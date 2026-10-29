# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json

from helpers import PROJECT_API, PROJECT_ID, call, list_tools
from responses import matchers

PHASE_ID = "22222222-2222-2222-2222-222222222222"
CYCLE_A = "33333333-3333-3333-3333-333333333333"
CYCLE_B = "44444444-4444-4444-4444-444444444444"
PHASES = f"{PROJECT_API}/phases/"
PHASE = f"{PROJECT_API}/phases/{PHASE_ID}/"
PHASE_JSON = {"id": PHASE_ID, "name": "Build", "total_cycles": 0, "completed_cycles": 0, "cycle_ids": []}


def body(mocked_api, index=-1):
    return json.loads(mocked_api.calls[index].request.body)


def test_phase_tool_is_advertised_with_its_actions(server):
    tool = list_tools(server)["phase"]

    assert tool.inputSchema["properties"]["action"]["enum"] == [
        "list",
        "retrieve",
        "create",
        "update",
        "delete",
        "archive",
        "unarchive",
        "list_cycles",
        "manage_cycles",
    ]
    assert "list_cycles" in tool.description


def test_list(server, mocked_api):
    mocked_api.get(PHASES, json={"results": [PHASE_JSON]})

    is_error, _, data = call(server, "phase", {"action": "list", "project_id": PROJECT_ID})

    assert not is_error
    assert data["results"][0]["id"] == PHASE_ID


def test_list_archived(server, mocked_api):
    mocked_api.get(PHASES, json={"results": []}, match=[matchers.query_param_matcher({"archived": "true"})])

    is_error, _, _ = call(server, "phase", {"action": "list", "project_id": PROJECT_ID, "archived": True})

    assert not is_error


def test_create_sends_only_given_fields(server, mocked_api):
    mocked_api.post(PHASES, json=PHASE_JSON, status=201)

    is_error, _, data = call(
        server,
        "phase",
        {"action": "create", "project_id": PROJECT_ID, "name": "Build", "start_date": "2026-02-01"},
    )

    assert not is_error
    assert data["id"] == PHASE_ID
    assert body(mocked_api) == {"name": "Build", "start_date": "2026-02-01"}


def test_create_requires_name(server):
    _, text, _ = call(server, "phase", {"action": "create", "project_id": PROJECT_ID})

    assert text == "Error: action 'create' requires: name."


def test_invalid_status_is_rejected_before_calling_the_api(server, mocked_api):
    _, text, _ = call(
        server, "phase", {"action": "create", "project_id": PROJECT_ID, "name": "Build", "status": "done"}
    )

    assert text.startswith("Error: status must be one of: backlog, planned, in-progress")
    assert not mocked_api.calls


def test_update_patches_only_given_fields(server, mocked_api):
    mocked_api.patch(PHASE, json={**PHASE_JSON, "status": "completed"})

    is_error, _, data = call(
        server, "phase", {"action": "update", "project_id": PROJECT_ID, "phase_id": PHASE_ID, "status": "completed"}
    )

    assert not is_error
    assert data["status"] == "completed"
    assert body(mocked_api) == {"status": "completed"}


def test_update_without_fields_is_rejected(server, mocked_api):
    _, text, _ = call(server, "phase", {"action": "update", "project_id": PROJECT_ID, "phase_id": PHASE_ID})

    assert text.startswith("Error: action 'update' needs at least one of: name")
    assert not mocked_api.calls


def test_retrieve_requires_phase_id(server):
    _, text, _ = call(server, "phase", {"action": "retrieve", "project_id": PROJECT_ID})

    assert text == "Error: action 'retrieve' requires: phase_id."


def test_stray_arguments_are_rejected(server, mocked_api):
    _, text, _ = call(server, "phase", {"action": "list", "project_id": PROJECT_ID, "name": "x"})

    assert text.startswith("Error")
    assert "name" in text
    assert not mocked_api.calls


def test_delete(server, mocked_api):
    mocked_api.delete(PHASE, status=204)

    is_error, _, _ = call(server, "phase", {"action": "delete", "project_id": PROJECT_ID, "phase_id": PHASE_ID})

    assert not is_error
    assert mocked_api.calls[0].request.method == "DELETE"


def test_archive_and_unarchive(server, mocked_api):
    mocked_api.post(f"{PHASE}archive/", json={**PHASE_JSON, "archived_at": "2026-10-29T00:00:00Z"})
    mocked_api.delete(f"{PHASE}archive/", json=PHASE_JSON)
    mocked_api.get(PHASE, json=PHASE_JSON)

    _, _, archived = call(server, "phase", {"action": "archive", "project_id": PROJECT_ID, "phase_id": PHASE_ID})
    is_error, _, restored = call(
        server, "phase", {"action": "unarchive", "project_id": PROJECT_ID, "phase_id": PHASE_ID}
    )

    assert archived["archived_at"] == "2026-10-29T00:00:00Z"
    assert not is_error
    assert restored["id"] == PHASE_ID


def test_manage_cycles_adds_removes_and_returns_linked_cycles(server, mocked_api):
    mocked_api.post(f"{PHASE}cycles/", json=[{"id": CYCLE_A}, {"id": CYCLE_B}])
    mocked_api.delete(f"{PHASE}cycles/{CYCLE_B}/", status=204)
    mocked_api.get(f"{PHASE}cycles/", json=[{"id": CYCLE_A}])

    is_error, _, data = call(
        server,
        "phase",
        {
            "action": "manage_cycles",
            "project_id": PROJECT_ID,
            "phase_id": PHASE_ID,
            "add_ids": [CYCLE_A, CYCLE_B],
            "remove_ids": CYCLE_B,
        },
    )

    assert not is_error
    assert data == [{"id": CYCLE_A}]
    assert json.loads(mocked_api.calls[0].request.body) == {"cycles": [CYCLE_A, CYCLE_B]}
    assert [c.request.method for c in mocked_api.calls] == ["POST", "DELETE", "GET"]


def test_manage_cycles_requires_ids(server):
    _, text, _ = call(server, "phase", {"action": "manage_cycles", "project_id": PROJECT_ID, "phase_id": PHASE_ID})

    assert text == "Error: action 'manage_cycles' requires: add_ids or remove_ids."


def test_api_errors_are_reported(server, mocked_api):
    mocked_api.post(
        PHASES,
        json={"non_field_errors": ["A phase already exists on the given dates. Please choose a different date range."]},
        status=400,
    )

    is_error, text, _ = call(
        server,
        "phase",
        {"action": "create", "project_id": PROJECT_ID, "name": "Overlap", "start_date": "2026-01-01"},
    )

    assert is_error
    assert "already exists on the given dates" in text
