# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import asyncio

import pytest
from plane_mcp.auth import PlaneHeaderAuthProvider

from bananaz_mcp.auth import CachedHeaderAuthProvider


@pytest.fixture
def upstream_calls(monkeypatch):
    """Record upstream validations; tokens starting with 'good' are accepted."""
    calls = []

    async def fake_validate(self, token):
        calls.append(token)
        return token.startswith("good")

    monkeypatch.setattr(PlaneHeaderAuthProvider, "_validate_api_key", fake_validate)
    return calls


def validate(provider, token):
    return asyncio.run(provider._validate_api_key(token))


def test_accepted_token_is_cached_within_ttl(upstream_calls):
    provider = CachedHeaderAuthProvider(ttl_seconds=60)

    assert validate(provider, "good-1") and validate(provider, "good-1")
    assert upstream_calls == ["good-1"]


def test_accepted_token_is_revalidated_after_ttl(upstream_calls):
    provider = CachedHeaderAuthProvider(ttl_seconds=0)

    validate(provider, "good-1")
    validate(provider, "good-1")

    assert upstream_calls == ["good-1", "good-1"]


def test_rejected_token_is_never_cached(upstream_calls):
    provider = CachedHeaderAuthProvider(ttl_seconds=60)

    assert not validate(provider, "bad-1")
    assert not validate(provider, "bad-1")
    assert upstream_calls == ["bad-1", "bad-1"]


def test_cache_is_bounded_and_keeps_digests_only(upstream_calls):
    provider = CachedHeaderAuthProvider(ttl_seconds=60, max_entries=2)

    for token in ("good-1", "good-2", "good-3"):
        validate(provider, token)
    validate(provider, "good-1")

    assert len(provider._valid_until) == 2
    assert upstream_calls == ["good-1", "good-2", "good-3", "good-1"]
    assert not any(token in key for key in provider._valid_until for token in ("good-1", "good-2", "good-3"))
