import { Button } from "@heroui/react";
import type { AnnotationType } from "./types";

interface AnnotationToolbarProps {
  onAnnotate: (type: AnnotationType, selectedText: string) => void;
  selectedText: string;
}

function AnnotationToolbar({ onAnnotate, selectedText }: AnnotationToolbarProps) {
  if (!selectedText) {
    return null;
  }

  return (
    <div className="inline-flex items-center gap-2 bg-default-900 text-white rounded-lg px-3 py-2 shadow-lg">
      <span className="text-xs text-default-300 max-w-32 truncate">
        &ldquo;{selectedText}&rdquo;
      </span>

      <Button
        size="sm"
        color="secondary"
        variant="flat"
        onPress={() => onAnnotate("sasha_reaction", selectedText)}
      >
        Sasha&apos;s reaction
      </Button>

      <Button
        size="sm"
        color="primary"
        variant="flat"
        onPress={() => onAnnotate("my_note", selectedText)}
      >
        My note
      </Button>
    </div>
  );
}

export default AnnotationToolbar;
