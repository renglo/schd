"""Normalize handler ``describe().execution`` for the tool catalog and Dumbo."""

from __future__ import annotations

from typing import Any

ASYNC_HIGH_MS = 25000


def normalize_execution(raw: Any) -> dict[str, Any]:
    """Return the latency rows. The matched row's ``high`` decides the call.

    A declared ``mode`` is ignored. A call leaves the hub only when the
    row that matches its arguments has a ``high`` above 25000 ms and a
    peer owns the extension.
    """
    if isinstance(raw, str):
        text = raw.strip()
        if text in ("", "_"):
            raw = {}
        else:
            import json

            try:
                raw = json.loads(text)
            except json.JSONDecodeError:
                raw = {}
    if not isinstance(raw, dict):
        raw = {}

    rows: list[dict[str, Any]] = []
    incoming = raw.get("latency_ms")
    if isinstance(incoming, dict):
        incoming = [incoming]
    if isinstance(incoming, list):
        for item in incoming:
            if not isinstance(item, dict):
                continue
            row: dict[str, Any] = {"when": str(item.get("when") or "").strip()}
            predicates = _predicates(item.get("args"))
            if predicates:
                row["args"] = predicates
            for key in ("typical", "low", "high"):
                if key not in item or item.get(key) is None:
                    continue
                try:
                    row[key] = int(item[key])
                except (TypeError, ValueError):
                    continue
            rows.append(row)

    if not rows:
        return {}
    return {"latency_ms": rows}


def should_detach(execution: Any, on_peer: bool, arguments: Any = None) -> str:
    """``async`` when the matched row cannot finish inside the gateway and a peer owns the extension.

    A hub-placed handler stays in-process. A fast row stays in-process even
    when another row on the same handler is slow.
    """
    if not on_peer:
        return "sync"
    normalized = normalize_execution(execution)
    row = match_latency(normalized, arguments)
    high = row.get("high") if isinstance(row, dict) else None
    try:
        high_ms = int(high) if high is not None else None
    except (TypeError, ValueError):
        high_ms = None
    if high_ms is None:
        return "sync"
    return "async" if high_ms > ASYNC_HIGH_MS else "sync"


def _human_ms(value: Any) -> str:
    try:
        ms = int(value)
    except (TypeError, ValueError):
        return ""
    if ms < 1000:
        return f"{ms}ms"
    if ms < 90000:
        seconds = max(1, round(ms / 1000))
        return f"{seconds}s"
    minutes = max(1, round(ms / 60000))
    return f"{minutes}min"


def latency_sentence(execution: Any) -> str:
    """One line for the model, empty when the handler declared no timings."""
    normalized = normalize_execution(execution)
    parts: list[str] = []
    for row in normalized.get("latency_ms") or []:
        typical = _human_ms(row.get("typical"))
        if not typical:
            continue
        label = str(row.get("when") or "").strip() or "This call"
        low = _human_ms(row.get("low"))
        high = _human_ms(row.get("high"))
        if low and high:
            parts.append(f"{label}: typically {typical}, often {low} to {high}.")
        else:
            parts.append(f"{label}: typically {typical}.")
    return " ".join(parts)


def _predicates(raw: Any) -> dict[str, Any]:
    """Keep ``set``, ``empty``, an exact value, or a list of exact values."""
    if not isinstance(raw, dict):
        return {}
    out: dict[str, Any] = {}
    for key, expected in raw.items():
        name = str(key or "").strip()
        if not name:
            continue
        if isinstance(expected, list):
            values = [str(item).strip().lower() for item in expected if str(item).strip()]
            if values:
                out[name] = values
            continue
        state = str(expected or "").strip().lower()
        if state:
            out[name] = state
    return out


def _arg_state(value: Any) -> str:
    if value is None:
        return "empty"
    if isinstance(value, str) and not value.strip():
        return "empty"
    if isinstance(value, (list, dict)) and not value:
        return "empty"
    return "set"


def _as_text(value: Any) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return str(value).strip().lower()


def _row_matches(row: dict[str, Any], arguments: dict[str, Any]) -> bool:
    predicates = row.get("args")
    if not isinstance(predicates, dict) or not predicates:
        return False
    for key, expected in predicates.items():
        value = arguments.get(key)
        if expected == "set":
            if _arg_state(value) != "set":
                return False
        elif expected == "empty":
            if _arg_state(value) != "empty":
                return False
        elif isinstance(expected, list):
            if _as_text(value) not in expected:
                return False
        elif _as_text(value) != str(expected):
            return False
    return True


def match_latency(execution: Any, arguments: Any) -> dict[str, Any]:
    """Pick the latency row whose ``args`` match this call.

    ``when`` is the label shown to the model. It is not a matcher.
    The first matching row wins. A single row with no ``args`` is the
    default. When several rows declare predicates and none match, the
    slowest row is used so an unknown shape is not held on the gateway.
    """
    normalized = normalize_execution(execution)
    rows = [row for row in (normalized.get("latency_ms") or []) if isinstance(row, dict)]
    if not rows:
        return {}
    args = arguments if isinstance(arguments, dict) else {}
    for row in rows:
        if _row_matches(row, args):
            return row
    defaults = [row for row in rows if not row.get("args")]
    if len(defaults) == 1:
        return defaults[0]
    if len(rows) == 1:
        return rows[0]
    return max(rows, key=lambda row: int(row.get("high") or 0))
