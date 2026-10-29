# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from helpers import PROJECT_API, PROJECT_ID, action_values, call, list_tools, page

import pytest

from bananaz_mcp.compat import SUPPORTED_ACTIONS, UNSUPPORTED_RESOURCES, CommunityEditionScope, supported_aliases
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


@pytest.mark.parametrize(
    ("tool", "action"),
    [
        ("workitem", "count"),
        ("workitem", "list_archived"),
        ("project", "update_features"),
        ("member", "list_roles"),
        ("workitem_attachment", "upload_from_url"),
        ("workitem_attachment", "download_url"),
    ],
)
def test_removed_actions_are_refused_before_any_api_call(server, mocked_api, tool, action):
    _, text, _ = call(server, tool, {"action": action, "project_id": PROJECT_ID})

    assert text.startswith(f"Error: action '{action}' is not available on BananaZ. Available: ")
    assert not mocked_api.calls


def test_workitem_list_requires_project(server, mocked_api):
    _, text, _ = call(server, "workitem", {"action": "list"})

    assert text == "Error: action 'list' requires: project_id."
    assert not mocked_api.calls


def test_legacy_name_cannot_bypass_the_project_requirement(server, mocked_api):
    legacy_list = next(alias for alias, target in supported_aliases().items() if target == ("workitem", "list"))

    _, text, _ = call(server, legacy_list, {})

    assert text == "Error: action 'list' requires: project_id."
    assert not mocked_api.calls


def test_attachment_tool_only_offers_list_and_delete(server):
    assert action_values(list_tools(server)["workitem_attachment"]) == ["list", "delete"]


def test_listing_tools_does_not_grow_memory(server):
    scope = next(t for t in server._transforms if isinstance(t, CommunityEditionScope))
    list_tools(server)
    size = len(scope._cache)

    for _ in range(25):
        list_tools(server)

    assert 0 < size == len(scope._cache) <= len(SUPPORTED_ACTIONS) + 3


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
