import type { Meta, StoryObj } from "@storybook/react";
import TextReviewCard from "./text-review-card";

const meta: Meta<typeof TextReviewCard> = {
  title: "Components/TextReviewCard",
  component: TextReviewCard,
};

export default meta;
type Story = StoryObj<typeof TextReviewCard>;

export const Default: Story = {
  args: {
    textV1: `Once upon a time, a little dragon named Sparky lost his fire.
He felt empty and cold inside.
The end.`,
    textV2: `Once upon a time, a little dragon named Sparky lost his fire.
He felt empty and cold inside, but his friends stayed close.
Together they discovered that warmth can come from love.
The end.`,
    psychologistOutput: {
      safety: { verdict: "safe", issues: [] },
      therapeutic: {
        score: 4,
        strengths: ["Models healthy emotional support", "Resolution through connection"],
        gaps: ["Could acknowledge sadness more explicitly"],
      },
      recommended_changes: ["Add one sentence about naming the feeling"],
    },
    onApprove: () => alert("Text approved!"),
  },
};
