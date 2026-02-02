// Shared types and utilities

export type ClientStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
export type MatterStatus = 'OPEN' | 'CLOSED' | 'PENDING';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  status: ClientStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface Matter {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  matterNumber: string;
  status: MatterStatus;
  practiceArea: string | null;
  openDate: Date;
  closeDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
