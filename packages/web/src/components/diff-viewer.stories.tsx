import type { Meta, StoryObj } from "@storybook/react";
import DiffViewer from "./diff-viewer";

const meta: Meta<typeof DiffViewer> = {
  title: "Components/DiffViewer",
  component: DiffViewer,
};

export default meta;
type Story = StoryObj<typeof DiffViewer>;

export const PlanDiff: Story = {
  args: {
    label: "Plan v1 → Final",
    originalText: `Chapter 1: The dragon wakes up.
He is sad because he lost his fire.
He goes to the forest alone.`,
    revisedText: `Chapter 1: The dragon wakes up feeling lost.
He is sad because he lost his fire.
He decides to ask the old turtle for help.
He goes to the forest with hope.`,
  },
};

export const TextDiff: Story = {
  args: {
    label: "Text v1 → v2",
    originalText: `Once upon a time there was a little dragon.
He could not breathe fire anymore.
The end.`,
    revisedText: `Once upon a time there was a little dragon named Sparky.
He could not breathe fire anymore, and his heart ached.
He learned that true warmth comes from kindness.
The end.`,
  },
};
