import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { randomUUID } from "crypto";
import {
  sendSignatureRequest,
  sendSignatureCompleteNotification,
  sendSignatureFullyComplete,
} from "@/lib/email";

export const signaturesRouter = router({
  list: publicProcedure
    .input(
      z.object({
        status: z
          .enum([
            "DRAFT",
            "PENDING_CLIENT",
            "CLIENT_SIGNED",
            "PENDING_ATTORNEY",
            "COMPLETED",
            "CANCELLED",
            "EXPIRED",
          ])
          .optional(),
        matterId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.status) where.status = input.status;
      if (input.matterId) where.matterId = input.matterId;

      const [requests, total] = await Promise.all([
        ctx.db.signatureRequest.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: input.limit,
          skip: input.offset,
          include: {
            matter: {
              select: { id: true, name: true, matterNumber: true },
            },
            document: {
              select: { id: true, name: true },
            },
          },
        }),
        ctx.db.signatureRequest.count({ where }),
      ]);

      return { requests, total };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUnique({
        where: { id: input.id },
        include: {
          matter: {
            select: {
              id: true,
              name: true,
              matterNumber: true,
              client: { select: { id: true, name: true, email: true } },
            },
          },
          document: { select: { id: true, name: true } },
        },
      });

      if (!request) throw new Error("Signature request not found");
      return request;
    }),

  create: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        documentId: z.string().optional(),
        title: z.string().min(1),
        description: z.string().optional(),
        clientName: z.string().min(1),
        clientEmail: z.string().email(),
        documentContent: z.string().min(1),
        expiresAt: z.string().optional(),
        attorneyName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.create({
        data: {
          matterId: input.matterId,
          documentId: input.documentId || null,
          title: input.title,
          description: input.description || null,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          documentContent: input.documentContent,
          attorneyName: input.attorneyName || null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          signingToken: randomUUID(),
          status: "DRAFT",
        },
      });
      return request;
    }),

  send: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUnique({
        where: { id: input.id },
      });
      if (!request) throw new Error("Signature request not found");
      if (request.status !== "DRAFT" && request.status !== "PENDING_CLIENT") {
        throw new Error("Can only send draft or pending requests");
      }

      const updated = await ctx.db.signatureRequest.update({
        where: { id: input.id },
        data: { status: "PENDING_CLIENT", sentAt: new Date() },
      });

      // Send email
      const firmSettings = await ctx.db.settings.findUnique({
        where: { id: "default" },
      });
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "";
      const signingUrl = `${baseUrl}/sign/${request.signingToken}`;
      const fromEmail = `noreply@${process.env.RESEND_DOMAIN || "example.com"}`;

      await sendSignatureRequest({
        to: request.clientEmail,
        clientName: request.clientName,
        signingUrl,
        title: request.title,
        firmName: firmSettings?.firmName || "Our Law Firm",
        fromEmail,
      });

      return updated;
    }),

  resend: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUnique({
        where: { id: input.id },
      });
      if (!request) throw new Error("Signature request not found");
      if (request.status !== "PENDING_CLIENT") {
        throw new Error("Can only resend pending requests");
      }

      const firmSettings = await ctx.db.settings.findUnique({
        where: { id: "default" },
      });
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "";
      const signingUrl = `${baseUrl}/sign/${request.signingToken}`;
      const fromEmail = `noreply@${process.env.RESEND_DOMAIN || "example.com"}`;

      await sendSignatureRequest({
        to: request.clientEmail,
        clientName: request.clientName,
        signingUrl,
        title: request.title,
        firmName: firmSettings?.firmName || "Our Law Firm",
        fromEmail,
      });

      await ctx.db.signatureRequest.update({
        where: { id: input.id },
        data: { sentAt: new Date() },
      });

      return { success: true };
    }),

  getByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUnique({
        where: { signingToken: input.token },
        include: {
          matter: {
            select: { id: true, name: true },
          },
        },
      });

      if (!request) throw new Error("Signature request not found");
      if (request.status === "CANCELLED") throw new Error("This signing request has been cancelled");
      if (request.expiresAt && request.expiresAt < new Date()) {
        throw new Error("This signing request has expired");
      }

      // Get firm name for display
      const firmSettings = await ctx.db.settings.findUnique({
        where: { id: "default" },
      });

      return {
        id: request.id,
        title: request.title,
        description: request.description,
        documentContent: request.documentContent,
        clientName: request.clientName,
        status: request.status,
        clientSignature: request.clientSignature,
        clientSignedAt: request.clientSignedAt,
        attorneySignature: request.attorneySignature,
        attorneySignedAt: request.attorneySignedAt,
        firmName: firmSettings?.firmName || null,
      };
    }),

  clientSign: publicProcedure
    .input(
      z.object({
        token: z.string(),
        signature: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUnique({
        where: { signingToken: input.token },
      });

      if (!request) throw new Error("Signature request not found");
      if (request.status !== "PENDING_CLIENT") {
        throw new Error("This document is not awaiting your signature");
      }
      if (request.expiresAt && request.expiresAt < new Date()) {
        throw new Error("This signing request has expired");
      }

      const updated = await ctx.db.signatureRequest.update({
        where: { id: request.id },
        data: {
          clientSignature: input.signature,
          clientSignedAt: new Date(),
          status: request.attorneyName ? "PENDING_ATTORNEY" : "COMPLETED",
          completedAt: request.attorneyName ? undefined : new Date(),
        },
      });

      // Notify attorney
      const firmSettings = await ctx.db.settings.findUnique({
        where: { id: "default" },
      });
      const fromEmail = `noreply@${process.env.RESEND_DOMAIN || "example.com"}`;

      if (firmSettings?.email) {
        await sendSignatureCompleteNotification({
          to: firmSettings.email,
          clientName: request.clientName,
          title: request.title,
          firmName: firmSettings.firmName || "Our Law Firm",
          fromEmail,
        });
      }

      return updated;
    }),

  attorneySign: publicProcedure
    .input(
      z.object({
        id: z.string(),
        signature: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUnique({
        where: { id: input.id },
      });

      if (!request) throw new Error("Signature request not found");
      if (request.status !== "PENDING_ATTORNEY" && request.status !== "CLIENT_SIGNED") {
        throw new Error("This document is not awaiting attorney signature");
      }

      const updated = await ctx.db.signatureRequest.update({
        where: { id: input.id },
        data: {
          attorneySignature: input.signature,
          attorneySignedAt: new Date(),
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });

      // Notify client
      const firmSettings = await ctx.db.settings.findUnique({
        where: { id: "default" },
      });
      const fromEmail = `noreply@${process.env.RESEND_DOMAIN || "example.com"}`;

      await sendSignatureFullyComplete({
        to: request.clientEmail,
        clientName: request.clientName,
        title: request.title,
        firmName: firmSettings?.firmName || "Our Law Firm",
        fromEmail,
      });

      return updated;
    }),

  cancel: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.signatureRequest.update({
        where: { id: input.id },
        data: { status: "CANCELLED" },
      });
      return updated;
    }),
});
