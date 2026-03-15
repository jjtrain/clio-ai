import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { randomUUID } from "crypto";
import {
  sendSignatureRequest,
  sendSignatureCompleteNotification,
  sendSignatureFullyComplete,
} from "@/lib/email";
import {
  createSignatureRequest as hsCreateRequest,
  getSignatureRequest as hsGetRequest,
  cancelSignatureRequest as hsCancelRequest,
  sendReminder as hsSendReminder,
  getFileUrl as hsGetFileUrl,
  getEmbeddedSignUrl as hsGetEmbeddedSignUrl,
  testConnection as hsTestConnection,
} from "@/lib/hellosign";

async function getHelloSignConfig(db: any) {
  const settings = await db.helloSignSettings.findUnique({ where: { id: "default" } });
  if (!settings?.isEnabled || !settings?.apiKey) return null;
  return {
    apiKey: settings.apiKey,
    clientId: settings.clientId || undefined,
    testMode: settings.testMode ?? true,
    callbackUrl: settings.callbackUrl || undefined,
  };
}

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
        attorneyEmail: z.string().email().optional(),
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
          attorneyEmail: input.attorneyEmail || null,
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
      const request = await ctx.db.signatureRequest.findUniqueOrThrow({ where: { id: input.id } });

      // If HelloSign request, cancel it there too
      if (request.helloSignRequestId) {
        const hsConfig = await getHelloSignConfig(ctx.db);
        if (hsConfig) {
          try {
            await hsCancelRequest(hsConfig, request.helloSignRequestId);
          } catch (e) {
            console.error("[HelloSign] Cancel error:", e);
          }
        }
      }

      const updated = await ctx.db.signatureRequest.update({
        where: { id: input.id },
        data: { status: "CANCELLED" },
      });
      return updated;
    }),

  // ==================== HELLOSIGN INTEGRATION ====================

  getHelloSignSettings: publicProcedure.query(async ({ ctx }) => {
    let settings = await ctx.db.helloSignSettings.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await ctx.db.helloSignSettings.create({
        data: { id: "default" },
      });
    }
    return {
      ...settings,
      apiKey: settings.apiKey ? "••••••••" + settings.apiKey.slice(-4) : null,
      webhookSecret: settings.webhookSecret ? "••••••••" : null,
    };
  }),

  updateHelloSignSettings: publicProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      apiKey: z.string().optional(),
      clientId: z.string().optional(),
      testMode: z.boolean().optional(),
      callbackUrl: z.string().optional(),
      brandId: z.string().optional(),
      webhookSecret: z.string().optional(),
      defaultFromName: z.string().optional(),
      defaultFromEmail: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: any = {};
      if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;
      if (input.apiKey && !input.apiKey.startsWith("••")) data.apiKey = input.apiKey;
      if (input.clientId !== undefined) data.clientId = input.clientId;
      if (input.testMode !== undefined) data.testMode = input.testMode;
      if (input.callbackUrl !== undefined) data.callbackUrl = input.callbackUrl;
      if (input.brandId !== undefined) data.brandId = input.brandId;
      if (input.webhookSecret !== undefined) data.webhookSecret = input.webhookSecret;
      if (input.defaultFromName !== undefined) data.defaultFromName = input.defaultFromName;
      if (input.defaultFromEmail !== undefined) data.defaultFromEmail = input.defaultFromEmail;

      return ctx.db.helloSignSettings.upsert({
        where: { id: "default" },
        update: data,
        create: { id: "default", ...data },
      });
    }),

  sendViaHelloSign: publicProcedure
    .input(z.object({
      matterId: z.string(),
      documentId: z.string().optional(),
      title: z.string(),
      description: z.string().optional(),
      clientName: z.string(),
      clientEmail: z.string().email(),
      documentContent: z.string(),
      attorneyName: z.string().optional(),
      attorneyEmail: z.string().email().optional(),
      expiresAt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const hsConfig = await getHelloSignConfig(ctx.db);
      if (!hsConfig) throw new Error("HelloSign is not configured. Please add your API key in Settings.");

      // Build signers list
      const signers: Array<{ name: string; emailAddress: string; order?: number }> = [
        { name: input.clientName, emailAddress: input.clientEmail, order: 0 },
      ];
      if (input.attorneyName && input.attorneyEmail) {
        signers.push({ name: input.attorneyName, emailAddress: input.attorneyEmail, order: 1 });
      }

      // Create the request in HelloSign
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "";
      const hsResult = await hsCreateRequest(hsConfig, {
        title: input.title,
        subject: input.title,
        message: input.description || `Please review and sign: ${input.title}`,
        signers,
        fileContent: input.documentContent,
        testMode: hsConfig.testMode,
        clientId: hsConfig.clientId,
        callbackUrl: hsConfig.callbackUrl || `${baseUrl}/api/hellosign/webhook`,
        metadata: { matterId: input.matterId },
      });

      const sigReq = hsResult.signature_request;
      if (!sigReq) throw new Error("Failed to create HelloSign signature request");

      // Create local record
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
          signingProvider: "hellosign",
          helloSignRequestId: sigReq.signature_request_id,
          helloSignSignatureId: sigReq.signatures?.[0]?.signature_id || null,
          hellosignStatus: "awaiting_signature",
          attorneyEmail: input.attorneyEmail || null,
          status: "PENDING_CLIENT",
          sentAt: new Date(),
        },
      });

      return request;
    }),

  helloSignRemind: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (!request.helloSignRequestId) throw new Error("Not a HelloSign request");

      const hsConfig = await getHelloSignConfig(ctx.db);
      if (!hsConfig) throw new Error("HelloSign is not configured");

      await hsSendReminder(hsConfig, request.helloSignRequestId, request.clientEmail);
      return { success: true };
    }),

  helloSignRefreshStatus: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (!request.helloSignRequestId) throw new Error("Not a HelloSign request");

      const hsConfig = await getHelloSignConfig(ctx.db);
      if (!hsConfig) throw new Error("HelloSign is not configured");

      const hsResult = await hsGetRequest(hsConfig, request.helloSignRequestId);
      const sigReq = hsResult.signature_request;
      if (!sigReq) throw new Error("Failed to get HelloSign status");

      // Map HelloSign status to our status
      let newStatus = request.status;
      let clientSignedAt = request.clientSignedAt;
      let attorneySignedAt = request.attorneySignedAt;
      let completedAt = request.completedAt;

      if (sigReq.is_complete) {
        newStatus = "COMPLETED";
        completedAt = new Date();
      } else {
        const clientSig = sigReq.signatures?.find(s => s.signer_email_address === request.clientEmail);
        const attorneySig = request.attorneyName
          ? sigReq.signatures?.find(s => s.signer_email_address !== request.clientEmail)
          : null;

        if (clientSig?.status_code === "signed") {
          clientSignedAt = clientSig.signed_at ? new Date(clientSig.signed_at * 1000) : new Date();
          if (request.attorneyName) {
            if (attorneySig?.status_code === "signed") {
              newStatus = "COMPLETED";
              attorneySignedAt = attorneySig.signed_at ? new Date(attorneySig.signed_at * 1000) : new Date();
              completedAt = new Date();
            } else {
              newStatus = "PENDING_ATTORNEY";
            }
          } else {
            newStatus = "COMPLETED";
            completedAt = new Date();
          }
        }
      }

      // Get signed file URL if completed
      let fileUrl = request.helloSignFileUrl;
      if (newStatus === "COMPLETED" && !fileUrl) {
        try {
          fileUrl = await hsGetFileUrl(hsConfig, request.helloSignRequestId);
        } catch {}
      }

      const updated = await ctx.db.signatureRequest.update({
        where: { id: input.id },
        data: {
          status: newStatus as any,
          clientSignedAt,
          attorneySignedAt,
          completedAt,
          helloSignFileUrl: fileUrl,
          helloSignStatusData: JSON.stringify(sigReq),
        },
      });

      return updated;
    }),

  helloSignGetFileUrl: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (!request.helloSignRequestId) throw new Error("Not a HelloSign request");
      if (request.helloSignFileUrl) return { url: request.helloSignFileUrl };

      const hsConfig = await getHelloSignConfig(ctx.db);
      if (!hsConfig) throw new Error("HelloSign is not configured");

      const url = await hsGetFileUrl(hsConfig, request.helloSignRequestId);
      await ctx.db.signatureRequest.update({
        where: { id: input.id },
        data: { helloSignFileUrl: url },
      });
      return { url };
    }),

  testHellosignConnection: publicProcedure
    .mutation(async ({ ctx }) => {
      const settings = await ctx.db.helloSignSettings.findUnique({ where: { id: "default" } });
      if (!settings?.apiKey) throw new Error("No API key configured");
      const result = await hsTestConnection(settings.apiKey);
      return result;
    }),

  createHellosignRequest: publicProcedure
    .input(z.object({
      signatureRequestId: z.string(),
      useEmbeddedSigning: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUniqueOrThrow({
        where: { id: input.signatureRequestId },
      });
      if (request.helloSignRequestId) throw new Error("Already sent to HelloSign");

      const hsConfig = await getHelloSignConfig(ctx.db);
      if (!hsConfig) throw new Error("HelloSign is not configured");

      const signers: Array<{ name: string; emailAddress: string; order?: number }> = [
        { name: request.clientName, emailAddress: request.clientEmail, order: 0 },
      ];
      if (request.attorneyName && request.attorneyEmail) {
        signers.push({ name: request.attorneyName, emailAddress: request.attorneyEmail, order: 1 });
      }

      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "";
      const hsResult = await hsCreateRequest(hsConfig, {
        title: request.title,
        subject: request.title,
        message: request.description || `Please review and sign: ${request.title}`,
        signers,
        fileContent: request.documentContent || undefined,
        testMode: hsConfig.testMode,
        clientId: hsConfig.clientId,
        callbackUrl: hsConfig.callbackUrl || `${baseUrl}/api/hellosign/webhook`,
        metadata: { matterId: request.matterId, signatureRequestId: request.id },
        useEmbeddedSigning: input.useEmbeddedSigning,
      });

      const sigReq = hsResult.signature_request;
      if (!sigReq) throw new Error("Failed to create HelloSign signature request");

      // Find signature IDs for each signer
      const clientSig = sigReq.signatures?.find(s => s.signer_email_address === request.clientEmail);
      const attorneySig = request.attorneyEmail
        ? sigReq.signatures?.find(s => s.signer_email_address === request.attorneyEmail)
        : null;

      const updated = await ctx.db.signatureRequest.update({
        where: { id: request.id },
        data: {
          signingProvider: "hellosign",
          helloSignRequestId: sigReq.signature_request_id,
          helloSignSignatureId: clientSig?.signature_id || null,
          hellosignStatus: "awaiting_signature",
          status: "PENDING_CLIENT",
          sentAt: new Date(),
          helloSignStatusData: JSON.stringify(sigReq),
        },
      });

      return updated;
    }),

  getHellosignSignUrl: publicProcedure
    .input(z.object({
      id: z.string(),
      signer: z.enum(["client", "attorney"]),
    }))
    .query(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (!request.helloSignRequestId) throw new Error("Not a HelloSign request");

      const hsConfig = await getHelloSignConfig(ctx.db);
      if (!hsConfig) throw new Error("HelloSign is not configured");

      // Get current signatures from HelloSign to find the right signature_id
      const hsResult = await hsGetRequest(hsConfig, request.helloSignRequestId);
      const sigReq = hsResult.signature_request;
      if (!sigReq) throw new Error("Failed to get HelloSign request");

      let targetEmail = input.signer === "client" ? request.clientEmail : request.attorneyEmail;
      if (!targetEmail) throw new Error(`No email for ${input.signer}`);

      const sig = sigReq.signatures?.find(s => s.signer_email_address === targetEmail);
      if (!sig) throw new Error(`Signer not found on HelloSign request`);

      if (sig.status_code === "signed") {
        return { signUrl: null, alreadySigned: true };
      }

      const embedded = await hsGetEmbeddedSignUrl(hsConfig, sig.signature_id);
      return { signUrl: embedded.sign_url, expiresAt: embedded.expires_at, alreadySigned: false };
    }),

  downloadHellosignDocument: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (!request.helloSignRequestId) throw new Error("Not a HelloSign request");

      const hsConfig = await getHelloSignConfig(ctx.db);
      if (!hsConfig) throw new Error("HelloSign is not configured");

      const url = await hsGetFileUrl(hsConfig, request.helloSignRequestId);
      await ctx.db.signatureRequest.update({
        where: { id: input.id },
        data: { helloSignFileUrl: url, hellosignDocumentUrl: url },
      });
      return { url };
    }),

  sendHellosignReminder: publicProcedure
    .input(z.object({
      id: z.string(),
      signer: z.enum(["client", "attorney"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const request = await ctx.db.signatureRequest.findUniqueOrThrow({ where: { id: input.id } });
      if (!request.helloSignRequestId) throw new Error("Not a HelloSign request");

      const hsConfig = await getHelloSignConfig(ctx.db);
      if (!hsConfig) throw new Error("HelloSign is not configured");

      const email = input.signer === "client" ? request.clientEmail : request.attorneyEmail;
      if (!email) throw new Error(`No email for ${input.signer}`);

      await hsSendReminder(hsConfig, request.helloSignRequestId, email);
      return { success: true };
    }),
});
