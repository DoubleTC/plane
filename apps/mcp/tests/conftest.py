# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os

import pytest
import responses

# The stdio-style server reads the API key and workspace from the environment.
os.environ.setdefault("PLANE_BASE_URL", "http://plane.test")
os.environ.setdefault("PLANE_API_KEY", "plane_api_test_key")
os.environ.setdefault("PLANE_WORKSPACE_SLUG", "acme")

from bananaz_mcp.server import build_server  # noqa: E402


@pytest.fixture(scope="session")
def server():
    return build_server()


@pytest.fixture
def mocked_api():
    with responses.RequestsMock(assert_all_requests_are_fired=False) as rsps:
        yield rsps
