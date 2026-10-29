# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Personal access token authentication with a short-lived validation cache."""

from __future__ import annotations

import hashlib
import re
import time
from collections import OrderedDict

from fastmcp.server.auth.auth import AccessToken
from fastmcp.server.dependencies import get_http_headers
from fastmcp.utilities.logging import get_logger
from plane_mcp.auth import PlaneHeaderAuthProvider

logger = get_logger(__name__)

# Workspace slugs as BananaZ creates them; the slug is interpolated into API URL paths.
WORKSPACE_SLUG = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,47}$")


class CachedHeaderAuthProvider(PlaneHeaderAuthProvider):
    """PlaneHeaderAuthProvider that remembers tokens BananaZ recently accepted.

    Upstream validates the token against /api/v1/users/me/ on every MCP request, and in
    stateless HTTP mode every tool call is its own request. BananaZ rate-limits each API
    key (60/minute by default), so validation alone would spend half of a client's budget.
    A token BananaZ accepted is trusted for `ttl_seconds` by this pre-check only: every tool
    call still sends the token to BananaZ, which rejects a revoked token at once (the MCP
    handshake may succeed for up to `ttl_seconds`, the calls do not). Rejections are never
    cached. Only SHA-256 digests of tokens are kept in memory.
    """

    def __init__(self, *, ttl_seconds: float = 60, max_entries: int = 1024, **kwargs) -> None:
        super().__init__(**kwargs)
        self._ttl_seconds = ttl_seconds
        self._max_entries = max_entries
        self._valid_until: OrderedDict[str, float] = OrderedDict()

    async def verify_token(self, token: str) -> AccessToken | None:
        try:
            slug = get_http_headers().get("x-workspace-slug", "")
        except RuntimeError:  # no HTTP request in context; upstream handles that case
            slug = ""
        if slug and not WORKSPACE_SLUG.match(slug):
            logger.warning("Rejected request: x-workspace-slug is not a valid workspace slug")
            return None
        return await super().verify_token(token)

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
