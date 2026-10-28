# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date, datetime, timezone as dt_timezone

import pytest
from rest_framework import status

from plane.db.models import (
    Issue,
    IssueAssignee,
    Project,
    ProjectMember,
    State,
    User,
    WorkspaceMember,
)

# Fixed anchor so the month period is March 2026 and the week period is
# Mon 2026-03-09 .. Sun 2026-03-15, independent of the day the suite runs.
ANCHOR = "2026-03-15"


def _dt(year: int, month: int, day: int) -> datetime:
    # Noon UTC keeps the __date lookups clear of any day-boundary ambiguity.
    return datetime(year, month, day, 12, 0, tzinfo=dt_timezone.utc)


def detail_url(slug: str, member_id) -> str:
    return f"/api/workspaces/{slug}/member-analytics/{member_id}/"


@pytest.fixture
def member(db, workspace):
    """The workspace member whose drill-down is requested."""
    user = User.objects.create(email="assignee@example.com", username="assignee", first_name="Assignee")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    return user


def _project(workspace, viewer, name: str, identifier: str, members) -> Project:
    project = Project.objects.create(name=name, identifier=identifier, workspace=workspace, created_by=viewer)
    for user in members:
        ProjectMember.objects.create(project=project, member=user, role=20 if user == viewer else 15)
    return project


def _states(project) -> dict:
    return {
        group: State.objects.create(name=f"{group} state", project=project, group=group, color=f"#{i}{i}{i}{i}{i}{i}")
        for i, group in enumerate(["backlog", "unstarted", "started", "completed", "cancelled"], start=1)
    }


def _issue(project, state, name, assignees, created=None, completed=None, start=None, target=None, removed=()):
    issue = Issue.objects.create(
        name=name, project=project, workspace=project.workspace, state=state, start_date=start, target_date=target
    )
    for user in assignees:
        IssueAssignee.objects.create(issue=issue, assignee=user, project=project)
    for user in removed:
        IssueAssignee.objects.create(issue=issue, assignee=user, project=project, deleted_at=_dt(2026, 3, 1))
    # created_at is auto_now_add and completed_at is synced on save, so pin both afterwards.
    Issue.objects.filter(pk=issue.pk).update(created_at=created or _dt(2026, 1, 10), completed_at=completed)
    return issue


@pytest.fixture
def scenario(workspace, create_user, member):
    """
    Project A and B: viewer + member. Project C: the member is not part of it.
    Project D: the member is part of it but the viewer is not.
    """
    other = User.objects.create(email="other@example.com", username="other", first_name="Other")
    WorkspaceMember.objects.create(workspace=workspace, member=other, role=15)

    project_a = _project(workspace, create_user, "Alpha", "ALP", [create_user, member, other])
    project_b = _project(workspace, create_user, "Beta", "BET", [create_user, member])
    project_c = _project(workspace, create_user, "Gamma", "GAM", [create_user])
    project_d = _project(workspace, member, "Delta", "DEL", [member])
    s_a, s_b, s_c, s_d = _states(project_a), _states(project_b), _states(project_c), _states(project_d)

    items = {
        # Included: open, or completed inside the period.
        "a_started": _issue(project_a, s_a["started"], "A started", [member], target=date(2026, 3, 20)),
        "a_backlog": _issue(project_a, s_a["backlog"], "A backlog", [member]),
        "a_unstarted": _issue(
            project_a, s_a["unstarted"], "A unstarted", [member], start=date(2026, 3, 2), target=date(2026, 3, 5)
        ),
        "a_done_week": _issue(project_a, s_a["completed"], "A done this week", [member], completed=_dt(2026, 3, 10)),
        "a_done_month": _issue(project_a, s_a["completed"], "A done this month", [member], completed=_dt(2026, 3, 3)),
        "b_started": _issue(project_b, s_b["started"], "B started", [member, other]),
        # Excluded.
        "a_done_before": _issue(project_a, s_a["completed"], "A done before", [member], completed=_dt(2026, 2, 20)),
        "a_cancelled": _issue(project_a, s_a["cancelled"], "A cancelled", [member]),
        "a_removed": _issue(project_a, s_a["started"], "A removed", [other], removed=[member]),
        "a_future": _issue(project_a, s_a["started"], "A future", [member], created=_dt(2026, 4, 5)),
        "a_other": _issue(project_a, s_a["started"], "A other", [other]),
        "c_not_member": _issue(project_c, s_c["started"], "C not member", [member]),
        "d_viewer_outside": _issue(project_d, s_d["started"], "D viewer outside", [member]),
    }
    return {"projects": {"a": project_a, "b": project_b}, "items": items, "states": s_a}


def _names(response) -> list:
    return [row["name"] for row in response.data["assigned_work_items"]]


@pytest.mark.contract
class TestMemberAnalyticsAssignedWorkItems:
    @pytest.mark.django_db
    def test_month_lists_open_and_in_period_items_only(self, session_client, workspace, member, scenario):
        response = session_client.get(detail_url(workspace.slug, member.id), {"period": "month", "anchor": ANCHOR})

        assert response.status_code == status.HTTP_200_OK
        assert sorted(_names(response)) == sorted(
            ["A started", "A backlog", "A unstarted", "A done this week", "A done this month", "B started"]
        )

    @pytest.mark.django_db
    def test_week_drops_items_completed_before_the_week(self, session_client, workspace, member, scenario):
        response = session_client.get(detail_url(workspace.slug, member.id), {"period": "week", "anchor": ANCHOR})

        assert response.status_code == status.HTTP_200_OK
        names = _names(response)
        assert "A done this week" in names
        assert "A done this month" not in names

    @pytest.mark.django_db
    def test_project_filter_limits_items(self, session_client, workspace, member, scenario):
        project_a = scenario["projects"]["a"]
        response = session_client.get(
            detail_url(workspace.slug, member.id),
            {"period": "month", "anchor": ANCHOR, "project_ids": str(project_a.id)},
        )

        assert response.status_code == status.HTTP_200_OK
        rows = response.data["assigned_work_items"]
        assert rows
        assert {row["project_id"] for row in rows} == {str(project_a.id)}
        assert "B started" not in _names(response)

    @pytest.mark.django_db
    def test_items_are_ordered_by_state_group_then_due_date(self, session_client, workspace, member, scenario):
        project_a = scenario["projects"]["a"]
        response = session_client.get(
            detail_url(workspace.slug, member.id),
            {"period": "month", "anchor": ANCHOR, "project_ids": str(project_a.id)},
        )

        assert _names(response) == [
            "A started",
            "A unstarted",
            "A backlog",
            # Completed items without dates fall back to sequence order.
            "A done this week",
            "A done this month",
        ]

    @pytest.mark.django_db
    def test_item_payload_shape(self, session_client, workspace, member, scenario):
        project_a = scenario["projects"]["a"]
        issue = scenario["items"]["a_unstarted"]
        state = scenario["states"]["unstarted"]
        response = session_client.get(
            detail_url(workspace.slug, member.id),
            {"period": "month", "anchor": ANCHOR, "project_ids": str(project_a.id)},
        )

        row = next(r for r in response.data["assigned_work_items"] if r["id"] == str(issue.id))
        assert row == {
            "id": str(issue.id),
            "name": "A unstarted",
            "sequence_id": issue.sequence_id,
            "project_id": str(project_a.id),
            "state": {"name": state.name, "color": state.color, "group": "unstarted"},
            "start_date": "2026-03-02",
            "target_date": "2026-03-05",
        }

    @pytest.mark.django_db
    def test_member_without_items_gets_empty_list(self, session_client, workspace, create_user, scenario):
        loner = User.objects.create(email="loner@example.com", username="loner", first_name="Loner")
        WorkspaceMember.objects.create(workspace=workspace, member=loner, role=15)

        response = session_client.get(detail_url(workspace.slug, loner.id), {"period": "month", "anchor": ANCHOR})

        assert response.status_code == status.HTTP_200_OK
        assert response.data["assigned_work_items"] == []
