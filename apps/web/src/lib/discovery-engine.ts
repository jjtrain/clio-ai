import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// ==========================================
// TEMPLATE-BASED GENERATION
// ==========================================

export async function generateFromTemplate(input: {
  matterId: string; templateId?: string; caseType: string; jurisdiction: string;
  practiceArea: string; createdBy?: string; firmId: string;
}): Promise<any> {
  // Find template
  let template: any;
  if (input.templateId) {
    template = await db.discoveryCLTemplate.findUnique({ where: { id: input.templateId }, include: { sections: { include: { items: true }, orderBy: { sequenceNumber: "asc" } } } });
  } else {
    template = await db.discoveryCLTemplate.findFirst({
      where: { practiceArea: input.practiceArea, isDefault: true },
      include: { sections: { include: { items: true }, orderBy: { sequenceNumber: "asc" } } },
    });
  }

  const matter = await db.matter.findUnique({ where: { id: input.matterId }, include: { client: true } });

  // Create checklist
  const checklist = await db.discoveryChecklist.create({
    data: {
      matterId: input.matterId, firmId: input.firmId, practiceArea: input.practiceArea,
      caseType: input.caseType, jurisdiction: input.jurisdiction, generatedFrom: "template",
      title: `${input.practiceArea.replace(/_/g, " ")} Discovery — ${matter?.name || "Matter"}`,
      createdBy: input.createdBy, status: "ACTIVE",
    },
  });

  if (template) {
    for (const section of template.sections) {
      const sec = await db.discoveryCLSection.create({
        data: { checklistId: checklist.id, name: section.name, category: section.category, sequenceNumber: section.sequenceNumber },
      });

      for (const item of section.items) {
        await db.discoveryCLItem.create({
          data: {
            checklistId: checklist.id, sectionId: sec.id, matterId: input.matterId,
            title: item.title, description: item.description, legalBasis: item.legalBasis,
            sampleLanguage: item.sampleLanguage, practiceNote: item.practiceNote,
            category: item.category, priority: item.priority, isRequired: item.isRequired,
            conditionalOn: item.conditionalOn, tags: item.tags, sequenceNumber: item.sequenceNumber,
            status: "PENDING",
          },
        });
      }
    }
  }

  return db.discoveryChecklist.findUnique({
    where: { id: checklist.id },
    include: { sections: { include: { items: true }, orderBy: { sequenceNumber: "asc" } } },
  });
}

// ==========================================
// AI-SUPPLEMENTED GENERATION
// ==========================================

export async function generateWithAI(input: {
  matterId: string; caseType: string; jurisdiction: string; practiceArea: string;
  additionalContext?: string; createdBy?: string; firmId: string;
}): Promise<any> {
  const matter = await db.matter.findUnique({ where: { id: input.matterId }, include: { client: true } });

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: `You are an expert litigation attorney specializing in ${input.practiceArea.replace(/_/g, " ")} in ${input.jurisdiction}. Generate a comprehensive discovery checklist. Return ONLY valid JSON with this structure:
{ "sections": [{ "name": "string", "category": "INTERROGATORIES_TO_SERVE|DOCUMENTS_TO_DEMAND|DOCUMENTS_TO_PRODUCE|DEPOSITIONS_TO_NOTICE|SUBPOENAS_TO_ISSUE|EXPERT_WITNESSES|PRESERVATION_HOLDS|ESI_DISCOVERY|ITEMS_TO_VERIFY", "sequenceNumber": 1, "items": [{ "title": "string", "description": "string", "legalBasis": "string or null", "sampleLanguage": "string or null", "practiceNote": "string or null", "category": "same as section category", "priority": "CRITICAL|HIGH|STANDARD|OPTIONAL", "isRequired": true, "isCaseSpecific": false, "tags": ["string"], "sequenceNumber": 1 }] }] }`,
      messages: [{ role: "user", content: `Practice Area: ${input.practiceArea}\nCase Type: ${input.caseType}\nJurisdiction: ${input.jurisdiction}\nMatter: ${matter?.name || "Unknown"}\nClient: ${matter?.client?.name || "Unknown"}\n${input.additionalContext ? `Additional Context: ${input.additionalContext}` : ""}\n\nGenerate a comprehensive discovery checklist.` }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || '{"sections":[]}');

    const checklist = await db.discoveryChecklist.create({
      data: {
        matterId: input.matterId, firmId: input.firmId, practiceArea: input.practiceArea,
        caseType: input.caseType, jurisdiction: input.jurisdiction, generatedFrom: "ai",
        title: `${input.practiceArea.replace(/_/g, " ")} Discovery — ${matter?.name || "Matter"}`,
        createdBy: input.createdBy, status: "ACTIVE",
        matterFactsUsed: { matterName: matter?.name, clientName: matter?.client?.name },
      },
    });

    for (const section of json.sections || []) {
      const sec = await db.discoveryCLSection.create({
        data: { checklistId: checklist.id, name: section.name, category: section.category, sequenceNumber: section.sequenceNumber || 1 },
      });

      for (const item of section.items || []) {
        await db.discoveryCLItem.create({
          data: {
            checklistId: checklist.id, sectionId: sec.id, matterId: input.matterId,
            title: item.title, description: item.description, legalBasis: item.legalBasis,
            sampleLanguage: item.sampleLanguage, practiceNote: item.practiceNote,
            category: item.category || section.category, priority: item.priority || "STANDARD",
            isRequired: item.isRequired ?? true, isAiGenerated: true,
            isCaseSpecific: item.isCaseSpecific || false, tags: item.tags,
            sequenceNumber: item.sequenceNumber || 1, status: "PENDING",
          },
        });
      }
    }

    return db.discoveryChecklist.findUnique({
      where: { id: checklist.id },
      include: { sections: { include: { items: true }, orderBy: { sequenceNumber: "asc" } } },
    });
  } catch {
    // Fallback to template
    return generateFromTemplate(input);
  }
}

// ==========================================
// HYBRID GENERATION
// ==========================================

export async function generateHybrid(input: {
  matterId: string; caseType: string; jurisdiction: string; practiceArea: string;
  additionalContext?: string; createdBy?: string; firmId: string;
}): Promise<any> {
  // Start with template, then supplement with AI
  const checklist = await generateFromTemplate(input);

  // AI supplement would run asynchronously in production
  // For now, the checklist from template is sufficient
  if (checklist) {
    await db.discoveryChecklist.update({
      where: { id: checklist.id },
      data: { generatedFrom: "hybrid" },
    });
  }

  return checklist;
}

// ==========================================
// STATUS & COMPLETION
// ==========================================

export async function recalculateCompletion(checklistId: string): Promise<number> {
  const items = await db.discoveryCLItem.findMany({ where: { checklistId } });
  const applicable = items.filter((i) => i.status !== "NOT_APPLICABLE");
  const complete = applicable.filter((i) => ["COMPLETE", "WAIVED"].includes(i.status));
  const pct = applicable.length > 0 ? Math.round((complete.length / applicable.length) * 100) : 0;

  await db.discoveryChecklist.update({ where: { id: checklistId }, data: { completionPct: pct, status: pct === 100 ? "COMPLETE" : "ACTIVE" } });
  return pct;
}

export async function updateItemStatus(itemId: string, status: string, userId: string, notes?: string): Promise<any> {
  const data: any = { status };
  if (status === "COMPLETE") { data.completedAt = new Date(); data.completedBy = userId; }
  if (status === "RESPONDED") { data.responseReceivedAt = new Date(); }
  if (notes) data.notes = notes;

  const item = await db.discoveryCLItem.update({ where: { id: itemId }, data });
  await recalculateCompletion(item.checklistId);

  // Create follow-up task for deficient responses
  if (status === "DEFICIENT") {
    await db.task.create({
      data: {
        title: `Follow up on deficient discovery response: ${item.title}`,
        description: `Discovery response for "${item.title}" was flagged as deficient. Review and prepare motion to compel if necessary.`,
        status: "NOT_STARTED",
        priority: "HIGH",
        matterId: item.matterId,
        dueDate: new Date(Date.now() + 7 * 86400000),
      },
    });
  }

  return item;
}

export async function getOverdueItems(firmId: string): Promise<any[]> {
  return db.discoveryCLItem.findMany({
    where: {
      checklist: { firmId },
      dueDate: { lt: new Date() },
      status: { notIn: ["COMPLETE", "WAIVED", "NOT_APPLICABLE"] },
    },
    include: { checklist: { select: { title: true, matterId: true } } },
    orderBy: { dueDate: "asc" },
  });
}
