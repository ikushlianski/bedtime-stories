import { Card, CardBody, CardHeader } from "@heroui/react";
import type { PipelineStep } from "./types";
import AgentStatusBadge from "./agent-status-badge";

interface PipelineProgressProps {
  steps: PipelineStep[];
}

const stepLineColor: Record<PipelineStep["status"], string> = {
  idle: "bg-default-200",
  running: "bg-primary",
  done: "bg-success",
  error: "bg-danger",
};

function PipelineProgress({ steps }: PipelineProgressProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="text-base font-semibold text-default-900">
          Pipeline Progress
        </h2>
      </CardHeader>

      <CardBody>
        <ol className="flex flex-col gap-0">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={`w-3 h-3 rounded-full mt-1 ${stepLineColor[step.status]}`}
                />

                {i < steps.length - 1 && (
                  <div className="w-0.5 h-6 bg-default-200 mt-0.5" />
                )}
              </div>

              <div className="flex items-center gap-2 pb-2">
                <AgentStatusBadge
                  agentName={step.agentName}
                  status={step.status}
                />

                {step.iterationNumber !== undefined && (
                  <span className="text-xs text-default-400">
                    iteration {step.iterationNumber}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

export default PipelineProgress;
