# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Argument guards applied to every tool call before it reaches the BananaZ API."""

from __future__ import annotations

import re
import uuid
from typing import Any

from fastmcp.server.middleware import Middleware, MiddlewareContext
from fastmcp.tools.base import ToolResult
from plane_mcp.toolkit import coerce_list

# Arguments ending in _id / _ids are interpolated into API URL paths by the tools. Anything
# but a UUID there (e.g. "..") is resolved by the HTTP client as a path segment and can
# retarget the call: `phase delete phase_id=".."` would delete the whole project. A prompt
# injection in work item text could exploit that, so ids are checked for every tool.
ID_ARGUMENT = re.compile(r"(^|_)ids?$")
# Free-form identifiers from external systems, never used in paths.
FREE_FORM_ARGUMENTS = frozenset({"external_id"})
# PROJECT-123, as used by `workitem retrieve_by_identifier`.
WORKITEM_IDENTIFIER = re.compile(r"^[A-Za-z0-9]{1,12}-\d{1,9}$")


def _is_uuid(value: Any) -> bool:
    try:
        uuid.UUID(str(value))
    except ValueError:
        return False
    return True


def _shown(value: Any) -> str:
    text = str(value)
    return text if len(text) <= 40 else text[:37] + "..."


def identifier_error(arguments: dict[str, Any]) -> str | None:
    """The error for the first malformed identifier argument, or None when all are valid."""
    for name, value in arguments.items():
        if value in (None, "", []):
            continue
        if name == "workitem_identifier":
            if not WORKITEM_IDENTIFIER.match(str(value)):
                return f"Error: workitem_identifier must look like PROJECT-123, got {_shown(value)!r}."
            continue
        if name in FREE_FORM_ARGUMENTS or not ID_ARGUMENT.search(name):
            continue
        values = coerce_list(value) if isinstance(value, (str, list)) else [value]
        for item in values or []:
            if not _is_uuid(item):
                return f"Error: {name} must be a UUID, got {_shown(item)!r}."
    return None


class ValidateIdentifiers(Middleware):
    """Refuse tool calls whose id arguments are not UUIDs (see ID_ARGUMENT)."""

    async def on_call_tool(self, context: MiddlewareContext, call_next):
        arguments = getattr(context.message, "arguments", None)
        if isinstance(arguments, dict) and (message := identifier_error(arguments)):
            return ToolResult(content=message)
        return await call_next(context)
