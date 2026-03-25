export interface MigrationContact { id: string; firstName: string; lastName: string; email?: string; phone?: string; type: "client" | "lead"; createdAt?: string; }
export interface MigrationMatter { id: string; name: string; status: string; clientId?: string; practiceArea?: string; openDate?: string; closeDate?: string; }
export interface MigrationDocument { id: string; matterId?: string; name: string; fileUrl?: string; mimeType?: string; uploadedAt?: string; }
export interface MigrationInvoice { id: string; matterId?: string; clientId?: string; amount: number; status: "draft" | "sent" | "paid"; dueDate?: string; issuedAt?: string; }

export interface ProviderAdapter {
  name: string;
  authenticate(credentials: any): Promise<{ accessToken: string; refreshToken?: string }>;
  fetchContacts(token: string, opts?: { limit?: number }): Promise<MigrationContact[]>;
  fetchMatters(token: string, opts?: { limit?: number }): Promise<MigrationMatter[]>;
  fetchDocuments(token: string, opts?: { limit?: number }): Promise<MigrationDocument[]>;
  fetchInvoices(token: string, opts?: { limit?: number }): Promise<MigrationInvoice[]>;
}

export interface FieldMapping { sourceField: string; destField: string; transform?: string; }
export interface MigrationResult { imported: number; skipped: number; failed: Array<{ sourceId: string; entityType: string; reason: string }>; }
