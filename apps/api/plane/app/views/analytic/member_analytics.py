# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import statistics
from collections import defaultdict
from datetime import date, timedelta
from typing import Dict, List, Tuple

from django.db import models
from django.db.models import Count, Q, Case, When, Value
from django.db.models.functions import Concat
from django.http import HttpRequest
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.db.models import (
    Cycle,
    Issue,
    IssueActivity,
    IssueComment,
    IssueMention,
    Module,
    Phase,
    State,
    WorkspaceMember,
)

from .project_analytics import ProjectAdvanceAnalyticsBaseView, classify_timeliness

# Five scorecard pillars. Each member metric feeds exactly one pillar; the
# pillar score is the mean of its (min-max normalized) member metrics and the
# composite index is the equal-weighted mean of the five pillars. Weights are
# fixed in v1 — role-aware weighting is a documented follow-up.
PILLARS = ("delivery", "quality", "predictability", "flow", "collaboration")

# Neutral score used when the team is too small / uniform to normalize against.
NEUTRAL_SCORE = 50.0


def get_period_range(period: str, anchor: date) -> Tuple[date, date, date, date]:
    """
    Resolve the current and previous-period date ranges for a week / month /
    year selection anchored on ``anchor`` (inclusive bounds).
    """
    if period == "week":
        start = anchor - timedelta(days=anchor.weekday())
        end = start + timedelta(days=6)
        prev_start = start - timedelta(days=7)
        prev_end = start - timedelta(days=1)
    elif period == "year":
        start = anchor.replace(month=1, day=1)
        end = anchor.replace(month=12, day=31)
        prev_start = start.replace(year=start.year - 1)
        prev_end = end.replace(year=end.year - 1)
    else:  # month (default)
        start = anchor.replace(day=1)
        next_month = (
            start.replace(year=start.year + 1, month=1)
            if start.month == 12
            else start.replace(month=start.month + 1)
        )
        end = next_month - timedelta(days=1)
        prev_end = start - timedelta(days=1)
        prev_start = prev_end.replace(day=1)
    return start, end, prev_start, prev_end


def _norm(value: float, lo: float, hi: float, invert: bool = False) -> float:
    """Min-max scale a value into 0–100 across the team (``invert`` for
    lower-is-better metrics). Falls back to a neutral score with no spread."""
    if hi <= lo:
        return NEUTRAL_SCORE
    scaled = (value - lo) / (hi - lo) * 100
    return 100 - scaled if invert else scaled


def _avatar_case():
    """Mirror the avatar_url expression used in project_analytics.get_members."""
    return Case(
        When(
            member__avatar_asset__isnull=False,
            then=Concat(Value("/api/assets/v2/static/"), "member__avatar_asset", Value("/")),
        ),
        When(member__avatar_asset__isnull=True, then="member__avatar"),
        default=Value(None),
        output_field=models.CharField(),
    )


class MemberAnalyticsBaseView(ProjectAdvanceAnalyticsBaseView):
    """Shared scoping helpers for the workspace member scorecard endpoints."""

    def _scoped_issues(self):
        return Issue.issue_objects.filter(**self.filters["base_filters"])

    def _state_group_map(self, slug: str) -> Dict[str, str]:
        return {
            str(row["id"]): row["group"]
            for row in State.objects.filter(workspace__slug=slug).values("id", "group")
        }

    def get_anchor(self, request: HttpRequest) -> date:
        raw = request.GET.get("anchor")
        if raw:
            try:
                return date.fromisoformat(raw)
            except ValueError:
                pass
        return timezone.localdate()


class WorkspaceMemberAnalyticsEndpoint(MemberAnalyticsBaseView):
    """
    Workspace-wide member scorecard leaderboard for a week / month / year, with
    each member's five pillar scores, the composite Performance Index, the
    percentile rank within the team and the previous-period delta on the
    headline metrics. Honors the analytics project filter.
    """

    def delivery_quality_flow(self, start: date, end: date) -> Dict[str, dict]:
        """Per-member delivery/quality/flow primitives over completed issues."""
        rows = self._scoped_issues().filter(
            state__group="completed", completed_at__date__range=(start, end)
        ).values(
            "assignees__id", "id", "point", "start_date", "target_date", "completed_at", "created_at"
        )

        acc: Dict[str, dict] = defaultdict(
            lambda: {
                "completed": 0,
                "points": 0,
                "early": 0,
                "on_time": 0,
                "delayed": 0,
                "cycle_times": [],
                "lead_times": [],
            }
        )
        seen = set()
        for row in rows:
            member_id = row["assignees__id"]
            if member_id is None:
                continue
            key = (str(member_id), row["id"])
            if key in seen:
                continue
            seen.add(key)
            bucket = acc[str(member_id)]
            bucket["completed"] += 1
            bucket["points"] += row["point"] or 0
            label = classify_timeliness(row["completed_at"], row["target_date"]) if row["start_date"] else None
            if label:
                bucket[label] += 1
            if row["start_date"] and row["completed_at"]:
                bucket["cycle_times"].append((row["completed_at"].date() - row["start_date"]).days)
            if row["created_at"] and row["completed_at"]:
                bucket["lead_times"].append((row["completed_at"].date() - row["created_at"].date()).days)
        return acc

    def headline(self, start: date, end: date) -> Dict[str, dict]:
        """Lightweight delivery/on-time headline used for the previous period."""
        acc = self.delivery_quality_flow(start, end)
        result = {}
        for member_id, bucket in acc.items():
            dated = bucket["early"] + bucket["on_time"] + bucket["delayed"]
            result[member_id] = {
                "completed_count": bucket["completed"],
                "completed_points": bucket["points"],
                "on_time_rate": round((bucket["early"] + bucket["on_time"]) / dated * 100, 1) if dated else 0.0,
            }
        return result

    def bug_counts(self, start: date, end: date) -> Dict[str, int]:
        rows = self._scoped_issues().filter(
            state__group="completed", completed_at__date__range=(start, end), labels__name__icontains="bug"
        ).values("assignees__id").annotate(c=Count("id", distinct=True))
        return {str(r["assignees__id"]): r["c"] for r in rows if r["assignees__id"] is not None}

    def assigned_counts(self, start: date, end: date) -> Dict[str, int]:
        """Distinct issues that were on a member's plate during the period:
        created on/before the period end and not already completed before it
        started. Used as the denominator for the completion rate."""
        rows = (
            self._scoped_issues()
            .filter(created_at__date__lte=end)
            .filter(Q(completed_at__isnull=True) | Q(completed_at__date__gte=start))
            .values("assignees__id")
            .annotate(c=Count("id", distinct=True))
        )
        return {str(r["assignees__id"]): r["c"] for r in rows if r["assignees__id"] is not None}

    def reopen_counts(self, slug: str, start: date, end: date) -> Dict[str, int]:
        group_map = self._state_group_map(slug)
        activities = IssueActivity.objects.filter(
            workspace__slug=slug, field="state", created_at__date__range=(start, end)
        ).values("issue_id", "old_identifier", "new_identifier")
        reopened_ids = set()
        for act in activities:
            old_group = group_map.get(str(act["old_identifier"]))
            new_group = group_map.get(str(act["new_identifier"]))
            if old_group == "completed" and new_group and new_group != "completed":
                reopened_ids.add(act["issue_id"])
        if not reopened_ids:
            return {}
        rows = self._scoped_issues().filter(id__in=reopened_ids).values("assignees__id").annotate(
            c=Count("id", distinct=True)
        )
        return {str(r["assignees__id"]): r["c"] for r in rows if r["assignees__id"] is not None}

    def snapshot(self, today: date) -> Tuple[Dict[str, int], Dict[str, int]]:
        wip_rows = self._scoped_issues().filter(state__group="started").values("assignees__id").annotate(
            c=Count("id", distinct=True)
        )
        overdue_rows = self._scoped_issues().filter(
            state__group__in=["backlog", "unstarted", "started"], target_date__lt=today
        ).values("assignees__id").annotate(c=Count("id", distinct=True))
        wip = {str(r["assignees__id"]): r["c"] for r in wip_rows if r["assignees__id"] is not None}
        overdue = {str(r["assignees__id"]): r["c"] for r in overdue_rows if r["assignees__id"] is not None}
        return wip, overdue

    def scope_adherence(self, start: date, end: date) -> Dict[str, float]:
        """Share of a member's cycle-committed issues finished by the cycle end."""
        rows = self._scoped_issues().filter(
            issue_cycle__cycle__end_date__date__range=(start, end)
        ).values("assignees__id", "id", "completed_at", "issue_cycle__cycle__end_date")
        committed: Dict[str, int] = defaultdict(int)
        kept: Dict[str, int] = defaultdict(int)
        seen = set()
        for row in rows:
            member_id = row["assignees__id"]
            cycle_end = row["issue_cycle__cycle__end_date"]
            if member_id is None or cycle_end is None:
                continue
            key = (str(member_id), row["id"])
            if key in seen:
                continue
            seen.add(key)
            committed[str(member_id)] += 1
            if row["completed_at"] and row["completed_at"].date() <= cycle_end.date():
                kept[str(member_id)] += 1
        return {
            member_id: round(kept[member_id] / committed[member_id] * 100, 1)
            for member_id in committed
            if committed[member_id]
        }

    def collaboration(self, start: date, end: date) -> Tuple[Dict[str, int], Dict[str, int], Dict[str, int]]:
        comment_rows = IssueComment.objects.filter(
            **self.filters["base_filters"], created_at__date__range=(start, end)
        ).values("actor_id").annotate(c=Count("id", distinct=True))
        comments = {str(r["actor_id"]): r["c"] for r in comment_rows if r["actor_id"] is not None}

        mention_rows = IssueMention.objects.filter(
            **self.filters["base_filters"], created_at__date__range=(start, end)
        ).values("mention_id").annotate(c=Count("id", distinct=True))
        mentions = {str(r["mention_id"]): r["c"] for r in mention_rows if r["mention_id"] is not None}

        breadth_rows = self._scoped_issues().filter(
            Q(completed_at__date__range=(start, end)) | Q(created_at__date__range=(start, end))
        ).values("assignees__id").annotate(p=Count("project_id", distinct=True))
        breadth = {str(r["assignees__id"]): r["p"] for r in breadth_rows if r["assignees__id"] is not None}

        return comments, mentions, breadth

    def ownership_counts(self, slug: str, start: date, end: date) -> Dict[str, int]:
        # Respect the active project filter so ownership matches the rest of the
        # scorecard (get_analytics_filters stores it as project_id__in).
        project_ids = self.filters["base_filters"].get("project_id__in")
        project_filter = {"project_id__in": project_ids} if project_ids else {}

        ownership: Dict[str, int] = defaultdict(int)
        cycles = Cycle.objects.filter(
            workspace__slug=slug,
            owned_by__isnull=False,
            start_date__date__lte=end,
            end_date__date__gte=start,
            **project_filter,
        ).values("owned_by_id").annotate(c=Count("id", distinct=True))
        for row in cycles:
            ownership[str(row["owned_by_id"])] += row["c"]
        modules = Module.objects.filter(
            workspace__slug=slug, lead__isnull=False, start_date__lte=end, target_date__gte=start, **project_filter
        ).values("lead_id").annotate(c=Count("id", distinct=True))
        for row in modules:
            ownership[str(row["lead_id"])] += row["c"]
        phases = Phase.objects.filter(
            workspace__slug=slug, lead__isnull=False, start_date__lte=end, end_date__gte=start, **project_filter
        ).values("lead_id").annotate(c=Count("id", distinct=True))
        for row in phases:
            ownership[str(row["lead_id"])] += row["c"]
        return ownership

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request: HttpRequest, slug: str) -> Response:
        self.initialize_workspace(slug, type="analytics")
        period = request.GET.get("period", "month")
        if period not in ("week", "month", "year"):
            period = "month"
        anchor = self.get_anchor(request)
        start, end, prev_start, prev_end = get_period_range(period, anchor)
        today = timezone.localdate()

        dqf = self.delivery_quality_flow(start, end)
        prev = self.headline(prev_start, prev_end)
        assigned = self.assigned_counts(start, end)
        bug = self.bug_counts(start, end)
        reopen = self.reopen_counts(slug, start, end)
        wip, overdue = self.snapshot(today)
        adherence = self.scope_adherence(start, end)
        comments, mentions, breadth = self.collaboration(start, end)
        ownership = self.ownership_counts(slug, start, end)

        members_qs = (
            WorkspaceMember.objects.filter(
                workspace__slug=slug, is_active=True, member__isnull=False, member__is_bot=False
            )
            .select_related("member", "custom_role")
            .annotate(avatar_url=_avatar_case())
        )

        # Assemble raw per-member metrics.
        raw: List[dict] = []
        for wm in members_qs:
            member_id = str(wm.member_id)
            bucket = dqf.get(member_id, {})
            early = bucket.get("early", 0)
            on_time = bucket.get("on_time", 0)
            delayed = bucket.get("delayed", 0)
            dated = early + on_time + delayed
            cycle_times = bucket.get("cycle_times", [])
            lead_times = bucket.get("lead_times", [])
            completed = bucket.get("completed", 0)
            assigned_count = assigned.get(member_id, 0)
            metrics = {
                "assigned_count": assigned_count,
                "completed_count": completed,
                "completion_rate": round(completed / assigned_count * 100, 1) if assigned_count else 0.0,
                "completed_points": bucket.get("points", 0),
                # Timeliness of the dated completed items (counts + rates).
                "early": early,
                "on_time": on_time,
                "delayed": delayed,
                "early_rate": round(early / dated * 100, 1) if dated else 0.0,
                "on_time_rate": round((early + on_time) / dated * 100, 1) if dated else 0.0,
                "delayed_rate": round(delayed / dated * 100, 1) if dated else 0.0,
                "reopen_count": reopen.get(member_id, 0),
                "bug_ratio": round(bug.get(member_id, 0) / completed * 100, 1) if completed else 0.0,
                "overdue_open": overdue.get(member_id, 0),
                "scope_adherence": adherence.get(member_id, 0.0),
                "cycle_time_stddev": round(statistics.pstdev(cycle_times), 1) if len(cycle_times) > 1 else 0.0,
                "avg_cycle_time": round(statistics.mean(cycle_times), 1) if cycle_times else 0.0,
                "avg_lead_time": round(statistics.mean(lead_times), 1) if lead_times else 0.0,
                "wip": wip.get(member_id, 0),
                "comments": comments.get(member_id, 0),
                "mentions_received": mentions.get(member_id, 0),
                "projects_touched": breadth.get(member_id, 0),
                "ownership": ownership.get(member_id, 0),
            }
            raw.append(
                {
                    "member_id": member_id,
                    "display_name": wm.member.display_name,
                    "avatar_url": wm.avatar_url,
                    "role": wm.role,
                    "custom_role": wm.custom_role.name if wm.custom_role else None,
                    "metrics": metrics,
                    "prev": prev.get(
                        member_id, {"completed_count": 0, "completed_points": 0, "on_time_rate": 0.0}
                    ),
                }
            )

        members = self._score(raw)
        avg_index = round(statistics.mean([m["index"] for m in members]), 1) if members else 0.0

        return Response(
            {
                "period": {
                    "type": period,
                    "start": start.isoformat(),
                    "end": end.isoformat(),
                    "prev_start": prev_start.isoformat(),
                    "prev_end": prev_end.isoformat(),
                },
                "members": members,
                "team": {"evaluated": len(members), "avg_index": avg_index},
            },
            status=status.HTTP_200_OK,
        )

    def _score(self, raw: List[dict]) -> List[dict]:
        """Min-max normalize metrics across the team and compute pillar scores,
        the composite index and the percentile rank."""
        if not raw:
            return []

        def col(metric: str) -> List[float]:
            return [r["metrics"][metric] for r in raw]

        ranges = {m: (min(col(m)), max(col(m))) for m in raw[0]["metrics"].keys()}

        def n(r: dict, metric: str, invert: bool = False) -> float:
            lo, hi = ranges[metric]
            return _norm(r["metrics"][metric], lo, hi, invert)

        for r in raw:
            delivery = statistics.mean([n(r, "completed_count"), n(r, "completed_points")])
            quality = statistics.mean(
                [
                    n(r, "on_time_rate"),
                    n(r, "reopen_count", invert=True),
                    n(r, "bug_ratio", invert=True),
                    n(r, "overdue_open", invert=True),
                ]
            )
            predictability = statistics.mean(
                [n(r, "scope_adherence"), n(r, "cycle_time_stddev", invert=True)]
            )
            # WIP is shown as context only; flow scores reward shorter cycle/lead time.
            flow = statistics.mean([n(r, "avg_cycle_time", invert=True), n(r, "avg_lead_time", invert=True)])
            collaboration = statistics.mean(
                [
                    n(r, "comments"),
                    n(r, "mentions_received"),
                    n(r, "projects_touched"),
                    n(r, "ownership"),
                ]
            )
            pillars = {
                "delivery": round(delivery, 1),
                "quality": round(quality, 1),
                "predictability": round(predictability, 1),
                "flow": round(flow, 1),
                "collaboration": round(collaboration, 1),
            }
            r["pillars"] = pillars
            r["index"] = round(statistics.mean(pillars.values()), 1)

        # Percentile rank by index (share of the team scoring <= this member).
        total = len(raw)
        for r in raw:
            below_or_equal = sum(1 for o in raw if o["index"] <= r["index"])
            r["percentile"] = round(below_or_equal / total * 100, 1)

        raw.sort(key=lambda r: r["index"], reverse=True)
        return raw


class WorkspaceMemberAnalyticsDetailEndpoint(MemberAnalyticsBaseView):
    """Drill-down series for a single member: throughput trend, cycle-time
    percentiles, estimate-vs-actual scatter, an activity heatmap and the most
    recent completed issues (for verification against the headline numbers)."""

    def _trend_buckets(self, period: str, anchor: date) -> List[Tuple[str, date, date]]:
        buckets: List[Tuple[str, date, date]] = []
        if period == "week":
            start = anchor - timedelta(days=anchor.weekday())
            for i in range(7, -1, -1):
                s = start - timedelta(days=7 * i)
                buckets.append((s.isoformat(), s, s + timedelta(days=6)))
        elif period == "year":
            for i in range(4, -1, -1):
                y = anchor.year - i
                buckets.append((str(y), date(y, 1, 1), date(y, 12, 31)))
        else:
            first = anchor.replace(day=1)
            for i in range(11, -1, -1):
                month = first.month - i
                year = first.year
                while month <= 0:
                    month += 12
                    year -= 1
                s = date(year, month, 1)
                e = (date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)) - timedelta(days=1)
                buckets.append((s.strftime("%Y-%m"), s, e))
        return buckets

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER], level="WORKSPACE")
    def get(self, request: HttpRequest, slug: str, member_id: str) -> Response:
        self.initialize_workspace(slug, type="analytics")
        period = request.GET.get("period", "month")
        if period not in ("week", "month", "year"):
            period = "month"
        anchor = self.get_anchor(request)
        start, end, _, _ = get_period_range(period, anchor)

        member_issues = self._scoped_issues().filter(assignees__id=member_id)

        # Trend across the trailing buckets.
        buckets = self._trend_buckets(period, anchor)
        trend = []
        for key, b_start, b_end in buckets:
            rows = member_issues.filter(
                state__group="completed", completed_at__date__range=(b_start, b_end)
            ).values("id", "point", "start_date", "target_date", "completed_at").distinct()
            completed = 0
            points = 0
            early = on_time = delayed = 0
            for row in rows:
                completed += 1
                points += row["point"] or 0
                if row["start_date"]:
                    label = classify_timeliness(row["completed_at"], row["target_date"])
                    if label == "early":
                        early += 1
                    elif label == "on_time":
                        on_time += 1
                    elif label == "delayed":
                        delayed += 1
            dated = early + on_time + delayed
            trend.append(
                {
                    "key": key,
                    "completed": completed,
                    "points": points,
                    "on_time_rate": round((early + on_time) / dated * 100, 1) if dated else 0.0,
                }
            )

        # Current-period completed issues drive cycle time, scatter and heatmap.
        current = list(
            member_issues.filter(state__group="completed", completed_at__date__range=(start, end))
            .values("id", "name", "sequence_id", "project_id", "point", "start_date", "target_date", "completed_at")
            .distinct()
        )

        cycle_times = sorted(
            (row["completed_at"].date() - row["start_date"]).days
            for row in current
            if row["start_date"] and row["completed_at"]
        )
        scatter = [
            {"point": row["point"], "cycle_time_days": (row["completed_at"].date() - row["start_date"]).days}
            for row in current
            if row["start_date"] and row["completed_at"] and row["point"] is not None
        ]
        heatmap_acc: Dict[str, int] = defaultdict(int)
        for row in current:
            if row["completed_at"]:
                heatmap_acc[row["completed_at"].date().isoformat()] += 1

        recent = sorted(
            (row for row in current if row["completed_at"]),
            key=lambda row: row["completed_at"],
            reverse=True,
        )[:15]
        recent_issues = [
            {
                "id": str(row["id"]),
                "name": row["name"],
                "sequence_id": row["sequence_id"],
                "project_id": str(row["project_id"]),
                "completed_at": row["completed_at"].isoformat() if row["completed_at"] else None,
                "on_time": (classify_timeliness(row["completed_at"], row["target_date"]) in ("early", "on_time"))
                if row["start_date"]
                else None,
            }
            for row in recent
        ]

        return Response(
            {
                "trend": trend,
                "cycle_time": self._percentiles(cycle_times),
                "estimate_scatter": scatter,
                "heatmap": [{"date": d, "count": c} for d, c in sorted(heatmap_acc.items())],
                "recent_issues": recent_issues,
            },
            status=status.HTTP_200_OK,
        )

    @staticmethod
    def _percentiles(samples: List[int]) -> dict:
        if not samples:
            return {"p50": 0, "p85": 0, "max": 0, "count": 0}

        def pct(p: float) -> float:
            if len(samples) == 1:
                return float(samples[0])
            idx = min(int(round(p * (len(samples) - 1))), len(samples) - 1)
            return float(samples[idx])

        return {
            "p50": round(pct(0.5), 1),
            "p85": round(pct(0.85), 1),
            "max": float(samples[-1]),
            "count": len(samples),
        }
