import type { CalculatedDeadline, ServiceResult } from "./types";

export class LawToolBoxClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor() {
    this.baseUrl = process.env.LAWTOOLBOX_API_URL || "https://api.lawtoolbox.com";
    this.clientId = process.env.LAWTOOLBOX_CLIENT_ID || "";
    this.clientSecret = process.env.LAWTOOLBOX_CLIENT_SECRET || "";
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret);
  }

  private notConfiguredError(): ServiceResult<any> {
    return { success: false, error: "LawToolBox is not configured. Add LAWTOOLBOX_CLIENT_ID and LAWTOOLBOX_CLIENT_SECRET to your environment variables." };
  }

  async authenticate(): Promise<ServiceResult<void>> {
    if (!this.isConfigured()) return this.notConfiguredError();

    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return { success: true };
    }

    try {
      const res = await fetch(`${this.baseUrl}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }),
      });

      if (!res.ok) return { success: false, error: `Authentication failed: ${res.status}` };
      const data = await res.json();
      this.accessToken = data.access_token;
      this.tokenExpiry = new Date(Date.now() + (data.expires_in || 3600) * 1000);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: `Authentication error: ${err.message}` };
    }
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" };
  }

  async getRulesets(): Promise<ServiceResult<Array<{ id: string; name: string; jurisdiction: string }>>> {
    if (!this.isConfigured()) return this.notConfiguredError();
    const auth = await this.authenticate();
    if (!auth.success) return auth as any;

    try {
      const res = await fetch(`${this.baseUrl}/api/rulesets`, { headers: this.authHeaders() });
      if (!res.ok) return { success: false, error: `Failed to fetch rulesets: ${res.status}` };
      const data = await res.json();
      return { success: true, data: Array.isArray(data) ? data : data.rulesets || [] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async getTriggers(rulesetId: string): Promise<ServiceResult<Array<{ id: string; name: string; description: string }>>> {
    if (!this.isConfigured()) return this.notConfiguredError();
    const auth = await this.authenticate();
    if (!auth.success) return auth as any;

    try {
      const res = await fetch(`${this.baseUrl}/api/rulesets/${rulesetId}/triggers`, { headers: this.authHeaders() });
      if (!res.ok) return { success: false, error: `Failed to fetch triggers: ${res.status}` };
      const data = await res.json();
      return { success: true, data: Array.isArray(data) ? data : data.triggers || [] };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async calculateDeadlines(params: {
    rulesetId: string;
    triggerId: string;
    triggerDate: Date;
    methodOfService?: string;
  }): Promise<ServiceResult<CalculatedDeadline[]>> {
    if (!this.isConfigured()) return this.notConfiguredError();
    const auth = await this.authenticate();
    if (!auth.success) return auth as any;

    try {
      const res = await fetch(`${this.baseUrl}/api/calculate`, {
        method: "POST",
        headers: this.authHeaders(),
        body: JSON.stringify({
          ruleset_id: params.rulesetId,
          trigger_id: params.triggerId,
          trigger_date: params.triggerDate.toISOString().split("T")[0],
          method_of_service: params.methodOfService,
        }),
      });

      if (!res.ok) return { success: false, error: `Calculation failed: ${res.status}` };
      const data = await res.json();
      const deadlines: CalculatedDeadline[] = (data.deadlines || data || []).map((d: any) => ({
        title: d.title || d.name || d.description,
        description: d.description,
        dueDate: new Date(d.due_date || d.dueDate),
        ruleAuthority: d.rule_authority || d.ruleAuthority || d.rule,
        triggerDate: params.triggerDate,
        triggerType: d.trigger_type || params.triggerId,
        consequenceOfMissing: d.consequence || d.consequenceOfMissing,
        category: d.category,
      }));
      return { success: true, data: deadlines };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
