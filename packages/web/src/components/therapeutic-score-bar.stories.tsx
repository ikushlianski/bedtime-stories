import type { Meta, StoryObj } from "@storybook/react";
import TherapeuticScoreBar from "./therapeutic-score-bar";

const meta: Meta<typeof TherapeuticScoreBar> = {
  title: "Components/TherapeuticScoreBar",
  component: TherapeuticScoreBar,
};

export default meta;
type Story = StoryObj<typeof TherapeuticScoreBar>;

export const HighScore: Story = {
  args: {
    score: 5,
    strengths: [
      "Strong emotional resonance",
      "Age-appropriate conflict resolution",
      "Encourages empathy",
    ],
    gaps: [],
  },
};

export const LowScore: Story = {
  args: {
    score: 2,
    strengths: ["Engaging protagonist"],
    gaps: [
      "Conflict resolution too abrupt",
      "Missing emotional acknowledgment",
      "Ending lacks closure",
    ],
  },
};
