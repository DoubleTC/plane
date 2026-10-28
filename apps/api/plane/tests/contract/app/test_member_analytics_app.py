# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date, datetime, timezone as dt_timezone

import pytest
from rest_framework import status

from plane.db.models import (
    Cycle,
    CycleIssue,
    Issue,
    IssueActivity,
    IssueAssignee,
    IssueLabel,
    Label,
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


def leaderboard_url(slug: str) -> str:
    return f"/api/workspaces/{slug}/member-analytics/"


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


def _member_metrics(response, member) -> dict:
    return next(row["metrics"] for row in response.data["members"] if row["member_id"] == str(member.id))


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


@pytest.mark.contract
class TestMemberAnalyticsAssignedCount:
    @pytest.mark.django_db
    @pytest.mark.parametrize("period, expected", [("week", 5), ("month", 6)])
    def test_assigned_count_matches_assigned_work_list(
        self, session_client, workspace, member, scenario, period, expected
    ):
        params = {"period": period, "anchor": ANCHOR}
        leaderboard = session_client.get(leaderboard_url(workspace.slug), params)
        detail = session_client.get(detail_url(workspace.slug, member.id), params)

        assert leaderboard.status_code == status.HTTP_200_OK
        # Cancelled, removed-assignee and not-a-project-member items are left out of both.
        assigned_count = _member_metrics(leaderboard, member)["assigned_count"]
        assert assigned_count == len(detail.data["assigned_work_items"]) == expected

    @pytest.mark.django_db
    def test_assigned_count_honours_project_filter(self, session_client, workspace, member, scenario):
        project_a = scenario["projects"]["a"]
        response = session_client.get(
            leaderboard_url(workspace.slug),
            {"period": "month", "anchor": ANCHOR, "project_ids": str(project_a.id)},
        )

        assert response.status_code == status.HTTP_200_OK
        assert _member_metrics(response, member)["assigned_count"] == 5

    @pytest.mark.django_db
    def test_completion_rate_counts_only_completed_assigned_items(self, session_client, workspace, member, scenario):
        other = User.objects.get(email="other@example.com")
        # Completed within the period, but the member had been taken off it.
        _issue(
            scenario["projects"]["a"],
            scenario["states"]["completed"],
            "A removed done",
            [other],
            completed=_dt(2026, 3, 12),
            removed=[member],
        )

        response = session_client.get(leaderboard_url(workspace.slug), {"period": "month", "anchor": ANCHOR})

        metrics = _member_metrics(response, member)
        assert metrics["assigned_count"] == 6
        # 2 of the 6 assigned items ("A done this week", "A done this month") were completed in March.
        assert metrics["completion_rate"] == 33.3


@pytest.fixture
def march_cycle(create_user, scenario):
    """A March cycle the member kept: "A done this week" finished before it ended."""
    project_a = scenario["projects"]["a"]
    cycle = Cycle.objects.create(
        name="March", project=project_a, start_date=_dt(2026, 3, 1), end_date=_dt(2026, 3, 20), owned_by=create_user
    )
    CycleIssue.objects.create(issue=scenario["items"]["a_done_week"], cycle=cycle, project=project_a)
    return cycle


def _add_work_the_member_was_taken_off(scenario, member, cycle, actor) -> None:
    """Items another member now owns, which touch every per-assignee metric."""
    project_a, project_b = scenario["projects"]["a"], scenario["projects"]["b"]
    states_a = scenario["states"]
    completed_b = State.objects.get(project=project_b, group="completed")
    other = User.objects.get(email="other@example.com")

    # Completed late in March, with points and a bug label, in a project the
    # member did not otherwise touch this month.
    done = _issue(
        project_b,
        completed_b,
        "B removed done",
        [other],
        start=date(2026, 3, 2),
        target=date(2026, 3, 4),
        completed=_dt(2026, 3, 12),
        removed=[member],
    )
    Issue.objects.filter(pk=done.pk).update(point=8)
    IssueLabel.objects.create(issue=done, label=Label.objects.create(name="Bug", project=project_b), project=project_b)

    # In progress, overdue, reopened in March and committed to the March cycle.
    open_item = _issue(
        project_a, states_a["started"], "A removed open", [other], target=date(2026, 3, 1), removed=[member]
    )
    CycleIssue.objects.create(issue=open_item, cycle=cycle, project=project_a)
    reopened = IssueActivity.objects.create(
        issue=open_item,
        project=project_a,
        actor=actor,
        verb="updated",
        field="state",
        old_identifier=states_a["completed"].id,
        new_identifier=states_a["started"].id,
    )
    IssueActivity.objects.filter(pk=reopened.pk).update(created_at=_dt(2026, 3, 13))


@pytest.mark.contract
class TestMemberAnalyticsRemovedAssignee:
    """Removed assignees are soft-deleted links; they must not move the member's numbers."""

    PARAMS = {"period": "month", "anchor": ANCHOR}

    @pytest.mark.django_db
    def test_leaderboard_metrics_ignore_removed_assignee_links(
        self, session_client, workspace, create_user, member, scenario, march_cycle
    ):
        before = _member_metrics(session_client.get(leaderboard_url(workspace.slug), self.PARAMS), member)
        _add_work_the_member_was_taken_off(scenario, member, march_cycle, create_user)
        after = _member_metrics(session_client.get(leaderboard_url(workspace.slug), self.PARAMS), member)

        assert after == before

    @pytest.mark.django_db
    def test_detail_series_ignore_removed_assignee_links(
        self, session_client, workspace, create_user, member, scenario, march_cycle
    ):
        before = session_client.get(detail_url(workspace.slug, member.id), self.PARAMS).data
        _add_work_the_member_was_taken_off(scenario, member, march_cycle, create_user)
        after = session_client.get(detail_url(workspace.slug, member.id), self.PARAMS).data

        assert after == before


@pytest.mark.contract
class TestMemberAnalyticsRemovedLabelAndCycleLinks:
    """Labels and cycle links are soft-deleted too; only live ones may count."""

    PARAMS = {"period": "month", "anchor": ANCHOR}

    @pytest.mark.django_db
    def test_bug_ratio_counts_only_live_bug_labels(self, session_client, workspace, member, scenario):
        project_a, items = scenario["projects"]["a"], scenario["items"]
        bug = Label.objects.create(name="Bug", project=project_a)
        old_bug = Label.objects.create(name="bug (old)", project=project_a)
        Label.all_objects.filter(pk=old_bug.pk).update(deleted_at=_dt(2026, 3, 1))
        # Of the member's two March completions, one is still labelled as a bug ...
        IssueLabel.objects.create(issue=items["a_done_week"], label=bug, project=project_a)
        # ... the other had its bug label removed, and carries a label deleted since.
        IssueLabel.objects.create(issue=items["a_done_month"], label=bug, project=project_a, deleted_at=_dt(2026, 3, 5))
        IssueLabel.objects.create(issue=items["a_done_month"], label=old_bug, project=project_a)

        response = session_client.get(leaderboard_url(workspace.slug), self.PARAMS)

        assert response.status_code == status.HTTP_200_OK
        assert _member_metrics(response, member)["bug_ratio"] == 50.0

    @pytest.mark.django_db
    def test_scope_adherence_counts_only_issues_still_in_a_live_cycle(
        self, session_client, workspace, create_user, member, scenario, march_cycle
    ):
        project_a, items = scenario["projects"]["a"], scenario["items"]
        # march_cycle holds "A done this week" (kept); "A started" is still in it, unfinished.
        CycleIssue.objects.create(issue=items["a_started"], cycle=march_cycle, project=project_a)
        # Taken out of the cycle before it ended.
        CycleIssue.objects.create(
            issue=items["a_unstarted"], cycle=march_cycle, project=project_a, deleted_at=_dt(2026, 3, 8)
        )
        # In a cycle that was deleted (its links not yet cleaned up).
        deleted_cycle = Cycle.objects.create(
            name="Dropped",
            project=project_a,
            start_date=_dt(2026, 3, 1),
            end_date=_dt(2026, 3, 25),
            owned_by=create_user,
        )
        CycleIssue.objects.create(issue=items["a_backlog"], cycle=deleted_cycle, project=project_a)
        Cycle.all_objects.filter(pk=deleted_cycle.pk).update(deleted_at=_dt(2026, 3, 9))

        response = session_client.get(leaderboard_url(workspace.slug), self.PARAMS)

        assert response.status_code == status.HTTP_200_OK
        # 1 kept out of the 2 issues still committed to a live cycle.
        assert _member_metrics(response, member)["scope_adherence"] == 50.0
