export interface LegalSearchRequest {
  query: string;
  jurisdiction?: string;
  dateRange?: { from: string; to: string };
  resultLimit?: number;
  documentType?: string;
}

export interface LegalSearchResult {
  id: string;
  title: string;
  citation?: string;
  court?: string;
  year?: number;
  snippet: string;
  fullText?: string;
  url?: string;
  relevanceScore?: number;
  provider: string;
}

export interface DocketAlertPayload {
  externalId: string;
  alertType: string;
  caseNumber: string;
  courtName: string;
  title: string;
  description?: string;
  dueDate?: Date;
  filingDate?: Date;
  rawData: any;
}

export interface DiscoveryRequest {
  matterId: string;
  documentText: string;
  requestType: "interrogatory" | "rfa" | "rfp" | "rog";
  responseStrategy?: string;
}

export interface DiscoveryResponse {
  responses: Array<{
    requestNumber: number;
    requestText: string;
    response: string;
    objections?: string[];
  }>;
  provider: string;
}

export interface DeadlineResult {
  title: string;
  dueDate: Date;
  courtRule?: string;
  jurisdiction: string;
  eventType: string;
  source: string;
}

export interface ServiceError {
  success: false;
  error: string;
  provider: string;
}

export type ServiceResult<T> = { success: true; data: T; provider: string } | ServiceError;
