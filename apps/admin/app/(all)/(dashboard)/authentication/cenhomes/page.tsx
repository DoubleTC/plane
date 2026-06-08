/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { setPromiseToast } from "@plane/propel/toast";
import { Loader, ToggleSwitch } from "@plane/ui";
// assets
import cenhomesLogo from "@/app/assets/logos/cenhomes-logo.svg?url";
// components
import { AuthenticationMethodCard } from "@/components/authentication/authentication-method-card";
import { PageWrapper } from "@/components/common/page-wrapper";
// hooks
import { useInstance } from "@/hooks/store";
// types
import type { Route } from "./+types/page";
// local
import { InstanceCenhomesConfigForm } from "./form";

const InstanceCenhomesAuthenticationPage = observer(function InstanceCenhomesAuthenticationPage(
  _props: Route.ComponentProps
) {
  // store
  const { fetchInstanceConfigurations, formattedConfig, updateInstanceConfigurations } = useInstance();
  // state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // config
  const enableCenhomesConfig = formattedConfig?.IS_CENHOMES_ENABLED ?? "";

  useSWR("INSTANCE_CONFIGURATIONS", () => fetchInstanceConfigurations());

  const updateConfig = async (key: "IS_CENHOMES_ENABLED", value: string) => {
    setIsSubmitting(true);

    const payload = {
      [key]: value,
    };

    const updateConfigPromise = updateInstanceConfigurations(payload);

    setPromiseToast(updateConfigPromise, {
      loading: "Saving Configuration",
      success: {
        title: "Configuration saved",
        message: () => `Cenhomes ID authentication is now ${value === "1" ? "active" : "disabled"}.`,
      },
      error: {
        title: "Error",
        message: () => "Failed to save configuration",
      },
    });

    await updateConfigPromise
      .then(() => {
        setIsSubmitting(false);
        return undefined;
      })
      .catch((err) => {
        console.error(err);
        setIsSubmitting(false);
      });
  };
  return (
    <PageWrapper
      customHeader={
        <AuthenticationMethodCard
          name="Cenhomes ID"
          description="Allow members to log in or sign up to BananaZ with their Cenhomes ID accounts."
          icon={<img src={cenhomesLogo} height={24} width={24} alt="Cenhomes Logo" />}
          config={
            <ToggleSwitch
              value={Boolean(parseInt(enableCenhomesConfig))}
              onChange={() => {
                if (Boolean(parseInt(enableCenhomesConfig)) === true) {
                  updateConfig("IS_CENHOMES_ENABLED", "0");
                } else {
                  updateConfig("IS_CENHOMES_ENABLED", "1");
                }
              }}
              size="sm"
              disabled={isSubmitting || !formattedConfig}
            />
          }
          disabled={isSubmitting || !formattedConfig}
          withBorder={false}
        />
      }
    >
      {formattedConfig ? (
        <InstanceCenhomesConfigForm config={formattedConfig} />
      ) : (
        <Loader className="space-y-8">
          <Loader.Item height="50px" width="25%" />
          <Loader.Item height="50px" />
          <Loader.Item height="50px" />
          <Loader.Item height="50px" />
          <Loader.Item height="50px" width="50%" />
        </Loader>
      )}
    </PageWrapper>
  );
});

export const meta: Route.MetaFunction = () => [{ title: "Cenhomes ID Authentication - God Mode" }];

export default InstanceCenhomesAuthenticationPage;
