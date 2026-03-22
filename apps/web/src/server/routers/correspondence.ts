import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as corrEngine from "@/lib/correspondence-engine";

export const correspondenceRouter = router({
  // ─── Draft Generation ───────────────────────────────────────────────

  generateDraft: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        correspondenceType: z.string(),
        recipientType: z.string(),
        tone: z.string().optional(),
        format: z.string().optional(),
        additionalInstructions: z.string().optional(),
        recipientName: z.string().optional(),
        recipientFirm: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const draft = await corrEngine.generateDraft({
        ...input,
        userId: "default",
        firmId: "default",
      });
      return draft;
    }),

  generateVariants: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        correspondenceType: z.string(),
        recipientType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const drafts = await corrEngine.generateVariants({
        ...input,
        userId: "default",
        firmId: "default",
      });
      return drafts;
    }),

  regenerate: publicProcedure
    .input(
      z.object({
        draftId: z.string(),
        feedback: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const draft = await corrEngine.regenerateDraft(
        input.draftId,
        input.feedback
      );
      return draft;
    }),

  quickDraft: publicProcedure
    .input(
      z.object({
        freeformInstruction: z.string(),
        matterId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const draft = await corrEngine.quickDraft({
        ...input,
        userId: "default",
        firmId: "default",
      });
      return draft;
    }),

  // ─── Draft Management ──────────────────────────────────────────────

  getDraft: publicProcedure
    .input(z.object({ draftId: z.string() }))
    .query(async ({ input }) => {
      try {
        const draft = await (db as any).correspondenceDraft.findUnique({
          where: { id: input.draftId },
        });
        return draft;
      } catch (error) {
        throw new Error("Failed to fetch draft");
      }
    }),

  getDraftsForMatter: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const drafts = await (db as any).correspondenceDraft.findMany({
          where: {
            matterId: input.matterId,
            ...(input.status && { status: input.status }),
          },
          orderBy: { createdAt: "desc" },
        });
        return drafts;
      } catch (error) {
        throw new Error("Failed to fetch drafts for matter");
      }
    }),

  getRecentDrafts: publicProcedure
    .input(
      z.object({
        limit: z.number().default(20),
        status: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const drafts = await (db as any).correspondenceDraft.findMany({
          where: {
            ...(input.status && { status: input.status }),
          },
          orderBy: { createdAt: "desc" },
          take: input.limit,
        });
        return drafts;
      } catch (error) {
        throw new Error("Failed to fetch recent drafts");
      }
    }),

  updateDraft: publicProcedure
    .input(
      z.object({
        draftId: z.string(),
        editedBody: z.string().optional(),
        subject: z.string().optional(),
        status: z.string().optional(),
        editNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { draftId, ...data } = input;
        const draft = await (db as any).correspondenceDraft.update({
          where: { id: draftId },
          data: data as any,
        });
        return draft;
      } catch (error) {
        throw new Error("Failed to update draft");
      }
    }),

  approveDraft: publicProcedure
    .input(z.object({ draftId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const draft = await (db as any).correspondenceDraft.update({
          where: { id: input.draftId },
          data: { status: "approved" } as any,
        });
        return draft;
      } catch (error) {
        throw new Error("Failed to approve draft");
      }
    }),

  deleteDraft: publicProcedure
    .input(z.object({ draftId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const draft = await (db as any).correspondenceDraft.update({
          where: { id: input.draftId },
          data: { status: "archived" } as any,
        });
        return draft;
      } catch (error) {
        throw new Error("Failed to archive draft");
      }
    }),

  getDraftVersionHistory: publicProcedure
    .input(z.object({ draftId: z.string() }))
    .query(async ({ input }) => {
      try {
        const draft = await (db as any).correspondenceDraft.findUnique({
          where: { id: input.draftId },
        });
        if (!draft) {
          throw new Error("Draft not found");
        }
        const versions = await (db as any).correspondenceDraft.findMany({
          where: {
            matterId: draft.matterId,
            correspondenceType: draft.correspondenceType,
          },
          orderBy: { version: "desc" },
        });
        return versions;
      } catch (error) {
        throw new Error("Failed to fetch draft version history");
      }
    }),

  // ─── Sending ───────────────────────────────────────────────────────

  sendViaEmail: publicProcedure
    .input(z.object({ draftId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        const draft = await (db as any).correspondenceDraft.update({
          where: { id: input.draftId },
          data: {
            sentAt: new Date(),
            sentVia: "email",
            status: "sent",
          } as any,
        });
        return draft;
      } catch (error) {
        throw new Error("Failed to send draft via email");
      }
    }),

  markAsSent: publicProcedure
    .input(
      z.object({
        draftId: z.string(),
        sentVia: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const draft = await (db as any).correspondenceDraft.update({
          where: { id: input.draftId },
          data: {
            sentAt: new Date(),
            sentVia: input.sentVia,
            status: "sent",
          } as any,
        });
        return draft;
      } catch (error) {
        throw new Error("Failed to mark draft as sent");
      }
    }),

  getMailtoLink: publicProcedure
    .input(z.object({ draftId: z.string() }))
    .query(async ({ input }) => {
      try {
        const draft = await (db as any).correspondenceDraft.findUnique({
          where: { id: input.draftId },
        });
        if (!draft) {
          throw new Error("Draft not found");
        }
        const mailto = `mailto:${encodeURIComponent(draft.recipientEmail || "")}?subject=${encodeURIComponent(draft.subject || "")}&body=${encodeURIComponent(draft.body || draft.editedBody || "")}`;
        return { mailto };
      } catch (error) {
        throw new Error("Failed to generate mailto link");
      }
    }),

  // ─── Contacts ──────────────────────────────────────────────────────

  getContactsForMatter: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        contactType: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const contacts = await (db as any).correspondenceContact.findMany({
          where: {
            matterId: input.matterId,
            ...(input.contactType && { contactType: input.contactType }),
          },
        });
        return contacts;
      } catch (error) {
        throw new Error("Failed to fetch contacts for matter");
      }
    }),

  addContact: publicProcedure
    .input(
      z.object({
        matterId: z.string().optional(),
        contactType: z.string(),
        name: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
        firm: z.string().optional(),
        address: z.string().optional(),
        barNumber: z.string().optional(),
        courtName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const contact = await (db as any).correspondenceContact.create({
          data: {
            ...input,
            userId: "default",
            firmId: "default",
          } as any,
        });
        return contact;
      } catch (error) {
        throw new Error("Failed to add contact");
      }
    }),

  updateContact: publicProcedure
    .input(
      z.object({
        contactId: z.string(),
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        firm: z.string().optional(),
        address: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const { contactId, ...data } = input;
        const contact = await (db as any).correspondenceContact.update({
          where: { id: contactId },
          data: data as any,
        });
        return contact;
      } catch (error) {
        throw new Error("Failed to update contact");
      }
    }),

  searchContacts: publicProcedure
    .input(z.object({ query: z.string() }))
    .query(async ({ input }) => {
      try {
        const contacts = await (db as any).correspondenceContact.findMany({
          where: {
            OR: [
              { name: { contains: input.query, mode: "insensitive" } },
              { email: { contains: input.query, mode: "insensitive" } },
              { firm: { contains: input.query, mode: "insensitive" } },
            ],
          },
        });
        return contacts;
      } catch (error) {
        throw new Error("Failed to search contacts");
      }
    }),

  // ─── Templates ─────────────────────────────────────────────────────

  getTemplates: publicProcedure
    .input(
      z.object({
        correspondenceType: z.string().optional(),
        practiceArea: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const defaults = await corrEngine.getDefaultTemplates();

        if (!input.correspondenceType && !input.practiceArea) {
          return defaults;
        }

        const customTemplates = await (
          db as any
        ).correspondenceTemplate.findMany({
          where: {
            ...(input.correspondenceType && {
              correspondenceType: input.correspondenceType,
            }),
            ...(input.practiceArea && { practiceArea: input.practiceArea }),
          },
        });

        return [...defaults, ...customTemplates];
      } catch (error) {
        throw new Error("Failed to fetch templates");
      }
    }),

  saveAsTemplate: publicProcedure
    .input(
      z.object({
        draftId: z.string(),
        name: z.string(),
        practiceArea: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const template = await corrEngine.saveAsTemplate(input.draftId, input.name, input.practiceArea);
        return template;
      } catch (error) {
        throw new Error("Failed to save as template");
      }
    }),

  deleteTemplate: publicProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ input }) => {
      try {
        await (db as any).correspondenceTemplate.delete({
          where: { id: input.templateId },
        });
        return { success: true };
      } catch (error) {
        throw new Error("Failed to delete template");
      }
    }),

  // ─── Letterhead ────────────────────────────────────────────────────

  getLetterhead: publicProcedure.query(async () => {
    try {
      const letterhead = await corrEngine.getLetterhead("default", "default");
      return letterhead;
    } catch (error) {
      throw new Error("Failed to fetch letterhead");
    }
  }),

  updateLetterhead: publicProcedure
    .input(
      z.object({
        firmName: z.string().optional(),
        attorneyName: z.string().optional(),
        barNumber: z.string().optional(),
        address: z.string().optional(),
        phone: z.string().optional(),
        fax: z.string().optional(),
        email: z.string().optional(),
        website: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        const letterhead = await (db as any).firmLetterhead.upsert({
          where: { id: "default" },
          update: input as any,
          create: {
            ...input,
            userId: "default",
            firmId: "default",
          } as any,
        });
        return letterhead;
      } catch (error) {
        throw new Error("Failed to update letterhead");
      }
    }),
});
