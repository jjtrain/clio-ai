import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { ClientStatus } from "@prisma/client";

const clientInput = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export const clientsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.nativeEnum(ClientStatus).optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { search, status, limit = 50, cursor } = input || {};
      
      const clients = await ctx.db.client.findMany({
        where: {
          AND: [
            search
              ? {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { email: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {},
            status ? { status } : {},
            { status: { not: "ARCHIVED" } },
          ],
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { matters: true },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (clients.length > limit) {
        const nextItem = clients.pop();
        nextCursor = nextItem!.id;
      }

      return { clients, nextCursor };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const client = await ctx.db.client.findUnique({
        where: { id: input.id },
        include: {
          matters: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!client) {
        throw new Error("Client not found");
      }

      return client;
    }),

  create: publicProcedure
    .input(clientInput)
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.db.client.create({
        data: {
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          address: input.address || null,
          notes: input.notes || null,
        },
      });

      return client;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: clientInput.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.db.client.update({
        where: { id: input.id },
        data: input.data,
      });

      return client;
    }),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(ClientStatus),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.db.client.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      return client;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Soft delete by archiving
      const client = await ctx.db.client.update({
        where: { id: input.id },
        data: { status: "ARCHIVED" },
      });

      return client;
    }),
});
