import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { PartyRole } from "@prisma/client";

export const relatedPartiesRouter = router({
  list: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.relatedParty.findMany({
        where: { matterId: input.matterId },
        orderBy: { createdAt: "desc" },
      });
    }),

  create: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        name: z.string().min(1),
        email: z.string().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        role: z.nativeEnum(PartyRole),
        relationship: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.relatedParty.create({ data: input });
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        company: z.string().optional(),
        role: z.nativeEnum(PartyRole).optional(),
        relationship: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.relatedParty.update({ where: { id }, data });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.relatedParty.delete({ where: { id: input.id } });
    }),
});
