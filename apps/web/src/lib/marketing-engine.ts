import { db } from "@/lib/db";

export async function getEmailStats() {
  const campaigns = await db.emailCampaignExternal.findMany({ where: { status: "sent" } });
  const totalSent = campaigns.reduce((s, c) => s + c.stats_sent, 0);
  const totalOpens = campaigns.reduce((s, c) => s + c.stats_uniqueOpens, 0);
  const totalClicks = campaigns.reduce((s, c) => s + c.stats_uniqueClicks, 0);
  const totalBounces = campaigns.reduce((s, c) => s + c.stats_bounces, 0);
  const totalUnsubs = campaigns.reduce((s, c) => s + c.stats_unsubscribes, 0);
  return {
    totalSent, totalOpens, totalClicks, totalBounces, totalUnsubs,
    openRate: totalSent > 0 ? (totalOpens / totalSent) * 100 : 0,
    clickRate: totalSent > 0 ? (totalClicks / totalSent) * 100 : 0,
    campaignCount: campaigns.length,
  };
}

export async function getReviewStats() {
  const reviews = await db.reviewRecord.findMany();
  const totalReviews = reviews.length;
  const avgRating = totalReviews > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / totalReviews : 0;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const byPlatform: Record<string, { count: number; total: number }> = {};
  const bySentiment = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 };

  for (const r of reviews) {
    if (distribution[r.rating as keyof typeof distribution] !== undefined) distribution[r.rating as keyof typeof distribution]++;
    if (!byPlatform[r.platform]) byPlatform[r.platform] = { count: 0, total: 0 };
    byPlatform[r.platform].count++;
    byPlatform[r.platform].total += r.rating;
    if (bySentiment[r.sentiment as keyof typeof bySentiment] !== undefined) bySentiment[r.sentiment as keyof typeof bySentiment]++;
  }

  const responded = reviews.filter((r) => r.responseText).length;
  return { totalReviews, avgRating: Math.round(avgRating * 10) / 10, distribution, byPlatform, bySentiment, responseRate: totalReviews > 0 ? (responded / totalReviews) * 100 : 0 };
}

export async function getReputationScore() {
  const stats = await getReviewStats();
  let score = 50;
  score += (stats.avgRating - 3) * 15; // rating component
  score += Math.min(20, stats.totalReviews / 5); // volume component
  score += Math.min(10, stats.responseRate / 10); // responsiveness
  score += (stats.bySentiment.POSITIVE / Math.max(1, stats.totalReviews)) * 10; // sentiment
  return { score: Math.max(0, Math.min(100, Math.round(score))), breakdown: { ratingComponent: stats.avgRating, volumeComponent: stats.totalReviews, responseRate: stats.responseRate, sentimentRatio: stats.bySentiment } };
}

export async function generateReviewResponse(reviewId: string, tone: string) {
  const review = await db.reviewRecord.findUniqueOrThrow({ where: { id: reviewId } });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { response: "AI response generation requires ANTHROPIC_API_KEY." };

  const system = `You are responding to a client review on behalf of a law firm. Be ${tone}, thank the reviewer, address any specific feedback, and maintain attorney-client confidentiality — never reference specific legal matters. Keep it concise (2-4 sentences).`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 500, system, messages: [{ role: "user", content: `${review.rating}-star review on ${review.platform}:\n${review.content || "(no text)"}` }] }),
  });
  const data = await res.json();
  return { response: data.content?.[0]?.text || "Unable to generate response." };
}
