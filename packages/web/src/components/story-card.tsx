import { Card, CardBody, CardHeader, Chip } from "@heroui/react";
import type { StoryStatus } from "./types";

interface StoryCardProps {
  title: string;
  status: StoryStatus;
  createdAt: string;
  rating?: number;
}

const statusConfig: Record<
  StoryStatus,
  { color: "default" | "primary" | "success" | "warning"; label: string }
> = {
  draft: { color: "default", label: "Draft" },
  ready: { color: "primary", label: "Ready" },
  read: { color: "success", label: "Read" },
  archived: { color: "warning", label: "Archived" },
};

function renderStars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StoryCard({ title, status, createdAt, rating }: StoryCardProps) {
  const config = statusConfig[status];
  const isArchived = status === "archived";

  return (
    <Card className={`w-full ${isArchived ? "opacity-60" : ""}`}>
      <CardHeader className="flex justify-between items-start gap-2">
        <h3 className="text-base font-semibold text-default-900 flex-1">
          {title}
        </h3>

        <Chip color={config.color} variant="flat" size="sm">
          {config.label}
        </Chip>
      </CardHeader>

      <CardBody className="flex flex-row justify-between items-center pt-0">
        <span className="text-xs text-default-500">{formatDate(createdAt)}</span>

        {rating !== undefined && (
          <span className="text-yellow-400 text-sm" aria-label={`Rating: ${rating} out of 5`}>
            {renderStars(rating)}
          </span>
        )}
      </CardBody>
    </Card>
  );
}

export default StoryCard;
