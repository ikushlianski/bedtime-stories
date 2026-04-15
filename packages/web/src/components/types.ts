export type StoryStatus = "draft" | "ready" | "read" | "archived";

export type AgentName =
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

export interface FeedbackValues {
  rating: number
  comment: string
}

export interface PipelineStep {
  agentName: AgentName;
  status: AgentStatus;
  iterationNumber?: number;
}
