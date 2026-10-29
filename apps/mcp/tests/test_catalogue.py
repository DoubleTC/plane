# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from helpers import PROJECT_API, PROJECT_ID, action_values, call, list_tools, page

from bananaz_mcp.compat import UNSUPPORTED_RESOURCES, supported_aliases
from plane_mcp.tools.registry import alias_table

EXPECTED_TOOLS = {
    "cycle",
    "intake",
    "label",
    "member",
    "module",
    "phase",
    "project",
    "project_estimate",
    "state",
    "workitem",
    "workitem_activity",
    "workitem_attachment",
    "workitem_comment",
    "workitem_link",
    "workspace",
}


def test_only_supported_tools_are_advertised(server):
    tools = list_tools(server)

    assert set(tools) == EXPECTED_TOOLS
    assert not set(tools) & UNSUPPORTED_RESOURCES


def test_unsupported_tool_cannot_be_called(server):
    is_error, text, _ = call(server, "page", {"action": "list", "project_id": PROJECT_ID})

    assert is_error
    assert "page" in text


def test_partially_supported_tools_only_offer_working_actions(server):
    tools = list_tools(server)

    assert action_values(tools["workitem"]) == [
        "list",
        "retrieve",
        "retrieve_by_identifier",
        "search",
        "create",
        "update",
        "delete",
        "manage_assignee",
        "manage_label",
    ]
    assert action_values(tools["project"]) == ["list", "retrieve", "create", "update", "delete", "archive", "unarchive"]
    assert action_values(tools["member"]) == ["me", "list_workspace", "list_project"]
    # One remaining action: pinned and hidden, so the tool takes no action argument.
    assert "action" not in tools["workspace"].inputSchema.get("properties", {})


def test_parameters_of_removed_features_are_hidden(server):
    tools = list_tools(server)

    for name in ("workitem", "cycle", "module"):
        assert "pql" not in tools[name].inputSchema["properties"], name
    assert "type_id" not in tools["workitem"].inputSchema["properties"]
    # Only update_features used the project feature flags.
    assert "epics" not in tools["project"].inputSchema["properties"]
    assert "role_id" not in tools["member"].inputSchema["properties"]


def test_descriptions_match_the_narrowed_tools(server):
    tools = list_tools(server)
    workitem = tools["workitem"].description

    action_lines = [line.strip() for line in workitem.splitlines() if line.startswith("  ")]
    assert [line.split(" ", 1)[0] for line in action_lines] == action_values(tools["workitem"])
    assert "omit project_id" not in workitem
    assert "list (project_id;" in workitem
    assert "PQL is not available" in workitem
    assert "count group_by" not in workitem
    assert "pql" not in tools["cycle"].description.split("\n\n")[1]


def test_removed_actions_are_rejected(server):
    is_error, text, _ = call(server, "workitem", {"action": "count", "project_id": PROJECT_ID})

    assert is_error or text.startswith("Error")
    assert "count" in text


def test_workitem_list_requires_project(server):
    is_error, text, _ = call(server, "workitem", {"action": "list"})

    assert text == "Error: action 'list' requires: project_id."


def test_legacy_names_only_resolve_to_supported_tools(server, mocked_api):
    aliases = supported_aliases()
    retired_to_unsupported = [alias for alias, (tool, _) in alias_table().items() if tool in UNSUPPORTED_RESOURCES]
    assert retired_to_unsupported and not set(retired_to_unsupported) & set(aliases)
    assert ("label", "list") in aliases.values()

    mocked_api.get(f"{PROJECT_API}/labels/", json=page([]))
    legacy_label_list = next(alias for alias, target in aliases.items() if target == ("label", "list"))
    is_error, _, _ = call(server, legacy_label_list, {"project_id": PROJECT_ID})
    assert not is_error

    is_error, _, _ = call(server, retired_to_unsupported[0], {"project_id": PROJECT_ID})
    assert is_error
