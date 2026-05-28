# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import os
import re
import uuid
from datetime import datetime
from urllib.parse import urlencode

import pytz
import requests

# Django imports
from django.utils import timezone

# Module imports
from plane.authentication.adapter.error import (
    AUTHENTICATION_ERROR_CODES,
    AuthenticationException,
)
from plane.authentication.adapter.oauth import OauthAdapter
from plane.db.models import Account, Profile, User
from plane.license.utils.instance_value import get_configuration_value


class CenhomesOAuthProvider(OauthAdapter):
    """Cenhomes ID (OpenID Connect) provider.

    Cenhomes' primary identity is a phone number, so an email may be absent.
    To keep Plane's email-keyed user model intact we resolve identity by the
    durable Cenhomes subject id (stored on the Account row's
    provider_account_id) first, fall back to a real email if present, and only
    then mint a deterministic placeholder email. The real phone number is kept
    on User.mobile_number.
    """

    provider = "cenhomes"

    def __init__(self, request, code=None, state=None, callback=None):
        (
            CENHOMES_CLIENT_ID,
            CENHOMES_CLIENT_SECRET,
            CENHOMES_AUTHORIZE_URL,
            CENHOMES_TOKEN_URL,
            CENHOMES_USERINFO_URL,
            CENHOMES_SCOPE,
            CENHOMES_FALLBACK_EMAIL_DOMAIN,
        ) = get_configuration_value(
            [
                {
                    "key": "CENHOMES_CLIENT_ID",
                    "default": os.environ.get("CENHOMES_CLIENT_ID"),
                },
                {
                    "key": "CENHOMES_CLIENT_SECRET",
                    "default": os.environ.get("CENHOMES_CLIENT_SECRET"),
                },
                {
                    "key": "CENHOMES_AUTHORIZE_URL",
                    "default": os.environ.get("CENHOMES_AUTHORIZE_URL", "https://id.cenhomes.vn/connect/authorize"),
                },
                {
                    "key": "CENHOMES_TOKEN_URL",
                    "default": os.environ.get("CENHOMES_TOKEN_URL", "https://id.cenhomes.vn/connect/token"),
                },
                {
                    "key": "CENHOMES_USERINFO_URL",
                    "default": os.environ.get("CENHOMES_USERINFO_URL", "https://id.cenhomes.vn/connect/userinfo"),
                },
                {
                    "key": "CENHOMES_SCOPE",
                    "default": os.environ.get("CENHOMES_SCOPE", "openid profile email phone"),
                },
                {
                    "key": "CENHOMES_FALLBACK_EMAIL_DOMAIN",
                    "default": os.environ.get("CENHOMES_FALLBACK_EMAIL_DOMAIN", "pm.cenz.pro"),
                },
            ]
        )

        if not (CENHOMES_CLIENT_ID and CENHOMES_CLIENT_SECRET):
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["CENHOMES_NOT_CONFIGURED"],
                error_message="CENHOMES_NOT_CONFIGURED",
            )

        self.token_url = CENHOMES_TOKEN_URL
        self.userinfo_url = CENHOMES_USERINFO_URL
        self.scope = CENHOMES_SCOPE or "openid profile email phone"
        self.fallback_email_domain = (CENHOMES_FALLBACK_EMAIL_DOMAIN or "pm.cenz.pro").lstrip("@")

        client_id = CENHOMES_CLIENT_ID
        client_secret = CENHOMES_CLIENT_SECRET

        redirect_uri = (
            f"""{"https" if request.is_secure() else "http"}://{request.get_host()}/auth/cenhomes/callback/"""
        )
        url_params = {
            "client_id": client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": self.scope,
            "state": state,
        }
        auth_url = f"{CENHOMES_AUTHORIZE_URL.rstrip('?')}?{urlencode(url_params)}"

        super().__init__(
            request,
            self.provider,
            client_id,
            self.scope,
            redirect_uri,
            auth_url,
            self.token_url,
            self.userinfo_url,
            client_secret,
            code,
            callback=callback,
        )

    def get_user_token(self, data, headers=None, auth=None):
        # Override to surface the provider's actual error body in logs — the
        # base adapter only logs a generic warning, which makes diagnosing
        # token-exchange failures (bad secret, redirect_uri mismatch, …) hard.
        try:
            response = requests.post(self.get_token_url(), data=data, headers=headers or {}, auth=auth)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            body = getattr(getattr(e, "response", None), "text", "")
            self.logger.error(f"Cenhomes token exchange failed: {body or e}")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["CENHOMES_OAUTH_PROVIDER_ERROR"],
                error_message="CENHOMES_OAUTH_PROVIDER_ERROR",
            )

    def get_user_response(self):
        try:
            headers = {
                "Authorization": f"Bearer {self.token_data.get('access_token')}",
                "Accept": "application/json",
            }
            response = requests.get(self.get_user_info_url(), headers=headers)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as e:
            body = getattr(getattr(e, "response", None), "text", "")
            self.logger.error(f"Cenhomes userinfo failed: {body or e}")
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["CENHOMES_OAUTH_PROVIDER_ERROR"],
                error_message="CENHOMES_OAUTH_PROVIDER_ERROR",
            )

    def set_token_data(self):
        # Cenhomes ID (IdentityServer) authenticates the client at the token
        # endpoint via HTTP Basic auth (client_secret_basic). Sending the
        # credentials in the body (client_secret_post) is rejected with
        # `invalid_client`, so we pass them through the Authorization header
        # and keep only the grant params in the body.
        data = {
            "grant_type": "authorization_code",
            "code": self.code,
            "redirect_uri": self.redirect_uri,
        }
        token_response = self.get_user_token(
            data=data,
            headers={"Accept": "application/json", "Content-Type": "application/x-www-form-urlencoded"},
            auth=(self.client_id, self.client_secret),
        )
        expires_in = token_response.get("expires_in")
        super().set_token_data(
            {
                "access_token": token_response.get("access_token"),
                "refresh_token": token_response.get("refresh_token", None),
                "access_token_expired_at": (
                    datetime.fromtimestamp(timezone.now().timestamp() + expires_in, tz=pytz.utc)
                    if expires_in
                    else None
                ),
                "refresh_token_expired_at": None,
                "id_token": token_response.get("id_token", ""),
            }
        )

    def set_user_data(self):
        user_info = self.get_user_response()

        # Cenhomes uses OIDC standard claims, but tolerate a few aliases.
        provider_id = str(user_info.get("sub") or user_info.get("id") or "")
        email = self._extract_first(user_info, ["email"])
        phone = self._extract_first(user_info, ["phone_number", "phoneNumber", "phone"])
        first_name = self._extract_first(user_info, ["given_name", "first_name"])
        last_name = self._extract_first(user_info, ["family_name", "last_name"])
        full_name = self._extract_first(user_info, ["name", "fullName", "full_name", "preferred_username"])

        if not first_name and full_name:
            # Best-effort split when only a display name is provided.
            parts = full_name.split(" ", 1)
            first_name = parts[0]
            last_name = last_name or (parts[1] if len(parts) > 1 else "")

        super().set_user_data(
            {
                "email": email,
                "user": {
                    "provider_id": provider_id,
                    "email": email,
                    "phone": phone,
                    "first_name": first_name or "",
                    "last_name": last_name or "",
                    "display_name": full_name or "",
                    "avatar": user_info.get("picture") or user_info.get("avatar") or "",
                    "is_password_autoset": True,
                },
            }
        )

    @staticmethod
    def _extract_first(payload, keys):
        for key in keys:
            value = payload.get(key)
            if value:
                return str(value)
        return None

    def _resolve_email(self, provider_id, email, phone):
        """Pick a usable, unique email for Plane's email-keyed user model.

        Prefers the real email; otherwise mints a deterministic placeholder.
        The placeholder follows the Cenhomes ecosystem convention
        ({digits}@domain) so the same person maps to the same address across
        systems, falling back to the immutable subject id when no phone exists.
        """
        if email:
            try:
                return self.sanitize_email(email)
            except AuthenticationException:
                pass

        if phone:
            digits = re.sub(r"\D+", "", phone)
            if digits:
                return f"{digits}@{self.fallback_email_domain}"

        return f"cenhomes-{provider_id}@{self.fallback_email_domain}"

    def complete_login_or_signup(self):
        user_info = self.user_data.get("user", {})
        provider_id = user_info.get("provider_id")
        phone = user_info.get("phone")

        if not provider_id:
            # Without a stable subject id we cannot safely link the account.
            raise AuthenticationException(
                error_code=AUTHENTICATION_ERROR_CODES["CENHOMES_OAUTH_PROVIDER_ERROR"],
                error_message="CENHOMES_OAUTH_PROVIDER_ERROR",
            )

        # 1) Durable link: resolve by the stored Cenhomes subject id.
        account = (
            Account.objects.filter(provider=self.provider, provider_account_id=provider_id)
            .select_related("user")
            .first()
        )
        user = account.user if account else None

        # 2) Otherwise resolve by a real email (links an existing Plane user).
        email = self._resolve_email(provider_id, self.user_data.get("email"), phone)
        if user is None:
            user = User.objects.filter(email=email).first()

        is_existing = bool(user)

        # 3) Create a new user when nothing matched.
        if user is None:
            self._Adapter__check_signup(email)

            user = User(email=email, username=uuid.uuid4().hex)
            user.set_password(uuid.uuid4().hex)
            user.is_password_autoset = True
            # Email is verified only when Cenhomes actually returned one.
            user.is_email_verified = bool(self.user_data.get("email"))
            user.first_name = user_info.get("first_name", "") or ""
            user.last_name = user_info.get("last_name", "") or ""
            display_name = user_info.get("display_name") or User.get_display_name(email)
            user.display_name = display_name
            if phone:
                user.mobile_number = phone
            user.save()

            Profile.objects.create(user=user)
        else:
            # Keep the phone number current on subsequent logins.
            if phone and user.mobile_number != phone:
                user.mobile_number = phone
                user.save(update_fields=["mobile_number"])

        # Optional IDP sync (only for already-existing users, matching core).
        if self.check_sync_enabled() and is_existing:
            user = self.sync_user_data(user=user)

        user = self.save_user_data(user=user)

        if self.callback:
            self.callback(user, is_existing, self.request)

        if self.token_data:
            self.create_update_account(user=user)

        return user
