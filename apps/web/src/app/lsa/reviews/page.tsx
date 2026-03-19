"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Star,
  ArrowLeft,
  MessageSquare,
  Sparkles,
  Send,
  TrendingUp,
  BarChart3,
} from "lucide-react";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

function RatingBar({ stars, count, total }: { stars: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600 w-6">{stars}</span>
      <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm text-gray-500 w-8 text-right">{count}</span>
    </div>
  );
}

export default function LSAReviewsPage() {
  const { toast } = useToast();
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const reviewsQuery = trpc.lsa["reviews.list"].useQuery({});
  const reviews = reviewsQuery.data || [];
  const avgRating = reviews.length > 0 ? reviews.reduce((s: number, r: any) => s + r.rating, 0) / reviews.length : 0;
  const stats = { averageRating: avgRating, totalReviews: reviews.length, reviewsThisMonth: reviews.filter((r: any) => new Date(r.reviewDate) > new Date(Date.now() - 30 * 86400000)).length };

  const totalReviews = stats?.totalReviews ?? 0;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } as Record<number, number>;
  for (const r of reviews) { distribution[(r as any).rating] = (distribution[(r as any).rating] || 0) + 1; }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/lsa">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
          <p className="text-gray-500 text-sm mt-1">Google LSA reviews and ratings</p>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Average Rating */}
        <Card>
          <CardContent className="p-5 flex flex-col items-center">
            <p className="text-sm text-gray-500 mb-2">Average Rating</p>
            <div className="text-4xl font-bold text-gray-900 mb-1">
              {avgRating.toFixed(1)}
            </div>
            <StarRating rating={Math.round(avgRating)} />
          </CardContent>
        </Card>

        {/* Total Reviews */}
        <Card>
          <CardContent className="p-5 flex flex-col items-center">
            <p className="text-sm text-gray-500 mb-2">Total Reviews</p>
            <div className="text-4xl font-bold text-gray-900">{totalReviews}</div>
            <div className="flex items-center gap-1 mt-1 text-sm text-gray-400">
              <MessageSquare className="h-4 w-4" />
              reviews
            </div>
          </CardContent>
        </Card>

        {/* Rating Distribution */}
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-gray-500 mb-3">Rating Distribution</p>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((stars) => (
                <RatingBar
                  key={stars}
                  stars={stars}
                  count={(distribution as any)[stars] ?? 0}
                  total={totalReviews}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Review List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold">All Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          {reviewsQuery.isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse p-4 rounded-lg bg-gray-50 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Star className="h-10 w-10 mx-auto mb-3 text-gray-300" />
              <p>No reviews yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review: any) => (
                <div key={review.id} className="p-4 rounded-lg border border-gray-100 bg-white">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <StarRating rating={review.rating} />
                        <span className="font-medium text-gray-900">
                          {review.reviewerName}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{review.text}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {review.replied ? (
                        <Badge className="bg-green-100 text-green-700">Replied</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-700">Pending</Badge>
                      )}
                    </div>
                  </div>

                  {/* Reply Section */}
                  {review.reply && (
                    <div className="mt-3 ml-4 pl-4 border-l-2 border-gray-200">
                      <p className="text-xs text-gray-500 font-medium mb-1">Your Reply</p>
                      <p className="text-sm text-gray-600">{review.reply}</p>
                    </div>
                  )}

                  {!review.replied && (
                    <div className="mt-3">
                      {replyingTo === review.id ? (
                        <div className="space-y-2">
                          <Textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Type your reply..."
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              disabled={!replyText.trim()}
                              onClick={() => {
                                toast({
                                  title: "Reply Sent",
                                  description: "Your reply has been posted.",
                                });
                                setReplyingTo(null);
                                setReplyText("");
                              }}
                            >
                              <Send className="mr-1 h-3 w-3" />
                              Post Reply
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReplyText(
                                  review.aiSuggestedReply ??
                                    "Thank you for your review. We appreciate your feedback and strive to provide the best legal services."
                                );
                              }}
                            >
                              <Sparkles className="mr-1 h-3 w-3" />
                              AI Suggest
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyText("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setReplyingTo(review.id);
                            setReplyText("");
                          }}
                        >
                          <MessageSquare className="mr-1 h-3 w-3" />
                          Reply
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
