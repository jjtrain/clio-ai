import { db } from "@/lib/db";

const METRICS = [
  "avg_case_duration_days",
  "avg_matter_revenue",
  "collection_rate",
  "avg_days_to_first_invoice",
  "cac",
] as const;

const MIN_SAMPLE_SIZE = 5;

export async function snapshotFirmMetrics(firmId: string, period: string): Promise<number> {
  const matters = await db.matter.findMany({
    where: { status: { not: undefined } },
    include: { invoices: true, timeEntries: true },
  });

  const practiceAreas = Array.from(new Set(matters.map((m) => m.practiceArea).filter(Boolean))) as string[];
  let count = 0;

  for (const pa of practiceAreas) {
    const paMatters = matters.filter((m) => m.practiceArea === pa);
    if (paMatters.length === 0) continue;

    // Avg case duration (closed matters)
    const closed = paMatters.filter((m) => m.closeDate && m.openDate);
    if (closed.length > 0) {
      const avgDays = closed.reduce((s, m) => s + Math.ceil((m.closeDate!.getTime() - m.openDate.getTime()) / 86400000), 0) / closed.length;
      await upsertSnapshot(firmId, pa, "avg_case_duration_days", avgDays, period);
      count++;
    }

    // Avg matter revenue
    const totalRevenue = paMatters.reduce((s, m) => s + m.invoices.reduce((is, inv) => is + Number(inv.total), 0), 0);
    if (paMatters.length > 0) {
      await upsertSnapshot(firmId, pa, "avg_matter_revenue", totalRevenue / paMatters.length, period);
      count++;
    }

    // Collection rate
    const totalInvoiced = paMatters.reduce((s, m) => s + m.invoices.reduce((is, inv) => is + Number(inv.total), 0), 0);
    const totalCollected = paMatters.reduce((s, m) => s + m.invoices.reduce((is, inv) => is + Number(inv.amountPaid), 0), 0);
    if (totalInvoiced > 0) {
      await upsertSnapshot(firmId, pa, "collection_rate", (totalCollected / totalInvoiced) * 100, period);
      count++;
    }

    // Avg days to first invoice
    const withInvoices = paMatters.filter((m) => m.invoices.length > 0);
    if (withInvoices.length > 0) {
      const avgDaysToInvoice = withInvoices.reduce((s, m) => {
        const firstInvoice = m.invoices.sort((a, b) => a.issueDate.getTime() - b.issueDate.getTime())[0];
        return s + Math.ceil((firstInvoice.issueDate.getTime() - m.openDate.getTime()) / 86400000);
      }, 0) / withInvoices.length;
      await upsertSnapshot(firmId, pa, "avg_days_to_first_invoice", avgDaysToInvoice, period);
      count++;
    }
  }

  return count;
}

async function upsertSnapshot(firmId: string, practiceArea: string, metric: string, value: number, period: string) {
  const existing = await db.benchmarkSnapshot.findFirst({ where: { firmId, practiceArea, metric, period } });
  if (existing) {
    await db.benchmarkSnapshot.update({ where: { id: existing.id }, data: { value } });
  } else {
    await db.benchmarkSnapshot.create({ data: { firmId, practiceArea, metric, value, period } });
  }
}

export async function rebuildPlatformBenchmarks(period: string): Promise<number> {
  // Group all firm snapshots by metric + practiceArea
  const snapshots = await db.benchmarkSnapshot.findMany({ where: { period } });

  const groups: Record<string, number[]> = {};
  for (const s of snapshots) {
    const key = `${s.metric}::${s.practiceArea}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(s.value);
  }

  let count = 0;
  for (const [key, values] of Object.entries(groups)) {
    // Deduplicate by firm — take one value per firm (already done since snapshot is per firm)
    const firmCount = values.length; // each snapshot = one firm
    if (firmCount < MIN_SAMPLE_SIZE) continue;

    const sorted = values.sort((a, b) => a - b);
    const p25 = percentile(sorted, 25);
    const p50 = percentile(sorted, 50);
    const p75 = percentile(sorted, 75);
    const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length;

    const [metric, practiceArea] = key.split("::");

    await db.platformBenchmark.upsert({
      where: { metric_practiceArea_period: { metric, practiceArea, period } },
      create: { metric, practiceArea, p25, p50, p75, mean, sampleSize: firmCount, period },
      update: { p25, p50, p75, mean, sampleSize: firmCount, updatedAt: new Date() },
    });
    count++;
  }

  return count;
}

function percentile(sorted: number[], pct: number): number {
  const idx = (pct / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

export async function getFirmBenchmarks(firmId: string, period: string, practiceArea?: string): Promise<any[]> {
  const where: any = { period };
  if (practiceArea) where.practiceArea = practiceArea;

  const benchmarks = await db.platformBenchmark.findMany({ where });
  const firmSnapshots = await db.benchmarkSnapshot.findMany({ where: { firmId, period, ...(practiceArea ? { practiceArea } : {}) } });

  const firmMap: Record<string, number> = {};
  for (const s of firmSnapshots) firmMap[`${s.metric}::${s.practiceArea}`] = s.value;

  return benchmarks.map((b) => {
    const firmValue = firmMap[`${b.metric}::${b.practiceArea}`];
    let percentileRank: number | null = null;
    if (firmValue !== undefined) {
      if (firmValue <= b.p25) percentileRank = 25;
      else if (firmValue <= b.p50) percentileRank = 50;
      else if (firmValue <= b.p75) percentileRank = 75;
      else percentileRank = 90;
      // For metrics where lower is better (duration, days to invoice, CAC), invert
      if (["avg_case_duration_days", "avg_days_to_first_invoice", "cac"].includes(b.metric)) {
        percentileRank = 100 - percentileRank;
      }
    }

    return {
      metric: b.metric,
      practiceArea: b.practiceArea,
      firmValue,
      p25: b.p25,
      median: b.p50,
      p75: b.p75,
      sampleSize: b.sampleSize,
      percentileRank,
    };
  });
}
