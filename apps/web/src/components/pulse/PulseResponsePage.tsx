"use client";

import { useState } from "react";
import { Heart, CheckCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

interface PulseResponsePageProps {
  token: string;
  initialScore?: number;
}

const emojiOptions = [
  { value: 1, emoji: "\uD83D\uDE20", label: "Very Unhappy" },
  { value: 2, emoji: "\uD83D\uDE1F", label: "Unhappy" },
  { value: 3, emoji: "\uD83D\uDE10", label: "Neutral" },
  { value: 4, emoji: "\uD83D\uDE42", label: "Happy" },
  { value: 5, emoji: "\uD83D\uDE0A", label: "Very Happy" },
];

export function PulseResponsePage({ token, initialScore }: PulseResponsePageProps) {
  const [score, setScore] = useState<number | null>(initialScore || null);
  const [followUp, setFollowUp] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { data: survey } = trpc.pulse.getSurveyByToken.useQuery({ token });
  const respondMutation = trpc.pulse.respond.useMutation({
    onSuccess: () => setSubmitted(true),
  });

  if (!survey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <p className="text-gray-500">This survey has expired or is no longer available.</p>
        </Card>
      </div>
    );
  }

  if (survey.responded || submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-gray-900 mb-2">Thank You!</h1>
          <p className="text-sm text-gray-600">
            Your feedback helps us provide better service. We appreciate you taking the time to respond.
          </p>
        </Card>
      </div>
    );
  }

  const handleSubmit = () => {
    if (score === null) return;
    respondMutation.mutate({ token, score, followUpResponse: followUp || undefined });
  };

  const renderScaleOptions = () => {
    switch (survey.questionType) {
      case "emoji_5":
        return (
          <div className="flex items-center justify-center gap-3">
            {emojiOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setScore(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-1 p-3 rounded-xl transition-all",
                  score === opt.value ? "bg-blue-100 ring-2 ring-blue-500 scale-110" : "hover:bg-gray-100"
                )}
              >
                <span className="text-3xl">{opt.emoji}</span>
                <span className="text-[10px] text-gray-500">{opt.label}</span>
              </button>
            ))}
          </div>
        );

      case "scale_1_5":
        return (
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setScore(n)}
                className={cn(
                  "h-14 w-14 rounded-xl text-lg font-bold transition-all",
                  score === n ? "bg-blue-600 text-white scale-110" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        );

      case "nps_0_10":
        return (
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            {Array.from({ length: 11 }, (_, i) => i).map((n) => (
              <button
                key={n}
                onClick={() => setScore(n)}
                className={cn(
                  "h-11 w-11 rounded-lg text-sm font-bold transition-all",
                  score === n ? "bg-blue-600 text-white scale-110" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                )}
              >
                {n}
              </button>
            ))}
            <div className="w-full flex justify-between px-1 mt-1">
              <span className="text-[10px] text-gray-400">Not likely</span>
              <span className="text-[10px] text-gray-400">Very likely</span>
            </div>
          </div>
        );

      case "thumbs":
        return (
          <div className="flex items-center justify-center gap-6">
            <button
              onClick={() => setScore(0)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
                score === 0 ? "bg-red-100 ring-2 ring-red-500 scale-110" : "hover:bg-gray-100"
              )}
            >
              <span className="text-4xl">{"\uD83D\uDC4E"}</span>
              <span className="text-xs text-gray-500">Not Great</span>
            </button>
            <button
              onClick={() => setScore(1)}
              className={cn(
                "flex flex-col items-center gap-2 p-4 rounded-xl transition-all",
                score === 1 ? "bg-green-100 ring-2 ring-green-500 scale-110" : "hover:bg-gray-100"
              )}
            >
              <span className="text-4xl">{"\uD83D\uDC4D"}</span>
              <span className="text-xs text-gray-500">Good</span>
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center p-4">
      <Card className="p-8 max-w-lg w-full">
        <div className="text-center mb-6">
          <Heart className="h-10 w-10 text-pink-500 mx-auto mb-3" />
          {survey.clientName && (
            <p className="text-sm text-gray-500 mb-2">Hi {survey.clientName.split(" ")[0]},</p>
          )}
          <h1 className="text-lg font-bold text-gray-900">{survey.question}</h1>
        </div>

        {/* Score Selection */}
        <div className="mb-6">
          {renderScaleOptions()}
        </div>

        {/* Follow-up Question */}
        {score !== null && survey.followUpQuestion && (
          <div className="mb-6">
            <p className="text-sm font-medium text-gray-700 mb-2">{survey.followUpQuestion}</p>
            <textarea
              value={followUp}
              onChange={(e) => setFollowUp(e.target.value)}
              placeholder="Your feedback (optional)..."
              className="w-full px-4 py-3 border rounded-xl text-sm resize-none outline-none focus:ring-2 focus:ring-blue-200"
              rows={3}
            />
          </div>
        )}

        {/* Submit */}
        {score !== null && (
          <Button
            onClick={handleSubmit}
            disabled={respondMutation.isLoading}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {respondMutation.isLoading ? "Submitting..." : "Submit Feedback"}
          </Button>
        )}
      </Card>
    </div>
  );
}
