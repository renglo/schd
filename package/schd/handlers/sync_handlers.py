"""Rebuild the schd_tools catalog from each extension's own handlers.

Schd is one tool-catalog implementation. Extensions keep their handlers and
``handlers_config.json`` and do not import schd. This handler reads those
files, calls each handler's ``describe()``, and upserts ``schd_tools`` rows.
Run it whenever extensions are added or removed; a second run with the same
code and catalog writes nothing.
"""

from __future__ import annotations

import importlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from renglo.auth.auth_controller import AuthController
from renglo.common import load_config
from renglo.data.data_controller import DataController
from renglo.logger import get_logger

from ..lib.handler_catalog import (
    RING,
    discover_handler_configs,
    diff_catalog,
    fields_from_describe,
    undescribed_fields,
    workspace_root_from,
)


class SyncHandlers:
    CONFIG_RING = "schd_config"
    SINGLETON_ID = "00000000-0000-0000-0000-000000000000"

    def __init__(self) -> None:
        config = load_config()
        self.config = config
        self.DAC = DataController(config=config)
        self.logger = get_logger()

    def describe(self, payload: Any = None) -> dict[str, Any]:
        return {
            "success": True,
            "action": "describe",
            "output": {
                "described": True,
                "handler": "sync_handlers",
                "title": "Sync handler catalog",
                "description": (
                    "Read every extension handlers_config.json, call each handler describe(), "
                    "and upsert schd_tools. Removes rows whose extension or handler is gone. "
                    "portfolio is injected by the platform. org defaults to the portfolio-scoped catalog."
                ),
                "input_schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "portfolio": {
                            "type": "string",
                            "title": "Portfolio",
                            "description": "Portfolio that owns the schd_tools ring.",
                        },
                        "org": {
                            "type": "string",
                            "title": "Org",
                            "description": "Catalog org. Defaults to _all.",
                            "default": AuthController.PORTFOLIO_SCOPE_ORG,
                        },
                    },
                },
                "output_schema": {
                    "type": "object",
                    "properties": {
                        "created": {"type": "array", "items": {"type": "string"}},
                        "updated": {"type": "array", "items": {"type": "string"}},
                        "deleted": {"type": "array", "items": {"type": "object"}},
                        "unchanged": {"type": "integer"},
                        "mapped": {"type": "integer"},
                        "synced_at": {"type": "string"},
                        "skipped": {"type": "array", "items": {"type": "object"}},
                    },
                },
            },
        }

    def run(self, payload: Any) -> dict[str, Any]:
        payload = payload if isinstance(payload, dict) else {}
        portfolio = str(payload.get("portfolio") or "").strip()
        org = str(payload.get("org") or "").strip() or AuthController.PORTFOLIO_SCOPE_ORG
        if not portfolio:
            return {
                "success": False,
                "action": "sync_handlers",
                "message": "portfolio is required",
                "input": payload,
            }

        discovery = discover_handler_configs(workspace_root_from(Path(__file__)))
        if discovery.loaded_extensions == 0:
            return {
                "success": False,
                "action": "sync_handlers",
                "message": "No extension handlers_config.json files found; schd_tools was left unchanged",
                "input": {"portfolio": portfolio, "org": org},
                "output": {"errors": discovery.errors},
            }

        desired, skipped = self._describe_handlers(
            discovery.handlers,
            {"portfolio": portfolio, "org": org},
        )
        try:
            existing = self._list_tools(portfolio, org)
        except RuntimeError as exc:
            return {
                "success": False,
                "action": "sync_handlers",
                "message": str(exc),
                "input": {"portfolio": portfolio, "org": org},
                "output": {"skipped": skipped, "errors": discovery.errors},
            }

        plan = diff_catalog(
            desired,
            discovery.live_handlers,
            existing,
            discovery.protected_extensions,
            allow_extension_removal=discovery.workspace_scanned,
        )
        created, updated, deleted, write_errors = self._apply(portfolio, org, plan)
        mapped = len(created) + len(updated) + len(plan["unchanged"])
        synced_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
        output = {
            "portfolio": portfolio,
            "org": org,
            "extensions": discovery.loaded_extensions,
            "handlers": len(discovery.handlers),
            "mapped": mapped,
            "synced_at": synced_at,
            "created": created,
            "updated": updated,
            "deleted": deleted,
            "unchanged": len(plan["unchanged"]),
            "skipped": skipped,
            "config_errors": discovery.errors,
            "errors": write_errors,
        }
        self._refresh_catalog_cache(portfolio, org)
        if not write_errors:
            self._remember_sync(
                portfolio,
                org,
                {
                    "synced_at": synced_at,
                    "extensions": discovery.loaded_extensions,
                    "found": len(discovery.handlers),
                    "mapped": mapped,
                    "created": len(created),
                    "updated": len(updated),
                    "deleted": len(deleted),
                    "unchanged": len(plan["unchanged"]),
                    "skipped": len(skipped),
                },
            )
        success = not write_errors
        message = (
            f"Synchronized {len(discovery.handlers)} handlers "
            f"({len(created)} created, {len(updated)} updated, "
            f"{len(deleted)} deleted, {len(plan['unchanged'])} unchanged)"
        )
        if write_errors:
            message = f"{message}; {len(write_errors)} writes failed"
        self.logger.info("sync_handlers %s org=%s %s", portfolio, org, message)
        return {
            "success": success,
            "action": "sync_handlers",
            "message": message,
            "input": {"portfolio": portfolio, "org": org},
            "output": output,
        }

    def _refresh_catalog_cache(self, portfolio: str, org: str) -> None:
        """Rebuild the list snapshot the tool menu reads when it is not paging Dynamo."""
        try:
            self.DAC.refresh_s3_cache(portfolio, org, RING, None)
        except Exception as exc:
            self.logger.warning("sync_handlers could not refresh schd_tools cache: %s", exc)

    def _remember_sync(self, portfolio: str, org: str, summary: dict[str, Any]) -> None:
        """Keep the last successful sync on the org config so the page can show it later."""
        try:
            existing = self.DAC.get_a_b_c(portfolio, org, self.CONFIG_RING, self.SINGLETON_ID)
            if (
                not isinstance(existing, dict)
                or existing.get("success") is False
                or not existing.get("_id")
            ):
                self.logger.info("sync_handlers: no schd_config document to store last sync")
                return
            response, _status = self.DAC.put_a_b_c(
                portfolio,
                org,
                self.CONFIG_RING,
                self.SINGLETON_ID,
                {"handler_sync": json.dumps(summary, ensure_ascii=False)},
            )
            if not _ok(response):
                self.logger.warning(
                    "sync_handlers could not store last sync: %s",
                    _error_message(response),
                )
        except Exception as exc:
            self.logger.warning("sync_handlers could not store last sync: %s", exc)

    def _describe_handlers(self, handlers, context: dict[str, str]):
        desired: dict[str, dict[str, str]] = {}
        skipped: list[dict[str, str]] = []
        for ref in handlers:
            try:
                desired[ref.route] = _describe_handler(
                    ref.dotted,
                    ref.extension,
                    ref.name,
                    context,
                    ref.package_dir,
                )
            except Exception as exc:
                self.logger.warning("sync_handlers skipped %s: %s", ref.route, exc)
                skipped.append({"route": ref.route, "message": str(exc)})
        return desired, skipped

    def _list_tools(self, portfolio: str, org: str) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        lastkey = None
        seen: set[str] = set()
        while True:
            page = self.DAC.get_a_b(portfolio, org, RING, limit=500, lastkey=lastkey)
            if not isinstance(page, dict) or not page.get("success"):
                message = ""
                if isinstance(page, dict):
                    message = str(page.get("message") or page.get("error") or "")
                raise RuntimeError(message or "Could not list schd_tools")
            items.extend(page.get("items") or [])
            last_id = page.get("last_id")
            if not last_id or last_id in seen or len(seen) > 100:
                break
            seen.add(str(last_id))
            lastkey = last_id
        return items

    def _apply(self, portfolio: str, org: str, plan: dict[str, list]):
        created: list[str] = []
        updated: list[str] = []
        deleted: list[dict[str, str]] = []
        errors: list[dict[str, str]] = []

        for fields in plan["create"]:
            route = str(fields.get("handler") or "")
            response, _status = self.DAC.post_a_b(portfolio, org, RING, dict(fields))
            if _ok(response):
                created.append(route)
            else:
                errors.append({"route": route, "action": "create", "message": _error_message(response)})

        for change in plan["update"]:
            route = str(change.get("route") or "")
            doc_id = str(change.get("_id") or "").strip()
            if not doc_id:
                errors.append({"route": route, "action": "update", "message": "missing _id"})
                continue
            response, _status = self.DAC.put_a_b_c(
                portfolio, org, RING, doc_id, dict(change.get("fields") or {})
            )
            if _ok(response):
                updated.append(route)
            else:
                errors.append({"route": route, "action": "update", "message": _error_message(response)})

        for change in plan["delete"]:
            route = str(change.get("route") or "")
            doc_id = str(change.get("_id") or "").strip()
            if not doc_id:
                errors.append({"route": route, "action": "delete", "message": "missing _id"})
                continue
            response, _status = self.DAC.delete_a_b_c(portfolio, org, RING, doc_id)
            if _ok(response):
                deleted.append(
                    {
                        "route": route,
                        "key": str(change.get("key") or ""),
                        "reason": str(change.get("reason") or ""),
                    }
                )
            else:
                errors.append({"route": route, "action": "delete", "message": _error_message(response)})

        return created, updated, deleted, errors


def _describe_handler(
    dotted: str,
    extension: str,
    handler: str,
    context: dict[str, str],
    package_dir: str = "",
) -> dict[str, str]:
    module_name, separator, class_name = dotted.rpartition(".")
    if not separator or not module_name or not class_name:
        raise ValueError(f"invalid handler path: {dotted}")
    _ensure_package_path(package_dir)
    module = importlib.import_module(module_name)
    cls = getattr(module, class_name)
    try:
        instance = cls()
    except TypeError:
        # Some handlers are constructed by an agent, not by the catalog.
        # Without an instance there is no describe() to call.
        if callable(getattr(cls, "describe", None)):
            raise
        return undescribed_fields(extension, handler)
    method = getattr(instance, "describe", None)
    if not callable(method):
        return undescribed_fields(extension, handler)
    return fields_from_describe(extension, handler, method(context))


def _ensure_package_path(package_dir: str) -> None:
    """Prefer the checkout that owns handlers_config.json over an older install."""
    if not package_dir:
        return
    path = str(Path(package_dir))
    if path in sys.path:
        return
    sys.path.insert(0, path)


def _ok(response: Any) -> bool:
    return isinstance(response, dict) and bool(response.get("success"))


def _error_message(response: Any) -> str:
    if isinstance(response, dict):
        return str(response.get("message") or response.get("error") or "write failed")
    return "write failed"
