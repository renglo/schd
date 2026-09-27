"""Catalog planning for sync_handlers. No Dynamo and no extension imports."""

from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path

PACKAGE = Path(__file__).resolve().parents[1]
if str(PACKAGE) not in sys.path:
    sys.path.insert(0, str(PACKAGE))

from schd.lib.handler_catalog import (  # noqa: E402
    diff_catalog,
    discover_handler_configs,
    fields_from_describe,
    undescribed_fields,
)


def _row(doc_id: str, **fields) -> dict:
    base = {
        "_id": doc_id,
        "name": "Tool",
        "key": "ext/tool",
        "goal": "Does a thing",
        "init": "_",
        "input": "{}",
        "output": "{}",
        "handler": "ext/tool",
        "instructions": "Does a thing",
    }
    base.update(fields)
    return base


class DiscoverTests(unittest.TestCase):
    def test_class_path_is_the_extension_handle(self) -> None:
        with self._workspace() as root:
            self._write(
                root,
                "my-local-clone",
                {"handlers": {"alpha": "widget.handlers.alpha.Alpha"}},
            )
            found = discover_handler_configs(root, include_installed=False)
        self.assertEqual(found.loaded_extensions, 1)
        self.assertEqual(found.handlers[0].extension, "widget")
        self.assertEqual(found.handlers[0].route, "widget/alpha")
        self.assertEqual(found.live_handlers["widget"], {"alpha"})

    def test_marker_used_when_class_prefixes_disagree(self) -> None:
        with self._workspace() as root:
            package = Path(root) / "extensions" / "mixed" / "package"
            package.mkdir(parents=True)
            (package / "extension_handle").write_text("widget\n", encoding="utf-8")
            (package / "handlers_config.json").write_text(
                json.dumps(
                    {
                        "handlers": {
                            "alpha": "one.handlers.alpha.Alpha",
                            "beta": "two.handlers.beta.Beta",
                        }
                    }
                ),
                encoding="utf-8",
            )
            found = discover_handler_configs(root, include_installed=False)
        self.assertEqual({ref.extension for ref in found.handlers}, {"widget"})

    def test_unreadable_config_is_protected(self) -> None:
        with self._workspace() as root:
            package = Path(root) / "extensions" / "broken" / "package"
            package.mkdir(parents=True)
            (package / "handlers_config.json").write_text("{", encoding="utf-8")
            found = discover_handler_configs(root, include_installed=False)
        self.assertEqual(found.loaded_extensions, 0)
        self.assertEqual(found.protected_extensions, {"broken"})
        self.assertTrue(found.errors)

    def test_bad_class_path_stays_live(self) -> None:
        with self._workspace() as root:
            self._write(
                root,
                "widget",
                {"handlers": {"alpha": "widget.handlers.alpha.Alpha", "beta": ""}},
            )
            found = discover_handler_configs(root, include_installed=False)
        self.assertEqual(found.live_handlers["widget"], {"alpha", "beta"})
        self.assertEqual([ref.name for ref in found.handlers], ["alpha"])

    def _workspace(self):
        return tempfile.TemporaryDirectory()

    def _write(self, root: str, folder: str, document: dict) -> None:
        package = Path(root) / "extensions" / folder / "package"
        package.mkdir(parents=True)
        (package / "handlers_config.json").write_text(
            json.dumps(document),
            encoding="utf-8",
        )


class DescribeMappingTests(unittest.TestCase):
    def test_wrapped_describe_becomes_tool_fields(self) -> None:
        fields = fields_from_describe(
            "gmail",
            "identities",
            {
                "success": True,
                "action": "describe",
                "output": {
                    "described": True,
                    "title": "Gmail identities",
                    "description": "List or unlink addresses.",
                    "input_schema": {
                        "type": "object",
                        "properties": {"action": {"type": "string"}},
                    },
                    "output_schema": {"type": "object"},
                },
            },
        )
        self.assertEqual(fields["name"], "Gmail identities")
        self.assertEqual(fields["key"], "gmail/identities")
        self.assertEqual(fields["handler"], "gmail/identities")
        self.assertEqual(fields["goal"], "List or unlink addresses.")
        parsed = json.loads(fields["input"])
        self.assertEqual(parsed["properties"]["action"]["type"], "string")
        self.assertEqual(json.loads(fields["output"]), {"type": "object"})

    def test_missing_describe_still_has_a_route(self) -> None:
        fields = undescribed_fields("schd", "check_weather")
        self.assertEqual(fields["handler"], "schd/check_weather")
        self.assertEqual(fields["name"], "Check Weather")
        self.assertIn("additionalProperties", json.loads(fields["input"]))


class DiffTests(unittest.TestCase):
    def test_creates_arrivals_and_is_idempotent(self) -> None:
        desired = {
            "gmail/identities": fields_from_describe(
                "gmail",
                "identities",
                {
                    "title": "Gmail identities",
                    "description": "List addresses.",
                    "input_schema": {"type": "object"},
                    "output_schema": {"type": "object"},
                },
            )
        }
        live = {"gmail": {"identities"}}
        first = diff_catalog(desired, live, [])
        self.assertEqual([row["handler"] for row in first["create"]], ["gmail/identities"])
        self.assertEqual(first["delete"], [])

        existing = [_row("doc-1", **desired["gmail/identities"])]
        second = diff_catalog(desired, live, existing)
        self.assertEqual(second["create"], [])
        self.assertEqual(second["update"], [])
        self.assertEqual(second["delete"], [])
        self.assertEqual(second["unchanged"], ["gmail/identities"])

    def test_updates_schema_without_replacing_the_key(self) -> None:
        desired = {
            "gmail/poll_inbox": fields_from_describe(
                "gmail",
                "poll_inbox",
                {
                    "title": "Poll inbox",
                    "description": "Poll the agent mailbox.",
                    "input_schema": {"type": "object", "properties": {"limit": {"type": "integer"}}},
                    "output_schema": {"type": "object"},
                },
            )
        }
        existing = [
            _row(
                "legacy",
                key="gmail_poll_inbox",
                handler="gmail/poll_inbox",
                name="Old",
                goal="Old goal",
                init='{"requires_approval": true}',
                input="{}",
                output="_",
                instructions="old",
            )
        ]
        plan = diff_catalog(desired, {"gmail": {"poll_inbox"}}, existing)
        self.assertEqual(plan["create"], [])
        self.assertEqual(len(plan["update"]), 1)
        patch = plan["update"][0]["fields"]
        self.assertNotIn("key", patch)
        self.assertNotIn("init", patch)
        self.assertNotIn("handler", patch)
        self.assertIn("limit", json.loads(patch["input"])["properties"])

    def test_removes_extensions_and_handlers_that_left(self) -> None:
        existing = [
            _row("keep", handler="gmail/identities", key="gmail/identities"),
            _row("sub", handler="gmail/identities/list", key="custom-sub"),
            _row("gone-handler", handler="gmail/old_report", key="gmail_old_report"),
            _row("gone-ext", handler="retired/export", key="retired/export"),
            _row("custom", handler="_", key="my_private_tool"),
        ]
        plan = diff_catalog(
            {
                "gmail/identities": fields_from_describe(
                    "gmail",
                    "identities",
                    {"title": "Gmail identities", "description": "List addresses."},
                )
            },
            {"gmail": {"identities"}},
            existing,
        )
        reasons = {row["_id"]: row["reason"] for row in plan["delete"]}
        self.assertNotIn("keep", reasons)
        self.assertNotIn("sub", reasons)
        self.assertNotIn("custom", reasons)
        self.assertEqual(reasons["gone-handler"], "handler_removed")
        self.assertEqual(reasons["gone-ext"], "extension_removed")

    def test_collapses_duplicate_routes(self) -> None:
        fields = undescribed_fields("schd", "check_weather")
        existing = [
            _row("first", **fields),
            _row("second", **fields),
        ]
        plan = diff_catalog({"schd/check_weather": fields}, {"schd": {"check_weather"}}, existing)
        self.assertEqual(plan["update"], [])
        self.assertEqual(plan["unchanged"], ["schd/check_weather"])
        self.assertEqual(plan["delete"], [
            {"_id": "second", "route": "schd/check_weather", "key": fields["key"], "reason": "duplicate"}
        ])

    def test_partial_scan_does_not_drop_unseen_extensions(self) -> None:
        existing = [_row("other", handler="gmail/identities", key="gmail/identities")]
        plan = diff_catalog(
            {},
            {"schd": {"sync_handlers"}},
            existing,
            allow_extension_removal=False,
        )
        self.assertEqual(plan["delete"], [])

    def test_protected_extension_is_not_deleted(self) -> None:
        existing = [_row("broken-1", handler="broken/alpha", key="broken/alpha")]
        plan = diff_catalog({}, {}, existing, protected_extensions={"broken"})
        self.assertEqual(plan["delete"], [])


if __name__ == "__main__":
    unittest.main()
