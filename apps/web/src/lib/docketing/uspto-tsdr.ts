import type { TrademarkStatus, ServiceResult } from "./types";

export class UsptoTsdrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.USPTO_TSDR_BASE_URL || "https://tsdrapi.uspto.gov";
    this.apiKey = process.env.USPTO_API_KEY || "";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private headers() {
    const h: Record<string, string> = { Accept: "application/json" };
    if (this.apiKey) h["USPTO-API-KEY"] = this.apiKey;
    return h;
  }

  async getStatusBySerial(serialNumber: string): Promise<ServiceResult<TrademarkStatus>> {
    const sn = serialNumber.replace(/\D/g, "");
    try {
      const res = await fetch(`${this.baseUrl}/ts/cd/casestatus/sn${sn}/info.json`, { headers: this.headers() });
      if (!res.ok) {
        // Try HTML endpoint as fallback
        return { success: false, error: `USPTO TSDR returned ${res.status}. ${!this.apiKey ? "Note: No USPTO_API_KEY configured." : ""}` };
      }
      const data = await res.json();
      const tm = data.trademarkBag?.trademark || data;
      return {
        success: true,
        data: {
          serialNumber: sn,
          registrationNumber: tm.registrationNumber || tm.reg_number,
          markName: tm.markVerbalElementText || tm.mark_name || "Unknown",
          currentStatus: tm.markCurrentStatusExternalDescriptionText || tm.status || "Unknown",
          statusDate: tm.markCurrentStatusDate ? new Date(tm.markCurrentStatusDate) : undefined,
          ownerName: tm.applicantName || tm.owner,
          filingDate: tm.applicationDate ? new Date(tm.applicationDate) : undefined,
          registrationDate: tm.registrationDate ? new Date(tm.registrationDate) : undefined,
          nextDeadlineType: undefined,
          nextDeadlineDate: undefined,
          prosecutionHistory: (tm.prosecutionHistory || []).map((e: any) => ({
            date: e.date || e.entryDate,
            action: e.action || e.code,
            description: e.description || e.text || "",
          })),
        },
      };
    } catch (err: any) {
      return { success: false, error: `USPTO fetch error: ${err.message}` };
    }
  }

  async getDocuments(serialNumber: string): Promise<ServiceResult<any[]>> {
    const sn = serialNumber.replace(/\D/g, "");
    try {
      const res = await fetch(`${this.baseUrl}/ts/cd/casedocs/sn${sn}/docs.json`, { headers: this.headers() });
      if (!res.ok) return { success: true, data: [] }; // 404 is normal for pending apps
      const data = await res.json();
      const docs = (data.documentBag?.document || data.docs || []).map((d: any) => ({
        id: d.documentIdentifier || d.id,
        description: d.documentDescription || d.description || "Document",
        date: d.documentDate || d.date,
        url: `https://tsdr.uspto.gov/documentviewer?caseId=sn${sn}&docId=${d.documentIdentifier || d.id}`,
      }));
      return { success: true, data: docs };
    } catch {
      return { success: true, data: [] };
    }
  }

  async getFullStatus(serialNumber: string): Promise<ServiceResult<TrademarkStatus & { ownerAddress?: string; attorneyOfRecord?: string; internationalClasses?: string; publicationDate?: Date; documents?: any[] }>> {
    const statusResult = await this.getStatusBySerial(serialNumber);
    if (!statusResult.success || !statusResult.data) return statusResult as any;

    const docsResult = await this.getDocuments(serialNumber);
    const sn = serialNumber.replace(/\D/g, "");

    // Re-fetch to get additional fields from raw response
    try {
      const res = await fetch(`${this.baseUrl}/ts/cd/casestatus/sn${sn}/info.json`, { headers: this.headers() });
      if (res.ok) {
        const raw = await res.json();
        const tm = raw.trademarkBag?.trademark || raw;
        return {
          success: true,
          data: {
            ...statusResult.data,
            ownerAddress: tm.applicantAddress || tm.ownerAddress || undefined,
            attorneyOfRecord: tm.attorneyName || tm.attorney || undefined,
            internationalClasses: (tm.classificationBag?.classification || tm.classes || [])
              .map((c: any) => c.classNumber || c.class_number || c).filter(Boolean).join(", "),
            publicationDate: tm.publicationDate ? new Date(tm.publicationDate) : undefined,
            documents: docsResult.data || [],
          },
        };
      }
    } catch {}

    return { success: true, data: { ...statusResult.data, documents: docsResult.data || [] } } as any;
  }

  async getStatusByRegistration(regNumber: string): Promise<ServiceResult<TrademarkStatus>> {
    const rn = regNumber.replace(/\D/g, "");
    try {
      const res = await fetch(`${this.baseUrl}/ts/cd/casestatus/rn${rn}/info.json`, { headers: this.headers() });
      if (!res.ok) return { success: false, error: `USPTO TSDR returned ${res.status}` };
      const data = await res.json();
      // Reuse serial parsing logic
      return this.getStatusBySerial(data.trademarkBag?.trademark?.serialNumber || rn);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  calculateMaintenanceDeadlines(registrationDate: Date, currentStatus: string): Array<{
    type: string; dueDate: Date; gracePeriodEnd: Date; description: string;
  }> {
    const deadlines: Array<{ type: string; dueDate: Date; gracePeriodEnd: Date; description: string }> = [];
    const regDate = new Date(registrationDate);
    const now = new Date();

    // Section 8 (Declaration of Use): years 5-6, then every 10 years
    const sec8Year5 = new Date(regDate); sec8Year5.setFullYear(sec8Year5.getFullYear() + 5);
    const sec8Year6 = new Date(regDate); sec8Year6.setFullYear(sec8Year6.getFullYear() + 6);
    if (sec8Year6 > now) {
      const grace = new Date(sec8Year6); grace.setMonth(grace.getMonth() + 6);
      deadlines.push({ type: "Section 8", dueDate: sec8Year6, gracePeriodEnd: grace, description: "Declaration of Use — due between year 5 and year 6 after registration" });
    }

    // Section 9 (Renewal): every 10 years
    for (let y = 10; y <= 100; y += 10) {
      const renewalDate = new Date(regDate); renewalDate.setFullYear(renewalDate.getFullYear() + y);
      if (renewalDate > now) {
        const grace = new Date(renewalDate); grace.setMonth(grace.getMonth() + 6);
        deadlines.push({ type: "Section 9", dueDate: renewalDate, gracePeriodEnd: grace, description: `Renewal — due ${y} years after registration` });
        break; // Only show next upcoming
      }
    }

    // Section 15 (Incontestability): after 5 years of continuous use
    if (currentStatus === "REGISTERED") {
      const sec15 = new Date(regDate); sec15.setFullYear(sec15.getFullYear() + 5);
      if (sec15 > now) {
        deadlines.push({ type: "Section 15", dueDate: sec15, gracePeriodEnd: sec15, description: "Incontestability — available after 5 consecutive years of use" });
      }
    }

    return deadlines;
  }

  calculateOfficeActionDeadline(issueDate: Date): {
    initialDeadline: Date; extendedDeadline: Date; description: string;
  } {
    const initial = new Date(issueDate); initial.setMonth(initial.getMonth() + 3);
    const extended = new Date(issueDate); extended.setMonth(extended.getMonth() + 6);
    return { initialDeadline: initial, extendedDeadline: extended, description: "Office Action Response — 3 months (extendable to 6 months with fee)" };
  }

  calculateSouDeadline(noaDate: Date): {
    initialDeadline: Date; maxExtensionDate: Date; description: string;
  } {
    const initial = new Date(noaDate); initial.setMonth(initial.getMonth() + 6);
    const max = new Date(noaDate); max.setMonth(max.getMonth() + 36);
    return { initialDeadline: initial, maxExtensionDate: max, description: "Statement of Use — 6 months from NOA (extendable up to 36 months total)" };
  }
}
