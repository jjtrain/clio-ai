import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const tasksRouter = router({
  // List all tasks with filtering
  list: publicProcedure
    .input(
      z.object({
        status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        matterId: z.string().optional(),
        assigneeId: z.string().optional(),
        dueBefore: z.string().optional(),
        dueAfter: z.string().optional(),
        includeCompleted: z.boolean().optional().default(true),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};

      if (input.status) where.status = input.status;
      if (input.priority) where.priority = input.priority;
      if (input.matterId) where.matterId = input.matterId;
      if (input.assigneeId) where.assigneeId = input.assigneeId;

      if (!input.includeCompleted) {
        where.status = { not: "COMPLETED" };
      }

      if (input.dueBefore || input.dueAfter) {
        where.dueDate = {};
        if (input.dueBefore) where.dueDate.lte = new Date(input.dueBefore);
        if (input.dueAfter) where.dueDate.gte = new Date(input.dueAfter);
      }

      const tasks = await ctx.db.task.findMany({
        where,
        include: {
          matter: {
            include: {
              client: true,
            },
          },
          assignee: {
            select: { id: true, name: true, email: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [
          // Overdue items first (null dates last)
          { dueDate: "asc" },
          // Then by priority (urgent first)
          { priority: "desc" },
          { createdAt: "desc" },
        ],
        take: input.limit,
        skip: input.offset,
      });

      const count = await ctx.db.task.count({ where });

      // Sort to put overdue at top
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const sortedTasks = tasks.sort((a, b) => {
        const aOverdue = a.dueDate && new Date(a.dueDate) < now && a.status !== "COMPLETED";
        const bOverdue = b.dueDate && new Date(b.dueDate) < now && b.status !== "COMPLETED";

        if (aOverdue && !bOverdue) return -1;
        if (!aOverdue && bOverdue) return 1;

        // Both overdue or both not - sort by date
        if (a.dueDate && b.dueDate) {
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }
        if (a.dueDate && !b.dueDate) return -1;
        if (!a.dueDate && b.dueDate) return 1;

        return 0;
      });

      return { tasks: sortedTasks, count };
    }),

  // Get single task by ID
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUnique({
        where: { id: input.id },
        include: {
          matter: {
            include: {
              client: true,
            },
          },
          assignee: {
            select: { id: true, name: true, email: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!task) throw new Error("Task not found");
      return task;
    }),

  // Create a new task
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        dueDate: z.string().optional(),
        matterId: z.string().optional(),
        assigneeId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.create({
        data: {
          title: input.title,
          description: input.description,
          status: input.status || "NOT_STARTED",
          priority: input.priority || "MEDIUM",
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          matterId: input.matterId || null,
          assigneeId: input.assigneeId || null,
          // createdById would be set from session in production
        },
        include: {
          matter: {
            include: { client: true },
          },
          assignee: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }),

  // Update a task
  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        dueDate: z.string().nullable().optional(),
        matterId: z.string().nullable().optional(),
        assigneeId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, dueDate, ...data } = input;

      // If marking as completed, set completedAt
      const updateData: any = { ...data };
      if (data.status === "COMPLETED") {
        updateData.completedAt = new Date();
      } else if (data.status) {
        // Status is NOT_STARTED or IN_PROGRESS, clear completedAt
        updateData.completedAt = null;
      }

      if (dueDate !== undefined) {
        updateData.dueDate = dueDate ? new Date(dueDate) : null;
      }

      return ctx.db.task.update({
        where: { id },
        data: updateData,
        include: {
          matter: {
            include: { client: true },
          },
          assignee: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }),

  // Quick toggle complete
  toggleComplete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUnique({
        where: { id: input.id },
      });

      if (!task) throw new Error("Task not found");

      const newStatus = task.status === "COMPLETED" ? "NOT_STARTED" : "COMPLETED";

      return ctx.db.task.update({
        where: { id: input.id },
        data: {
          status: newStatus,
          completedAt: newStatus === "COMPLETED" ? new Date() : null,
        },
        include: {
          matter: {
            include: { client: true },
          },
          assignee: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    }),

  // Delete a task
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.task.delete({
        where: { id: input.id },
      });
    }),

  // Get tasks for a specific matter
  getByMatter: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        includeCompleted: z.boolean().optional().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { matterId: input.matterId };
      if (!input.includeCompleted) {
        where.status = { not: "COMPLETED" };
      }

      return ctx.db.task.findMany({
        where,
        include: {
          assignee: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      });
    }),

  // Dashboard summary - overdue and due today
  dashboardSummary: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Overdue tasks (due before today, not completed)
    const overdueTasks = await ctx.db.task.findMany({
      where: {
        dueDate: { lt: startOfToday },
        status: { not: "COMPLETED" },
      },
      include: {
        matter: {
          include: { client: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    });

    // Tasks due today (not completed)
    const dueTodayTasks = await ctx.db.task.findMany({
      where: {
        dueDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
        status: { not: "COMPLETED" },
      },
      include: {
        matter: {
          include: { client: true },
        },
        assignee: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { priority: "desc" },
      take: 10,
    });

    // Counts
    const overdueCount = await ctx.db.task.count({
      where: {
        dueDate: { lt: startOfToday },
        status: { not: "COMPLETED" },
      },
    });

    const dueTodayCount = await ctx.db.task.count({
      where: {
        dueDate: {
          gte: startOfToday,
          lte: endOfToday,
        },
        status: { not: "COMPLETED" },
      },
    });

    const totalOpenCount = await ctx.db.task.count({
      where: {
        status: { not: "COMPLETED" },
      },
    });

    return {
      overdueTasks,
      dueTodayTasks,
      overdueCount,
      dueTodayCount,
      totalOpenCount,
    };
  }),

  // Summary stats
  summary: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [total, completed, inProgress, notStarted, overdue] = await Promise.all([
      ctx.db.task.count(),
      ctx.db.task.count({ where: { status: "COMPLETED" } }),
      ctx.db.task.count({ where: { status: "IN_PROGRESS" } }),
      ctx.db.task.count({ where: { status: "NOT_STARTED" } }),
      ctx.db.task.count({
        where: {
          dueDate: { lt: startOfToday },
          status: { not: "COMPLETED" },
        },
      }),
    ]);

    return { total, completed, inProgress, notStarted, overdue };
  }),
});
