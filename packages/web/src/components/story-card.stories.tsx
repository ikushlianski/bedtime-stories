import type { Meta, StoryObj } from "@storybook/react";
import StoryCard from "./story-card";

const meta: Meta<typeof StoryCard> = {
  title: "Components/StoryCard",
  component: StoryCard,
};

export default meta;
type Story = StoryObj<typeof StoryCard>;

export const Default: Story = {
  args: {
    title: "The Dragon Who Lost His Fire",
    status: "ready",
    createdAt: "2026-03-01T10:00:00Z",
  },
};

export const WithRating: Story = {
  args: {
    title: "The Magic Forest",
    status: "read",
    createdAt: "2026-02-15T08:00:00Z",
    rating: 4,
  },
};

export const Archived: Story = {
  args: {
    title: "An Old Tale",
    status: "archived",
    createdAt: "2025-12-01T00:00:00Z",
    rating: 3,
  },
};
