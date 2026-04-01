import { Chip } from "@heroui/react";
import type { SafetyVerdict } from "./types";

interface SafetyVerdictBadgeProps {
  verdict: SafetyVerdict;
}

const verdictConfig: Record<
  SafetyVerdict,
  { label: string; color: "success" | "warning" | "danger" }
> = {
  safe: { label: "Safe", color: "success" },
  concern: { label: "Concern", color: "warning" },
  block: { label: "Block", color: "danger" },
};

function SafetyVerdictBadge({ verdict }: SafetyVerdictBadgeProps) {
  const config = verdictConfig[verdict];

  return (
    <Chip color={config.color} variant="flat" size="sm">
      {config.label}
    </Chip>
  );
}

export default SafetyVerdictBadge;
