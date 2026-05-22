# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Drop PermissionScheme + CustomRoleScheme — Custom Roles are now metadata only.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0122_add_gac_models"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="customrolescheme",
            name="custom_role_scheme_unique_role_scheme_active",
        ),
        migrations.RemoveConstraint(
            model_name="permissionscheme",
            name="permission_scheme_unique_ws_name_scope_active",
        ),
        migrations.DeleteModel(name="CustomRoleScheme"),
        migrations.DeleteModel(name="PermissionScheme"),
    ]
