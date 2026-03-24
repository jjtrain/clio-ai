export interface CourtEventData {
  externalId: string;
  eventType: "HEARING" | "FILING_DEADLINE" | "CONFERENCE" | "TRIAL" | "MOTION" | "JUDGMENT" | "ORDER";
  title: string;
  courtName?: string;
  judgeAssigned?: string;
  caseNumber?: string;
  scheduledAt: Date;
  endTime?: Date;
  location?: string;
  notes?: string;
}

export interface CourtAdapter {
  name: string;
  fetchEvents(caseNumber: string, credentials?: any): Promise<CourtEventData[]>;
  validateCredentials(credentials: any): Promise<boolean>;
}
