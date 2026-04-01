import { Card, CardBody, CardHeader, CardFooter, Button, Divider } from "@heroui/react";
import type { PsychologistOutput } from "./types";
import DiffViewer from "./diff-viewer";
import SafetyVerdictBadge from "./safety-verdict-badge";
import TherapeuticScoreBar from "./therapeutic-score-bar";

interface TextReviewCardProps {
  textV1: string;
  textV2: string;
  psychologistOutput: PsychologistOutput;
  onApprove: () => void;
}

function TextReviewCard({
  textV1,
  textV2,
  psychologistOutput,
  onApprove,
}: TextReviewCardProps) {
  const { safety, therapeutic } = psychologistOutput;

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-col items-start gap-1">
        <h2 className="text-lg font-bold text-default-900">Text Review</h2>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <DiffViewer
          originalText={textV1}
          revisedText={textV2}
          label="Text v1 → v2"
        />

        <Divider />

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-default-700">
            Psychologist Assessment
          </h3>

          <div className="flex items-center gap-2">
            <span className="text-xs text-default-500">Safety verdict:</span>
            <SafetyVerdictBadge verdict={safety.verdict} />
          </div>

          {safety.issues.length > 0 && (
            <ul className="list-disc list-inside text-xs text-danger-600 space-y-0.5">
              {safety.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          )}

          <TherapeuticScoreBar
            score={therapeutic.score}
            strengths={therapeutic.strengths}
            gaps={therapeutic.gaps}
          />
        </div>
      </CardBody>

      <CardFooter>
        <Button color="success" onPress={onApprove} fullWidth>
          Approve Text
        </Button>
      </CardFooter>
    </Card>
  );
}

export default TextReviewCard;
