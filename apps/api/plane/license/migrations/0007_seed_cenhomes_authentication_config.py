# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import os

from django.db import migrations


# Cenhomes ID authentication configuration keys. Mirrors the entries in
# plane/utils/instance_config_variables/core.py so existing instances (where
# configure_instance has already run and is gated by the presence of other
# IS_*_ENABLED keys) still get these rows. Without a row the configuration
# PATCH endpoint silently no-ops, so the admin toggle cannot be enabled.
CENHOMES_CONFIG = [
    {"key": "IS_CENHOMES_ENABLED", "default": "0", "is_encrypted": False},
    {"key": "CENHOMES_CLIENT_ID", "default": "", "is_encrypted": False},
    {"key": "CENHOMES_CLIENT_SECRET", "default": "", "is_encrypted": True},
    {
        "key": "CENHOMES_AUTHORIZE_URL",
        "default": "https://id.cenhomes.vn/connect/authorize",
        "is_encrypted": False,
    },
    {"key": "CENHOMES_TOKEN_URL", "default": "https://id.cenhomes.vn/connect/token", "is_encrypted": False},
    {"key": "CENHOMES_USERINFO_URL", "default": "https://id.cenhomes.vn/connect/userinfo", "is_encrypted": False},
    {"key": "CENHOMES_SCOPE", "default": "openid profile email phone", "is_encrypted": False},
    {"key": "CENHOMES_FALLBACK_EMAIL_DOMAIN", "default": "pm.cenz.pro", "is_encrypted": False},
    {"key": "ENABLE_CENHOMES_SYNC", "default": "0", "is_encrypted": False},
]


def seed_cenhomes_config(apps, schema_editor):
    from plane.license.utils.encryption import encrypt_data

    InstanceConfiguration = apps.get_model("license", "InstanceConfiguration")

    for item in CENHOMES_CONFIG:
        if InstanceConfiguration.objects.filter(key=item["key"]).exists():
            continue
        raw_value = os.environ.get(item["key"], item["default"])
        value = encrypt_data(raw_value) if item["is_encrypted"] else raw_value
        InstanceConfiguration.objects.create(
            key=item["key"],
            value=value,
            category="CENHOMES",
            is_encrypted=item["is_encrypted"],
        )


def unseed_cenhomes_config(apps, schema_editor):
    InstanceConfiguration = apps.get_model("license", "InstanceConfiguration")
    InstanceConfiguration.objects.filter(key__in=[item["key"] for item in CENHOMES_CONFIG]).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("license", "0006_instance_is_current_version_deprecated"),
    ]

    operations = [
        migrations.RunPython(seed_cenhomes_config, unseed_cenhomes_config),
    ]
