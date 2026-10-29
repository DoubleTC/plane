# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from helpers import PROJECT_API, PROJECT_ID, call, page

from bananaz_mcp.guards import identifier_error

PHASE_ID = "22222222-2222-2222-2222-222222222222"


@pytest.mark.parametrize(
    ("tool", "arguments", "bad"),
    [
        # Without the guard this became DELETE /projects/<project>/ — deleting the project.
        ("phase", {"action": "delete", "project_id": PROJECT_ID, "phase_id": ".."}, "phase_id"),
        (
            "phase",
            {"action": "manage_cycles", "project_id": PROJECT_ID, "phase_id": PHASE_ID, "remove_ids": ["../.."]},
            "remove_ids",
        ),
        ("workitem", {"action": "delete", "project_id": PROJECT_ID, "workitem_id": "../../members"}, "workitem_id"),
        ("phase", {"action": "list", "project_id": "../../../users/me"}, "project_id"),
        ("phase", {"action": "retrieve", "project_id": PROJECT_ID, "phase_id": "x?evil=1#"}, "phase_id"),
    ],
)
def test_path_like_ids_are_refused_before_any_api_call(server, mocked_api, tool, arguments, bad):
    _, text, _ = call(server, tool, arguments)

    assert text.startswith(f"Error: {bad} must be a UUID")
    assert not mocked_api.calls


def test_workitem_identifier_must_look_like_project_and_number(server, mocked_api):
    _, text, _ = call(server, "workitem", {"action": "retrieve_by_identifier", "workitem_identifier": "../x-1"})

    assert text.startswith("Error: workitem_identifier must look like PROJECT-123")
    assert not mocked_api.calls


def test_valid_ids_pass_through(server, mocked_api):
    mocked_api.get(f"{PROJECT_API}/phases/", json=page([]))

    is_error, _, _ = call(server, "phase", {"action": "list", "project_id": PROJECT_ID})

    assert not is_error
    assert len(mocked_api.calls) == 1


def test_identifier_rules():
    assert identifier_error({"external_id": "JIRA ../42", "name": "..", "cursor": "1000:0:0"}) is None
    assert identifier_error({"add_ids": f"{PHASE_ID},{PROJECT_ID}"}) is None
    assert identifier_error({"add_ids": f'["{PHASE_ID}", "nope"]'}).startswith("Error: add_ids must be a UUID")
    assert identifier_error({"workitem_identifier": "WEB-12"}) is None
