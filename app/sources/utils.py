from __future__ import annotations

import html
import re
from datetime import datetime, timezone
from typing import Any


def clean_html(value: str | None) -> str:
    if not value:
        return ""
    text = re.sub(r"<script.*?</script>|<style.*?</style>", " ", str(value), flags=re.I | re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def parse_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    s = str(value).strip()
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except Exception:
        return None


def deep_lists(payload: Any):
    if isinstance(payload, list):
        yield payload
        for item in payload:
            yield from deep_lists(item)
    elif isinstance(payload, dict):
        for value in payload.values():
            yield from deep_lists(value)
