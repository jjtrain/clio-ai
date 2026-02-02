import { z } from "zod";
import { router, publicProcedure } from "../trpc";

const documentInput = z.object({
  matterId: z.string().min(1, "Matter is required"),
  name: z.string().min(1, "Name is required"),
  filename: z.string().min(1, "Filename is required"),
  mimeType: z.string().default("application/octet-stream"),
  size: z.number().default(0),
  path: z.string().default(""),
});

export const documentsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        matterId: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { matterId, search, limit = 50, cursor } = input || {};

      const documents = await ctx.db.document.findMany({
        where: {
          AND: [
            matterId ? { matterId } : {},
            search
              ? {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { filename: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {},
          ],
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          matter: {
            select: {
              id: true,
              name: true,
              matterNumber: true,
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (documents.length > limit) {
        const nextItem = documents.pop();
        nextCursor = nextItem!.id;
      }

      return { documents, nextCursor };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const document = await ctx.db.document.findUnique({
        where: { id: input.id },
        include: {
          matter: {
            include: {
              client: true,
            },
          },
        },
      });

      if (!document) {
        throw new Error("Document not found");
      }

      return document;
    }),

  create: publicProcedure
    .input(documentInput)
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.db.document.create({
        data: {
          matterId: input.matterId,
          name: input.name,
          filename: input.filename,
          mimeType: input.mimeType,
          size: input.size,
          path: input.path,
        },
      });

      return document;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: z.object({
          name: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.db.document.update({
        where: { id: input.id },
        data: input.data,
      });

      return document;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.document.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),
});
