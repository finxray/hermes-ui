"use client";

import { useState } from "react";
import { useHermesDashboardRecovery } from "@/hooks/useHermesDashboardRecovery";
import { EmptyState } from "./EmptyState";

type HermesDashboardRecoveryStateProps = {
  onRecovered: () => void | Promise<void>;
  resourceName: "Config" | "Keys" | "Logs" | "Plugins";
};

export function HermesDashboardRecoveryState({
  onRecovered,
  resourceName
}: HermesDashboardRecoveryStateProps) {
  const dashboardRecovery = useHermesDashboardRecovery(true);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const resourceIsPlural = resourceName !== "Config";

  if (dashboardRecovery.status?.canStart) {
    return (
      <EmptyState
        actionDisabled={dashboardRecovery.isStarting}
        actionLabel={
          confirmationOpen
            ? dashboardRecovery.isStarting
              ? "Starting..."
              : "Confirm start"
            : "Start Dashboard"
        }
        compact
        tone="important"
        title={confirmationOpen ? "Start Hermes Dashboard?" : "Hermes Dashboard is not running"}
        body={
          startError ??
          (confirmationOpen
            ? `Stoix will start the local Dashboard on this computer and refresh ${resourceName} when it is ready.`
            : `Start the local Hermes Dashboard to load ${resourceName.toLowerCase()}.`)
        }
        onAction={() => {
          if (!confirmationOpen) {
            setConfirmationOpen(true);
            return;
          }
          setStartError(null);
          void dashboardRecovery.start().then(async (startResult) => {
            if (!startResult.ok) {
              setStartError(startResult.error.message);
              return;
            }
            setConfirmationOpen(false);
            await onRecovered();
          });
        }}
        onSecondaryAction={
          confirmationOpen
            ? () => {
                setConfirmationOpen(false);
                setStartError(null);
              }
            : undefined
        }
        secondaryActionLabel={confirmationOpen ? "Cancel" : undefined}
      />
    );
  }

  if (dashboardRecovery.status?.reachable) {
    return (
      <EmptyState
        compact
        tone="important"
        title={`Hermes Dashboard cannot provide ${resourceName}`}
        body={`The Dashboard is running, but ${resourceName.toLowerCase()} ${resourceIsPlural ? "are" : "is"} unavailable. Update Hermes or verify Dashboard access, then refresh ${resourceName}.`}
      />
    );
  }

  return (
    <EmptyState
      compact
      tone="important"
      title={`${resourceName} ${resourceIsPlural ? "are" : "is"} unavailable`}
      body={
        dashboardRecovery.isChecking
          ? "Checking whether the local Hermes Dashboard can be started..."
          : dashboardRecovery.status?.reason ??
            `Run \`hermes dashboard --no-open\` in the Hermes environment, then refresh ${resourceName}.`
      }
    />
  );
}
