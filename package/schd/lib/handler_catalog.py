"""Read extension handler configs and plan schd_tools catalog changes.

Each extension owns ``handlers_config.json`` and its handlers' ``describe()``.
This module only reads those files and turns them into catalog rows. It does
not import extension packages and it does not write anything extensions own.
"""

from __future__ import annotations

import importlib.metadata
import importlib.util
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Optional


RING = "schd_tools"
CATALOG_FIELDS = ("name", "key", "goal", "init", "input", "output", "handler", "instructions", "execution")
COMPARED_FIELDS = ("name", "goal", "input", "output", "handler", "instructions", "execution")


@dataclass(frozen=True)
class HandlerRef:
    extension: str
    name: str
    dotted: str
    package_dir: str

    @property
    def route(self) -> str:
        return f"{self.extension}/{self.name}"


@dataclass
class Discovery:
    handlers: list[HandlerRef] = field(default_factory=list)
    live_handlers: dict[str, set[str]] = field(default_factory=dict)
    protected_extensions: set[str] = field(default_factory=set)
    errors: list[dict[str, str]] = field(default_factory=list)
    loaded_extensions: int = 0
    workspace_scanned: bool = False


def workspace_root_from(start: Path) -> Optional[Path]:
    """Walk parents until a directory contains both ``extensions/`` and ``dev/``."""
    current = start.resolve()
    if current.is_file():
        current = current.parent
    for parent in (current, *current.parents):
        if (parent / "extensions").is_dir() and (parent / "dev").is_dir():
            return parent
    return None


def parse_handler_route(value: Any) -> Optional[tuple[str, str]]:
    """Return ``(extension, handler)`` for an ``ext/handler[/sub…]`` route."""
    text = _exact_route(value)
    if text is None:
        return None
    extension, handler, *_rest = text.split("/")
    return extension, handler


def _exact_route(value: Any) -> Optional[str]:
    text = str(value or "").strip().strip("/")
    parts = [part for part in text.split("/") if part]
    if len(parts) < 2:
        return None
    return "/".join(parts)


def discover_handler_configs(
    workspace: Optional[Path] = None,
    *,
    include_installed: bool = True,
) -> Discovery:
    """Load every extension ``handlers_config.json`` the process can see.

    Workspace checkouts win over an installed copy of the same handle.
    A file that cannot be parsed protects that extension from deletion.
    """
    if workspace is not None:
        workspace = Path(workspace)
    paths: list[Path] = []
    seen_paths: set[Path] = set()

    def add(path: Path) -> None:
        try:
            resolved = path.resolve()
        except OSError:
            return
        if resolved in seen_paths or not resolved.is_file():
            return
        seen_paths.add(resolved)
        paths.append(resolved)

    if workspace is not None:
        extensions = workspace / "extensions"
        if extensions.is_dir():
            for child in sorted(extensions.iterdir()):
                if child.is_dir():
                    add(child / "package" / "handlers_config.json")

    if include_installed:
        for path in _installed_config_paths():
            add(path)

    discovery = Discovery(
        workspace_scanned=workspace is not None and (workspace / "extensions").is_dir()
    )
    seen_handles: set[str] = set()
    for path in paths:
        handle_hint = _handle_hint(path)
        loaded = _load_config(path, handle_hint)
        if loaded is None:
            if handle_hint:
                discovery.protected_extensions.add(handle_hint)
            discovery.errors.append(
                {"path": str(path), "message": "handlers_config.json could not be read"}
            )
            continue
        handle, handlers, withheld, problems = loaded
        if handle in seen_handles:
            continue
        seen_handles.add(handle)
        discovery.loaded_extensions += 1
        live = discovery.live_handlers.setdefault(handle, set())
        # Withheld names stay live so a bad class path does not drop an existing row.
        live.update(withheld)
        for problem in problems:
            discovery.errors.append({"path": str(path), "extension": handle, "message": problem})
        for name, dotted in handlers.items():
            live.add(name)
            discovery.handlers.append(
                HandlerRef(
                    extension=handle,
                    name=name,
                    dotted=dotted,
                    package_dir=str(path.parent),
                )
            )
    return discovery


def fields_from_describe(extension: str, handler: str, described: Any) -> dict[str, str]:
    """Map a handler ``describe()`` result onto ``schd_tools`` string fields."""
    body = _describe_body(described)
    if body.get("success") is False:
        message = body.get("message") or body.get("error") or "describe failed"
        raise ValueError(str(message))

    route = f"{extension}/{handler}"
    title = _text(body, "title", "name") or _humanize(handler)
    description = _text(body, "description", "goal") or route
    goal = _text(body, "goal", "description") or description
    instructions = _text(body, "instructions") or description
    input_schema = body.get("input_schema", body.get("input"))
    output_schema = body.get("output_schema", body.get("output"))
    from schd.lib.execution import normalize_execution

    execution = normalize_execution(body.get("execution"))
    return {
        "name": title,
        "key": route,
        "goal": goal,
        "init": "_",
        "input": _schema_text(
            input_schema,
            fallback={"type": "object", "additionalProperties": True},
        ),
        "output": _schema_text(output_schema, fallback={"type": "object"}),
        "handler": route,
        "instructions": instructions,
        "execution": json.dumps(execution, ensure_ascii=False, sort_keys=True),
    }


def undescribed_fields(extension: str, handler: str) -> dict[str, str]:
    """Catalog row when the handler class has no ``describe`` method."""
    return fields_from_describe(
        extension,
        handler,
        {
            "described": False,
            "handler": handler,
            "title": _humanize(handler),
            "description": f"{extension}/{handler}",
            "input_schema": {"type": "object", "additionalProperties": True},
            "output_schema": {"type": "object"},
        },
    )


def diff_catalog(
    desired: dict[str, dict[str, str]],
    live_handlers: dict[str, set[str]],
    existing: Iterable[dict[str, Any]],
    protected_extensions: Optional[set[str]] = None,
    *,
    allow_extension_removal: bool = True,
) -> dict[str, list]:
    """Plan creates, in-place updates, and deletions. Safe to apply repeatedly.

    Documents whose ``handler`` is not an ``ext/handler`` route are left alone.
    A handler removed from a config we loaded drops its rows. A missing
    extension drops its rows only when ``allow_extension_removal`` is set,
    which is the workspace checkout scan. Extra rows that share one exact
    handler route collapse to a single row.
    """
    protected = protected_extensions or set()
    rows = [dict(row) for row in existing if isinstance(row, dict)]
    by_route: dict[str, list[dict[str, Any]]] = {}
    for row in rows:
        exact = _exact_route(row.get("handler"))
        if exact is None:
            continue
        by_route.setdefault(exact, []).append(row)

    creates: list[dict[str, str]] = []
    updates: list[dict[str, Any]] = []
    deletes: list[dict[str, str]] = []
    unchanged: list[str] = []
    used: set[str] = set()

    for route in sorted(desired):
        fields = desired[route]
        matches = by_route.get(route) or []
        if matches:
            keeper = matches[0]
            extras = matches[1:]
        else:
            keeper = _adoptable_by_key(rows, route, used)
            extras = []
        keeper_id = str((keeper or {}).get("_id") or "").strip()
        if keeper is None or not keeper_id:
            creates.append(dict(fields))
            continue
        used.add(keeper_id)
        patch = _patch(keeper, fields)
        if patch:
            updates.append({"_id": keeper_id, "route": route, "fields": patch})
        else:
            unchanged.append(route)
        for extra in extras:
            extra_id = str(extra.get("_id") or "").strip()
            if not extra_id or extra_id in used:
                continue
            used.add(extra_id)
            deletes.append(
                {
                    "_id": extra_id,
                    "route": route,
                    "key": str(extra.get("key") or ""),
                    "reason": "duplicate",
                }
            )

    for row in rows:
        row_id = str(row.get("_id") or "").strip()
        if not row_id or row_id in used:
            continue
        parsed = parse_handler_route(row.get("handler"))
        if parsed is None:
            continue
        extension, handler = parsed
        if extension in protected:
            continue
        if extension not in live_handlers:
            if not allow_extension_removal:
                continue
            reason = "extension_removed"
        elif handler not in live_handlers[extension]:
            reason = "handler_removed"
        else:
            continue
        used.add(row_id)
        deletes.append(
            {
                "_id": row_id,
                "route": f"{extension}/{handler}",
                "key": str(row.get("key") or ""),
                "reason": reason,
            }
        )

    return {
        "create": creates,
        "update": updates,
        "delete": deletes,
        "unchanged": unchanged,
    }


def _adoptable_by_key(
    rows: list[dict[str, Any]],
    route: str,
    used: set[str],
) -> Optional[dict[str, Any]]:
    """Reuse a row whose key is the route but whose handler was never set."""
    for row in rows:
        row_id = str(row.get("_id") or "").strip()
        if row_id and row_id in used:
            continue
        if str(row.get("key") or "").strip() != route:
            continue
        if parse_handler_route(row.get("handler")) is not None:
            continue
        return row
    return None


def _patch(existing: dict[str, Any], desired: dict[str, str]) -> dict[str, str]:
    patch: dict[str, str] = {}
    for name in COMPARED_FIELDS:
        if _canonical(existing.get(name)) != _canonical(desired.get(name)):
            patch[name] = desired[name]
    existing_key = str(existing.get("key") or "").strip()
    if existing_key in ("", "_") and existing_key != desired.get("key"):
        patch["key"] = desired["key"]
    return patch


def _canonical(value: Any) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    text = str(value or "").strip()
    if not text or text == "_":
        return text
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        return text
    if isinstance(parsed, (dict, list)):
        return json.dumps(parsed, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return text


def _schema_text(value: Any, *, fallback: dict[str, Any]) -> str:
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    if isinstance(value, str):
        text = value.strip()
        if not text or text == "_":
            return json.dumps(fallback, ensure_ascii=False, sort_keys=True)
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return text
        if isinstance(parsed, (dict, list)):
            return json.dumps(parsed, ensure_ascii=False, sort_keys=True)
        return text
    return json.dumps(fallback, ensure_ascii=False, sort_keys=True)


def _describe_body(described: Any) -> dict[str, Any]:
    if not isinstance(described, dict):
        raise ValueError("describe() did not return an object")
    output = described.get("output")
    if isinstance(output, dict) and any(
        key in output for key in ("input_schema", "output_schema", "title", "described", "description")
    ):
        if described.get("success") is False:
            return described
        return output
    return described


def _text(body: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = body.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _humanize(handler: str) -> str:
    words = handler.replace("_", " ").strip()
    return words.title() if words else handler


def _handle_hint(path: Path) -> str:
    marker = path.parent / "extension_handle"
    if marker.is_file():
        try:
            marked = marker.read_text(encoding="utf-8").strip().lower()
        except OSError:
            marked = ""
        if marked:
            return marked
    if path.parent.name == "package":
        return path.parent.parent.name.strip().lower()
    return path.parent.name.strip().lower()


def _load_config(
    path: Path,
    handle_hint: str,
) -> Optional[tuple[str, dict[str, str], set[str], list[str]]]:
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(raw, dict) or not isinstance(raw.get("handlers"), dict):
        return None
    prefixes: list[str] = []
    handlers: dict[str, str] = {}
    withheld: set[str] = set()
    problems: list[str] = []
    for name, dotted in raw["handlers"].items():
        handler_name = str(name or "").strip()
        if not handler_name:
            continue
        if not isinstance(dotted, str) or "." not in dotted.strip():
            withheld.add(handler_name)
            problems.append(f"{handler_name}: dotted class path is missing")
            continue
        class_path = dotted.strip()
        handlers[handler_name] = class_path
        prefixes.append(class_path.split(".", 1)[0].strip().lower())
    unique = {prefix for prefix in prefixes if prefix}
    if len(unique) == 1:
        handle = unique.pop()
    else:
        handle = handle_hint
    if not handle:
        return None
    return handle, handlers, withheld, problems


def _installed_config_paths() -> Iterable[Path]:
    yield from _paths_from_distributions()
    yield from _paths_beside_installed_packages()


def _paths_from_distributions() -> Iterable[Path]:
    try:
        distributions = list(importlib.metadata.distributions())
    except Exception:
        return
    for dist in distributions:
        files = getattr(dist, "files", None)
        if not files:
            continue
        for file in files:
            if Path(str(file)).name != "handlers_config.json":
                continue
            try:
                located = Path(str(dist.locate_file(file)))
            except (OSError, TypeError, ValueError):
                continue
            if located.is_file():
                yield located


def _paths_beside_installed_packages() -> Iterable[Path]:
    try:
        packages = importlib.metadata.packages_distributions()
    except Exception:
        return
    for package in packages:
        if not package or "." in package or package.startswith("_"):
            continue
        try:
            spec = importlib.util.find_spec(package)
        except (ImportError, ModuleNotFoundError, ValueError):
            continue
        origin = getattr(spec, "origin", None) if spec is not None else None
        if not origin or not str(origin).endswith(".py"):
            continue
        package_dir = Path(origin).resolve().parent
        if not (package_dir / "handlers").is_dir():
            continue
        for candidate in (
            package_dir / "handlers_config.json",
            package_dir.parent / "handlers_config.json",
        ):
            if candidate.is_file():
                yield candidate
