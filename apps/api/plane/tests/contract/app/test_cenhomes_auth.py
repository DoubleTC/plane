# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import json
import uuid
from unittest.mock import MagicMock, patch
from urllib.parse import parse_qs, urlparse

import pytest
from django.core.cache import cache
from django.test import Client
from django.utils import timezone
from rest_framework import status

from plane.authentication.provider.oauth import cenhomes
from plane.db.models import Account, User, WorkspaceMemberInvite
from plane.license.models import Instance

DOMAIN = "pm.cenz.pro"
PHONE = "+84 912 345 678"


@pytest.fixture(autouse=True)
def cenhomes_config(monkeypatch, db):
    monkeypatch.setenv("CENHOMES_CLIENT_ID", "bananaz")
    monkeypatch.setenv("CENHOMES_CLIENT_SECRET", "secret")
    monkeypatch.setenv("CENHOMES_FALLBACK_EMAIL_DOMAIN", DOMAIN)
    Instance.objects.update_or_create(
        instance_id=str(uuid.uuid4()),
        defaults={
            "instance_name": "BananaZ",
            "current_version": "1.4.2",
            "domain": "http://localhost:8000",
            "last_checked_at": timezone.now(),
            "is_setup_done": True,
        },
    )


@pytest.fixture
def browser():
    return Client(HTTP_USER_AGENT="Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/140.0")


def userinfo(sub="sub-1", email=None, email_verified=None, phone=PHONE, **extra):
    data = {"sub": sub, "name": "Nguyen Van A", "phone_number": phone, **extra}
    if email is not None:
        data["email"] = email
    if email_verified is not None:
        data["email_verified"] = email_verified
    return data


def mock_cenhomes(claims):
    """Patch the token and userinfo calls to Cenhomes ID."""
    token = MagicMock(status_code=200)
    token.json.return_value = {"access_token": "at", "expires_in": 3600, "token_type": "Bearer"}
    info = MagicMock(status_code=200)
    info.json.return_value = claims
    return (
        patch.object(cenhomes.requests, "post", return_value=token),
        patch.object(cenhomes.requests, "get", return_value=info),
    )


def login(browser, claims, *, start=True, state=None):
    """Run the Cenhomes login; returns (response, token-exchange mock)."""
    if start:
        assert browser.get("/auth/cenhomes/").status_code == status.HTTP_302_FOUND
    post_patch, get_patch = mock_cenhomes(claims)
    with post_patch as post, get_patch:
        query = "?code=abc" + (f"&state={state}" if state else "")
        response = browser.get(f"/auth/cenhomes/callback/{query}")
    return response, post


def logged_in_user(browser):
    user_id = browser.session.get("_auth_user_id")
    return User.objects.filter(pk=user_id).first() if user_id else None


def error_code(response):
    return parse_qs(urlparse(response["Location"]).query).get("error_code", [None])[0]


@pytest.mark.contract
class TestCenhomesIdentity:
    @pytest.mark.django_db
    def test_unverified_email_never_takes_over_an_existing_account(self, browser):
        victim = User.objects.create(email="victim@example.com", username="victim", is_email_verified=True)

        login(browser, userinfo(email="victim@example.com", email_verified=False))

        user = logged_in_user(browser)
        assert user is not None and user != victim
        assert user.email == f"84912345678@{DOMAIN}"
        assert user.is_email_verified is False
        assert not Account.objects.filter(user=victim).exists()

    @pytest.mark.django_db
    def test_email_without_verification_claim_is_treated_as_unverified(self, browser):
        login(browser, userinfo(email="someone@example.com"))

        user = logged_in_user(browser)
        assert user.email == f"84912345678@{DOMAIN}"
        assert not User.objects.filter(email="someone@example.com").exists()

    @pytest.mark.django_db
    def test_verified_email_links_an_existing_account(self, browser):
        existing = User.objects.create(email="owner@example.com", username="owner", is_email_verified=True)

        login(browser, userinfo(email="owner@example.com", email_verified=True))

        assert logged_in_user(browser) == existing
        assert Account.objects.filter(user=existing, provider="cenhomes", provider_account_id="sub-1").exists()

    @pytest.mark.django_db
    def test_verified_email_as_string_claim_is_accepted(self, browser):
        login(browser, userinfo(email="new@example.com", email_verified="true"))

        user = logged_in_user(browser)
        assert user.email == "new@example.com"
        assert user.is_email_verified is True

    @pytest.mark.django_db
    def test_account_linked_to_another_cenhomes_id_is_not_relinked(self, browser):
        owner = User.objects.create(email="owner@example.com", username="owner")
        Account.objects.create(user=owner, provider="cenhomes", provider_account_id="sub-owner", access_token="x")

        login(browser, userinfo(sub="sub-other", email="owner@example.com", email_verified=True))

        user = logged_in_user(browser)
        assert user != owner
        assert user.email == f"84912345678@{DOMAIN}"

    @pytest.mark.django_db
    def test_returning_user_is_found_by_subject_id(self, browser):
        login(browser, userinfo(email="first@example.com", email_verified=True))
        first = logged_in_user(browser)
        browser.logout()

        login(browser, userinfo(email="changed@example.com", email_verified=True, phone="+84 900 000 000"))

        assert logged_in_user(browser) == first

    @pytest.mark.django_db
    def test_phone_based_address_already_taken_falls_back_to_subject_id(self, browser):
        squatter = User.objects.create(email=f"84912345678@{DOMAIN}", username="squatter")

        login(browser, userinfo(sub="sub-9"))

        user = logged_in_user(browser)
        assert user != squatter
        assert user.email == f"cenhomes-sub-9@{DOMAIN}"


@pytest.mark.contract
class TestCenhomesBlockedAccounts:
    @pytest.mark.django_db
    def test_bot_accounts_cannot_log_in(self, browser):
        User.objects.create(email="bot@example.com", username="bot", is_bot=True)

        response, _ = login(browser, userinfo(email="bot@example.com", email_verified=True))

        assert error_code(response) == "5017"
        assert logged_in_user(browser) is None

    @pytest.mark.django_db
    def test_deactivated_accounts_are_not_reactivated(self, browser):
        user = User.objects.create(email="gone@example.com", username="gone")
        Account.objects.create(user=user, provider="cenhomes", provider_account_id="sub-1", access_token="x")
        User.objects.filter(pk=user.pk).update(is_active=False, last_logout_time=timezone.now())

        response, _ = login(browser, userinfo())

        assert error_code(response) == "5019"
        user.refresh_from_db()
        assert user.is_active is False


@pytest.mark.contract
class TestCenhomesLoginCsrf:
    @pytest.mark.django_db
    def test_callback_without_a_started_login_is_rejected(self, browser):
        response, token_exchange = login(browser, userinfo(), start=False)

        assert error_code(response) is not None
        assert not token_exchange.called
        assert logged_in_user(browser) is None

    @pytest.mark.django_db
    def test_started_login_completes_when_cenhomes_drops_state(self, browser):
        login(browser, userinfo())

        assert logged_in_user(browser) is not None

    @pytest.mark.django_db
    def test_returned_state_must_match(self, browser):
        response, token_exchange = login(browser, userinfo(), state="forged")

        assert error_code(response) is not None
        assert not token_exchange.called

    @pytest.mark.django_db
    def test_matching_state_is_accepted(self, browser):
        browser.get("/auth/cenhomes/")
        state = browser.session[cenhomes.LOGIN_SESSION_KEY]["state"]

        login(browser, userinfo(), start=False, state=state)

        assert logged_in_user(browser) is not None

    @pytest.mark.django_db
    def test_a_started_login_can_be_used_once(self, browser):
        login(browser, userinfo())
        browser.logout()

        response, token_exchange = login(browser, userinfo(), start=False)

        assert error_code(response) is not None
        assert not token_exchange.called

    @pytest.mark.django_db
    def test_a_stale_login_is_rejected(self, browser):
        browser.get("/auth/cenhomes/")
        session = browser.session
        session[cenhomes.LOGIN_SESSION_KEY]["started_at"] -= cenhomes.LOGIN_TTL_SECONDS + 1
        session.save()

        response, token_exchange = login(browser, userinfo(), start=False)

        assert error_code(response) is not None
        assert not token_exchange.called


@pytest.mark.contract
class TestInvitationsNeedVerifiedEmail:
    @pytest.mark.django_db
    def test_invitations_are_hidden_until_the_email_is_verified(self, api_client, create_user, workspace):
        invite = WorkspaceMemberInvite.objects.create(workspace=workspace, email=create_user.email, role=15, token="t")
        api_client.force_authenticate(user=create_user)

        User.objects.filter(pk=create_user.pk).update(is_email_verified=False)
        create_user.refresh_from_db()
        hidden = api_client.get("/api/users/me/workspaces/invitations/")
        join = api_client.post(
            "/api/users/me/workspaces/invitations/", {"invitations": [str(invite.id)]}, format="json"
        )

        User.objects.filter(pk=create_user.pk).update(is_email_verified=True)
        create_user.refresh_from_db()
        visible = api_client.get("/api/users/me/workspaces/invitations/")

        assert hidden.status_code == status.HTTP_200_OK and hidden.data == []
        assert join.status_code == status.HTTP_403_FORBIDDEN
        assert [str(i["id"]) for i in visible.data] == [str(invite.id)]

    @pytest.mark.django_db
    def test_email_changed_with_a_valid_code_is_verified(self, api_client, create_user):
        User.objects.filter(pk=create_user.pk).update(is_email_verified=False, email=f"84912345678@{DOMAIN}")
        create_user.refresh_from_db()
        new_email = "real@example.com"
        cache.set(f"magic_email_update_{create_user.id}_{new_email}", json.dumps({"token": "123456"}), 600)
        api_client.force_authenticate(user=create_user)

        with patch("plane.app.views.user.base.send_email_update_confirmation.delay"):
            response = api_client.patch("/api/users/me/email/", {"email": new_email, "code": "123456"}, format="json")

        assert response.status_code == status.HTTP_200_OK, response.data
        create_user.refresh_from_db()
        assert create_user.email == new_email
        assert create_user.is_email_verified is True
