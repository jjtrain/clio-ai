export interface CalculatedDeadline {
  title: string;
  description?: string;
  dueDate: Date;
  ruleAuthority?: string;
  triggerDate: Date;
  triggerType: string;
  consequenceOfMissing?: string;
  category?: string;
}

export interface CourtFilingResult {
  docketEntryNum?: number;
  description: string;
  filedDate: Date;
  documentUrl?: string;
  externalId?: string;
}

export interface TrademarkStatus {
  serialNumber: string;
  registrationNumber?: string;
  markName: string;
  currentStatus: string;
  statusDate?: Date;
  ownerName?: string;
  filingDate?: Date;
  registrationDate?: Date;
  nextDeadlineType?: string;
  nextDeadlineDate?: Date;
  prosecutionHistory: Array<{ date: string; action: string; description: string }>;
}

export interface DeadlineDigest {
  critical: Array<{ deadline: any; matter: any }>;
  upcoming: Array<{ deadline: any; matter: any }>;
  thisWeek: Array<{ deadline: any; matter: any }>;
  today: Array<{ deadline: any; matter: any }>;
}

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
