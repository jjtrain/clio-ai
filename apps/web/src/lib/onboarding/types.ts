export interface MatterTemplate { name: string; description: string; defaultStatus: string; }
export interface CustomField { name: string; type: "text" | "date" | "select" | "boolean" | "currency"; required: boolean; placeholder?: string; options?: string[]; }
export interface DocTemplate { name: string; description: string; category: "retainer" | "letter" | "agreement" | "form" | "motion" | "checklist"; }
export interface BillingConfig { hourlyRateRange: [number, number]; flatFees: Array<{ name: string; amount: number }>; billingCodes: Array<{ code: string; description: string }>; feeType: "hourly" | "contingency" | "flat" | "hybrid"; contingencyPct?: number; }
export interface Integration { name: string; description: string; category: string; }
export interface WorkflowTask { title: string; description: string; dueDaysFromOpen: number; }
export interface Workflow { name: string; description: string; tasks: WorkflowTask[]; }

export interface PracticeAreaConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  matterTemplates: MatterTemplate[];
  customFields: CustomField[];
  docTemplates: DocTemplate[];
  billing: BillingConfig;
  integrations: Integration[];
  workflows: Workflow[];
}
