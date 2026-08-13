export type StoryStatus = "draft" | "proofreading" | "ready" | "read" | "archived";

export type AgentName =
  | "Questions"
  | "Plotter"
  | "Psychologist"
  | "PlotCritic"
  | "Writer"
  | "WriterCritic"
  | "Improver";

export type AgentStatus = "idle" | "running" | "done" | "error";

export type SafetyVerdict = "safe" | "concern" | "block";

export type AnnotationType =
  | "sasha_reaction"
  | "my_note"
  | "sasha_laughed"
  | "sasha_loved"
  | "sasha_disliked";

export function annotationTypeLabel(type: AnnotationType): string {
  switch (type) {
    case "sasha_reaction":
      return "Реакция Саши";
    case "sasha_laughed":
      return "Саша смеялся";
    case "sasha_loved":
      return "Саше понравилось";
    case "sasha_disliked":
      return "Слабое место";
    case "my_note":
      return "Моя заметка";
  }
}

export interface PsychologistOutput {
  safety: {
    verdict: SafetyVerdict;
    issues: string[];
  };
  therapeutic: {
    score: number;
    strengths: string[];
    gaps: string[];
  };
  recommended_changes: string[];
}

export type { FeedbackValues } from './feedback-form'

export interface PipelineStep {
  agentName: AgentName;
  status: AgentStatus;
  iterationNumber?: number;
  summary?: string;
}
