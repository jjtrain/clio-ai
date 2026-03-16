import type { CourtFilingResult, ServiceResult } from "./types";

export class CourtDriveClient {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = process.env.COURTDRIVE_API_URL || "https://api.courtdrive.com";
    this.apiKey = process.env.COURTDRIVE_API_KEY || "";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  private notConfiguredError(): ServiceResult<any> {
    return { success: false, error: "CourtDrive is not configured. Add COURTDRIVE_API_KEY to your environment variables." };
  }

  private headers() {
    return { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" };
  }

  async searchCase(court: string, caseNumber: string): Promise<ServiceResult<any>> {
    if (!this.isConfigured()) return this.notConfiguredError();
    try {
      const res = await fetch(`${this.baseUrl}/api/cases/search?court=${encodeURIComponent(court)}&case_number=${encodeURIComponent(caseNumber)}`, { headers: this.headers() });
      if (!res.ok) return { success: false, error: `Search failed: ${res.status}` };
      return { success: true, data: await res.json() };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async searchByParty(partyName: string, court?: string): Promise<ServiceResult<any[]>> {
    if (!this.isConfigured()) return this.notConfiguredError();
    try {
      const params = new URLSearchParams({ party_name: partyName });
      if (court) params.set("court", court);
      const res = await fetch(`${this.baseUrl}/api/cases/search?${params}`, { headers: this.headers() });
      if (!res.ok) return { success: false, error: `Search failed: ${res.status}` };
      const data = await res.json();
      return { success: true, data: Array.isArray(data) ? data : data.results || [] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getDocket(caseId: string): Promise<ServiceResult<CourtFilingResult[]>> {
    if (!this.isConfigured()) return this.notConfiguredError();
    try {
      const res = await fetch(`${this.baseUrl}/api/cases/${caseId}/docket`, { headers: this.headers() });
      if (!res.ok) return { success: false, error: `Docket fetch failed: ${res.status}` };
      const data = await res.json();
      const filings: CourtFilingResult[] = (data.entries || data || []).map((e: any) => ({
        docketEntryNum: e.entry_number || e.docketEntryNum,
        description: e.description || e.text,
        filedDate: new Date(e.filed_date || e.filedDate || e.date),
        documentUrl: e.document_url || e.documentUrl,
        externalId: e.id || e.externalId,
      }));
      return { success: true, data: filings };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getNewFilings(caseId: string, since: Date): Promise<ServiceResult<CourtFilingResult[]>> {
    if (!this.isConfigured()) return this.notConfiguredError();
    try {
      const res = await fetch(`${this.baseUrl}/api/cases/${caseId}/docket?since=${since.toISOString()}`, { headers: this.headers() });
      if (!res.ok) return { success: false, error: `Fetch failed: ${res.status}` };
      const data = await res.json();
      return { success: true, data: (data.entries || data || []).map((e: any) => ({
        docketEntryNum: e.entry_number,
        description: e.description || e.text,
        filedDate: new Date(e.filed_date || e.date),
        documentUrl: e.document_url,
        externalId: e.id,
      })) };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async monitorCase(court: string, caseNumber: string): Promise<ServiceResult<{ courtDriveId: string }>> {
    if (!this.isConfigured()) return this.notConfiguredError();
    try {
      const res = await fetch(`${this.baseUrl}/api/monitors`, {
        method: "POST", headers: this.headers(),
        body: JSON.stringify({ court, case_number: caseNumber }),
      });
      if (!res.ok) return { success: false, error: `Monitor setup failed: ${res.status}` };
      const data = await res.json();
      return { success: true, data: { courtDriveId: data.id || data.monitor_id || `cd_${Date.now()}` } };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async unmonitorCase(courtDriveId: string): Promise<ServiceResult<void>> {
    if (!this.isConfigured()) return this.notConfiguredError();
    try {
      await fetch(`${this.baseUrl}/api/monitors/${courtDriveId}`, { method: "DELETE", headers: this.headers() });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
