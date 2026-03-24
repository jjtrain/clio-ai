import { db } from "@/lib/db";

export async function findBestTemplate(params: { practiceArea: string; caseType: string; jurisdiction?: string; firmId: string }): Promise<any> {
  // Priority: firm+PA+case+jurisdiction > firm+PA+case > system+PA+case+jurisdiction > system+PA+case
  const candidates = await db.workflowTemplate.findMany({
    where: { practiceArea: params.practiceArea, caseType: params.caseType, OR: [{ firmId: params.firmId }, { firmId: null }] },
    orderBy: [{ firmId: "desc" }, { isDefault: "desc" }],
  });

  if (params.jurisdiction) {
    const exact = candidates.find((t) => t.jurisdiction === params.jurisdiction && t.firmId === params.firmId);
    if (exact) return exact;
    const systemExact = candidates.find((t) => t.jurisdiction === params.jurisdiction);
    if (systemExact) return systemExact;
  }

  return candidates[0] || null;
}

export async function applyTemplate(params: {
  matterId: string; templateId: string; appliedBy: string; firmId: string;
}): Promise<any> {
  const template = await db.workflowTemplate.findUnique({
    where: { id: params.templateId },
    include: { taskCascades: true, documentTemplates: true, deadlineRules: true, discoveryConfig: true, checklistItems: true, automationRules: true },
  });
  if (!template) throw new Error("Workflow template not found");

  const stages = template.stagesConfig as any[];
  const firstStage = stages[0]?.name || "Intake";

  // Create workflow instance
  const workflow = await db.matterWorkflowInstance.create({
    data: {
      matterId: params.matterId, workflowTemplateId: params.templateId,
      firmId: params.firmId, status: "ACTIVE", currentStage: firstStage,
      appliedBy: params.appliedBy,
    },
  });

  const events: Array<{ eventType: string; description: string; entityType?: string; entityId?: string }> = [];

  // Log template application
  events.push({ eventType: "workflow_applied", description: `Workflow "${template.name}" applied with ${stages.length} stages` });

  // Create checklist tasks for first stage
  const firstStageChecklist = template.checklistItems.filter((c) => c.triggerStage === firstStage);
  for (const item of firstStageChecklist) {
    const task = await db.task.create({
      data: {
        title: item.title, description: item.description, status: "NOT_STARTED",
        priority: item.isRequired ? "HIGH" : "MEDIUM", matterId: params.matterId,
        dueDate: item.dueOffsetDays ? new Date(Date.now() + item.dueOffsetDays * 86400000) : null,
        isAutoCascaded: true,
      },
    });
    events.push({ eventType: "checklist_task_created", description: `Task: ${item.title}`, entityType: "task", entityId: task.id });
  }

  // Create deadline rules
  for (const deadline of template.deadlineRules) {
    events.push({ eventType: "deadline_created", description: `Deadline: ${deadline.name} (${deadline.offsetDays} days ${deadline.offsetDirection} ${deadline.triggerEvent})` });
  }

  // Fire automations for first stage
  const firstStageAutos = template.automationRules.filter((a) => a.triggerType === "stage_enter" && a.triggerStage === firstStage && a.isActive);
  for (const auto of firstStageAutos) {
    const actions = auto.actions as any[];
    for (const action of actions) {
      await executeAutomationAction(action, params.matterId, params.firmId);
      events.push({ eventType: "automation_fired", description: `Automation: ${auto.name} → ${action.type}` });
    }
  }

  // Log all events
  for (const event of events) {
    await db.wFExecutionEvent.create({
      data: { matterWorkflowId: workflow.id, matterId: params.matterId, ...event, triggeredBy: "system" },
    });
  }

  // Update template usage
  await db.workflowTemplate.update({ where: { id: params.templateId }, data: { usageCount: { increment: 1 }, lastUsedAt: new Date() } });

  return workflow;
}

export async function onStageChange(params: {
  matterId: string; fromStage: string; toStage: string; changedBy: string;
}): Promise<void> {
  const workflow = await db.matterWorkflowInstance.findUnique({
    where: { matterId: params.matterId },
    include: { workflowTemplate: { include: { taskCascades: true, documentTemplates: true, checklistItems: true, automationRules: true, discoveryConfig: true } } },
  });
  if (!workflow) return;

  const template = workflow.workflowTemplate;
  const completedStages = workflow.completedStages as any[];
  completedStages.push({ stage: params.fromStage, completedAt: new Date().toISOString(), durationDays: 0 });

  await db.matterWorkflowInstance.update({
    where: { id: workflow.id },
    data: { currentStage: params.toStage, completedStages },
  });

  // Fire stage_enter triggers
  const stageChecklist = template.checklistItems.filter((c) => c.triggerStage === params.toStage);
  for (const item of stageChecklist) {
    await db.task.create({
      data: {
        title: item.title, status: "NOT_STARTED", priority: item.isRequired ? "HIGH" : "MEDIUM",
        matterId: params.matterId, dueDate: item.dueOffsetDays ? new Date(Date.now() + item.dueOffsetDays * 86400000) : null,
        isAutoCascaded: true,
      },
    });
  }

  const stageAutos = template.automationRules.filter((a) => a.triggerType === "stage_enter" && a.triggerStage === params.toStage && a.isActive);
  for (const auto of stageAutos) {
    for (const action of auto.actions as any[]) {
      await executeAutomationAction(action, params.matterId, workflow.firmId);
    }
  }

  await db.wFExecutionEvent.create({
    data: { matterWorkflowId: workflow.id, matterId: params.matterId, eventType: "stage_entered", description: `Stage changed: ${params.fromStage} → ${params.toStage}`, triggeredBy: params.changedBy },
  });
}

async function executeAutomationAction(action: any, matterId: string, firmId: string): Promise<void> {
  const config = action.config || {};
  switch (action.type) {
    case "create_task":
      await db.task.create({
        data: {
          title: config.title || "Auto-created task", status: "NOT_STARTED",
          priority: config.priority || "MEDIUM", matterId,
          dueDate: config.dueOffsetDays ? new Date(Date.now() + config.dueOffsetDays * 86400000) : null,
          isAutoCascaded: true,
        },
      });
      break;
    case "send_to_portal":
      // Would send via portal notification engine
      break;
    case "notify_user":
      // Would create notification
      break;
    default:
      break;
  }
}

export async function getWorkflowProgress(matterId: string): Promise<any> {
  const workflow = await db.matterWorkflowInstance.findUnique({
    where: { matterId },
    include: { workflowTemplate: true },
  });
  if (!workflow) return null;

  const stages = workflow.workflowTemplate.stagesConfig as any[];
  const completed = workflow.completedStages as any[];
  const currentIdx = stages.findIndex((s: any) => s.name === workflow.currentStage);

  return {
    currentStage: workflow.currentStage,
    completedStages: completed,
    remainingStages: stages.slice(currentIdx + 1).map((s: any) => s.name),
    totalStages: stages.length,
    completedStageCount: completed.length,
    percentComplete: stages.length > 0 ? Math.round((completed.length / stages.length) * 100) : 0,
  };
}

export async function cloneTemplate(templateId: string, params: { name: string; firmId: string; clonedBy: string }): Promise<any> {
  const orig = await db.workflowTemplate.findUnique({
    where: { id: templateId },
    include: { taskCascades: true, documentTemplates: true, deadlineRules: true, discoveryConfig: true, checklistItems: true, automationRules: true },
  });
  if (!orig) throw new Error("Template not found");

  const { id, createdAt, updatedAt, usageCount, lastUsedAt, mattersUsingThis, taskCascades, documentTemplates, deadlineRules, discoveryConfig, checklistItems, automationRules, ...data } = orig as any;

  const clone = await db.workflowTemplate.create({
    data: {
      ...data, name: params.name, firmId: params.firmId, clonedFromId: templateId,
      isSystemTemplate: false, isDefault: false, isPublished: false, version: 1,
      createdBy: params.clonedBy,
      taskCascades: { create: taskCascades.map((tc: any) => { const { id, workflowTemplateId, ...d } = tc; return d; }) },
      documentTemplates: { create: documentTemplates.map((dt: any) => { const { id, workflowTemplateId, ...d } = dt; return d; }) },
      deadlineRules: { create: deadlineRules.map((dr: any) => { const { id, workflowTemplateId, ...d } = dr; return d; }) },
      checklistItems: { create: checklistItems.map((ci: any) => { const { id, workflowTemplateId, ...d } = ci; return d; }) },
      automationRules: { create: automationRules.map((ar: any) => { const { id, workflowTemplateId, ...d } = ar; return d; }) },
    },
  });

  if (discoveryConfig) {
    const { id: dcId, workflowTemplateId: dcWtId, ...dcData } = discoveryConfig;
    await db.wFTemplateDiscovery.create({ data: { ...dcData, workflowTemplateId: clone.id } });
  }

  return clone;
}
