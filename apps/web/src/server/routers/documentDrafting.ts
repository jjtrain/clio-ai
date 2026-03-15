import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  generateDocumentFromPrompt,
  generateFromTemplate,
  suggestTemplateVariables,
  improveDocument,
  assembleDocumentSetSuggestion,
} from "@/lib/ai-documents";
import { SYSTEM_FIELD_SETS, resolveFields, applyMergeFields, extractUsedFields } from "@/lib/merge-fields";
import crypto from "crypto";

const STARTER_TEMPLATES = [
  {
    name: "Retainer Agreement",
    description: "Standard retainer agreement with client information, scope of representation, fee structure, and retainer deposit terms.",
    category: "ENGAGEMENT" as const,
    practiceArea: "Family Law",
    variables: JSON.stringify([
      { name: "CLIENT_NAME", label: "Client Name", type: "text", required: true },
      { name: "CLIENT_ADDRESS", label: "Client Address", type: "textarea", required: true },
      { name: "RETAINER_AMOUNT", label: "Retainer Deposit", type: "number", required: true, defaultValue: "5000" },
      { name: "HOURLY_RATE", label: "Hourly Rate", type: "number", required: true, defaultValue: "350" },
      { name: "PRACTICE_AREA", label: "Practice Area", type: "text", required: true, defaultValue: "Family Law" },
      { name: "SCOPE_OF_WORK", label: "Scope of Representation", type: "textarea", required: true },
      { name: "STATE", label: "Governing State", type: "text", required: true },
    ]),
    content: `<h1 style="text-align:center;">RETAINER AGREEMENT</h1>
<p style="text-align:center;"><strong>{{FIRM_NAME}}</strong></p>
<hr/>
<p>This Retainer Agreement ("Agreement") is entered into as of the date last signed below, by and between:</p>
<p><strong>Attorney/Firm:</strong> {{FIRM_NAME}}, {{FIRM_ADDRESS}}</p>
<p><strong>Client:</strong> {{CLIENT_NAME}}, {{CLIENT_ADDRESS}}</p>

<h2>1. SCOPE OF REPRESENTATION</h2>
<p>The Firm agrees to represent the Client in the following matter:</p>
<p><strong>Practice Area:</strong> {{PRACTICE_AREA}}</p>
<p><strong>Scope:</strong> {{SCOPE_OF_WORK}}</p>
<p>This representation is limited to the matter described above and does not extend to any other legal matters unless separately agreed upon in writing.</p>

<h2>2. FEES AND BILLING</h2>
<p>2.1. <strong>Hourly Rate:</strong> The Client agrees to pay the Firm at the rate of \${{HOURLY_RATE}} per hour for attorney time.</p>
<p>2.2. <strong>Retainer Deposit:</strong> The Client shall pay an initial retainer deposit of \${{RETAINER_AMOUNT}} upon execution of this Agreement. This retainer will be deposited into the Firm's trust account and applied against fees and costs as they are incurred.</p>
<p>2.3. <strong>Billing:</strong> The Firm will provide monthly invoices detailing all services rendered and costs incurred. Payment is due within thirty (30) days of the invoice date.</p>
<p>2.4. <strong>Replenishment:</strong> If the retainer balance falls below $1,000, the Client agrees to replenish the retainer to its original amount within ten (10) days of written notice.</p>

<h2>3. COSTS AND EXPENSES</h2>
<p>In addition to attorney fees, the Client is responsible for all costs and expenses incurred in connection with the representation, including but not limited to: filing fees, service of process fees, deposition costs, expert witness fees, travel expenses, and copying charges.</p>

<h2>4. TERMINATION</h2>
<p>4.1. Either party may terminate this Agreement at any time by providing written notice to the other party.</p>
<p>4.2. Upon termination, the Client remains responsible for all fees and costs incurred through the date of termination.</p>
<p>4.3. Any unused portion of the retainer deposit will be refunded to the Client within thirty (30) days of final billing.</p>

<h2>5. GOVERNING LAW</h2>
<p>This Agreement shall be governed by and construed in accordance with the laws of the State of {{STATE}}.</p>

<h2>6. ACKNOWLEDGMENT</h2>
<p>The Client acknowledges that: (a) no outcome has been guaranteed; (b) the Client has read and understands this Agreement; and (c) the Client has received a copy of this Agreement.</p>`,
  },
  {
    name: "Fee Agreement",
    description: "Hourly fee agreement with detailed billing terms, payment schedule, and client obligations.",
    category: "AGREEMENT" as const,
    practiceArea: null,
    variables: JSON.stringify([
      { name: "CLIENT_NAME", label: "Client Name", type: "text", required: true },
      { name: "HOURLY_RATE", label: "Hourly Rate", type: "number", required: true, defaultValue: "350" },
      { name: "BILLING_CYCLE", label: "Billing Cycle", type: "select", required: true, options: ["Monthly", "Bi-Weekly", "Quarterly"], defaultValue: "Monthly" },
      { name: "PAYMENT_TERMS", label: "Payment Terms (days)", type: "number", required: true, defaultValue: "30" },
    ]),
    content: `<h1 style="text-align:center;">FEE AGREEMENT</h1>
<p style="text-align:center;"><strong>{{FIRM_NAME}}</strong></p>
<hr/>
<p>This Fee Agreement is between <strong>{{FIRM_NAME}}</strong> ("Firm") and <strong>{{CLIENT_NAME}}</strong> ("Client").</p>

<h2>1. FEES</h2>
<p>The Firm's current hourly rate for legal services is <strong>\${{HOURLY_RATE}}</strong> per hour. This rate is subject to periodic review and adjustment with prior written notice to the Client.</p>

<h2>2. BILLING</h2>
<p>The Firm will issue invoices on a <strong>{{BILLING_CYCLE}}</strong> basis. Each invoice will itemize the services performed, the time spent, and any costs advanced on the Client's behalf.</p>

<h2>3. PAYMENT</h2>
<p>Payment is due within <strong>{{PAYMENT_TERMS}} days</strong> of the invoice date. Late payments may be subject to interest at the rate permitted by applicable law.</p>

<h2>4. COSTS</h2>
<p>The Client is responsible for all out-of-pocket costs incurred in the representation, including filing fees, service charges, copying, postage, and travel expenses.</p>`,
  },
  {
    name: "Engagement Letter",
    description: "Initial engagement letter confirming representation, describing the matter, and outlining fee terms.",
    category: "ENGAGEMENT" as const,
    practiceArea: null,
    variables: JSON.stringify([
      { name: "CLIENT_NAME", label: "Client Name", type: "text", required: true },
      { name: "MATTER_DESCRIPTION", label: "Matter Description", type: "textarea", required: true },
      { name: "FEES", label: "Fee Arrangement Description", type: "textarea", required: true },
      { name: "DATE", label: "Date", type: "date", required: true },
    ]),
    content: `<p>{{DATE}}</p>
<p>{{CLIENT_NAME}}<br/>Via Email</p>
<p>Re: <strong>Engagement of Legal Services</strong></p>
<p>Dear {{CLIENT_NAME}},</p>
<p>Thank you for retaining <strong>{{FIRM_NAME}}</strong> to represent you. This letter confirms the terms of our engagement.</p>

<h3>Matter Description</h3>
<p>{{MATTER_DESCRIPTION}}</p>

<h3>Fee Arrangement</h3>
<p>{{FEES}}</p>

<h3>Scope of Representation</h3>
<p>Our representation is limited to the matter described above. Any additional legal matters will require a separate engagement agreement.</p>

<h3>Communication</h3>
<p>We will keep you informed of significant developments and will consult with you on major decisions regarding your matter.</p>

<p>Please sign and return a copy of this letter to confirm your agreement to these terms.</p>
<p>Sincerely,<br/><strong>{{FIRM_NAME}}</strong></p>`,
  },
  {
    name: "Demand Letter",
    description: "Formal demand letter requiring action or payment by a specified deadline.",
    category: "LETTER" as const,
    practiceArea: null,
    variables: JSON.stringify([
      { name: "RECIPIENT_NAME", label: "Recipient Name", type: "text", required: true },
      { name: "RECIPIENT_ADDRESS", label: "Recipient Address", type: "textarea", required: true },
      { name: "DEMAND_AMOUNT", label: "Demand Amount ($)", type: "number", required: true },
      { name: "DEMAND_REASON", label: "Reason for Demand", type: "textarea", required: true },
      { name: "DEADLINE_DATE", label: "Deadline Date", type: "date", required: true },
    ]),
    content: `<p>{{DATE}}</p>
<p><strong>SENT VIA CERTIFIED MAIL, RETURN RECEIPT REQUESTED</strong></p>
<p>{{RECIPIENT_NAME}}<br/>{{RECIPIENT_ADDRESS}}</p>
<p>Re: <strong>Demand for Payment</strong></p>
<p>Dear {{RECIPIENT_NAME}},</p>
<p>This firm represents <strong>{{CLIENT_NAME}}</strong> in connection with the matter described below. This letter serves as formal demand for the following:</p>

<h3>Basis for Demand</h3>
<p>{{DEMAND_REASON}}</p>

<h3>Demand</h3>
<p>We hereby demand payment in the amount of <strong>\${{DEMAND_AMOUNT}}</strong> on or before <strong>{{DEADLINE_DATE}}</strong>.</p>

<h3>Consequences of Non-Compliance</h3>
<p>Should you fail to comply with this demand by the deadline stated above, our client is prepared to pursue all available legal remedies, including but not limited to filing a civil action, which may result in additional liability for attorney's fees and court costs.</p>

<p>Please direct all communications regarding this matter to this office.</p>
<p>Very truly yours,<br/><strong>{{FIRM_NAME}}</strong></p>`,
  },
  {
    name: "Motion Template",
    description: "Generic motion with court caption, body, and prayer for relief.",
    category: "MOTION" as const,
    practiceArea: null,
    variables: JSON.stringify([
      { name: "COURT_NAME", label: "Court Name", type: "text", required: true },
      { name: "CASE_NUMBER", label: "Case Number", type: "text", required: true },
      { name: "PLAINTIFF_NAME", label: "Plaintiff Name", type: "text", required: true },
      { name: "DEFENDANT_NAME", label: "Defendant Name", type: "text", required: true },
      { name: "MOTION_TYPE", label: "Motion Type", type: "text", required: true },
      { name: "GROUNDS", label: "Grounds for Motion", type: "textarea", required: true },
    ]),
    content: `<p style="text-align:center;"><strong>{{COURT_NAME}}</strong></p>
<table style="width:100%;border:none;">
<tr><td style="width:45%;">{{PLAINTIFF_NAME}},<br/><em>Plaintiff,</em><br/><br/>v.<br/><br/>{{DEFENDANT_NAME}},<br/><em>Defendant.</em></td>
<td style="width:10%;border-left:2px solid #000;"></td>
<td style="width:45%;">Case No. {{CASE_NUMBER}}<br/><br/><strong>{{MOTION_TYPE}}</strong></td></tr>
</table>
<hr/>
<h2>MOTION</h2>
<p>COMES NOW the undersigned, and hereby moves this Honorable Court for the following relief:</p>

<h3>I. STATEMENT OF FACTS</h3>
<p>{{GROUNDS}}</p>

<h3>II. LEGAL ARGUMENT</h3>
<p>[Legal argument supporting the motion]</p>

<h3>III. PRAYER FOR RELIEF</h3>
<p>WHEREFORE, the undersigned respectfully requests that this Court grant the relief requested herein, and for such other and further relief as this Court deems just and proper.</p>

<p>Respectfully submitted,</p>
<p><strong>{{FIRM_NAME}}</strong><br/>Attorney for {{PLAINTIFF_NAME}}</p>`,
  },
  {
    name: "Settlement Agreement",
    description: "Settlement agreement template with terms, conditions, and mutual release provisions.",
    category: "AGREEMENT" as const,
    practiceArea: null,
    variables: JSON.stringify([
      { name: "PARTY_1_NAME", label: "Party 1 (Your Client)", type: "text", required: true },
      { name: "PARTY_2_NAME", label: "Party 2 (Opposing Party)", type: "text", required: true },
      { name: "SETTLEMENT_AMOUNT", label: "Settlement Amount ($)", type: "number", required: true },
      { name: "TERMS", label: "Settlement Terms & Conditions", type: "textarea", required: true },
      { name: "EFFECTIVE_DATE", label: "Effective Date", type: "date", required: true },
    ]),
    content: `<h1 style="text-align:center;">SETTLEMENT AGREEMENT AND MUTUAL RELEASE</h1>
<hr/>
<p>This Settlement Agreement and Mutual Release ("Agreement") is entered into as of <strong>{{EFFECTIVE_DATE}}</strong>, by and between:</p>
<p><strong>{{PARTY_1_NAME}}</strong> ("Party 1") and <strong>{{PARTY_2_NAME}}</strong> ("Party 2"), collectively referred to as the "Parties."</p>

<h2>RECITALS</h2>
<p>WHEREAS, the Parties are involved in a dispute; and</p>
<p>WHEREAS, the Parties desire to resolve all claims and disputes between them without further litigation;</p>
<p>NOW, THEREFORE, in consideration of the mutual promises and covenants contained herein, the Parties agree as follows:</p>

<h2>1. SETTLEMENT PAYMENT</h2>
<p>Party 2 shall pay to Party 1 the sum of <strong>\${{SETTLEMENT_AMOUNT}}</strong> within thirty (30) days of the execution of this Agreement.</p>

<h2>2. TERMS AND CONDITIONS</h2>
<p>{{TERMS}}</p>

<h2>3. MUTUAL RELEASE</h2>
<p>Upon receipt of the settlement payment, each Party hereby releases and forever discharges the other Party from any and all claims, demands, damages, actions, and causes of action, whether known or unknown, arising out of or related to the dispute referenced herein.</p>

<h2>4. CONFIDENTIALITY</h2>
<p>The Parties agree to keep the terms of this Agreement confidential, except as required by law or to enforce the terms hereof.</p>

<h2>5. GOVERNING LAW</h2>
<p>This Agreement shall be governed by and construed in accordance with applicable state law.</p>

<h2>6. ENTIRE AGREEMENT</h2>
<p>This Agreement constitutes the entire agreement between the Parties and supersedes all prior negotiations, representations, or agreements relating to this subject matter.</p>`,
  },
];

async function ensureStarterTemplates(db: any) {
  const count = await db.documentTemplate.count();
  if (count > 0) return;

  for (const t of STARTER_TEMPLATES) {
    await db.documentTemplate.create({
      data: {
        name: t.name,
        description: t.description,
        category: t.category,
        practiceArea: t.practiceArea,
        content: t.content,
        variables: t.variables,
      },
    });
  }
}

async function ensureSystemMergeFields(db: any) {
  const count = await db.mergeFieldSet.count({ where: { isSystem: true } });
  if (count > 0) return;

  for (const [key, setDef] of Object.entries(SYSTEM_FIELD_SETS)) {
    await db.mergeFieldSet.create({
      data: {
        name: setDef.name,
        description: setDef.description,
        fields: JSON.stringify(setDef.fields),
        isSystem: true,
      },
    });
  }
}

export const documentDraftingRouter = router({
  // ── Templates ─────────────────────────────────────────
  listTemplates: publicProcedure
    .input(
      z.object({
        category: z.enum(["ENGAGEMENT", "PLEADING", "MOTION", "LETTER", "AGREEMENT", "DISCOVERY", "COURT_FORM", "OTHER"]).optional(),
        practiceArea: z.string().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      await ensureStarterTemplates(ctx.db);
      const where: any = { isActive: true };
      if (input?.category) where.category = input.category;
      if (input?.practiceArea) where.practiceArea = input.practiceArea;
      if (input?.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { description: { contains: input.search, mode: "insensitive" } },
        ];
      }
      return ctx.db.documentTemplate.findMany({
        where,
        orderBy: { updatedAt: "desc" },
      });
    }),

  getTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.documentTemplate.findUniqueOrThrow({ where: { id: input.id } });
    }),

  createTemplate: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      category: z.enum(["ENGAGEMENT", "PLEADING", "MOTION", "LETTER", "AGREEMENT", "DISCOVERY", "COURT_FORM", "OTHER"]),
      practiceArea: z.string().optional(),
      content: z.string(),
      variables: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.documentTemplate.create({ data: input });
    }),

  updateTemplate: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.enum(["ENGAGEMENT", "PLEADING", "MOTION", "LETTER", "AGREEMENT", "DISCOVERY", "COURT_FORM", "OTHER"]).optional(),
      practiceArea: z.string().optional(),
      content: z.string().optional(),
      variables: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.documentTemplate.update({ where: { id }, data });
    }),

  deleteTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.documentTemplate.update({ where: { id: input.id }, data: { isActive: false } });
    }),

  duplicateTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.documentTemplate.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.documentTemplate.create({
        data: { name: `Copy of ${t.name}`, description: t.description, category: t.category, practiceArea: t.practiceArea, content: t.content, variables: t.variables },
      });
    }),

  aiCreateTemplate: publicProcedure
    .input(z.object({
      description: z.string().min(1),
      practiceArea: z.string().optional(),
      category: z.enum(["ENGAGEMENT", "PLEADING", "MOTION", "LETTER", "AGREEMENT", "DISCOVERY", "COURT_FORM", "OTHER"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const doc = await generateDocumentFromPrompt({ prompt: `Create a template for: ${input.description}. Use {{VARIABLE_NAME}} placeholders for all customizable values.` });
      const vars = await suggestTemplateVariables({ documentContent: doc.content });
      const variables = vars.map((v) => ({ ...v, required: true }));
      return ctx.db.documentTemplate.create({
        data: {
          name: doc.title,
          description: input.description,
          category: input.category,
          practiceArea: input.practiceArea || null,
          content: doc.content,
          variables: JSON.stringify(variables),
        },
      });
    }),

  // ── Drafting ──────────────────────────────────────────
  listDrafts: publicProcedure
    .input(z.object({
      status: z.enum(["DRAFT", "REVIEW", "APPROVED", "SENT", "SIGNED"]).optional(),
      matterId: z.string().optional(),
      clientId: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.search) where.title = { contains: input.search, mode: "insensitive" };
      return ctx.db.draftDocument.findMany({
        where,
        include: {
          matter: { select: { id: true, name: true, matterNumber: true } },
          client: { select: { id: true, name: true } },
          template: { select: { id: true, name: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  getDraft: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.draftDocument.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          matter: { select: { id: true, name: true, matterNumber: true } },
          client: { select: { id: true, name: true } },
          template: { select: { id: true, name: true } },
        },
      });
    }),

  createFromTemplate: publicProcedure
    .input(z.object({
      templateId: z.string(),
      matterId: z.string().optional(),
      clientId: z.string().optional(),
      variableValues: z.record(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.documentTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
      const content = generateFromTemplate(template.content, input.variableValues);
      const draft = await ctx.db.draftDocument.create({
        data: {
          title: template.name,
          content,
          templateId: input.templateId,
          matterId: input.matterId || null,
          clientId: input.clientId || null,
          variableValues: JSON.stringify(input.variableValues),
        },
      });
      await ctx.db.documentTemplate.update({ where: { id: input.templateId }, data: { usageCount: { increment: 1 } } });
      return draft;
    }),

  createFromAi: publicProcedure
    .input(z.object({
      prompt: z.string().min(1),
      matterId: z.string().optional(),
      clientId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let matterContext: any = undefined;
      if (input.matterId) {
        const m = await ctx.db.matter.findUnique({
          where: { id: input.matterId },
          include: { client: { select: { name: true } }, relatedParties: { select: { name: true, role: true } } },
        });
        if (m) {
          matterContext = {
            name: m.name, description: m.description, practiceArea: m.practiceArea,
            clientName: m.client.name,
            parties: m.relatedParties.map((p: any) => `${p.name} (${p.role})`),
          };
        }
      }
      const firmSettings = await ctx.db.settings.findUnique({ where: { id: "default" } });
      const firmInfo = firmSettings ? { name: firmSettings.firmName ?? undefined, address: [firmSettings.address, firmSettings.city, firmSettings.state, firmSettings.zip].filter(Boolean).join(", "), phone: firmSettings.phone ?? undefined, email: firmSettings.email ?? undefined } : undefined;

      const result = await generateDocumentFromPrompt({ prompt: input.prompt, matterContext, firmInfo });
      return ctx.db.draftDocument.create({
        data: {
          title: result.title,
          content: result.content,
          matterId: input.matterId || null,
          clientId: input.clientId || null,
          aiGenerated: true,
          aiPrompt: input.prompt,
        },
      });
    }),

  createBlank: publicProcedure
    .input(z.object({ title: z.string().min(1), matterId: z.string().optional(), clientId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.draftDocument.create({
        data: { title: input.title, content: "<p></p>", matterId: input.matterId || null, clientId: input.clientId || null },
      });
    }),

  updateDraft: publicProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      content: z.string().optional(),
      status: z.enum(["DRAFT", "REVIEW", "APPROVED", "SENT", "SIGNED"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, content, ...rest } = input;
      const data: any = { ...rest };
      if (content !== undefined) {
        data.content = content;
        data.version = { increment: 1 };
      }
      return ctx.db.draftDocument.update({ where: { id }, data });
    }),

  improveDraft: publicProcedure
    .input(z.object({ id: z.string(), instructions: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.draftDocument.findUniqueOrThrow({ where: { id: input.id } });
      const result = await improveDocument({ content: draft.content, instructions: input.instructions });
      await ctx.db.draftDocument.update({
        where: { id: input.id },
        data: { content: result.content, version: { increment: 1 } },
      });
      return { changes: result.changes };
    }),

  deleteDraft: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.draftDocument.delete({ where: { id: input.id } });
    }),

  duplicateDraft: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const d = await ctx.db.draftDocument.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.draftDocument.create({
        data: {
          title: `Copy of ${d.title}`, content: d.content, matterId: d.matterId, clientId: d.clientId,
          templateId: d.templateId, variableValues: d.variableValues, aiGenerated: d.aiGenerated, aiPrompt: d.aiPrompt,
        },
      });
    }),

  sendForSignature: publicProcedure
    .input(z.object({ draftId: z.string(), clientName: z.string(), clientEmail: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const draft = await ctx.db.draftDocument.findUniqueOrThrow({ where: { id: input.draftId } });
      if (!draft.matterId) throw new Error("Draft must be linked to a matter to send for signature");
      const sigReq = await ctx.db.signatureRequest.create({
        data: {
          matterId: draft.matterId,
          title: draft.title,
          documentContent: draft.content,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          signingToken: crypto.randomBytes(32).toString("hex"),
          status: "PENDING_CLIENT",
          sentAt: new Date(),
        },
      });
      await ctx.db.draftDocument.update({ where: { id: input.draftId }, data: { status: "SENT" } });
      return sigReq;
    }),

  // ── Document Sets ─────────────────────────────────────
  listSets: publicProcedure
    .input(z.object({ matterId: z.string().optional(), status: z.enum(["ASSEMBLING", "READY", "SENT", "COMPLETED"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      return ctx.db.documentSet.findMany({
        where,
        include: {
          matter: { select: { id: true, name: true, matterNumber: true } },
          _count: { select: { items: true } },
          items: { select: { isComplete: true } },
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  getSet: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.documentSet.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          matter: { select: { id: true, name: true, matterNumber: true, practiceArea: true } },
          items: {
            include: {
              draftDocument: { select: { id: true, title: true, status: true } },
              signatureRequest: { select: { id: true, title: true, status: true } },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      });
    }),

  createSet: publicProcedure
    .input(z.object({ name: z.string().min(1), matterId: z.string().optional(), clientId: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.documentSet.create({ data: input });
    }),

  aiSuggestSet: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({
        where: { id: input.matterId },
        select: { name: true, practiceArea: true, description: true },
      });
      return assembleDocumentSetSuggestion({
        matterType: matter.description || matter.name,
        practiceArea: matter.practiceArea || "General",
      });
    }),

  addItemToSet: publicProcedure
    .input(z.object({ documentSetId: z.string(), draftDocumentId: z.string().optional(), signatureRequestId: z.string().optional(), title: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.db.documentSetItem.aggregate({ where: { documentSetId: input.documentSetId }, _max: { sortOrder: true } });
      return ctx.db.documentSetItem.create({
        data: { ...input, sortOrder: (maxOrder._max.sortOrder || 0) + 1 },
      });
    }),

  removeItemFromSet: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.documentSetItem.delete({ where: { id: input.id } });
    }),

  reorderItems: publicProcedure
    .input(z.object({ documentSetId: z.string(), itemIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      for (let i = 0; i < input.itemIds.length; i++) {
        await ctx.db.documentSetItem.update({ where: { id: input.itemIds[i] }, data: { sortOrder: i } });
      }
      return true;
    }),

  markItemComplete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.documentSetItem.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.documentSetItem.update({ where: { id: input.id }, data: { isComplete: !item.isComplete } });
    }),

  updateSetStatus: publicProcedure
    .input(z.object({ id: z.string(), status: z.enum(["ASSEMBLING", "READY", "SENT", "COMPLETED"]) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.documentSet.update({ where: { id: input.id }, data: { status: input.status } });
    }),

  deleteSet: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.documentSet.delete({ where: { id: input.id } });
    }),

  // ── Merge Fields ──────────────────────────────────────────────

  listMergeFieldSets: publicProcedure.query(async ({ ctx }) => {
    await ensureSystemMergeFields(ctx.db);
    return ctx.db.mergeFieldSet.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }] });
  }),

  createMergeFieldSet: publicProcedure
    .input(z.object({ name: z.string().min(1), description: z.string().optional(), fields: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.mergeFieldSet.create({ data: { name: input.name, description: input.description, fields: input.fields, isSystem: false } });
    }),

  updateMergeFieldSet: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), description: z.string().optional(), fields: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const set = await ctx.db.mergeFieldSet.findUnique({ where: { id: input.id } });
      if (set?.isSystem) throw new Error("Cannot modify system merge field sets");
      const { id, ...data } = input;
      return ctx.db.mergeFieldSet.update({ where: { id }, data });
    }),

  deleteMergeFieldSet: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const set = await ctx.db.mergeFieldSet.findUnique({ where: { id: input.id } });
      if (set?.isSystem) throw new Error("Cannot delete system merge field sets");
      return ctx.db.mergeFieldSet.delete({ where: { id: input.id } });
    }),

  resolveFieldsForMatter: publicProcedure
    .input(z.object({ matterId: z.string(), clientId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return resolveFields(ctx.db, input.matterId, input.clientId);
    }),

  previewTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), matterId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.documentTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
      let fields: Record<string, string> = {};
      if (input.matterId) {
        fields = await resolveFields(ctx.db, input.matterId);
      }
      // Also resolve date fields regardless
      const now = new Date();
      if (!fields.TODAY) fields.TODAY = `${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getDate().toString().padStart(2, "0")}/${now.getFullYear()}`;
      if (!fields.TODAY_LONG) fields.TODAY_LONG = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      if (!fields.CURRENT_YEAR) fields.CURRENT_YEAR = now.getFullYear().toString();

      const html = applyMergeFields(template.content, fields);
      const usedFields = extractUsedFields(template.content);
      return { html, usedFields, resolvedFields: fields };
    }),

  // ── Template Versions ─────────────────────────────────────────

  listVersions: publicProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.templateVersion.findMany({
        where: { templateId: input.templateId },
        orderBy: { versionNumber: "desc" },
        take: 50,
      });
    }),

  getVersion: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.templateVersion.findUniqueOrThrow({ where: { id: input.id } });
    }),

  saveVersion: publicProcedure
    .input(z.object({ templateId: z.string(), changeNote: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.documentTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
      const lastVersion = await ctx.db.templateVersion.findFirst({
        where: { templateId: input.templateId },
        orderBy: { versionNumber: "desc" },
      });
      return ctx.db.templateVersion.create({
        data: {
          templateId: input.templateId,
          versionNumber: (lastVersion?.versionNumber || 0) + 1,
          content: template.content,
          variables: template.variables,
          changeNote: input.changeNote,
        },
      });
    }),

  restoreVersion: publicProcedure
    .input(z.object({ templateId: z.string(), versionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.db.templateVersion.findUniqueOrThrow({ where: { id: input.versionId } });
      await ctx.db.documentTemplate.update({
        where: { id: input.templateId },
        data: { content: version.content, variables: version.variables },
      });
      // Save a new version recording the restore
      const lastVersion = await ctx.db.templateVersion.findFirst({
        where: { templateId: input.templateId },
        orderBy: { versionNumber: "desc" },
      });
      return ctx.db.templateVersion.create({
        data: {
          templateId: input.templateId,
          versionNumber: (lastVersion?.versionNumber || 0) + 1,
          content: version.content,
          variables: version.variables,
          changeNote: `Restored from version ${version.versionNumber}`,
        },
      });
    }),
});
