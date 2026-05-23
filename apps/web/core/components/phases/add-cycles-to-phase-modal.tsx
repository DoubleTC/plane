// Copyright (c) 2023-present Plane Software, Inc. and contributors
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { CheckIcon } from "@plane/propel/icons";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { CircularProgressIndicator } from "@plane/ui";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
import { renderFormattedDate } from "@plane/utils";
// hooks
import { useCycle } from "@/hooks/store/use-cycle";
import { usePhase } from "@/hooks/store/use-phase";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  phaseId: string;
  linkedCycleIds: string[];
};

export const AddCyclesToPhaseModal = observer(function AddCyclesToPhaseModal(props: Props) {
  const { isOpen, onClose, workspaceSlug, projectId, phaseId, linkedCycleIds } = props;
  // state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  // store
  const { getProjectCycleIds, getCycleById } = useCycle();
  const { addCyclesToPhase } = usePhase();
  const { t } = useTranslation();

  const allCycleIds = getProjectCycleIds(projectId) ?? [];
  // Exclude already-linked and archived cycles
  const availableCycleIds = allCycleIds.filter((id) => {
    if (linkedCycleIds.includes(id)) return false;
    const cycle = getCycleById(id);
    return cycle && !cycle.archived_at;
  });

  const handleToggle = (cycleId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(cycleId)) next.delete(cycleId);
      else next.add(cycleId);
      return next;
    });
  };

  const handleClose = () => {
    setSelected(new Set());
    onClose();
  };

  const handleSubmit = async () => {
    if (selected.size === 0) {
      setToast({ type: TOAST_TYPE.ERROR, title: t("phase.toast.cycles_add_error") });
      return;
    }
    setIsSubmitting(true);
    try {
      await addCyclesToPhase(workspaceSlug, projectId, phaseId, [...selected]);
      setToast({ type: TOAST_TYPE.SUCCESS, title: t("phase.toast.cycles_added") });
      handleClose();
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: t("phase.toast.cycles_add_error") });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <div className="p-4">
        <h3 className="text-base text-custom-text-100 mb-4 font-semibold">{t("phase.add_cycles")}</h3>

        {availableCycleIds.length === 0 ? (
          <p className="text-sm text-custom-text-400 py-6 text-center">{t("phase.empty_state.no_cycles_to_add")}</p>
        ) : (
          <ul className="vertical-scrollbar scrollbar-sm max-h-72 space-y-1 overflow-y-auto">
            {availableCycleIds.map((cycleId) => {
              const cycle = getCycleById(cycleId);
              if (!cycle) return null;

              const totalIssues = cycle.total_issues ?? 0;
              const completedIssues = cycle.completed_issues ?? 0;
              const progress = totalIssues > 0 ? Math.floor((completedIssues / totalIssues) * 100) : 0;
              const isSelected = selected.has(cycleId);

              return (
                <li key={cycleId}>
                  <button
                    type="button"
                    onClick={() => handleToggle(cycleId)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? "bg-custom-primary-100/10 text-custom-primary-100"
                        : "hover:bg-custom-background-80 text-custom-text-200"
                    }`}
                  >
                    <span className="flex-shrink-0">
                      <CircularProgressIndicator size={24} percentage={progress} strokeWidth={3}>
                        {progress === 100 ? (
                          <CheckIcon className="h-2 w-2 stroke-[2] text-accent-primary" />
                        ) : (
                          <span className="text-[7px] text-tertiary">{progress}%</span>
                        )}
                      </CircularProgressIndicator>
                    </span>
                    <span className="flex-1 truncate text-13 font-medium">{cycle.name}</span>
                    {(cycle.start_date || cycle.end_date) && (
                      <span className="text-custom-text-400 flex-shrink-0 text-11">
                        {cycle.start_date ? renderFormattedDate(cycle.start_date) : "—"}
                        {" → "}
                        {cycle.end_date ? renderFormattedDate(cycle.end_date) : "—"}
                      </span>
                    )}
                    {isSelected && <CheckIcon className="text-custom-primary-100 h-4 w-4 flex-shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="border-custom-border-200 mt-4 flex items-center justify-end gap-2 border-t pt-4">
          <Button variant="secondary" size="lg" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting || selected.size === 0}
          >
            {isSubmitting ? t("common.adding") : t("common.add")}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
