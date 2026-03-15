import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { renderInvoiceHtml, getSampleInvoice } from "@/lib/invoice-renderer";

const STARTER_TEMPLATES = [
  {
    name: "Standard Summary",
    description: "Clean, minimal invoice with line item summary",
    format: "SUMMARY",
    isDefault: true,
    branding: JSON.stringify({ firmName: "Your Law Firm", primaryColor: "#1E40AF", accentColor: "#3B82F6", fontFamily: "Inter", showLogo: true }),
    layout: JSON.stringify({ headerStyle: "centered", showMatterDetails: true, showTimeEntryDetails: false, showExpenseDetails: true, showPaymentHistory: true, showTrustBalance: true, showRemittanceSlip: false, groupTimeBy: "none", showHourlyBreakdown: false, showTotalHours: false, termsAndConditions: "Payment is due within 30 days of invoice date.", paymentInstructions: "Please include invoice number with your payment." }),
  },
  {
    name: "Detailed Hourly",
    description: "Full time entry breakdown grouped by date",
    format: "DETAILED",
    branding: JSON.stringify({ firmName: "Your Law Firm", primaryColor: "#7C3AED", accentColor: "#8B5CF6", fontFamily: "Inter", showLogo: true }),
    layout: JSON.stringify({ headerStyle: "left", showMatterDetails: true, showTimeEntryDetails: true, showExpenseDetails: true, showPaymentHistory: true, showTrustBalance: true, showRemittanceSlip: false, groupTimeBy: "date", showHourlyBreakdown: true, showTotalHours: true, termsAndConditions: "Payment is due within 30 days of invoice date." }),
  },
  {
    name: "Timekeeper Report",
    description: "Entries grouped by attorney for multi-attorney matters",
    format: "TIMEKEEPER",
    branding: JSON.stringify({ firmName: "Your Law Firm", primaryColor: "#B45309", accentColor: "#D97706", fontFamily: "Merriweather", showLogo: true }),
    layout: JSON.stringify({ headerStyle: "split", showMatterDetails: true, showTimeEntryDetails: true, showExpenseDetails: true, showPaymentHistory: true, showTrustBalance: false, showRemittanceSlip: false, groupTimeBy: "timekeeper", showHourlyBreakdown: true, showTotalHours: true }),
  },
  {
    name: "Flat Fee Simple",
    description: "Simple service and fee layout without hourly detail",
    format: "FLAT_FEE",
    branding: JSON.stringify({ firmName: "Your Law Firm", primaryColor: "#047857", accentColor: "#10B981", fontFamily: "Inter", showLogo: true }),
    layout: JSON.stringify({ headerStyle: "centered", showMatterDetails: true, showTimeEntryDetails: false, showExpenseDetails: false, showPaymentHistory: true, showTrustBalance: false, showRemittanceSlip: false, groupTimeBy: "none", showHourlyBreakdown: false, showTotalHours: false, paymentInstructions: "Payment is due upon receipt. Please include invoice number with your payment." }),
  },
];

async function ensureStarterTemplates(db: any) {
  const count = await db.invoiceTemplate.count();
  if (count === 0) {
    for (const tmpl of STARTER_TEMPLATES) {
      await db.invoiceTemplate.create({ data: tmpl });
    }
  }
}

export const invoiceTemplatesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    await ensureStarterTemplates(ctx.db);
    return ctx.db.invoiceTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.invoiceTemplate.findUniqueOrThrow({ where: { id: input.id } });
    }),

  create: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      format: z.string().default("SUMMARY"),
      isDefault: z.boolean().optional(),
      branding: z.string(),
      layout: z.string(),
      headerHtml: z.string().optional(),
      footerHtml: z.string().optional(),
      cssOverrides: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.isDefault) {
        await ctx.db.invoiceTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return ctx.db.invoiceTemplate.create({
        data: {
          ...input,
          format: input.format as any,
        },
      });
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      format: z.string().optional(),
      isDefault: z.boolean().optional(),
      branding: z.string().optional(),
      layout: z.string().optional(),
      headerHtml: z.string().optional(),
      footerHtml: z.string().optional(),
      cssOverrides: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      if (data.isDefault) {
        await ctx.db.invoiceTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return ctx.db.invoiceTemplate.update({ where: { id }, data: { ...data, format: data.format as any } });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tmpl = await ctx.db.invoiceTemplate.findUniqueOrThrow({ where: { id: input.id } });
      if (tmpl.isDefault) throw new Error("Cannot delete the default template");
      return ctx.db.invoiceTemplate.update({ where: { id: input.id }, data: { isActive: false } });
    }),

  duplicate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tmpl = await ctx.db.invoiceTemplate.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.invoiceTemplate.create({
        data: {
          name: `Copy of ${tmpl.name}`,
          description: tmpl.description,
          format: tmpl.format,
          branding: tmpl.branding,
          layout: tmpl.layout,
          headerHtml: tmpl.headerHtml,
          footerHtml: tmpl.footerHtml,
          cssOverrides: tmpl.cssOverrides,
        },
      });
    }),

  setDefault: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.invoiceTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      return ctx.db.invoiceTemplate.update({ where: { id: input.id }, data: { isDefault: true } });
    }),

  getDefault: publicProcedure.query(async ({ ctx }) => {
    await ensureStarterTemplates(ctx.db);
    const tmpl = await ctx.db.invoiceTemplate.findFirst({ where: { isDefault: true, isActive: true } });
    return tmpl || ctx.db.invoiceTemplate.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
  }),

  renderInvoice: publicProcedure
    .input(z.object({ invoiceId: z.string(), templateId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
        include: {
          matter: { include: { client: true } },
          lineItems: { orderBy: { date: { sort: "asc", nulls: "last" } } },
          payments: { orderBy: { paymentDate: "asc" } },
        },
      });

      let template = null;
      if (input.templateId) {
        template = await ctx.db.invoiceTemplate.findUnique({ where: { id: input.templateId } });
      } else if (invoice.templateId) {
        template = await ctx.db.invoiceTemplate.findUnique({ where: { id: invoice.templateId } });
      }
      if (!template) {
        template = await ctx.db.invoiceTemplate.findFirst({ where: { isDefault: true, isActive: true } });
      }

      const firmSettings = await ctx.db.settings.findUnique({ where: { id: "default" } }).catch(() => null);
      const html = renderInvoiceHtml(invoice, template, firmSettings);
      return { html };
    }),

  renderPreview: publicProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ ctx, input }) => {
      const template = await ctx.db.invoiceTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
      const firmSettings = await ctx.db.settings.findUnique({ where: { id: "default" } }).catch(() => null);
      const html = renderInvoiceHtml(getSampleInvoice(), template, firmSettings);
      return { html };
    }),

  renderPreviewFromData: publicProcedure
    .input(z.object({
      branding: z.string(),
      layout: z.string(),
      format: z.string().default("SUMMARY"),
      headerHtml: z.string().optional(),
      footerHtml: z.string().optional(),
      cssOverrides: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const firmSettings = await ctx.db.settings.findUnique({ where: { id: "default" } }).catch(() => null);
      const template = { ...input, format: input.format };
      const html = renderInvoiceHtml(getSampleInvoice(), template, firmSettings);
      return { html };
    }),
});
