/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
// components
import { SettingsHeading } from "@/components/settings/heading";
// local imports
import { CoffeeDonate } from "../../license/coffee-donate";

export const BillingRoot = observer(function BillingRoot() {
  const { t } = useTranslation();

  return (
    <section className="relative scrollbar-hide size-full overflow-y-auto">
      <SettingsHeading
        title={t("workspace_settings.settings.billing_and_plans.heading")}
        description={t("workspace_settings.settings.billing_and_plans.description")}
      />
      {/* This fork doesn't sell paid plans — it asks for a coffee instead. */}
      <CoffeeDonate className="mt-8" />
    </section>
  );
});
