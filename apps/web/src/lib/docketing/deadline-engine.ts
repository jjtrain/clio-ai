import { db } from "@/lib/db";
import { LawToolBoxClient } from "./lawtoolbox";
import { CourtDriveClient } from "./courtdrive";
import { UsptoTsdrClient } from "./uspto-tsdr";
import type { DeadlineDigest } from "./types";

export class DeadlineEngine {
  private lawToolBox: LawToolBoxClient;
  private courtDrive: CourtDriveClient;
  private uspto: UsptoTsdrClient;

  constructor() {
    this.lawToolBox = new LawToolBoxClient();
    this.courtDrive = new CourtDriveClient();
    this.uspto = new UsptoTsdrClient();
  }

  getIntegrationStatus() {
    return {
      lawToolBox: { configured: this.lawToolBox.isConfigured() },
      courtDrive: { configured: this.courtDrive.isConfigured() },
      uspto: { configured: this.uspto.isConfigured() },
    };
  }

  getLawToolBox() { return this.lawToolBox; }
  getCourtDrive() { return this.courtDrive; }
  getUspto() { return this.uspto; }

  async calculateAndSaveDeadlines(params: {
    matterId: string; rulesetId: string; triggerId: string;
    triggerDate: Date; methodOfService?: string; userId?: string;
  }): Promise<{ deadlines: any[]; error?: string }> {
    const result = await this.lawToolBox.calculateDeadlines({
      rulesetId: params.rulesetId, triggerId: params.triggerId,
      triggerDate: params.triggerDate, methodOfService: params.methodOfService,
    });

    if (!result.success || !result.data) return { deadlines: [], error: result.error };

    const saved = [];
    for (const d of result.data) {
      const deadline = await db.deadline.create({
        data: {
          matterId: params.matterId, title: d.title, description: d.description,
          dueDate: d.dueDate, ruleAuthority: d.ruleAuthority,
          consequenceOfMissing: d.consequenceOfMissing,
          triggerDate: d.triggerDate, triggerType: d.triggerType,
          source: "LAWTOOLBOX", jurisdiction: params.rulesetId,
          methodOfService: params.methodOfService, createdBy: params.userId,
          priority: this.calculatePriority(d.dueDate),
        },
      });
      saved.push(deadline);
    }

    await db.docketingAuditLog.create({
      data: { matterId: params.matterId, action: "DEADLINE_CALCULATED", source: "LAWTOOLBOX", inputData: params as any, outputData: { count: saved.length } as any, userId: params.userId },
    });

    return { deadlines: saved };
  }

  async checkForNewFilings(courtCaseId: string): Promise<{ newFilings: any[]; error?: string }> {
    const courtCase = await db.courtCase.findUniqueOrThrow({ where: { id: courtCaseId } });
    const since = courtCase.lastChecked || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const result = await this.courtDrive.getNewFilings(courtCase.courtDriveId || courtCaseId, since);
    if (!result.success || !result.data) return { newFilings: [], error: result.error };

    const saved = [];
    for (const f of result.data) {
      const filing = await db.courtFiling.create({
        data: {
          courtCaseId, docketEntryNum: f.docketEntryNum,
          description: f.description, filedDate: f.filedDate,
          documentUrl: f.documentUrl, externalId: f.externalId, isNew: true,
        },
      });
      saved.push(filing);
    }

    await db.courtCase.update({ where: { id: courtCaseId }, data: { lastChecked: new Date() } });
    await db.docketingAuditLog.create({
      data: { matterId: courtCase.matterId, action: "FILING_DETECTED", source: "COURTDRIVE", outputData: { count: saved.length } as any },
    });

    return { newFilings: saved };
  }

  async refreshTrademarkStatus(trademarkDocketId: string): Promise<{ status: any; error?: string }> {
    const tm = await db.trademarkDocket.findUniqueOrThrow({ where: { id: trademarkDocketId } });
    const result = await this.uspto.getStatusBySerial(tm.serialNumber);

    if (!result.success || !result.data) return { status: null, error: result.error };

    const data = result.data;
    const maintenanceDeadlines = data.registrationDate
      ? this.uspto.calculateMaintenanceDeadlines(data.registrationDate, data.currentStatus)
      : [];
    const nextDeadline = maintenanceDeadlines[0];

    const statusChanged = data.currentStatus !== tm.currentStatus;

    await db.trademarkDocket.update({
      where: { id: trademarkDocketId },
      data: {
        currentStatus: data.currentStatus, statusDate: data.statusDate,
        ownerName: data.ownerName, filingDate: data.filingDate,
        registrationDate: data.registrationDate, registrationNumber: data.registrationNumber,
        nextDeadlineType: nextDeadline?.type, nextDeadlineDate: nextDeadline?.dueDate,
        lastChecked: new Date(), lastStatusChange: statusChanged ? new Date() : undefined,
        prosecutionHistory: data.prosecutionHistory as any,
      },
    });

    await db.docketingAuditLog.create({
      data: { matterId: tm.matterId, action: "STATUS_POLLED", source: "USPTO", outputData: { serialNumber: tm.serialNumber, status: data.currentStatus } as any },
    });

    return { status: data };
  }

  async getDeadlineDigest(): Promise<DeadlineDigest> {
    const now = new Date();
    const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const endOfWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const deadlines = await db.deadline.findMany({
      where: { status: "ACTIVE", dueDate: { lte: in30 } },
      include: { matter: true },
      orderBy: { dueDate: "asc" },
    });

    return {
      critical: deadlines.filter((d) => d.dueDate <= in14 || d.dueDate < now).map((d) => ({ deadline: d, matter: d.matter })),
      upcoming: deadlines.filter((d) => d.dueDate > in14 && d.dueDate <= in30).map((d) => ({ deadline: d, matter: d.matter })),
      thisWeek: deadlines.filter((d) => d.dueDate <= endOfWeek).map((d) => ({ deadline: d, matter: d.matter })),
      today: deadlines.filter((d) => d.dueDate <= endOfDay).map((d) => ({ deadline: d, matter: d.matter })),
    };
  }

  async recalculatePriorities(): Promise<{ updated: number }> {
    const now = new Date();
    const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const critical = await db.deadline.updateMany({
      where: { status: "ACTIVE", dueDate: { lte: in14 }, priority: { not: "CRITICAL" } },
      data: { priority: "CRITICAL" },
    });
    const upcoming = await db.deadline.updateMany({
      where: { status: "ACTIVE", dueDate: { gt: in14, lte: in30 }, priority: { not: "UPCOMING" } },
      data: { priority: "UPCOMING" },
    });
    const scheduled = await db.deadline.updateMany({
      where: { status: "ACTIVE", dueDate: { gt: in30 }, priority: { not: "SCHEDULED" } },
      data: { priority: "SCHEDULED" },
    });
    // Mark missed
    await db.deadline.updateMany({
      where: { status: "ACTIVE", dueDate: { lt: now } },
      data: { status: "MISSED" },
    });

    return { updated: critical.count + upcoming.count + scheduled.count };
  }

  private calculatePriority(dueDate: Date): "CRITICAL" | "UPCOMING" | "SCHEDULED" {
    const now = new Date();
    const daysOut = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysOut <= 14) return "CRITICAL";
    if (daysOut <= 30) return "UPCOMING";
    return "SCHEDULED";
  }
}
