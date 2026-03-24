export const RECIPE_TEMPLATES = [
  {
    id: "jotform-lead", name: "JotForm → New Lead",
    description: "When a contact form is submitted in JotForm, create a lead in Managal",
    platform: ["zapier", "make"], trigger: "JotForm: New Submission", action: "Managal: Create Lead",
    fieldMappings: [{ from: "name", to: "firstName + lastName" }, { from: "email", to: "email" }, { from: "phone", to: "phone" }, { from: "practice_area", to: "practiceArea" }],
  },
  {
    id: "typeform-lead", name: "Typeform → New Lead",
    description: "Convert Typeform intake responses into Managal leads automatically",
    platform: ["zapier", "make"], trigger: "Typeform: New Entry", action: "Managal: Create Lead",
    fieldMappings: [{ from: "Full Name", to: "firstName + lastName" }, { from: "Email Address", to: "email" }, { from: "Phone Number", to: "phone" }, { from: "Legal Issue", to: "notes" }],
  },
  {
    id: "mailchimp-sync", name: "New Client → Mailchimp Subscriber",
    description: "When a lead is converted to a client, add them to a Mailchimp audience",
    platform: ["zapier", "make"], trigger: "Managal: Lead Converted", action: "Mailchimp: Add/Update Subscriber",
    fieldMappings: [{ from: "email", to: "Email Address" }, { from: "firstName", to: "FNAME" }, { from: "lastName", to: "LNAME" }],
  },
  {
    id: "google-ads-lead", name: "Google Ads Lead Form → Managal Lead",
    description: "Capture Google Ads lead form submissions directly as Managal leads",
    platform: ["zapier"], trigger: "Google Ads: New Lead Form Entry", action: "Managal: Create Lead",
    fieldMappings: [{ from: "full_name", to: "firstName + lastName" }, { from: "email", to: "email" }, { from: "phone_number", to: "phone" }],
  },
  {
    id: "matter-to-sheet", name: "New Matter → Google Sheets Row",
    description: "Log every new matter to a Google Sheet for reporting or tracking",
    platform: ["zapier", "make"], trigger: "Managal: Matter Opened", action: "Google Sheets: Create Row",
    fieldMappings: [{ from: "matterName", to: "Matter Name" }, { from: "practiceArea", to: "Practice Area" }, { from: "clientName", to: "Client" }, { from: "openedAt", to: "Date Opened" }],
  },
  {
    id: "invoice-paid-slack", name: "Invoice Paid → Slack Notification",
    description: "Notify the team in Slack when an invoice is paid",
    platform: ["zapier", "make"], trigger: "Managal: Invoice Paid", action: "Slack: Send Channel Message",
    fieldMappings: [{ from: "clientName + amount", to: "Message text" }],
  },
];
