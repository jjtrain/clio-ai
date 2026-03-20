import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const departmentsRouter = router({
  // 1. list
  list: publicProcedure.query(async () => {
    const departments = await db.firmDepartment.findMany({
      where: { isActive: true },
      include: { _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    });
    return departments;
  }),

  // 2. getById
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const department = await db.firmDepartment.findUnique({
        where: { id: input.id },
        include: {
          members: true,
          _count: { select: { workflows: true, widgets: true } },
        },
      });
      return department;
    }),

  // 3. create
  create: publicProcedure
    .input(
      z.object({
        name: z.string(),
        description: z.string().optional(),
        practiceAreas: z.array(z.string()),
        headAttorney: z.string().optional(),
        headAttorneyEmail: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
        defaultBillingRate: z.number().optional(),
        defaultBillingType: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const slug = generateSlug(input.name);
      const department = await db.firmDepartment.create({
        data: {
          name: input.name,
          slug,
          description: input.description,
          practiceAreas: JSON.stringify(input.practiceAreas),
          headAttorney: input.headAttorney,
          headAttorneyEmail: input.headAttorneyEmail,
          color: input.color,
          icon: input.icon,
          defaultBillingRate: input.defaultBillingRate,
          defaultBillingType: input.defaultBillingType,
        },
      });
      return department;
    }),

  // 4. update
  update: publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      const data = { ...input.data };
      if (Array.isArray(data.practiceAreas)) {
        data.practiceAreas = JSON.stringify(data.practiceAreas);
      }
      const department = await db.firmDepartment.update({
        where: { id: input.id },
        data,
      });
      return department;
    }),

  // 5. delete
  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const department = await db.firmDepartment.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      return department;
    }),

  // 6. getSettings
  getSettings: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const department = await db.firmDepartment.findUnique({
        where: { id: input.id },
      });
      const settings = department?.settings
        ? JSON.parse(department.settings as string)
        : {};
      return settings;
    }),

  // 7. updateSettings
  updateSettings: publicProcedure
    .input(z.object({ id: z.string(), settings: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      const department = await db.firmDepartment.findUnique({
        where: { id: input.id },
      });
      const existing = department?.settings
        ? JSON.parse(department.settings as string)
        : {};
      const merged = { ...existing, ...input.settings };
      return db.firmDepartment.update({
        where: { id: input.id },
        data: { settings: JSON.stringify(merged) },
      });
    }),

  // 8. members.list
  "members.list": publicProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(async ({ input }) => {
      const members = await db.departmentMember.findMany({
        where: { departmentId: input.departmentId },
        orderBy: { userName: "asc" },
      });
      return members;
    }),

  // 9. members.add
  "members.add": publicProcedure
    .input(
      z.object({
        departmentId: z.string(),
        userId: z.string(),
        userName: z.string(),
        userEmail: z.string(),
        role: z.string(),
        billingRate: z.number().optional(),
        isPrimary: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const member = await db.departmentMember.create({ data: input as any });
      await db.firmDepartment.update({
        where: { id: input.departmentId },
        data: { memberCount: { increment: 1 } },
      });
      return member;
    }),

  // 10. members.update
  "members.update": publicProcedure
    .input(z.object({ memberId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      const member = await db.departmentMember.update({
        where: { id: input.memberId },
        data: input.data,
      });
      return member;
    }),

  // 11. members.remove
  "members.remove": publicProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ input }) => {
      const member = await db.departmentMember.findUnique({
        where: { id: input.memberId },
      });
      await db.departmentMember.delete({ where: { id: input.memberId } });
      await db.firmDepartment.update({
        where: { id: member!.departmentId },
        data: { memberCount: { decrement: 1 } },
      });
      return { deleted: true };
    }),

  // 12. members.bulkAdd
  "members.bulkAdd": publicProcedure
    .input(
      z.object({
        departmentId: z.string(),
        members: z.array(
          z.object({
            userId: z.string(),
            userName: z.string(),
            userEmail: z.string(),
            role: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const data = input.members.map((m) => ({
        ...m,
        departmentId: input.departmentId,
      }));
      const result = await db.departmentMember.createMany({ data: data as any });
      await db.firmDepartment.update({
        where: { id: input.departmentId },
        data: { memberCount: { increment: result.count } },
      });
      return { count: result.count };
    }),

  // 13. members.getMyDepartments
  "members.getMyDepartments": publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const memberships = await db.departmentMember.findMany({
        where: { userId: input.userId },
        include: { department: true },
      });
      return memberships;
    }),

  // 14. members.setPrimary
  "members.setPrimary": publicProcedure
    .input(z.object({ userId: z.string(), departmentId: z.string() }))
    .mutation(async ({ input }) => {
      await db.departmentMember.updateMany({
        where: { userId: input.userId },
        data: { isPrimary: false },
      });
      await db.departmentMember.updateMany({
        where: { userId: input.userId, departmentId: input.departmentId },
        data: { isPrimary: true },
      });
      return { success: true };
    }),

  // 15. dashboard.getWidgets
  "dashboard.getWidgets": publicProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(async ({ input }) => {
      const widgets = await db.departmentDashboardWidget.findMany({
        where: { departmentId: input.departmentId, isVisible: true },
        orderBy: { position: "asc" },
      });
      return widgets;
    }),

  // 16. dashboard.addWidget
  "dashboard.addWidget": publicProcedure
    .input(
      z.object({
        departmentId: z.string(),
        widgetType: z.string(),
        title: z.string(),
        width: z.number().optional(),
        config: z.string().optional(),
        position: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const widget = await db.departmentDashboardWidget.create({
        data: input as any,
      });
      return widget;
    }),

  // 17. dashboard.updateWidget
  "dashboard.updateWidget": publicProcedure
    .input(z.object({ widgetId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      const widget = await db.departmentDashboardWidget.update({
        where: { id: input.widgetId },
        data: input.data,
      });
      return widget;
    }),

  // 18. dashboard.removeWidget
  "dashboard.removeWidget": publicProcedure
    .input(z.object({ widgetId: z.string() }))
    .mutation(async ({ input }) => {
      await db.departmentDashboardWidget.delete({
        where: { id: input.widgetId },
      });
      return { deleted: true };
    }),

  // 19. dashboard.reorderWidgets
  "dashboard.reorderWidgets": publicProcedure
    .input(
      z.object({ departmentId: z.string(), widgetIds: z.array(z.string()) })
    )
    .mutation(async ({ input }) => {
      for (let i = 0; i < input.widgetIds.length; i++) {
        await db.departmentDashboardWidget.update({
          where: { id: input.widgetIds[i] },
          data: { position: i },
        });
      }
      return { reordered: true };
    }),

  // 20. dashboard.getData
  "dashboard.getData": publicProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(async ({ input }) => {
      const department = await db.firmDepartment.findUnique({
        where: { id: input.departmentId },
      });
      const matterCount = await db.matter.count({
        where: { departmentId: input.departmentId },
      });
      const members = await db.departmentMember.findMany({
        where: { departmentId: input.departmentId },
        select: { userId: true },
      });
      const memberIds = members.map((m) => m.userId);
      const timeEntries = await db.timeEntry.aggregate({
        where: { userId: { in: memberIds } },
        _sum: { duration: true },
      });
      const tasksDue = await db.task.count({
        where: { assigneeId: { in: memberIds }, status: { not: "COMPLETED" as any } },
      });
      return {
        matterCount,
        revenue: timeEntries._sum.duration ?? 0,
        tasksDue,
        upcomingDeadlines: 0,
      };
    }),

  // 21. dashboard.getDefaultWidgets
  "dashboard.getDefaultWidgets": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(({ input }) => {
      const defaults: Record<string, Array<{ type: string; title: string; width: number }>> = {
        litigation: [
          { type: "mattersPipeline", title: "Matters Pipeline", width: 2 },
          { type: "upcomingDeadlines", title: "Upcoming Deadlines", width: 1 },
          { type: "teamUtilization", title: "Team Utilization", width: 1 },
          { type: "revenueChart", title: "Revenue", width: 2 },
        ],
        corporate: [
          { type: "activeDeals", title: "Active Deals", width: 2 },
          { type: "complianceTracker", title: "Compliance", width: 1 },
          { type: "teamUtilization", title: "Team Utilization", width: 1 },
        ],
        default: [
          { type: "mattersSummary", title: "Matters Summary", width: 1 },
          { type: "teamUtilization", title: "Team Utilization", width: 1 },
          { type: "revenueChart", title: "Revenue", width: 2 },
        ],
      };
      return defaults[input.practiceArea] ?? defaults["default"];
    }),

  // 22. workflows.list
  "workflows.list": publicProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(async ({ input }) => {
      const workflows = await db.departmentWorkflow.findMany({
        where: { departmentId: input.departmentId },
      });
      return workflows;
    }),

  // 23. workflows.create
  "workflows.create": publicProcedure
    .input(
      z.object({
        departmentId: z.string(),
        name: z.string(),
        description: z.string().optional(),
        trigger: z.string(),
        triggerConditions: z.string().optional(),
        actions: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const workflow = await db.departmentWorkflow.create({ data: input as any });
      return workflow;
    }),

  // 24. workflows.update
  "workflows.update": publicProcedure
    .input(z.object({ workflowId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      const workflow = await db.departmentWorkflow.update({
        where: { id: input.workflowId },
        data: input.data,
      });
      return workflow;
    }),

  // 25. workflows.delete
  "workflows.delete": publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input }) => {
      await db.departmentWorkflow.delete({ where: { id: input.workflowId } });
      return { deleted: true };
    }),

  // 26. workflows.toggle
  "workflows.toggle": publicProcedure
    .input(z.object({ workflowId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const workflow = await db.departmentWorkflow.update({
        where: { id: input.workflowId },
        data: { isActive: input.isActive },
      });
      return workflow;
    }),

  // 27. workflows.execute
  "workflows.execute": publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input }) => {
      await db.departmentWorkflow.update({
        where: { id: input.workflowId },
        data: {
          executionCount: { increment: 1 },
          lastExecutedAt: new Date(),
        },
      });
      return { executed: true };
    }),

  // 28. announcements.list
  "announcements.list": publicProcedure
    .input(z.object({ departmentId: z.string().optional() }))
    .query(async ({ input }) => {
      const announcements = await db.departmentAnnouncement.findMany({
        where: {
          OR: [
            { departmentId: input.departmentId ?? undefined },
            { departmentId: null },
          ],
          expiresAt: { gt: new Date() },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      });
      return announcements;
    }),

  // 29. announcements.create
  "announcements.create": publicProcedure
    .input(
      z.object({
        departmentId: z.string().optional(),
        title: z.string(),
        content: z.string(),
        priority: z.string(),
        authorName: z.string(),
        isPinned: z.boolean().optional(),
        expiresAt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const announcement = await db.departmentAnnouncement.create({
        data: {
          ...input as any,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
        },
      });
      return announcement;
    }),

  // 30. announcements.update
  "announcements.update": publicProcedure
    .input(z.object({ announcementId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      const announcement = await db.departmentAnnouncement.update({
        where: { id: input.announcementId },
        data: input.data,
      });
      return announcement;
    }),

  // 31. announcements.delete
  "announcements.delete": publicProcedure
    .input(z.object({ announcementId: z.string() }))
    .mutation(async ({ input }) => {
      await db.departmentAnnouncement.delete({
        where: { id: input.announcementId },
      });
      return { deleted: true };
    }),

  // 32. announcements.markRead
  "announcements.markRead": publicProcedure
    .input(z.object({ announcementId: z.string(), userId: z.string() }))
    .mutation(async ({ input }) => {
      const announcement = await db.departmentAnnouncement.findUnique({
        where: { id: input.announcementId },
      });
      const readBy: string[] = announcement?.readBy
        ? JSON.parse(announcement.readBy as string)
        : [];
      if (!readBy.includes(input.userId)) {
        readBy.push(input.userId);
      }
      await db.departmentAnnouncement.update({
        where: { id: input.announcementId },
        data: { readBy: JSON.stringify(readBy) },
      });
      return { marked: true };
    }),

  // 33. matters.assignDepartment
  "matters.assignDepartment": publicProcedure
    .input(z.object({ matterId: z.string(), departmentId: z.string() }))
    .mutation(async ({ input }) => {
      const matter = await db.matter.update({
        where: { id: input.matterId },
        data: { departmentId: input.departmentId },
      });
      await db.firmDepartment.update({
        where: { id: input.departmentId },
        data: { matterCount: { increment: 1 } },
      });
      return matter;
    }),

  // 34. matters.listByDepartment
  "matters.listByDepartment": publicProcedure
    .input(
      z.object({
        departmentId: z.string(),
        status: z.string().optional(),
        page: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      const page = input.page ?? 1;
      const take = 20;
      const where: any = { departmentId: input.departmentId };
      if (input.status) where.status = input.status as any;
      const matters = await db.matter.findMany({
        where,
        skip: (page - 1) * take,
        take,
      });
      return matters;
    }),

  // 35. matters.bulkAssign
  "matters.bulkAssign": publicProcedure
    .input(
      z.object({ matterIds: z.array(z.string()), departmentId: z.string() })
    )
    .mutation(async ({ input }) => {
      const result = await db.matter.updateMany({
        where: { id: { in: input.matterIds } },
        data: { departmentId: input.departmentId },
      });
      await db.firmDepartment.update({
        where: { id: input.departmentId },
        data: { matterCount: { increment: result.count } },
      });
      return { updated: result.count };
    }),

  // 36. matters.autoAssign
  "matters.autoAssign": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ input }) => {
      const matter = await db.matter.findUnique({
        where: { id: input.matterId },
      });
      const departments = await db.firmDepartment.findMany({
        where: { isActive: true },
      });
      const match = departments.find((d) => {
        const areas = d.practiceAreas ? JSON.parse(d.practiceAreas as string) : [];
        return areas.includes((matter as any)?.practiceArea);
      });
      if (match) {
        await db.matter.update({
          where: { id: input.matterId },
          data: { departmentId: match.id },
        });
        await db.firmDepartment.update({
          where: { id: match.id },
          data: { matterCount: { increment: 1 } },
        });
      }
      return { assigned: !!match, departmentId: match?.id ?? null };
    }),

  // 37. leads.routeToDepartment
  "leads.routeToDepartment": publicProcedure
    .input(z.object({ leadId: z.string(), departmentId: z.string() }))
    .mutation(async ({ input }) => {
      // Placeholder - depends on Lead model having departmentId
      return { routed: true };
    }),

  // 38. leads.autoRoute
  "leads.autoRoute": publicProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ input }) => {
      // Placeholder
      return { routed: true, departmentId: null };
    }),

  // 39. leads.listByDepartment
  "leads.listByDepartment": publicProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(async ({ input }) => {
      // Placeholder
      return [];
    }),

  // 40. reports.departmentComparison
  "reports.departmentComparison": publicProcedure
    .input(
      z.object({ from: z.string().optional(), to: z.string().optional() })
    )
    .query(async ({ input }) => {
      const departments = await db.firmDepartment.findMany({
        where: { isActive: true },
      });
      const comparison = await Promise.all(
        departments.map(async (dept) => {
          const matterCount = await db.matter.count({
            where: { departmentId: dept.id },
          });
          const members = await db.departmentMember.findMany({
            where: { departmentId: dept.id },
            select: { userId: true },
          });
          const revenue = await db.timeEntry.aggregate({
            where: { userId: { in: members.map((m) => m.userId) } },
            _sum: { duration: true },
          });
          return {
            departmentId: dept.id,
            name: dept.name,
            matterCount,
            revenue: revenue._sum.duration ?? 0,
            memberCount: members.length,
          };
        })
      );
      return comparison;
    }),

  // 41. reports.departmentDetail
  "reports.departmentDetail": publicProcedure
    .input(
      z.object({
        departmentId: z.string(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const department = await db.firmDepartment.findUnique({
        where: { id: input.departmentId },
        include: { members: true },
      });
      const matterCount = await db.matter.count({
        where: { departmentId: input.departmentId },
      });
      const memberIds = department?.members.map((m) => m.userId) ?? [];
      const revenue = await db.timeEntry.aggregate({
        where: { userId: { in: memberIds } },
        _sum: { duration: true },
      });
      return {
        department,
        matterCount,
        revenue: revenue._sum.duration ?? 0,
      };
    }),

  // 42. reports.teamUtilization
  "reports.teamUtilization": publicProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(async ({ input }) => {
      const members = await db.departmentMember.findMany({
        where: { departmentId: input.departmentId },
      });
      const utilization = await Promise.all(
        members.map(async (member) => {
          const entries = await db.timeEntry.aggregate({
            where: { userId: member.userId },
            _sum: { duration: true },
          });
          const totalHours = (entries._sum.duration as number) ?? 0;
          const targetHours = 160;
          return {
            userId: member.userId,
            userName: member.userName,
            totalHours,
            utilization: Math.round((totalHours / targetHours) * 100),
          };
        })
      );
      return utilization;
    }),

  // 43. reports.crossDepartmentMatters
  "reports.crossDepartmentMatters": publicProcedure.query(async () => {
    const matters = await db.matter.findMany({
      where: { departmentId: { not: null } },
      select: { clientId: true, departmentId: true, id: true, name: true },
    });
    const clientMap = new Map<string, Array<{ matterId: string; departmentId: string; name: string }>>();
    for (const m of matters) {
      if (!m.clientId || !m.departmentId) continue;
      if (!clientMap.has(m.clientId)) clientMap.set(m.clientId, []);
      clientMap.get(m.clientId)!.push({
        matterId: m.id,
        departmentId: m.departmentId,
        name: m.name ?? "",
      });
    }
    const crossRefs: Array<{ clientId: string; departments: string[]; matters: any[] }> = [];
    clientMap.forEach((items, clientId) => {
      const depts = Array.from(new Set(items.map((i) => i.departmentId)));
      if (depts.length > 1) {
        crossRefs.push({ clientId, departments: depts, matters: items });
      }
    });
    return crossRefs;
  }),
});
