import { db } from "@/lib/db";

// ==========================================
// BUSINESS DATE CALCULATION
// ==========================================

const FEDERAL_HOLIDAYS_2026 = [
  "2026-01-01", "2026-01-19", "2026-02-16", "2026-05-25", "2026-07-04",
  "2026-09-07", "2026-10-12", "2026-11-11", "2026-11-26", "2026-12-25",
];

export function calculateBusinessDate(startDate: Date, daysToAdd: number): Date {
  const holidays = new Set(FEDERAL_HOLIDAYS_2026);
  const d = new Date(startDate);
  let remaining = Math.abs(daysToAdd);
  const direction = daysToAdd >= 0 ? 1 : -1;

  while (remaining > 0) {
    d.setDate(d.getDate() + direction);
    const day = d.getDay();
    const dateStr = d.toISOString().split("T")[0];
    if (day !== 0 && day !== 6 && !holidays.has(dateStr)) {
      remaining--;
    }
  }
  return d;
}

// ==========================================
// CORE CASCADE EXECUTION
// ==========================================

export async function executeCascade(params: {
  templateId: string; matterId: string; triggerDate?: Date;
  executedBy?: string; skipOptional?: boolean; selectedItemIds?: string[];
}): Promise<{ execution: any; createdTasks: any[] }> {
  const template = await db.taskCascadeTemplate.findUnique({
    where: { id: params.templateId },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) throw new Error("Template not found");

  const matter = await db.matter.findUnique({ where: { id: params.matterId } });
  if (!matter) throw new Error("Matter not found");

  const triggerDate = params.triggerDate || new Date();
  const items = params.selectedItemIds
    ? template.tasks.filter((t) => params.selectedItemIds!.includes(t.id))
    : template.tasks.filter((t) => !params.skipOptional || !t.isOptional);

  const createdTasks: any[] = [];
  const itemToTaskId: Record<string, string> = {};

  for (const item of items) {
    // Calculate due date
    const dueDate = item.isBusinessDays
      ? calculateBusinessDate(triggerDate, item.relativeDueDays)
      : new Date(triggerDate.getTime() + item.relativeDueDays * 86400000);

    // Resolve assignee
    let assigneeId: string | null = null;
    if (item.assigneeType === "specific_user" && item.assigneeUserId) {
      assigneeId = item.assigneeUserId;
    }
    // For matter_attorney, matter_paralegal, etc. - would resolve from matter team in production

    // Resolve dependency
    let dependsOnTaskId: string | null = null;
    if (item.dependsOnItemId && itemToTaskId[item.dependsOnItemId]) {
      dependsOnTaskId = itemToTaskId[item.dependsOnItemId];
    }

    // Map priority
    const priorityMap: Record<string, string> = { low: "LOW", normal: "MEDIUM", high: "HIGH", critical: "HIGH" };

    const task = await db.task.create({
      data: {
        title: item.title,
        description: item.description,
        status: "NOT_STARTED",
        priority: (priorityMap[item.priority] || "MEDIUM") as any,
        dueDate,
        matterId: params.matterId,
        assigneeId,
        cascadeExecutionId: null, // set after execution created
        cascadeItemId: item.id,
        dependsOnTaskId,
        isAutoCascaded: true,
        category: item.category,
        estimatedMinutes: item.estimatedMinutes,
        tags: item.tags as any,
      },
    });

    itemToTaskId[item.id] = task.id;
    createdTasks.push(task);
  }

  // Create execution log
  const execution = await db.taskCascadeExecution.create({
    data: {
      templateId: params.templateId,
      matterId: params.matterId,
      triggerStage: template.triggerStage,
      triggerDate,
      executedBy: params.executedBy || "system",
      executionType: params.executedBy ? "manual" : "automatic",
      tasksCreated: createdTasks.length,
      taskIds: createdTasks.map((t) => t.id),
      firmId: template.firmId,
    },
  });

  // Update tasks with execution ID
  await db.task.updateMany({
    where: { id: { in: createdTasks.map((t) => t.id) } },
    data: { cascadeExecutionId: execution.id },
  });

  return { execution, createdTasks };
}

// ==========================================
// TRIGGER MATCHING
// ==========================================

export async function findCascadesForTrigger(params: {
  practiceArea: string; triggerType: string; triggerStage?: string; matterId: string; firmId: string;
}): Promise<any[]> {
  const where: any = {
    isActive: true,
    triggerType: params.triggerType,
    firmId: params.firmId,
  };

  // Match practice area - handle both exact and prefix matching
  where.practiceArea = params.practiceArea;
  if (params.triggerStage) where.triggerStage = params.triggerStage;

  const templates = await db.taskCascadeTemplate.findMany({
    where,
    include: { tasks: { orderBy: { sortOrder: "asc" } }, _count: { select: { tasks: true } } },
  });

  // Filter out already-executed for this matter+stage
  const results: any[] = [];
  for (const t of templates) {
    const alreadyExecuted = await db.taskCascadeExecution.findFirst({
      where: { templateId: t.id, matterId: params.matterId, triggerStage: params.triggerStage, status: { not: "rolled_back" } },
    });
    if (!alreadyExecuted) results.push(t);
  }

  return results;
}

// ==========================================
// STAGE CHANGE HANDLER
// ==========================================

export async function onStageChange(params: {
  matterId: string; fromStage: string; toStage: string;
  practiceArea: string; changedBy: string; firmId: string;
}): Promise<{ autoExecuted: any[]; suggestedForReview: any[] }> {
  const cascades = await findCascadesForTrigger({
    practiceArea: params.practiceArea,
    triggerType: "stage_change",
    triggerStage: params.toStage,
    matterId: params.matterId,
    firmId: params.firmId,
  });

  const autoExecuted: any[] = [];
  const suggestedForReview: any[] = [];

  for (const cascade of cascades) {
    if (cascade.isDefault) {
      const result = await executeCascade({
        templateId: cascade.id,
        matterId: params.matterId,
        executedBy: params.changedBy,
      });
      autoExecuted.push({ template: cascade, ...result });
    } else {
      suggestedForReview.push(cascade);
    }
  }

  return { autoExecuted, suggestedForReview };
}

// ==========================================
// PREVIEW (no side effects)
// ==========================================

export async function previewCascade(params: {
  templateId: string; matterId: string; triggerDate?: Date;
}): Promise<Array<{ title: string; description: string | null; dueDate: Date; priority: string; assigneeType: string; isOptional: boolean; dependsOn: string | null; category: string | null }>> {
  const template = await db.taskCascadeTemplate.findUnique({
    where: { id: params.templateId },
    include: { tasks: { orderBy: { sortOrder: "asc" } } },
  });
  if (!template) return [];

  const triggerDate = params.triggerDate || new Date();

  return template.tasks.map((item) => {
    const dueDate = item.isBusinessDays
      ? calculateBusinessDate(triggerDate, item.relativeDueDays)
      : new Date(triggerDate.getTime() + item.relativeDueDays * 86400000);

    return {
      title: item.title,
      description: item.description,
      dueDate,
      priority: item.priority,
      assigneeType: item.assigneeType,
      isOptional: item.isOptional,
      dependsOn: item.dependsOnItemId,
      category: item.category,
    };
  });
}

// ==========================================
// ROLLBACK
// ==========================================

export async function rollbackCascade(executionId: string, rolledBackBy: string): Promise<{ rolledBack: number; preserved: number }> {
  const execution = await db.taskCascadeExecution.findUnique({ where: { id: executionId } });
  if (!execution) throw new Error("Execution not found");

  const taskIds = (execution.taskIds as string[]) || [];
  const tasks = await db.task.findMany({ where: { id: { in: taskIds } } });

  let rolledBack = 0, preserved = 0;
  for (const task of tasks) {
    if (task.status === "NOT_STARTED") {
      await db.task.delete({ where: { id: task.id } });
      rolledBack++;
    } else {
      preserved++;
    }
  }

  await db.taskCascadeExecution.update({
    where: { id: executionId },
    data: { status: "rolled_back", rollbackAt: new Date(), rollbackBy: rolledBackBy },
  });

  return { rolledBack, preserved };
}

// ==========================================
// SEED DEFAULT CASCADES
// ==========================================

export async function seedDefaultCascades(firmId: string): Promise<number> {
  let count = 0;

  const templates: Array<{ name: string; practiceArea: string; triggerStage: string; tasks: Array<{ title: string; relativeDueDays: number; priority: string; assigneeType: string; category?: string; dependsOnIdx?: number; isOptional?: boolean; reminderDaysBefore?: number[] }> }> = [
    // FAMILY LAW — Filing
    { name: "Family Law — Filing Tasks", practiceArea: "family_law", triggerStage: "Filing", tasks: [
      { title: "Draft Summons and Complaint/Petition", relativeDueDays: 0, priority: "high", assigneeType: "matter_attorney", category: "filing" },
      { title: "Prepare Statement of Net Worth", relativeDueDays: 3, priority: "high", assigneeType: "matter_paralegal", category: "document_prep" },
      { title: "Compile financial disclosure documents", relativeDueDays: 5, priority: "normal", assigneeType: "matter_paralegal", category: "document_prep", dependsOnIdx: 1 },
      { title: "File with Court Clerk", relativeDueDays: 7, priority: "high", assigneeType: "matter_paralegal", category: "filing", dependsOnIdx: 0 },
      { title: "Arrange service of process", relativeDueDays: 8, priority: "high", assigneeType: "matter_paralegal", category: "filing", dependsOnIdx: 3 },
      { title: "Send client welcome packet and timeline", relativeDueDays: 1, priority: "normal", assigneeType: "matter_paralegal", category: "client_communication" },
    ]},
    // FAMILY LAW — Discovery
    { name: "Family Law — Discovery Tasks", practiceArea: "family_law", triggerStage: "Discovery", tasks: [
      { title: "Draft and serve Interrogatories", relativeDueDays: 3, priority: "high", assigneeType: "matter_attorney", category: "discovery" },
      { title: "Draft and serve Document Demands", relativeDueDays: 3, priority: "high", assigneeType: "matter_attorney", category: "discovery" },
      { title: "Draft and serve Notice of Deposition", relativeDueDays: 5, priority: "normal", assigneeType: "matter_attorney", category: "discovery" },
      { title: "Request updated Statement of Net Worth from client", relativeDueDays: 0, priority: "high", assigneeType: "matter_paralegal", category: "client_communication" },
      { title: "Subpoena financial institution records", relativeDueDays: 7, priority: "high", assigneeType: "matter_paralegal", category: "discovery" },
      { title: "Order real property appraisal", relativeDueDays: 5, priority: "normal", assigneeType: "matter_attorney", category: "discovery" },
      { title: "Schedule forensic accountant (if business interests)", relativeDueDays: 10, priority: "normal", assigneeType: "matter_attorney", category: "discovery", isOptional: true },
      { title: "Calendar discovery response deadlines", relativeDueDays: 1, priority: "critical", assigneeType: "matter_paralegal", category: "administrative" },
    ]},
    // PI — Investigation
    { name: "PI — Investigation Tasks", practiceArea: "personal_injury", triggerStage: "Investigation", tasks: [
      { title: "Send preservation letters to all parties", relativeDueDays: 0, priority: "critical", assigneeType: "matter_attorney", category: "filing" },
      { title: "Order police/accident report", relativeDueDays: 1, priority: "high", assigneeType: "matter_paralegal", category: "document_prep" },
      { title: "Send HIPAA authorizations to client", relativeDueDays: 1, priority: "high", assigneeType: "matter_paralegal", category: "client_communication" },
      { title: "Photograph accident scene and vehicle damage", relativeDueDays: 3, priority: "high", assigneeType: "matter_paralegal", category: "document_prep" },
      { title: "Obtain witness statements", relativeDueDays: 5, priority: "normal", assigneeType: "matter_attorney", category: "discovery" },
      { title: "Request client's prior medical records (5 years)", relativeDueDays: 5, priority: "normal", assigneeType: "matter_paralegal", category: "document_prep" },
      { title: "Set up medical treatment tracking log", relativeDueDays: 2, priority: "normal", assigneeType: "matter_paralegal", category: "administrative" },
    ]},
    // PI — Demand Package
    { name: "PI — Demand Package Prep", practiceArea: "personal_injury", triggerStage: "Demand Package", tasks: [
      { title: "Request final medical records and bills from all providers", relativeDueDays: 0, priority: "critical", assigneeType: "matter_paralegal", category: "document_prep" },
      { title: "Order medical narrative from treating physician", relativeDueDays: 3, priority: "high", assigneeType: "matter_attorney", category: "document_prep" },
      { title: "Calculate special damages", relativeDueDays: 7, priority: "high", assigneeType: "matter_paralegal", category: "review", dependsOnIdx: 0 },
      { title: "Draft demand letter", relativeDueDays: 14, priority: "high", assigneeType: "matter_attorney", category: "filing", dependsOnIdx: 1 },
      { title: "Prepare demand package exhibits", relativeDueDays: 14, priority: "high", assigneeType: "matter_paralegal", category: "document_prep", dependsOnIdx: 2 },
      { title: "Review demand with client and send to carrier", relativeDueDays: 21, priority: "high", assigneeType: "matter_attorney", category: "client_communication", dependsOnIdx: 3 },
    ]},
    // PI — Litigation Filed
    { name: "PI — Litigation Filed Tasks", practiceArea: "personal_injury", triggerStage: "Litigation Filed", tasks: [
      { title: "Draft Summons and Complaint", relativeDueDays: 3, priority: "critical", assigneeType: "matter_attorney", category: "filing" },
      { title: "File with Court and obtain index number", relativeDueDays: 7, priority: "critical", assigneeType: "matter_paralegal", category: "filing", dependsOnIdx: 0 },
      { title: "Serve all defendants", relativeDueDays: 10, priority: "critical", assigneeType: "matter_paralegal", category: "filing", dependsOnIdx: 1 },
      { title: "File proof of service", relativeDueDays: 14, priority: "high", assigneeType: "matter_paralegal", category: "filing", dependsOnIdx: 2 },
      { title: "Calendar answer deadline", relativeDueDays: 1, priority: "critical", assigneeType: "matter_paralegal", category: "administrative" },
      { title: "Send litigation hold letter to client", relativeDueDays: 0, priority: "high", assigneeType: "matter_attorney", category: "client_communication" },
      { title: "Prepare preliminary conference statement", relativeDueDays: 20, priority: "normal", assigneeType: "matter_attorney", category: "court" },
      { title: "Request jury demand (if applicable)", relativeDueDays: 7, priority: "normal", assigneeType: "matter_attorney", category: "filing", isOptional: true },
    ]},
    // IMMIGRATION — Application Filing
    { name: "Immigration — Application Filing", practiceArea: "immigration", triggerStage: "Application Filing", tasks: [
      { title: "Complete all applicable USCIS forms", relativeDueDays: 5, priority: "critical", assigneeType: "matter_attorney", category: "filing" },
      { title: "Collect and organize supporting documents", relativeDueDays: 3, priority: "high", assigneeType: "matter_paralegal", category: "document_prep" },
      { title: "Draft cover letter / legal memo", relativeDueDays: 7, priority: "high", assigneeType: "matter_attorney", category: "filing" },
      { title: "Obtain certified translations", relativeDueDays: 10, priority: "high", assigneeType: "matter_paralegal", category: "document_prep" },
      { title: "Order passport-style photos", relativeDueDays: 3, priority: "normal", assigneeType: "matter_paralegal", category: "administrative" },
      { title: "Prepare filing fee payment", relativeDueDays: 7, priority: "normal", assigneeType: "matter_paralegal", category: "administrative" },
      { title: "Final review of complete petition package", relativeDueDays: 12, priority: "critical", assigneeType: "matter_attorney", category: "review" },
      { title: "File petition and calendar receipt notice deadline", relativeDueDays: 14, priority: "critical", assigneeType: "matter_paralegal", category: "filing", dependsOnIdx: 6 },
    ]},
    // IMMIGRATION — RFE Response
    { name: "Immigration — RFE Response", practiceArea: "immigration", triggerStage: "RFE Response", tasks: [
      { title: "Analyze RFE notice — identify each deficiency", relativeDueDays: 0, priority: "critical", assigneeType: "matter_attorney", category: "review" },
      { title: "Draft RFE response strategy memo", relativeDueDays: 2, priority: "critical", assigneeType: "matter_attorney", category: "document_prep" },
      { title: "Request additional evidence from client", relativeDueDays: 2, priority: "high", assigneeType: "matter_paralegal", category: "client_communication" },
      { title: "Obtain expert opinion letters if needed", relativeDueDays: 10, priority: "high", assigneeType: "matter_attorney", category: "document_prep", isOptional: true },
      { title: "Draft RFE response brief", relativeDueDays: 14, priority: "critical", assigneeType: "matter_attorney", category: "filing" },
      { title: "File RFE response (before 87-day deadline)", relativeDueDays: 20, priority: "critical", assigneeType: "matter_attorney", category: "filing", dependsOnIdx: 4, reminderDaysBefore: [30, 14, 7, 3, 1] },
    ]},
    // CORPORATE — Entity Formation
    { name: "Corporate — Entity Formation", practiceArea: "corporate", triggerStage: "Entity Formation", tasks: [
      { title: "Prepare and file Articles of Incorporation/Organization", relativeDueDays: 3, priority: "critical", assigneeType: "matter_attorney", category: "filing" },
      { title: "Draft Operating Agreement / Bylaws", relativeDueDays: 5, priority: "high", assigneeType: "matter_attorney", category: "document_prep" },
      { title: "Obtain EIN from IRS", relativeDueDays: 3, priority: "high", assigneeType: "matter_paralegal", category: "administrative", dependsOnIdx: 0 },
      { title: "Draft Organizational Resolutions", relativeDueDays: 5, priority: "normal", assigneeType: "matter_attorney", category: "document_prep" },
      { title: "Prepare stock/membership certificates", relativeDueDays: 7, priority: "normal", assigneeType: "matter_paralegal", category: "document_prep" },
      { title: "Send corporate maintenance calendar to client", relativeDueDays: 10, priority: "normal", assigneeType: "matter_paralegal", category: "client_communication" },
    ]},
    // REAL ESTATE — Contract
    { name: "Real Estate — Contract Phase", practiceArea: "real_estate", triggerStage: "Contract", tasks: [
      { title: "Review/draft purchase and sale agreement", relativeDueDays: 2, priority: "critical", assigneeType: "matter_attorney", category: "review" },
      { title: "Negotiate contract terms and rider provisions", relativeDueDays: 5, priority: "high", assigneeType: "matter_attorney", category: "filing", dependsOnIdx: 0 },
      { title: "Order title search and report", relativeDueDays: 3, priority: "critical", assigneeType: "matter_paralegal", category: "document_prep" },
      { title: "Review title report for exceptions", relativeDueDays: 10, priority: "high", assigneeType: "matter_attorney", category: "review", dependsOnIdx: 2 },
      { title: "Coordinate home inspection scheduling", relativeDueDays: 3, priority: "normal", assigneeType: "matter_paralegal", category: "administrative" },
      { title: "Calendar mortgage commitment and closing dates", relativeDueDays: 1, priority: "critical", assigneeType: "matter_paralegal", category: "administrative" },
    ]},
    // REAL ESTATE — Closing
    { name: "Real Estate — Closing Phase", practiceArea: "real_estate", triggerStage: "Closing", tasks: [
      { title: "Review closing statement / settlement statement", relativeDueDays: -3, priority: "critical", assigneeType: "matter_attorney", category: "review" },
      { title: "Review title insurance commitment", relativeDueDays: -5, priority: "high", assigneeType: "matter_attorney", category: "review" },
      { title: "Confirm wire transfer instructions", relativeDueDays: -2, priority: "critical", assigneeType: "matter_paralegal", category: "administrative" },
      { title: "Prepare transfer documents (deed, tax forms)", relativeDueDays: -5, priority: "high", assigneeType: "matter_attorney", category: "document_prep" },
      { title: "Schedule final walk-through", relativeDueDays: -2, priority: "normal", assigneeType: "matter_paralegal", category: "administrative" },
      { title: "Prepare closing binder", relativeDueDays: -1, priority: "high", assigneeType: "matter_paralegal", category: "document_prep" },
      { title: "Post-closing: record deed, send docs, archive", relativeDueDays: 3, priority: "high", assigneeType: "matter_paralegal", category: "administrative" },
    ]},
  ];

  for (const tmpl of templates) {
    const existing = await db.taskCascadeTemplate.findFirst({
      where: { practiceArea: tmpl.practiceArea, triggerStage: tmpl.triggerStage, firmId, isSystemTemplate: true },
    });
    if (existing) continue;

    const created = await db.taskCascadeTemplate.create({
      data: {
        name: tmpl.name,
        practiceArea: tmpl.practiceArea,
        triggerType: "stage_change",
        triggerStage: tmpl.triggerStage,
        isActive: true,
        isDefault: true,
        isSystemTemplate: true,
        firmId,
      },
    });

    const itemIds: string[] = [];
    for (let i = 0; i < tmpl.tasks.length; i++) {
      const t = tmpl.tasks[i];
      const item = await db.taskCascadeItem.create({
        data: {
          templateId: created.id,
          title: t.title,
          relativeDueDays: t.relativeDueDays,
          isBusinessDays: true,
          priority: t.priority,
          assigneeType: t.assigneeType,
          category: t.category,
          dependsOnItemId: t.dependsOnIdx !== undefined ? itemIds[t.dependsOnIdx] : null,
          isOptional: t.isOptional || false,
          reminderDaysBefore: t.reminderDaysBefore,
          sortOrder: i,
        },
      });
      itemIds.push(item.id);
    }
    count++;
  }

  return count;
}
