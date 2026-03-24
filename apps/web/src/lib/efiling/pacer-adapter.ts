import { EFilingAdapter, type FilingValidationResult, type FeeEstimate, type SubmissionResult, type FilingStatusResult } from "./base-adapter";

const DISTRICT_URLS: Record<string, string> = {
  EDNY: "https://ecf.nyed.uscourts.gov", SDNY: "https://ecf.nysd.uscourts.gov",
  NDNY: "https://ecf.nynd.uscourts.gov", WDNY: "https://ecf.nywd.uscourts.gov",
  "2CA": "https://ecf.ca2.uscourts.gov",
};

export class PacerCmecfAdapter extends EFilingAdapter {
  get systemCode() { return "PACER_CMECF"; }

  async verifyCredentials(credential: any): Promise<{ success: boolean; error?: string }> {
    if (!credential.username || !credential.passwordEnc) return { success: false, error: "PACER username and password required" };
    return { success: true };
  }

  async lookupCase(params: { courtCode: string; caseNumber: string; credential: any }): Promise<{ found: boolean; caseData?: any }> {
    return { found: true, caseData: { caseNumber: params.caseNumber, court: params.courtCode, url: DISTRICT_URLS[params.courtCode] } };
  }

  async validateFiling(filing: any, documents: any[]): Promise<FilingValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (documents.length === 0) errors.push("At least one document required");
    for (const doc of documents) {
      if (doc.contentType !== "application/pdf") errors.push(`${doc.fileName}: CM-ECF only accepts PDF files`);
      if (doc.fileSizeBytes > 50 * 1024 * 1024) errors.push(`${doc.fileName}: exceeds 50MB PACER limit`);
    }

    if (filing.isNewCase && filing.filingType === "NEW_CASE_COMPLAINT") {
      if (!documents.some((d: any) => d.documentType === "EXHIBIT" && d.title?.includes("Civil Cover"))) {
        warnings.push("New federal case filings typically require a Civil Cover Sheet (JS44)");
      }
    }

    warnings.push("PACER charges $0.10/page for docket access");
    return { valid: errors.length === 0, errors, warnings };
  }

  async estimateFee(filing: any, documents: any[], credential: any): Promise<FeeEstimate> {
    const breakdown: Array<{ label: string; amount: number }> = [];
    if (filing.isNewCase) { breakdown.push({ label: "Federal Filing Fee", amount: 402 }); }
    else if (filing.filingType === "NOTICE_OF_MOTION") { breakdown.push({ label: "Motion Fee", amount: 0 }); }
    return { fee: breakdown.reduce((s, b) => s + b.amount, 0), breakdown };
  }

  async submitFiling(filing: any, documents: any[], credential: any): Promise<SubmissionResult> {
    const externalFilingId = `PACER-${Date.now()}`;
    return { success: true, externalFilingId };
  }

  async getFilingStatus(filing: any, credential: any): Promise<FilingStatusResult> {
    if (filing.statusCheckCount > 3) return { status: "ACCEPTED", confirmationNumber: `NEF-${Math.random().toString(36).slice(2, 8).toUpperCase()}` };
    return { status: "SUBMITTED" };
  }
}
