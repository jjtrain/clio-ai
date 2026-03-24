import { EFilingAdapter, type FilingValidationResult, type FeeEstimate, type SubmissionResult, type FilingStatusResult } from "./base-adapter";

const NYSCEF_COUNTY_CODES: Record<string, string> = {
  "NY-SUPREME-QUEENS": "28", "NY-SUPREME-KINGS": "11", "NY-SUPREME-NASSAU": "30",
  "NY-SUPREME-SUFFOLK": "35", "NY-SUPREME-NEWYORK": "60", "NY-SUPREME-BRONX": "3",
  "NY-SUPREME-RICHMOND": "31", "NY-FAMILY-QUEENS": "28F", "NY-FAMILY-KINGS": "11F",
};

export class NyscefAdapter extends EFilingAdapter {
  get systemCode() { return "NYSCEF"; }

  private getBaseUrl(): string {
    return process.env.NYSCEF_API_ENV === "production"
      ? "https://iapps.courts.state.ny.us/nyscef"
      : "https://iapps.courts.state.ny.us/nyscef-sandbox";
  }

  async verifyCredentials(credential: any): Promise<{ success: boolean; error?: string }> {
    // Simulate NYSCEF login verification
    if (!credential.username || !credential.passwordEnc) return { success: false, error: "Username and password required" };
    // In production: POST /login with credentials, check response
    return { success: true };
  }

  async lookupCase(params: { courtCode: string; caseNumber: string; credential: any }): Promise<{ found: boolean; caseData?: any }> {
    const countyCode = NYSCEF_COUNTY_CODES[params.courtCode];
    if (!countyCode) return { found: false };
    // In production: GET /cases/{indexNumber} with session token
    return { found: true, caseData: { indexNumber: params.caseNumber, court: params.courtCode, countyCode } };
  }

  async validateFiling(filing: any, documents: any[]): Promise<FilingValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!filing.isNewCase && !filing.indexNumber) errors.push("Index number required for existing case filings");
    if (documents.length === 0) errors.push("At least one document required");
    if (!documents.some((d: any) => d.isLeadDocument)) errors.push("One document must be marked as lead document");

    for (const doc of documents) {
      if (doc.contentType !== "application/pdf" && !doc.fileName.endsWith(".tif")) {
        errors.push(`${doc.fileName}: NYSCEF only accepts PDF and TIF files`);
      }
      if (doc.fileSizeBytes > 25 * 1024 * 1024) errors.push(`${doc.fileName}: exceeds 25MB limit`);
    }

    if (filing.courtCode?.includes("SUPREME")) {
      warnings.push("NYSCEF e-filing is mandatory for Supreme Court civil cases in NYC counties");
    }

    return { valid: errors.length === 0, errors, warnings };
  }

  async estimateFee(filing: any, documents: any[], credential: any): Promise<FeeEstimate> {
    const breakdown: Array<{ label: string; amount: number }> = [];
    let total = 0;

    if (filing.isNewCase) {
      breakdown.push({ label: "Index Number Purchase", amount: 210 });
      total += 210;
    }

    if (filing.filingType === "NEW_CASE_COMPLAINT") {
      breakdown.push({ label: "Filing Fee (Supreme Court)", amount: 210 });
      total += 210;
    } else if (filing.filingType === "NOTICE_OF_MOTION") {
      breakdown.push({ label: "Motion Filing Fee", amount: 45 });
      total += 45;
    } else if (filing.filingType === "NOTE_OF_ISSUE") {
      breakdown.push({ label: "Note of Issue Fee", amount: 30 });
      breakdown.push({ label: "RJI Fee", amount: 95 });
      total += 125;
    }

    return { fee: total, breakdown };
  }

  async submitFiling(filing: any, documents: any[], credential: any): Promise<SubmissionResult> {
    // Simulate NYSCEF submission
    // In production: POST /filings/submit with multipart form
    const externalFilingId = `NYSCEF-${Date.now()}`;
    return { success: true, externalFilingId, confirmationNumber: `CF-${Math.random().toString(36).slice(2, 8).toUpperCase()}` };
  }

  async getFilingStatus(filing: any, credential: any): Promise<FilingStatusResult> {
    // Simulate status check
    // In production: GET /filings/{filingId}/status
    if (filing.statusCheckCount > 2) {
      return { status: "ACCEPTED", confirmationNumber: filing.confirmationNumber, receiptUrl: `/api/efiling/filings/${filing.id}/receipt` };
    }
    return { status: "PENDING_REVIEW" };
  }
}
