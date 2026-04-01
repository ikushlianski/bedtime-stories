import { useState } from "react";
import { Card, CardBody, CardHeader, CardFooter, Button, Textarea } from "@heroui/react";
import { z } from "zod";

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1, "Comment is required"),
});

type FeedbackValues = z.infer<typeof feedbackSchema>;

interface FeedbackFormProps {
  storyId: string;
  onSubmit: (values: FeedbackValues) => Promise<void>;
}

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-2xl transition-colors ${
            star <= value ? "text-yellow-400" : "text-default-300"
          } hover:text-yellow-400`}
          aria-label={`Rate ${star} out of 5`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function FeedbackForm({ storyId: _storyId, onSubmit }: FeedbackFormProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const result = feedbackSchema.safeParse({ rating, comment });

    if (!result.success) {
      setError(result.error.errors[0]?.message ?? "Invalid input");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await onSubmit(result.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <h2 className="text-base font-semibold text-default-900">
          Leave Feedback
        </h2>
      </CardHeader>

      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-default-600">Rating</span>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <Textarea
          label="Comment"
          placeholder="What did Sasha think?"
          value={comment}
          onValueChange={setComment}
          minRows={3}
          isInvalid={!!error}
          errorMessage={error ?? undefined}
        />
      </CardBody>

      <CardFooter>
        <Button
          color="primary"
          onPress={handleSubmit}
          isLoading={loading}
          fullWidth
        >
          Submit Feedback
        </Button>
      </CardFooter>
    </Card>
  );
}

export default FeedbackForm;
