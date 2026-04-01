import type { Meta, StoryObj } from "@storybook/react";
import SafetyVerdictBadge from "./safety-verdict-badge";

const meta: Meta<typeof SafetyVerdictBadge> = {
  title: "Components/SafetyVerdictBadge",
  component: SafetyVerdictBadge,
};

export default meta;
type Story = StoryObj<typeof SafetyVerdictBadge>;

export const Safe: Story = {
  args: { verdict: "safe" },
};

export const Concern: Story = {
  args: { verdict: "concern" },
};

export const Block: Story = {
  args: { verdict: "block" },
};
