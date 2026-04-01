import { Chip } from "@heroui/react";
import type { AgentName, AgentStatus } from "./types";

interface AgentStatusBadgeProps {
  agentName: AgentName;
  status: AgentStatus;
}

const statusConfig: Record<
  AgentStatus,
  {
    color: "default" | "primary" | "success" | "danger";
    label: string;
    dot: string;
  }
> = {
  idle: { color: "default", label: "Idle", dot: "bg-default-400" },
  running: { color: "primary", label: "Running", dot: "bg-primary animate-pulse" },
  done: { color: "success", label: "Done", dot: "bg-success" },
  error: { color: "danger", label: "Error", dot: "bg-danger" },
};

function AgentStatusBadge({ agentName, status }: AgentStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Chip
      color={config.color}
      variant="flat"
      size="sm"
      startContent={
        <span className={`w-2 h-2 rounded-full ${config.dot} ml-1`} />
      }
    >
      {agentName} — {config.label}
    </Chip>
  );
}

export default AgentStatusBadge;
