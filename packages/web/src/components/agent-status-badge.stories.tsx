import type { Meta, StoryObj } from "@storybook/react";
import AgentStatusBadge from "./agent-status-badge";

const meta: Meta<typeof AgentStatusBadge> = {
  title: "Components/AgentStatusBadge",
  component: AgentStatusBadge,
};

export default meta;
type Story = StoryObj<typeof AgentStatusBadge>;

export const Idle: Story = {
  args: { agentName: "Plotter", status: "idle" },
};

export const Running: Story = {
  args: { agentName: "Psychologist", status: "running" },
};

export const Done: Story = {
  args: { agentName: "Writer", status: "done" },
};

export const Error: Story = {
  args: { agentName: "WriterCritic", status: "error" },
};
