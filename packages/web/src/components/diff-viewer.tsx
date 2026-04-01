import { Card, CardBody, CardHeader } from "@heroui/react";

interface DiffViewerProps {
  originalText: string;
  revisedText: string;
  label: string;
}

interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
}

function computeDiff(original: string, revised: string): DiffLine[] {
  const originalLines = original.split("\n");
  const revisedLines = revised.split("\n");
  const result: DiffLine[] = [];

  const maxLen = Math.max(originalLines.length, revisedLines.length);

  for (let i = 0; i < maxLen; i++) {
    const orig = originalLines[i];
    const rev = revisedLines[i];

    if (orig === rev) {
      result.push({ type: "unchanged", text: orig ?? "" });
    } else {
      if (orig !== undefined) {
        result.push({ type: "removed", text: orig });
      }

      if (rev !== undefined) {
        result.push({ type: "added", text: rev });
      }
    }
  }

  return result;
}

const lineStyle: Record<DiffLine["type"], string> = {
  added: "bg-green-50 text-green-800 border-l-4 border-green-400 pl-2",
  removed: "bg-red-50 text-red-800 border-l-4 border-red-400 pl-2 line-through",
  unchanged: "text-default-700 pl-2",
};

const linePrefix: Record<DiffLine["type"], string> = {
  added: "+ ",
  removed: "- ",
  unchanged: "  ",
};

function DiffViewer({ originalText, revisedText, label }: DiffViewerProps) {
  const diffLines = computeDiff(originalText, revisedText);

  return (
    <Card className="w-full">
      <CardHeader>
        <h3 className="text-sm font-semibold text-default-700">{label}</h3>
      </CardHeader>

      <CardBody>
        <pre className="text-xs font-mono overflow-auto max-h-96 space-y-0.5">
          {diffLines.map((line, i) => (
            <div key={i} className={`${lineStyle[line.type]} py-0.5 rounded-sm`}>
              <span className="select-none opacity-50">{linePrefix[line.type]}</span>
              {line.text}
            </div>
          ))}
        </pre>
      </CardBody>
    </Card>
  );
}

export default DiffViewer;
