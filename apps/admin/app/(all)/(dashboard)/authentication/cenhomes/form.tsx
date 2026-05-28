/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { isEmpty } from "lodash-es";
import Link from "next/link";
import { useForm } from "react-hook-form";
// plane internal packages
import { API_BASE_URL } from "@plane/constants";
import { Button, getButtonStyling } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IFormattedInstanceConfiguration, TInstanceCenhomesAuthenticationConfigurationKeys } from "@plane/types";
// components
import { CodeBlock } from "@/components/common/code-block";
import { ConfirmDiscardModal } from "@/components/common/confirm-discard-modal";
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import type { TCopyField } from "@/components/common/copy-field";
import { CopyField } from "@/components/common/copy-field";
// hooks
import { useInstance } from "@/hooks/store";

type Props = {
  config: IFormattedInstanceConfiguration;
};

type CenhomesConfigFormValues = Record<TInstanceCenhomesAuthenticationConfigurationKeys, string>;

export function InstanceCenhomesConfigForm(props: Props) {
  const { config } = props;
  // states
  const [isDiscardChangesModalOpen, setIsDiscardChangesModalOpen] = useState(false);
  // store hooks
  const { updateInstanceConfigurations } = useInstance();
  // form data
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<CenhomesConfigFormValues>({
    defaultValues: {
      CENHOMES_CLIENT_ID: config["CENHOMES_CLIENT_ID"],
      CENHOMES_CLIENT_SECRET: config["CENHOMES_CLIENT_SECRET"],
      CENHOMES_AUTHORIZE_URL: config["CENHOMES_AUTHORIZE_URL"] || "https://id.cenhomes.vn/connect/authorize",
      CENHOMES_TOKEN_URL: config["CENHOMES_TOKEN_URL"] || "https://id.cenhomes.vn/connect/token",
      CENHOMES_USERINFO_URL: config["CENHOMES_USERINFO_URL"] || "https://id.cenhomes.vn/connect/userinfo",
      CENHOMES_SCOPE: config["CENHOMES_SCOPE"] || "openid profile email phone",
      CENHOMES_FALLBACK_EMAIL_DOMAIN: config["CENHOMES_FALLBACK_EMAIL_DOMAIN"] || "pm.cenz.pro",
    },
  });

  const originURL = !isEmpty(API_BASE_URL) ? API_BASE_URL : typeof window !== "undefined" ? window.location.origin : "";

  const CENHOMES_FORM_FIELDS: TControllerInputFormField[] = [
    {
      key: "CENHOMES_CLIENT_ID",
      type: "text",
      label: "Client ID",
      description: "The OAuth client id issued by Cenhomes ID for this Plane instance.",
      placeholder: "cenfiliate",
      error: Boolean(errors.CENHOMES_CLIENT_ID),
      required: true,
    },
    {
      key: "CENHOMES_CLIENT_SECRET",
      type: "password",
      label: "Client Secret",
      description: "The OAuth client secret issued by Cenhomes ID.",
      placeholder: "••••••••••••••••",
      error: Boolean(errors.CENHOMES_CLIENT_SECRET),
      required: true,
    },
    {
      key: "CENHOMES_AUTHORIZE_URL",
      type: "text",
      label: "Authorize URL",
      description: (
        <>
          The OIDC authorize endpoint, e.g. <CodeBlock>https://id.cenhomes.vn/connect/authorize</CodeBlock>.
        </>
      ),
      placeholder: "https://id.cenhomes.vn/connect/authorize",
      error: Boolean(errors.CENHOMES_AUTHORIZE_URL),
      required: true,
    },
    {
      key: "CENHOMES_TOKEN_URL",
      type: "text",
      label: "Token URL",
      description: (
        <>
          The OIDC token endpoint, e.g. <CodeBlock>https://id.cenhomes.vn/connect/token</CodeBlock>.
        </>
      ),
      placeholder: "https://id.cenhomes.vn/connect/token",
      error: Boolean(errors.CENHOMES_TOKEN_URL),
      required: true,
    },
    {
      key: "CENHOMES_USERINFO_URL",
      type: "text",
      label: "Userinfo URL",
      description: (
        <>
          The OIDC userinfo endpoint, e.g. <CodeBlock>https://id.cenhomes.vn/connect/userinfo</CodeBlock>.
        </>
      ),
      placeholder: "https://id.cenhomes.vn/connect/userinfo",
      error: Boolean(errors.CENHOMES_USERINFO_URL),
      required: true,
    },
    {
      key: "CENHOMES_SCOPE",
      type: "text",
      label: "Scope",
      description: (
        <>
          Space-separated OAuth scopes. <CodeBlock>openid profile email phone</CodeBlock> is recommended.
        </>
      ),
      placeholder: "openid profile email phone",
      error: Boolean(errors.CENHOMES_SCOPE),
      required: false,
    },
    {
      key: "CENHOMES_FALLBACK_EMAIL_DOMAIN",
      type: "text",
      label: "Fallback email domain",
      description: (
        <>
          When Cenhomes returns no email, Plane mints a placeholder address (<CodeBlock>{`{phone}@domain`}</CodeBlock>)
          on this domain. Identity is still linked by the Cenhomes ID.
        </>
      ),
      placeholder: "pm.cenz.pro",
      error: Boolean(errors.CENHOMES_FALLBACK_EMAIL_DOMAIN),
      required: false,
    },
  ];

  const CENHOMES_SERVICE_FIELD: TCopyField[] = [
    {
      key: "Callback_URL",
      label: "Callback URL",
      url: `${originURL}/auth/cenhomes/callback/`,
      description: (
        <>
          We auto-generate this. Register it as the <CodeBlock darkerShade>Redirect URI</CodeBlock> of your Cenhomes ID
          OAuth client.
        </>
      ),
    },
  ];

  const onSubmit = async (formData: CenhomesConfigFormValues) => {
    const payload: Partial<CenhomesConfigFormValues> = { ...formData };

    try {
      const response = await updateInstanceConfigurations(payload);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Done!",
        message: "Your Cenhomes ID authentication is configured. You should test it now.",
      });
      reset({
        CENHOMES_CLIENT_ID: response.find((item) => item.key === "CENHOMES_CLIENT_ID")?.value,
        CENHOMES_CLIENT_SECRET: response.find((item) => item.key === "CENHOMES_CLIENT_SECRET")?.value,
        CENHOMES_AUTHORIZE_URL: response.find((item) => item.key === "CENHOMES_AUTHORIZE_URL")?.value,
        CENHOMES_TOKEN_URL: response.find((item) => item.key === "CENHOMES_TOKEN_URL")?.value,
        CENHOMES_USERINFO_URL: response.find((item) => item.key === "CENHOMES_USERINFO_URL")?.value,
        CENHOMES_SCOPE: response.find((item) => item.key === "CENHOMES_SCOPE")?.value,
        CENHOMES_FALLBACK_EMAIL_DOMAIN: response.find((item) => item.key === "CENHOMES_FALLBACK_EMAIL_DOMAIN")?.value,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleGoBack = (e: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    if (isDirty) {
      e.preventDefault();
      setIsDiscardChangesModalOpen(true);
    }
  };

  return (
    <>
      <ConfirmDiscardModal
        isOpen={isDiscardChangesModalOpen}
        onDiscardHref="/authentication"
        handleClose={() => setIsDiscardChangesModalOpen(false)}
      />
      <div className="flex flex-col gap-8">
        <div className="grid w-full grid-cols-2 gap-x-12 gap-y-8">
          <div className="col-span-2 flex flex-col gap-y-4 pt-1 md:col-span-1">
            <div className="pt-2.5 text-18 font-medium">Cenhomes ID-provided details for Plane</div>
            {CENHOMES_FORM_FIELDS.map((field) => (
              <ControllerInput
                key={field.key}
                control={control}
                type={field.type}
                name={field.key}
                label={field.label}
                description={field.description}
                placeholder={field.placeholder}
                error={field.error}
                required={field.required}
              />
            ))}
            <div className="flex flex-col gap-1 pt-4">
              <div className="flex items-center gap-4">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={(e) => void handleSubmit(onSubmit)(e)}
                  loading={isSubmitting}
                  disabled={!isDirty}
                >
                  {isSubmitting ? "Saving" : "Save changes"}
                </Button>
                <Link href="/authentication" className={getButtonStyling("secondary", "lg")} onClick={handleGoBack}>
                  Go back
                </Link>
              </div>
            </div>
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col gap-y-4 rounded-lg bg-layer-3 px-6 pt-1.5 pb-4">
              <div className="pt-2 text-18 font-medium">Plane-provided details for Cenhomes ID</div>
              {CENHOMES_SERVICE_FIELD.map((field) => (
                <CopyField key={field.key} label={field.label} url={field.url} description={field.description} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
