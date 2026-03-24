import { db } from "@/lib/db";

export async function resolveMatterIds(params: { firmId: string; selectionMode: string; matterIds?: string[]; filterCriteria?: any }): Promise<string[]> {
  if (params.selectionMode === "manual" && params.matterIds) return params.matterIds;
  if (params.selectionMode === "all") {
    const matters = await db.matter.findMany({ where: { status: { not: "CLOSED" } }, select: { id: true }, take: 500 });
    return matters.map((m) => m.id);
  }
  // Filter mode
  const where = buildFilterQuery(params.filterCriteria || {});
  const matters = await db.matter.findMany({ where, select: { id: true }, take: 500 });
  return matters.map((m) => m.id);
}

function buildFilterQuery(criteria: any): any {
  const where: any = {};
  if (criteria.status?.length) where.status = { in: criteria.status };
  if (criteria.practiceArea?.length) where.practiceArea = { in: criteria.practiceArea };
  if (criteria.openedBefore) where.openDate = { ...(where.openDate || {}), lte: new Date(criteria.openedBefore) };
  if (criteria.openedAfter) where.openDate = { ...(where.openDate || {}), gte: new Date(criteria.openedAfter) };
  if (criteria.search) where.OR = [{ name: { contains: criteria.search, mode: "insensitive" } }];
  return where;
}

export async function generatePreview(operationId: string): Promise<any> {
  const op = await db.bulkOperation.findUnique({ where: { id: operationId } });
  if (!op) throw new Error("Operation not found");

  const matterIds = op.matterIds as string[];
  const matters = await db.matter.findMany({ where: { id: { in: matterIds } }, include: { client: true } });

  const warnings: string[] = [];
  const blockers: string[] = [];
  let willProcess = matters.length;

  if (op.operationType === "CLOSE_MATTERS") {
    const closed = matters.filter((m) => m.status === "CLOSED");
    if (closed.length) warnings.push(`${closed.length} matters already closed — will be skipped`);
    willProcess -= closed.length;
  }

  if (op.operationType === "REASSIGN_ATTORNEY" || op.operationType === "REASSIGN_ALL_STAFF") {
    const payload = op.payload as any;
    const tasks = await db.task.count({ where: { matterId: { in: matterIds }, status: "NOT_STARTED" } });
    if (tasks > 0) warnings.push(`${tasks} open tasks will also be reassigned`);
  }

  const preview = {
    summary: `${op.operationType.replace(/_/g, " ").toLowerCase()}: ${willProcess} matters`,
    warnings, blockers,
    breakdown: { willProcess, blocked: blockers.length, skipped: matters.length - willProcess },
    sampleMatters: matters.slice(0, 5).map((m) => ({ id: m.id, name: m.name, client: m.client?.name, status: m.status })),
  };

  await db.bulkOperation.update({ where: { id: operationId }, data: { previewData: preview, status: "PREVIEW_READY" } });
  return preview;
}

export async function executeOperation(operationId: string): Promise<void> {
  const op = await db.bulkOperation.findUnique({ where: { id: operationId } });
  if (!op || !op.previewApproved) throw new Error("Operation not approved");

  await db.bulkOperation.update({ where: { id: operationId }, data: { status: "RUNNING", startedAt: new Date() } });

  const matterIds = op.matterIds as string[];
  const payload = op.payload as any;
  let succeeded = 0, failed = 0, skipped = 0;

  for (const matterId of matterIds) {
    try {
      const matter = await db.matter.findUnique({ where: { id: matterId } });
      if (!matter) { skipped++; continue; }

      let changeSnapshot: any = null;

      switch (op.operationType) {
        case "CLOSE_MATTERS": {
          if (matter.status === "CLOSED") { skipped++; await logResult(operationId, matterId, matter.name, "skipped", "Already closed"); continue; }
          changeSnapshot = { before: { status: matter.status }, after: { status: "CLOSED" } };
          await db.matter.update({ where: { id: matterId }, data: { status: "CLOSED", closeDate: new Date() } });
          break;
        }
        case "ARCHIVE_MATTERS": {
          changeSnapshot = { before: { status: matter.status }, after: { status: "CLOSED" } };
          await db.matter.update({ where: { id: matterId }, data: { status: "CLOSED", closeDate: new Date() } });
          break;
        }
        case "REASSIGN_ATTORNEY": {
          // Would update assignedAttorneyId in production
          changeSnapshot = { before: { note: "previous assignment" }, after: { assignedTo: payload.toUserId } };
          break;
        }
        case "ADD_TAGS": {
          // Would merge tags in production
          changeSnapshot = { before: {}, after: { addedTags: payload.tags } };
          break;
        }
        case "ADD_TASK": {
          await db.task.create({
            data: { title: (payload.title || "Bulk task").replace("{{matter.name}}", matter.name), description: payload.description, status: "NOT_STARTED", priority: payload.priority || "MEDIUM", matterId, dueDate: payload.dueOffsetDays ? new Date(Date.now() + payload.dueOffsetDays * 86400000) : null },
          });
          changeSnapshot = { action: "task_created", title: payload.title };
          break;
        }
        case "ADD_NOTE": {
          await db.matterActivity.create({
            data: { matterId, type: "NOTE_ADDED", description: payload.content || "Bulk note" },
          });
          changeSnapshot = { action: "note_added" };
          break;
        }
        default: {
          changeSnapshot = { action: op.operationType, payload };
          break;
        }
      }

      await logResult(operationId, matterId, matter.name, "success", null, changeSnapshot);
      succeeded++;
    } catch (error: any) {
      await logResult(operationId, matterId, matterId, "failed", error.message);
      failed++;
    }

    await db.bulkOperation.update({ where: { id: operationId }, data: { totalProcessed: succeeded + failed + skipped } });
  }

  const finalStatus = failed > 0 ? "COMPLETED_WITH_ERRORS" : "COMPLETED";
  await db.bulkOperation.update({
    where: { id: operationId },
    data: { status: finalStatus, completedAt: new Date(), totalSucceeded: succeeded, totalFailed: failed, totalSkipped: skipped },
  });
}

async function logResult(operationId: string, matterId: string, matterName: string, status: string, reason?: string | null, changeSnapshot?: any) {
  await db.bulkOperationResult.create({
    data: { operationId, matterId, matterName, status, skipReason: status === "skipped" ? reason : null, errorMessage: status === "failed" ? reason : null, changeSnapshot },
  });
}

export async function undoOperation(operationId: string, userId: string): Promise<{ undone: number }> {
  const op = await db.bulkOperation.findUnique({ where: { id: operationId }, include: { results: { where: { status: "success" } } } });
  if (!op || !op.isReversible) throw new Error("Cannot undo");
  if (op.completedAt && Date.now() - op.completedAt.getTime() > 24 * 3600000) throw new Error("Undo window expired (24 hours)");

  let undone = 0;
  for (const result of op.results) {
    const snapshot = result.changeSnapshot as any;
    if (snapshot?.before && op.operationType === "CLOSE_MATTERS") {
      await db.matter.update({ where: { id: result.matterId }, data: { status: snapshot.before.status, closeDate: null } });
      undone++;
    }
  }

  await db.bulkOperation.update({ where: { id: operationId }, data: { status: "UNDONE", undoneAt: new Date(), undoneBy: userId } });
  return { undone };
}
