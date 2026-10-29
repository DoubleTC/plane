# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Fit Plane's official MCP tool catalogue to what a BananaZ (Community Edition) API serves.

plane-mcp-server targets Plane Cloud / Commercial Edition. Against BananaZ some resources
have no API at all (pages, milestones, work item types, ...), some actions call endpoints
that do not exist (workspace-wide work item listing, feature flags, roles, ...), and PQL
filtering is rejected. This module:

- registers only the resources BananaZ can serve;
- narrows partially supported tools to the actions that work, hiding the parameters only
  the removed actions used, and rebuilds their descriptions to match;
- keeps legacy tool names only when they point at something that still exists;
- patches an SDK model that rejects data the BananaZ API returns.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import replace
from types import ModuleType
from typing import Literal

from fastmcp import FastMCP
from fastmcp.server.middleware import MiddlewareContext
from fastmcp.server.transforms import GetToolNext, Transform
from fastmcp.tools.base import Tool, ToolResult
from fastmcp.tools.tool_transform import ArgTransform
from plane.api.work_items import activities as sdk_activities
from plane.models import work_items as sdk_work_items
from plane_mcp.middleware import ValidateActionArguments
from plane_mcp.pql_reference import PQL_FIELD_HINT
from plane_mcp.toolkit import Action, StripOutputSchemas, build_description
from plane_mcp.tools.legacy import LegacyNames
from plane_mcp.tools.registry import RESOURCES, alias_table

# Resources whose endpoints do not exist on BananaZ (Commercial Edition features), plus
# work item relations (the SDK calls the commercial dependencies/custom-relations API) and
# the PQL reference (PQL filtering is rejected by the Community Edition API).
UNSUPPORTED_RESOURCES = frozenset(
    {
        "collection",
        "customer",
        "customer_property",
        "customer_request",
        "get_pql_reference",
        "initiative",
        "milestone",
        "page",
        "release",
        "release_label",
        "release_tag",
        "template",
        "work_log",
        "workitem_property",
        "workitem_relation",
        "workitem_type",
    }
)

# Partially supported resources: the actions that work on BananaZ.
SUPPORTED_ACTIONS: dict[str, tuple[str, ...]] = {
    # No workspace-wide count / archived listing / archive endpoints for work items.
    "workitem": (
        "list",
        "retrieve",
        "retrieve_by_identifier",
        "search",
        "create",
        "update",
        "delete",
        "manage_assignee",
        "manage_label",
    ),
    # No feature flags or worklog summary endpoints.
    "project": ("list", "retrieve", "create", "update", "delete", "archive", "unarchive"),
    "workspace": ("retrieve",),
    # No custom roles.
    "member": ("me", "list_workspace", "list_project"),
    # read/download_url return presigned URLs built for the internal API host, so they are
    # unusable outside the server; upload_from_url makes the server fetch arbitrary URLs
    # (slow-server thread exhaustion, and an exfiltration channel for prompt injection).
    "workitem_attachment": ("list", "delete"),
}

# Parameters hidden everywhere: PQL is rejected by the Community Edition API, and work item
# types (type_id) are a Commercial Edition feature.
HIDDEN_PARAMETERS = frozenset({"pql", "type_id"})

# Arguments an action needs on BananaZ although upstream treats them as optional.
REQUIRED_ON_BANANAZ: dict[tuple[str, str], tuple[str, ...]] = {
    # Without project_id upstream lists work items workspace-wide, which BananaZ cannot serve.
    ("workitem", "list"): ("project_id",),
}

# Upstream action notes that are wrong on BananaZ.
ACTION_NOTES: dict[tuple[str, str], str] = {
    ("workitem", "list"): "lists one project; use search to find work items across the workspace",
}

BANANAZ_FOOTER_NOTES: dict[str, str] = {
    "workitem": (
        "On BananaZ, list needs project_id (there is no workspace-wide listing); use search to find "
        "work items across the workspace. Filter results yourself: PQL is not available."
    ),
    "cycle": "PQL is not available on BananaZ: filter list_workitems results yourself.",
    "module": "PQL is not available on BananaZ: filter list_workitems results yourself.",
}


def resource_name(module: ModuleType) -> str:
    return module.NAME


def supported_resources() -> tuple[ModuleType, ...]:
    return tuple(module for module in RESOURCES if resource_name(module) not in UNSUPPORTED_RESOURCES)


def is_supported(tool: str, action: str | None = None) -> bool:
    if tool in UNSUPPORTED_RESOURCES:
        return False
    allowed = SUPPORTED_ACTIONS.get(tool)
    return allowed is None or action is None or action in allowed


def supported_aliases() -> dict[str, tuple[str, str]]:
    """Legacy tool names that still resolve to a supported tool and action."""
    return {alias: target for alias, target in alias_table().items() if is_supported(*target)}


def patch_sdk_models() -> None:
    """Accept fractional activity epochs.

    BananaZ (like Plane CE) stores IssueActivity.epoch as a float, but plane-sdk declares
    it as int, so every activity listing failed validation. The SDK module looks these
    names up at call time, so rebinding them is enough.
    """
    if getattr(sdk_activities, "_bananaz_patched", False):
        return

    class WorkItemActivity(sdk_work_items.WorkItemActivity):
        epoch: float | None = None

    class PaginatedWorkItemActivityResponse(sdk_work_items.PaginatedWorkItemActivityResponse):
        results: list[WorkItemActivity]

    sdk_activities.WorkItemActivity = WorkItemActivity
    sdk_activities.PaginatedWorkItemActivityResponse = PaginatedWorkItemActivityResponse
    sdk_activities._bananaz_patched = True


def _scope_for(module: ModuleType) -> tuple[tuple[str, ...], frozenset[str]] | None:
    """(allowed actions, visible parameters) for a tool that needs narrowing, else None."""
    actions = module.ACTIONS
    allowed = SUPPORTED_ACTIONS.get(resource_name(module), tuple(action.name for action in actions))
    declared = {name for action in actions for name in (*action.requires, *action.optional)}
    visible = {
        name for action in actions if action.name in allowed for name in (*action.requires, *action.optional)
    } - HIDDEN_PARAMETERS
    if len(allowed) == len(actions) and visible == declared:
        return None
    return allowed, frozenset(visible)


def _scoped_action(tool: str, action: Action, visible: frozenset[str]) -> Action:
    required = REQUIRED_ON_BANANAZ.get((tool, action.name), ())
    return replace(
        action,
        requires=tuple(dict.fromkeys((*action.requires, *required))),
        optional=tuple(p for p in action.optional if p in visible and p not in required),
        note=ACTION_NOTES.get((tool, action.name), action.note),
    )


def _scoped_description(tool: Tool, module: ModuleType, allowed: tuple[str, ...], visible: frozenset[str]) -> str:
    summary = (tool.description or "").split("\n\nActions:")[0]
    removed = {action.name for action in module.ACTIONS} - set(allowed)
    actions = tuple(_scoped_action(module.NAME, action, visible) for action in module.ACTIONS if action.name in allowed)
    footer_lines = [
        line
        for line in getattr(module, "FOOTER", "").replace(PQL_FIELD_HINT, "").split("\n")
        if line.strip() and line.split(" ", 1)[0] not in removed
    ]
    if note := BANANAZ_FOOTER_NOTES.get(module.NAME):
        footer_lines.append(note)
    return build_description(summary, actions, "\n".join(footer_lines))


class CommunityEditionScope(Transform):
    """Narrow partially supported tools to the actions and parameters BananaZ serves."""

    def __init__(self) -> None:
        self._modules = {resource_name(module): module for module in supported_resources()}
        # One entry per narrowed tool. Registered before StripOutputSchemas, this transform
        # sees the server's registered Tool objects, which do not change at runtime.
        self._cache: dict[str, Tool] = {}

    def scope(self, tool: Tool) -> Tool:
        module = self._modules.get(tool.name)
        scope = _scope_for(module) if module else None
        if scope is None:
            return tool
        key = tool.name
        if key not in self._cache:
            allowed, visible = scope
            properties = (tool.parameters or {}).get("properties", {})
            transform_args = {
                name: ArgTransform(hide=True) for name in properties if name != "action" and name not in visible
            }
            if "action" in properties:
                # A single remaining action is pinned and hidden: FastMCP would otherwise merge a
                # one-value Literal into the original enum and advertise a contradictory schema.
                transform_args["action"] = (
                    ArgTransform(hide=True, default=allowed[0])
                    if len(allowed) == 1
                    else ArgTransform(type=Literal[allowed])
                )
            self._cache[key] = Tool.from_tool(
                tool,
                description=_scoped_description(tool, module, allowed, visible),
                transform_args=transform_args,
            )
        return self._cache[key]

    async def list_tools(self, tools: Sequence[Tool]) -> Sequence[Tool]:
        return [self.scope(tool) for tool in tools]

    async def get_tool(self, name: str, call_next: GetToolNext, *, version=None) -> Tool | None:
        tool = await call_next(name, version=version)
        return self.scope(tool) if tool is not None else None


class BananaZValidateActionArguments(ValidateActionArguments):
    """Upstream argument validation, aware of BananaZ's tool surface.

    Knows the extra tools (phase), drops removed tools and actions, and enforces arguments
    BananaZ requires where upstream treats them as optional.
    """

    def __init__(self, extra_tools: dict[str, dict[str, frozenset[str]]] | None = None) -> None:
        super().__init__()
        accepted = {
            tool: {action: args for action, args in by_action.items() if is_supported(tool, action)}
            for tool, by_action in self._accepted.items()
            if tool not in UNSUPPORTED_RESOURCES
        }
        accepted.update(extra_tools or {})
        self._accepted = accepted
        self._aliases = supported_aliases()

    def bananaz_rejection(self, name: str, arguments: dict) -> str | None:
        # Legacy names call a tool with its action pinned; check what they resolve to.
        tool, action = self._aliases.get(name, (name, arguments.get("action")))
        by_action = self._accepted.get(tool)
        # Upstream leaves an action it does not list alone, and the narrowed schema is only
        # advertised (FastMCP does not re-validate enum values), so removed actions are
        # refused here.
        if by_action is not None and action is not None and action not in by_action:
            return f"Error: action '{action}' is not available on BananaZ. Available: {', '.join(by_action)}."
        required = REQUIRED_ON_BANANAZ.get((tool, action), ())
        if absent := [arg for arg in required if not arguments.get(arg)]:
            return f"Error: action '{action}' requires: {', '.join(absent)}."
        return None

    async def on_call_tool(self, context: MiddlewareContext, call_next):
        arguments = getattr(context.message, "arguments", None)
        if isinstance(arguments, dict) and (message := self.bananaz_rejection(context.message.name, arguments)):
            return ToolResult(content=message)
        return await super().on_call_tool(context, call_next)


def register_supported_tools(mcp: FastMCP, extra: Sequence[ModuleType] = ()) -> None:
    """BananaZ counterpart of plane_mcp.tools.register_tools."""
    for module in (*supported_resources(), *extra):
        module.register(mcp)
    # Scope first: it must see the registered tools, not StripOutputSchemas' per-call copies.
    mcp.add_transform(CommunityEditionScope())
    mcp.add_transform(StripOutputSchemas())
    mcp.add_transform(LegacyNames(supported_aliases()))


__all__ = [
    "BananaZValidateActionArguments",
    "CommunityEditionScope",
    "HIDDEN_PARAMETERS",
    "SUPPORTED_ACTIONS",
    "UNSUPPORTED_RESOURCES",
    "patch_sdk_models",
    "register_supported_tools",
    "supported_aliases",
    "supported_resources",
]
