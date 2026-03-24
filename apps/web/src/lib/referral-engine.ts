import { db } from "@/lib/db";
import crypto from "crypto";

export function generateTrackingCode(sourceName: string): string {
  const slug = sourceName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);
  return `ref-${slug}`;
}

export function generateTrackingUrl(trackingCode: string, baseUrl: string): string {
  return `${baseUrl}?ref=${trackingCode}`;
}

export async function attributeReferral(params: {
  trackingCode?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string;
  howHeard?: string; howHeardDetail?: string; clientName: string; clientEmail?: string;
  practiceArea?: string; firmId: string; userId: string;
}): Promise<any> {
  let sourceId: string | null = null;

  // Try tracking code first
  if (params.trackingCode) {
    const source = await db.referralSource.findUnique({ where: { trackingCode: params.trackingCode } });
    if (source) sourceId = source.id;
  }

  // Try UTM matching
  if (!sourceId && params.utmCampaign) {
    const source = await db.referralSource.findFirst({ where: { utmCampaign: params.utmCampaign, firmId: params.firmId } });
    if (source) sourceId = source.id;
  }

  // Try howHeard matching
  if (!sourceId && params.howHeard) {
    const source = await db.referralSource.findFirst({ where: { sourceType: params.howHeard, firmId: params.firmId } });
    if (source) sourceId = source.id;
  }

  if (!sourceId) return null;

  const referral = await db.referralEntry.create({
    data: {
      sourceId,
      clientName: params.clientName,
      clientEmail: params.clientEmail,
      practiceArea: params.practiceArea,
      howHeard: params.howHeard,
      howHeardDetail: params.howHeardDetail,
      trackingCode: params.trackingCode,
      utmSource: params.utmSource,
      utmMedium: params.utmMedium,
      utmCampaign: params.utmCampaign,
      status: "lead",
      userId: params.userId,
      firmId: params.firmId,
    },
  });

  // Update source stats
  await db.referralSource.update({
    where: { id: sourceId },
    data: { totalReferrals: { increment: 1 }, lastReferralAt: new Date() },
  });

  return referral;
}

export async function updateReferralStatus(referralId: string, status: string, data?: { matterId?: string; revenue?: number }): Promise<void> {
  const update: any = { status };
  if (data?.matterId) update.matterId = data.matterId;
  if (data?.revenue) update.revenue = data.revenue;

  await db.referralEntry.update({ where: { id: referralId }, data: update });

  if (status === "retained" || status === "active_matter") {
    const referral = await db.referralEntry.findUnique({ where: { id: referralId } });
    if (referral?.sourceId) {
      await db.referralSource.update({ where: { id: referral.sourceId }, data: { totalConverted: { increment: 1 } } });
    }
  }

  if (data?.revenue) {
    const referral = await db.referralEntry.findUnique({ where: { id: referralId } });
    if (referral?.sourceId) {
      await db.referralSource.update({ where: { id: referral.sourceId }, data: { totalRevenue: { increment: data.revenue } } });
    }
  }
}

export async function getDashboardStats(firmId: string): Promise<any> {
  const now = new Date();
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

  const totalReferrals = await db.referralEntry.count({ where: { firmId, referralDate: { gte: quarterStart } } });
  const converted = await db.referralEntry.count({ where: { firmId, referralDate: { gte: quarterStart }, status: { in: ["retained", "active_matter", "matter_closed"] } } });
  const conversionRate = totalReferrals > 0 ? Math.round((converted / totalReferrals) * 100) : 0;

  const revenue = await db.referralEntry.aggregate({ where: { firmId, referralDate: { gte: quarterStart } }, _sum: { revenue: true } });

  const topSource = await db.referralSource.findFirst({ where: { firmId, isActive: true }, orderBy: { totalRevenue: "desc" } });

  const overdueThankYous = await db.referralThankYou.count({ where: { firmId, status: "scheduled", scheduledDate: { lt: now } } });

  return {
    totalReferrals,
    conversionRate,
    revenue: revenue._sum.revenue || 0,
    topSource: topSource ? { name: topSource.contactName || topSource.name, referrals: topSource.totalReferrals, revenue: topSource.totalRevenue } : null,
    overdueThankYous,
  };
}
