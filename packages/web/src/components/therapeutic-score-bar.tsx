import { useState } from "react";
import { Progress, Button } from "@heroui/react";

interface TherapeuticScoreBarProps {
  score: number;
  strengths: string[];
  gaps: string[];
}

function scoreToColor(score: number): "success" | "warning" | "danger" {
  if (score >= 4) return "success";
  if (score >= 3) return "warning";
  return "danger";
}

function TherapeuticScoreBar({
  score,
  strengths,
  gaps,
}: TherapeuticScoreBarProps) {
  const [expanded, setExpanded] = useState(false);
  const color = scoreToColor(score);
  const percentage = (score / 5) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-default-600">
          Therapeutic score: {score}/5
        </span>

        <Button
          size="sm"
          variant="light"
          onPress={() => setExpanded((prev) => !prev)}
        >
          {expanded ? "Hide" : "Show details"}
        </Button>
      </div>

      <Progress
        value={percentage}
        color={color}
        size="sm"
        aria-label="Therapeutic score"
      />

      {expanded && (
        <div className="flex flex-col gap-2 mt-1">
          {strengths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-success-600 mb-1">
                Strengths
              </p>

              <ul className="list-disc list-inside text-xs text-default-600 space-y-0.5">
                {strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}

          {gaps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-danger-600 mb-1">
                Gaps
              </p>

              <ul className="list-disc list-inside text-xs text-default-600 space-y-0.5">
                {gaps.map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TherapeuticScoreBar;
