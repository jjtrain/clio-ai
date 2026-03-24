// Base adapter interface for all e-filing systems

export interface FilingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FeeEstimate {
  fee: number;
  breakdown: Array<{ label: string; amount: number }>;
}

export interface SubmissionResult {
  success: boolean;
  externalFilingId?: string;
  confirmationNumber?: string;
  error?: string;
  rawResponse?: any;
}

export interface FilingStatusResult {
  status: string;
  confirmationNumber?: string;
  rejectionReason?: string;
  receiptUrl?: string;
  stampedDocUrls?: any[];
}

export abstract class EFilingAdapter {
  abstract get systemCode(): string;

  abstract verifyCredentials(credential: any): Promise<{ success: boolean; error?: string }>;
  abstract lookupCase(params: { courtCode: string; caseNumber: string; credential: any }): Promise<{ found: boolean; caseData?: any }>;
  abstract validateFiling(filing: any, documents: any[]): Promise<FilingValidationResult>;
  abstract estimateFee(filing: any, documents: any[], credential: any): Promise<FeeEstimate>;
  abstract submitFiling(filing: any, documents: any[], credential: any): Promise<SubmissionResult>;
  abstract getFilingStatus(filing: any, credential: any): Promise<FilingStatusResult>;
}
