# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Phases: BananaZ's grouping of a project's cycles into dated stages.

Backed by BananaZ's /api/v1 phase endpoints, which upstream Plane (and its SDK) do not have.
"""

from __future__ import annotations

from typing import Any, Literal

from fastmcp import FastMCP
from plane.api.base_resource import BaseResource
from plane.config import Configuration

from plane_mcp.client import get_plane_client_context
from plane_mcp.toolkit import Action, build_annotations, build_description, coerce_list, one_of, opt, require

NAME = "phase"
TITLE = "Phases"

STATUSES = ("backlog", "planned", "in-progress", "paused", "completed", "cancelled")

WRITABLE_FIELDS = ("name", "description", "status", "start_date", "end_date", "lead", "sort_order")

ACTIONS = (
    Action("list", ("project_id",), ("archived", "cursor", "per_page"), read=True),
    Action("retrieve", ("project_id", "phase_id"), read=True),
    Action("create", ("project_id", "name"), ("description", "status", "start_date", "end_date", "lead", "sort_order")),
    Action(
        "update",
        ("project_id", "phase_id"),
        ("name", "description", "status", "start_date", "end_date", "lead", "sort_order"),
        note="only the fields you pass are changed",
    ),
    Action("delete", ("project_id", "phase_id"), destructive=True, note="the linked cycles are kept"),
    Action("archive", ("project_id", "phase_id"), note="hides the phase from list unless archived=true"),
    Action("unarchive", ("project_id", "phase_id")),
    Action("list_cycles", ("project_id", "phase_id"), read=True),
    Action(
        "manage_cycles",
        ("project_id", "phase_id"),
        ("add_ids", "remove_ids"),
        note="pass at least one of add_ids or remove_ids (cycle ids of the same project); returns the linked cycles",
    ),
)

FOOTER = (
    "A phase groups cycles of one project into a dated stage and reports progress as "
    "completed_cycles / total_cycles (a cycle is completed when all of its work items are done). "
    "The project must have Phases enabled in its settings.\n"
    f"status: {', '.join(STATUSES)}. Dates are ISO 8601 (YYYY-MM-DD) and must not overlap another "
    "active phase of the project. lead is a project member id.\n"
    "To see the work items of a phase, call list_cycles, then `cycle list_workitems` for each cycle."
)


class Phases(BaseResource):
    """Client for BananaZ's /api/v1 phase endpoints."""

    def __init__(self, config: Configuration) -> None:
        super().__init__(config, "/workspaces/")

    @staticmethod
    def _path(workspace_slug: str, project_id: str, *parts: str) -> str:
        return "/".join((workspace_slug, "projects", project_id, "phases", *parts))

    def list(self, workspace_slug: str, project_id: str, params: dict[str, Any] | None = None) -> Any:
        return self._get(self._path(workspace_slug, project_id), params=params)

    def retrieve(self, workspace_slug: str, project_id: str, phase_id: str) -> Any:
        return self._get(self._path(workspace_slug, project_id, phase_id))

    def create(self, workspace_slug: str, project_id: str, data: dict[str, Any]) -> Any:
        return self._post(self._path(workspace_slug, project_id), data)

    def update(self, workspace_slug: str, project_id: str, phase_id: str, data: dict[str, Any]) -> Any:
        return self._patch(self._path(workspace_slug, project_id, phase_id), data)

    def delete(self, workspace_slug: str, project_id: str, phase_id: str) -> None:
        self._delete(self._path(workspace_slug, project_id, phase_id))

    def archive(self, workspace_slug: str, project_id: str, phase_id: str) -> Any:
        return self._post(self._path(workspace_slug, project_id, phase_id, "archive"))

    def unarchive(self, workspace_slug: str, project_id: str, phase_id: str) -> None:
        self._delete(self._path(workspace_slug, project_id, phase_id, "archive"))

    def list_cycles(self, workspace_slug: str, project_id: str, phase_id: str) -> Any:
        return self._get(self._path(workspace_slug, project_id, phase_id, "cycles"))

    def add_cycles(self, workspace_slug: str, project_id: str, phase_id: str, cycle_ids: list[str]) -> Any:
        return self._post(self._path(workspace_slug, project_id, phase_id, "cycles"), {"cycles": cycle_ids})

    def remove_cycle(self, workspace_slug: str, project_id: str, phase_id: str, cycle_id: str) -> None:
        self._delete(self._path(workspace_slug, project_id, phase_id, "cycles", cycle_id))


def accepted_arguments() -> dict[str, frozenset[str]]:
    """Action name -> the arguments that action accepts (for argument validation)."""
    return {action.name: frozenset(action.requires) | frozenset(action.optional) for action in ACTIONS}


def _payload(**fields: Any) -> dict[str, Any]:
    return {name: value for name, value in fields.items() if opt(value) is not None}


def register(mcp: FastMCP) -> None:
    @mcp.tool(
        name=NAME,
        description=build_description("Phases (dated stages that group cycles) in a project.", ACTIONS, FOOTER),
        annotations=build_annotations(TITLE, ACTIONS),
    )
    def phase(
        action: Literal[
            "list",
            "retrieve",
            "create",
            "update",
            "delete",
            "archive",
            "unarchive",
            "list_cycles",
            "manage_cycles",
        ],
        project_id: str = "",
        phase_id: str = "",
        name: str = "",
        description: str = "",
        status: str = "",
        start_date: str = "",
        end_date: str = "",
        lead: str = "",
        sort_order: float = 0,
        archived: bool = False,
        add_ids: str | list[str] = "",
        remove_ids: str | list[str] = "",
        cursor: str = "",
        per_page: int = 0,
    ) -> dict[str, Any] | list[Any] | str | None:
        if error := require(ACTIONS, action, project_id=project_id, phase_id=phase_id, name=name):
            return error
        if error := one_of("status", status, STATUSES):
            return error

        client, workspace_slug = get_plane_client_context()
        phases = Phases(client.config)
        fields = _payload(
            name=name,
            description=description,
            status=status,
            start_date=start_date,
            end_date=end_date,
            lead=lead,
            sort_order=sort_order,
        )

        if action == "list":
            params = _payload(cursor=cursor, per_page=per_page)
            if archived:
                params["archived"] = "true"
            return phases.list(workspace_slug, project_id, params=params or None)

        if action == "create":
            return phases.create(workspace_slug, project_id, fields)

        if action == "retrieve":
            return phases.retrieve(workspace_slug, project_id, phase_id)

        if action == "update":
            if not fields:
                return f"Error: action 'update' needs at least one of: {', '.join(WRITABLE_FIELDS)}."
            return phases.update(workspace_slug, project_id, phase_id, fields)

        if action == "delete":
            phases.delete(workspace_slug, project_id, phase_id)
            return None

        if action == "archive":
            return phases.archive(workspace_slug, project_id, phase_id)

        if action == "unarchive":
            phases.unarchive(workspace_slug, project_id, phase_id)
            return phases.retrieve(workspace_slug, project_id, phase_id)

        if action == "list_cycles":
            return phases.list_cycles(workspace_slug, project_id, phase_id)

        # manage_cycles
        add = coerce_list(add_ids)
        remove = coerce_list(remove_ids)
        if not add and not remove:
            return "Error: action 'manage_cycles' requires: add_ids or remove_ids."
        if add:
            phases.add_cycles(workspace_slug, project_id, phase_id, add)
        for cycle_id in remove or []:
            phases.remove_cycle(workspace_slug, project_id, phase_id, cycle_id)
        return phases.list_cycles(workspace_slug, project_id, phase_id)
