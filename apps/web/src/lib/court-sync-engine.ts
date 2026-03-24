import { db } from "@/lib/db";
import { getAdapter } from "./court-adapters";
import type { CourtEventData } from "./court-adapters";

// ─── Sync a single case number ──────────────────────────────────

export async function syncCaseNumber(
  firmId: string,
  caseNumber: string,
  provider: string,
  matterId?: string,
  credentials?: any,
): Promise<{ created: number; updated: number; errors: string[] }> {
  const adapter = getAdapter(provider);
  const errors: string[] = [];
  let created = 0;
  let updated = 0;

  let events: CourtEventData[];
  try {
    events = await adapter.fetchEvents(caseNumber, credentials);
  } catch (err: any) {
    return { created: 0, updated: 0, errors: [err.message] };
  }

  for (const event of events) {
    try {
      const existing = event.externalId
        ? await db.courtEvent.findFirst({
            where: { firmId, externalId: event.externalId, source: provider },
          })
        : null;

      if (existing) {
        await db.courtEvent.update({
          where: { id: existing.id },
          data: {
            title: event.title,
            eventType: event.eventType,
            courtName: event.courtName,
            judgeAssigned: event.judgeAssigned,
            scheduledAt: event.scheduledAt,
            endTime: event.endTime,
            location: event.location,
            notes: event.notes,
            syncedAt: new Date(),
          },
        });
        updated++;
      } else {
        const courtEvent = await db.courtEvent.create({
          data: {
            firmId,
            matterId: matterId || null,
            source: provider,
            externalId: event.externalId,
            eventType: event.eventType,
            title: event.title,
            courtName: event.courtName,
            judgeAssigned: event.judgeAssigned,
            caseNumber: event.caseNumber || caseNumber,
            scheduledAt: event.scheduledAt,
            endTime: event.endTime,
            location: event.location,
            notes: event.notes,
            syncedAt: new Date(),
          },
        });

        // Auto-create deadline/task if matter linked
        if (matterId) {
          await propagateDeadline(courtEvent.id, matterId, event);
        }

        created++;
      }
    } catch (err: any) {
      errors.push(`Event "${event.title}": ${err.message}`);
    }
  }

  return { created, updated, errors };
}

// ─── Sync all watched cases for a firm ──────────────────────────

export async function syncAllWatchedCases(firmId: string): Promise<{
  totalCreated: number;
  totalUpdated: number;
  errors: string[];
}> {
  const integrations = await db.courtIntegration.findMany({
    where: { firmId, status: "active" },
  });

  let totalCreated = 0;
  let totalUpdated = 0;
  const errors: string[] = [];

  for (const integration of integrations) {
    const caseNumbers = (
      typeof integration.caseNumbers === "string"
        ? JSON.parse(integration.caseNumbers)
        : integration.caseNumbers
    ) as Array<{ caseNumber: string; matterId?: string }>;

    for (const entry of caseNumbers) {
      const result = await syncCaseNumber(
        firmId,
        entry.caseNumber,
        integration.provider,
        entry.matterId,
        integration.credentials,
      );
      totalCreated += result.created;
      totalUpdated += result.updated;
      errors.push(...result.errors);
    }

    // Update last sync time
    await db.courtIntegration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date(), status: errors.length > 0 ? "error" : "active" },
    });
  }

  return { totalCreated, totalUpdated, errors };
}

// ─── Deadline Propagation ───────────────────────────────────────

async function propagateDeadline(
  courtEventId: string,
  matterId: string,
  event: CourtEventData,
) {
  // Only propagate for time-sensitive event types
  const deadlineTypes = ["HEARING", "FILING_DEADLINE", "CONFERENCE", "TRIAL", "MOTION"];
  if (!deadlineTypes.includes(event.eventType)) return;

  // Check if a task already exists for this court event
  const existingTask = await db.task.findFirst({
    where: {
      matterId,
      title: { contains: event.title.slice(0, 50) },
      dueDate: event.scheduledAt,
    },
  });

  if (existingTask) return;

  // Create task with 7-day lead reminder
  const reminderDate = new Date(event.scheduledAt.getTime() - 7 * 86400000);
  const prefix = event.eventType === "FILING_DEADLINE" ? "📋 File: "
    : event.eventType === "HEARING" ? "⚖️ Hearing: "
    : event.eventType === "TRIAL" ? "🏛️ Trial: "
    : event.eventType === "CONFERENCE" ? "📞 Conference: "
    : "📅 ";

  await db.task.create({
    data: {
      title: `${prefix}${event.title}`.slice(0, 255),
      description: [
        `Auto-created from court calendar sync.`,
        event.courtName ? `Court: ${event.courtName}` : null,
        event.judgeAssigned ? `Judge: ${event.judgeAssigned}` : null,
        event.location ? `Location: ${event.location}` : null,
        event.notes ? `\nNotes: ${event.notes.slice(0, 500)}` : null,
      ].filter(Boolean).join("\n"),
      matterId,
      dueDate: event.scheduledAt,
      priority: event.eventType === "TRIAL" ? "URGENT"
        : event.eventType === "HEARING" ? "HIGH"
        : "MEDIUM",
      status: "NOT_STARTED",
    },
  });
}
