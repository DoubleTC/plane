# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Personal access token authentication with a short-lived validation cache."""

from __future__ import annotations

import hashlib
import time
from collections import OrderedDict

from plane_mcp.auth import PlaneHeaderAuthProvider


class CachedHeaderAuthProvider(PlaneHeaderAuthProvider):
    """PlaneHeaderAuthProvider that remembers tokens BananaZ recently accepted.

    Upstream validates the token against /api/v1/users/me/ on every MCP request, and in
    stateless HTTP mode every tool call is its own request. BananaZ rate-limits each API
    key (60/minute by default), so validation alone would spend half of a client's budget.
    A token BananaZ accepted is trusted for `ttl_seconds`; a revoked token therefore keeps
    working through the MCP server for at most that long. Rejections are never cached.
    Only SHA-256 digests of tokens are kept in memory.
    """

    def __init__(self, *, ttl_seconds: float = 60, max_entries: int = 1024, **kwargs) -> None:
        super().__init__(**kwargs)
        self._ttl_seconds = ttl_seconds
        self._max_entries = max_entries
        self._valid_until: OrderedDict[str, float] = OrderedDict()

    async def _validate_api_key(self, token: str) -> bool:
        key = hashlib.sha256(token.encode()).hexdigest()
        now = time.monotonic()
        if self._valid_until.get(key, 0) > now:
            self._valid_until.move_to_end(key)
            return True

        valid = await super()._validate_api_key(token)
        if valid:
            self._valid_until[key] = now + self._ttl_seconds
            self._valid_until.move_to_end(key)
            while len(self._valid_until) > self._max_entries:
                self._valid_until.popitem(last=False)
        else:
            self._valid_until.pop(key, None)
        return valid
