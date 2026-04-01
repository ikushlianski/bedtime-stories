import type { Meta, StoryObj } from "@storybook/react";
import PipelineProgress from "./pipeline-progress";

const meta: Meta<typeof PipelineProgress> = {
  title: "Components/PipelineProgress",
  component: PipelineProgress,
};

export default meta;
type Story = StoryObj<typeof PipelineProgress>;

export const InProgress: Story = {
  args: {
    steps: [
      { agentName: "Plotter", status: "done", iterationNumber: 1 },
      { agentName: "Psychologist", status: "done", iterationNumber: 1 },
      { agentName: "PlotCritic", status: "running", iterationNumber: 1 },
      { agentName: "Writer", status: "idle" },
      { agentName: "WriterCritic", status: "idle" },
      { agentName: "Improver", status: "idle" },
    ],
  },
};

export const Complete: Story = {
  args: {
    steps: [
      { agentName: "Plotter", status: "done", iterationNumber: 2 },
      { agentName: "Psychologist", status: "done" },
      { agentName: "PlotCritic", status: "done", iterationNumber: 2 },
      { agentName: "Writer", status: "done" },
      { agentName: "WriterCritic", status: "done" },
      { agentName: "Improver", status: "done" },
    ],
  },
};

export const ErrorState: Story = {
  args: {
    steps: [
      { agentName: "Plotter", status: "done" },
      { agentName: "Psychologist", status: "error" },
      { agentName: "PlotCritic", status: "idle" },
      { agentName: "Writer", status: "idle" },
      { agentName: "WriterCritic", status: "idle" },
      { agentName: "Improver", status: "idle" },
    ],
  },
};
