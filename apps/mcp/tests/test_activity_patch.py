# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from helpers import PROJECT_API, PROJECT_ID, call, page

WORKITEM_ID = "55555555-5555-5555-5555-555555555555"

ACTIVITY = {
    "id": "66666666-6666-6666-6666-666666666666",
    "created_at": "2026-10-28T01:02:17Z",
    "updated_at": "2026-10-28T01:02:17Z",
    "verb": "created",
    "field": None,
    "old_value": None,
    "new_value": None,
    "comment": "created the work item.",
    "attachments": [],
    # BananaZ stores epoch as a float; plane-sdk declared it as int and rejected the page.
    "epoch": 1793149337.8372014,
    "project": PROJECT_ID,
    "workspace": "77777777-7777-7777-7777-777777777777",
    "issue": WORKITEM_ID,
    "actor": "88888888-8888-8888-8888-888888888888",
}


def test_activity_list_accepts_fractional_epoch(server, mocked_api):
    mocked_api.get(f"{PROJECT_API}/work-items/{WORKITEM_ID}/activities/", json=page([ACTIVITY]))

    is_error, text, data = call(
        server, "workitem_activity", {"action": "list", "project_id": PROJECT_ID, "workitem_id": WORKITEM_ID}
    )

    assert not is_error, text
    assert data["results"][0]["epoch"] == ACTIVITY["epoch"]
