import type { Meta, StoryObj } from "@storybook/react";
import PlanReviewCard from "./plan-review-card";

const meta: Meta<typeof PlanReviewCard> = {
  title: "Components/PlanReviewCard",
  component: PlanReviewCard,
};

export default meta;
type Story = StoryObj<typeof PlanReviewCard>;

const basePsychOutput = {
  safety: { verdict: "safe" as const, issues: [] },
  therapeutic: {
    score: 5,
    strengths: ["Encourages emotional vocabulary", "Age-appropriate resolution"],
    gaps: [],
  },
  recommended_changes: [],
};

export const SafePlan: Story = {
  args: {
    planV1: "A dragon loses his fire and is sad.\nHe stays home alone.",
    planFinal: "A dragon loses his fire.\nHe seeks help from friends.\nTogether they find warmth in friendship.",
    iterationsCount: 2,
    psychologistOutput: basePsychOutput,
    onApprove: () => alert("Approved!"),
  },
};

export const PlanWithConcerns: Story = {
  args: {
    planV1: "A dragon loses his fire and is sad.\nHe stays home alone.",
    planFinal: "A dragon loses his fire.\nHe tries to scare others into helping.\nEveryone runs away.",
    iterationsCount: 3,
    psychologistOutput: {
      safety: {
        verdict: "concern" as const,
        issues: ["Aggressive coping mechanism modeled", "Conflict unresolved"],
      },
      therapeutic: {
        score: 2,
        strengths: [],
        gaps: ["Missing empathy arc", "No positive resolution"],
      },
      recommended_changes: ["Add a moment of reflection", "Resolve conflict peacefully"],
    },
    onApprove: () => alert("Approved!"),
  },
};
