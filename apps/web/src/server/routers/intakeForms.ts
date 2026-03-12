import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { IntakeLeadStatus, MatterStatus } from "@prisma/client";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const fieldInput = z.object({
  id: z.string().optional(),
  label: z.string().min(1),
  fieldType: z.enum([
    "TEXT",
    "TEXTAREA",
    "EMAIL",
    "PHONE",
    "SELECT",
    "MULTISELECT",
    "CHECKBOX",
    "DATE",
    "FILE",
  ]),
  isRequired: z.boolean().default(false),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  options: z.string().optional(),
  sortOrder: z.number().default(0),
  clientFieldMap: z.string().nullable().optional(),
});

export const intakeFormsRouter = router({
  // ========== Admin Procedures ==========

  listTemplates: publicProcedure.query(async ({ ctx }) => {
    const templates = await ctx.db.intakeFormTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { submissions: true },
        },
      },
    });
    return templates;
  }),

  getTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.intakeFormTemplate.findUnique({
        where: { id: input.id },
        include: {
          fields: { orderBy: { sortOrder: "asc" } },
          _count: { select: { submissions: true } },
        },
      });
      if (!template) throw new Error("Template not found");
      return template;
    }),

  createTemplate: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        slug: z.string().optional(),
        practiceArea: z.string().optional(),
        headerText: z.string().optional(),
        confirmationMsg: z.string().optional(),
        autoCreateClient: z.boolean().default(true),
        autoCreateMatter: z.boolean().default(false),
        notifyEmail: z.string().optional(),
        fields: z.array(fieldInput),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let slug = input.slug || slugify(input.name);

      // Deduplicate slug
      const existing = await ctx.db.intakeFormTemplate.findUnique({
        where: { slug },
      });
      if (existing) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }

      const template = await ctx.db.intakeFormTemplate.create({
        data: {
          name: input.name,
          description: input.description,
          slug,
          practiceArea: input.practiceArea,
          headerText: input.headerText,
          confirmationMsg:
            input.confirmationMsg ||
            "Thank you for your submission. We will be in touch shortly.",
          autoCreateClient: input.autoCreateClient,
          autoCreateMatter: input.autoCreateMatter,
          notifyEmail: input.notifyEmail,
          fields: {
            create: input.fields.map((f, i) => ({
              label: f.label,
              fieldType: f.fieldType,
              isRequired: f.isRequired,
              placeholder: f.placeholder,
              helpText: f.helpText,
              options: f.options,
              sortOrder: f.sortOrder ?? i,
              clientFieldMap: f.clientFieldMap,
            })),
          },
        },
        include: { fields: true },
      });

      return template;
    }),

  updateTemplate: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        slug: z.string().optional(),
        practiceArea: z.string().optional(),
        isPublic: z.boolean().optional(),
        isActive: z.boolean().optional(),
        headerText: z.string().optional(),
        confirmationMsg: z.string().optional(),
        autoCreateClient: z.boolean().optional(),
        autoCreateMatter: z.boolean().optional(),
        notifyEmail: z.string().optional(),
        fields: z.array(fieldInput).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, fields, ...data } = input;

      // Update template
      const template = await ctx.db.intakeFormTemplate.update({
        where: { id },
        data,
      });

      // Replace fields if provided
      if (fields) {
        await ctx.db.intakeFormField.deleteMany({
          where: { templateId: id },
        });
        await ctx.db.intakeFormField.createMany({
          data: fields.map((f, i) => ({
            templateId: id,
            label: f.label,
            fieldType: f.fieldType,
            isRequired: f.isRequired,
            placeholder: f.placeholder,
            helpText: f.helpText,
            options: f.options,
            sortOrder: f.sortOrder ?? i,
            clientFieldMap: f.clientFieldMap,
          })),
        });
      }

      return ctx.db.intakeFormTemplate.findUnique({
        where: { id },
        include: { fields: { orderBy: { sortOrder: "asc" } } },
      });
    }),

  deleteTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.intakeFormTemplate.update({
        where: { id: input.id },
        data: { isActive: false },
      });
    }),

  listSubmissions: publicProcedure
    .input(
      z.object({
        templateId: z.string().optional(),
        status: z.nativeEnum(IntakeLeadStatus).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.templateId) where.templateId = input.templateId;
      if (input.status) where.status = input.status;
      if (input.startDate || input.endDate) {
        where.createdAt = {};
        if (input.startDate) where.createdAt.gte = new Date(input.startDate);
        if (input.endDate) where.createdAt.lte = new Date(input.endDate);
      }

      const [submissions, total] = await Promise.all([
        ctx.db.intakeFormSubmission.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: input.limit,
          skip: input.offset,
          include: {
            template: { select: { name: true, practiceArea: true } },
          },
        }),
        ctx.db.intakeFormSubmission.count({ where }),
      ]);

      return { submissions, total };
    }),

  getSubmission: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const submission = await ctx.db.intakeFormSubmission.findUnique({
        where: { id: input.id },
        include: {
          template: {
            include: { fields: { orderBy: { sortOrder: "asc" } } },
          },
        },
      });
      if (!submission) throw new Error("Submission not found");

      const parsedData = JSON.parse(submission.data);
      const answers = submission.template.fields.map((field) => ({
        label: field.label,
        fieldType: field.fieldType,
        value: parsedData[field.id] ?? null,
      }));

      return { ...submission, answers };
    }),

  updateSubmissionStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(IntakeLeadStatus),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.intakeFormSubmission.update({
        where: { id: input.id },
        data: { status: input.status },
      });
    }),

  addSubmissionNote: publicProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.intakeFormSubmission.update({
        where: { id: input.id },
        data: { notes: input.notes },
      });
    }),

  convertToClient: publicProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.intakeFormSubmission.findUnique({
        where: { id: input.submissionId },
        include: {
          template: {
            include: { fields: true },
          },
        },
      });
      if (!submission) throw new Error("Submission not found");

      const data = JSON.parse(submission.data);
      const clientData: Record<string, string> = {};

      for (const field of submission.template.fields) {
        if (field.clientFieldMap && data[field.id]) {
          clientData[field.clientFieldMap] = data[field.id];
        }
      }

      const client = await ctx.db.client.create({
        data: {
          name: clientData.name || submission.submitterName || "Unknown",
          email: clientData.email || submission.submitterEmail || null,
          phone: clientData.phone || submission.submitterPhone || null,
          address: clientData.address || null,
          notes: clientData.notes || null,
        },
      });

      const updateData: any = {
        clientId: client.id,
        status: "CONVERTED" as const,
      };

      // Auto-create matter if enabled
      if (submission.template.autoCreateMatter) {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000)
          .toString()
          .padStart(4, "0");

        const matter = await ctx.db.matter.create({
          data: {
            clientId: client.id,
            name: `${submission.template.name} - ${client.name}`,
            matterNumber: `${year}-${random}`,
            practiceArea: submission.template.practiceArea,
            status: submission.template.defaultMatterStatus,
          },
        });
        updateData.matterId = matter.id;
      }

      await ctx.db.intakeFormSubmission.update({
        where: { id: input.submissionId },
        data: updateData,
      });

      return client;
    }),

  // ========== Public Procedures ==========

  getPublicForm: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.intakeFormTemplate.findUnique({
        where: { slug: input.slug },
        include: {
          fields: { orderBy: { sortOrder: "asc" } },
        },
      });

      if (!template || !template.isPublic || !template.isActive) {
        return null;
      }

      // Get firm name
      const settings = await ctx.db.settings.findUnique({
        where: { id: "default" },
      });

      return {
        name: template.name,
        headerText: template.headerText,
        confirmationMsg: template.confirmationMsg,
        practiceArea: template.practiceArea,
        firmName: settings?.firmName || "Our Firm",
        fields: template.fields.map((f) => ({
          id: f.id,
          label: f.label,
          fieldType: f.fieldType,
          isRequired: f.isRequired,
          placeholder: f.placeholder,
          helpText: f.helpText,
          options: f.options,
          sortOrder: f.sortOrder,
        })),
      };
    }),

  submitForm: publicProcedure
    .input(
      z.object({
        slug: z.string(),
        data: z.record(z.string(), z.any()),
        referrer: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.intakeFormTemplate.findUnique({
        where: { slug: input.slug },
        include: { fields: true },
      });

      if (!template || !template.isPublic || !template.isActive) {
        throw new Error("Form is not available");
      }

      // Validate required fields
      for (const field of template.fields) {
        if (field.isRequired) {
          const value = input.data[field.id];
          if (value === undefined || value === null || value === "") {
            throw new Error(`${field.label} is required`);
          }
        }
      }

      // Extract contact info from mapped fields
      let submitterName: string | null = null;
      let submitterEmail: string | null = null;
      let submitterPhone: string | null = null;

      for (const field of template.fields) {
        const value = input.data[field.id];
        if (!value) continue;
        if (field.clientFieldMap === "name") submitterName = value;
        if (field.clientFieldMap === "email") submitterEmail = value;
        if (field.clientFieldMap === "phone") submitterPhone = value;
      }

      const submission = await ctx.db.intakeFormSubmission.create({
        data: {
          templateId: template.id,
          data: JSON.stringify(input.data),
          submitterName,
          submitterEmail,
          submitterPhone,
          referrer: input.referrer,
        },
      });

      // Auto-create client if enabled
      if (template.autoCreateClient && submitterName) {
        const clientData: Record<string, string | null> = {
          name: submitterName,
          email: null,
          phone: null,
          address: null,
          notes: null,
        };

        for (const field of template.fields) {
          if (field.clientFieldMap && input.data[field.id]) {
            clientData[field.clientFieldMap] = input.data[field.id];
          }
        }

        const client = await ctx.db.client.create({
          data: {
            name: clientData.name!,
            email: clientData.email,
            phone: clientData.phone,
            address: clientData.address,
            notes: clientData.notes,
          },
        });

        const updatePayload: any = { clientId: client.id };

        if (template.autoCreateMatter) {
          const year = new Date().getFullYear();
          const random = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, "0");

          const matter = await ctx.db.matter.create({
            data: {
              clientId: client.id,
              name: `${template.name} - ${client.name}`,
              matterNumber: `${year}-${random}`,
              practiceArea: template.practiceArea,
              status: template.defaultMatterStatus,
            },
          });
          updatePayload.matterId = matter.id;
        }

        await ctx.db.intakeFormSubmission.update({
          where: { id: submission.id },
          data: updatePayload,
        });
      }

      // TODO: Send email notification
      if (template.notifyEmail) {
        console.log("[IntakeForms] Notification would be sent to:", template.notifyEmail, {
          templateName: template.name,
          submitterName,
          submitterEmail,
          submitterPhone,
          submissionId: submission.id,
        });
      }

      return {
        success: true,
        confirmationMsg:
          template.confirmationMsg ||
          "Thank you for your submission. We will be in touch shortly.",
      };
    }),
});
