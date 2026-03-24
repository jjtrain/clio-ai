import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";

async function main() {
  console.log("Seeding assembly snippets...");
  const snippets = [
    { name: "iola_trust_disclosure", category: "disclaimer", content: "<p>Client retainer funds are maintained in an Interest on Lawyer Account (IOLA) in compliance with Rule 1.15 of the New York Rules of Professional Conduct. Interest earned on these funds is remitted to the Interest on Lawyer Account Fund of the State of New York.</p>" },
    { name: "litigation_rider", category: "rider", practiceArea: "family_law", content: "<p><strong>LITIGATION RIDER:</strong> In the event that this matter proceeds to litigation, the following additional terms apply: All court appearances, motion practice, trial preparation, and trial time will be billed at the hourly rates set forth in this agreement. The retainer balance shall be replenished to the minimum amount specified above before any court appearance.</p>" },
    { name: "contingency_fee_disclosure", category: "disclaimer", practiceArea: "personal_injury", content: "<p><strong>CONTINGENCY FEE DISCLOSURE:</strong> You (the client) are not obligated to sign this retainer agreement. You may consult another attorney. If you sign this agreement, you have the right to end the attorney-client relationship at any time, subject to your obligation to pay for legal services already rendered and expenses incurred.</p>" },
    { name: "standard_confidentiality", category: "clause", content: "<p>All information shared between Attorney and Client in the course of this representation is confidential and protected by the attorney-client privilege. Attorney will not disclose confidential information without Client's informed written consent, except as required by law or the Rules of Professional Conduct.</p>" },
    { name: "standard_signature_block", category: "signature_block", content: "<div style='margin-top:40px'><p>___________________________<br/>{{firm.name}}<br/>By: {{attorney.fullName}}<br/>Attorney for {{client.fullName}}</p><p style='margin-top:30px'>___________________________<br/>{{client.fullName}}<br/>Client</p><p>Date: _______________</p></div>" },
  ];
  for (const s of snippets) {
    await prisma.assemblySnippet.create({ data: { ...s, isSystem: true, firmId: FIRM_ID } });
  }
  console.log(`Seeded ${snippets.length} snippets.`);

  console.log("Seeding lookup tables...");
  await prisma.assemblyLookupTable.create({
    data: {
      name: "NY County Fee Schedule", lookupKey: "county", practiceArea: "family_law",
      entries: [
        { key: "nassau", values: { flatFee: 5000, hourlyRate: 450, filingFee: 210, retainerMinimum: 2500 } },
        { key: "queens", values: { flatFee: 3500, hourlyRate: 375, filingFee: 210, retainerMinimum: 2000 } },
        { key: "suffolk", values: { flatFee: 4500, hourlyRate: 425, filingFee: 210, retainerMinimum: 2500 } },
        { key: "kings", values: { flatFee: 4000, hourlyRate: 400, filingFee: 210, retainerMinimum: 2000 } },
        { key: "new_york", values: { flatFee: 5500, hourlyRate: 500, filingFee: 210, retainerMinimum: 3000 } },
      ],
      defaultEntry: { flatFee: 4000, hourlyRate: 400, filingFee: 210, retainerMinimum: 2500 },
      firmId: FIRM_ID,
    },
  });

  await prisma.assemblyLookupTable.create({
    data: {
      name: "PI Filing Fees by Court", lookupKey: "court_type",
      entries: [
        { key: "supreme", values: { filingFee: 210, rji: 95, indexPurchase: 45 } },
        { key: "district", values: { filingFee: 45, rji: 0, indexPurchase: 0 } },
        { key: "city", values: { filingFee: 45, rji: 0, indexPurchase: 0 } },
        { key: "federal", values: { filingFee: 402, rji: 0, indexPurchase: 0 } },
      ],
      firmId: FIRM_ID,
    },
  });
  console.log("Seeded 2 lookup tables.");

  console.log("Seeding assembly templates...");

  // Family Law Retainer
  await prisma.assemblyTemplate.create({
    data: {
      name: "Family Law Retainer Agreement — New York",
      description: "Complete retainer agreement for family/matrimonial matters with county-specific fee schedules and contested/uncontested variants",
      documentType: "retainer", practiceArea: "family_law", jurisdiction: "ny", status: "active",
      content: `<h1 style="text-align:center">RETAINER AGREEMENT</h1>
<p style="text-align:center">{{firm.name}}</p>
<p>Date: {{dates.todayLong}}</p>
<p>This agreement is between <strong>{{firm.name}}</strong> ("Attorney") and <strong>{{client.fullName}}</strong> ("Client") regarding legal representation in the matter of <strong>{{matter.name}}</strong>.</p>

<h2>1. SCOPE OF REPRESENTATION</h2>
{% if custom.matterType == "contested" %}
<p>Attorney agrees to represent Client in a <strong>contested</strong> matrimonial action, including but not limited to: filing or responding to a complaint for divorce, negotiation of a settlement agreement, motion practice, court appearances, discovery, and trial if necessary.</p>
{% else %}
<p>Attorney agrees to represent Client in an <strong>uncontested</strong> divorce proceeding, including preparation and filing of all necessary documents with the court.</p>
{% endif %}

<h2>2. FEES</h2>
{% if custom.matterType == "contested" %}
<p>Client agrees to pay Attorney at the rate of <strong>{{billing.hourlyRate | currency}}</strong> per hour for all legal services rendered. A retainer deposit of <strong>{{billing.retainerAmount | currency}}</strong> is required upon signing this agreement.</p>
{% else %}
<p>Client agrees to pay a flat fee of <strong>{{billing.flatFee | currency}}</strong> for all services described in Section 1. This fee includes the court filing fee of $210.00.</p>
{% endif %}

<h2>3. RETAINER AND BILLING</h2>
<p>{% snippet "iola_trust_disclosure" %}</p>

{% if custom.matterType == "contested" %}
<p>{% snippet "litigation_rider" %}</p>
{% endif %}

<h2>4. CONFIDENTIALITY</h2>
<p>{% snippet "standard_confidentiality" %}</p>

<h2>5. SIGNATURES</h2>
{% snippet "standard_signature_block" %}`,
      mergeFieldSchema: [
        { fieldKey: "client.fullName", label: "Client Full Name", source: "client", dataType: "text", isRequired: true },
        { fieldKey: "matter.name", label: "Matter Name", source: "matter", dataType: "text", isRequired: true },
        { fieldKey: "firm.name", label: "Firm Name", source: "firm", dataType: "text", isRequired: true },
        { fieldKey: "billing.hourlyRate", label: "Hourly Rate", source: "billing", dataType: "number" },
        { fieldKey: "billing.flatFee", label: "Flat Fee", source: "billing", dataType: "number" },
        { fieldKey: "billing.retainerAmount", label: "Retainer Amount", source: "billing", dataType: "number" },
        { fieldKey: "dates.todayLong", label: "Today's Date", source: "dates", dataType: "date" },
        { fieldKey: "custom.matterType", label: "Matter Type (contested/uncontested)", source: "custom_fields", dataType: "text" },
      ],
      conditionalRules: [
        { ruleId: "contested", field: "custom.matterType", operator: "==", value: "contested", action: "include", targetBlockId: "contested_scope" },
      ],
      signatureBlocks: [{ role: "attorney", label: "Attorney" }, { role: "client", label: "Client" }],
      isSystemTemplate: true, firmId: FIRM_ID,
    },
  });

  // PI Demand Letter
  await prisma.assemblyTemplate.create({
    data: {
      name: "PI Demand Letter — Auto Accident",
      description: "Demand letter for personal injury auto accident cases with liability and damages sections",
      documentType: "demand_letter", practiceArea: "personal_injury", jurisdiction: "ny", status: "active",
      content: `<p>{{dates.todayLong}}</p>
<p>VIA CERTIFIED MAIL — RETURN RECEIPT REQUESTED</p>
<p>{{insurance.adjusterName}}<br/>{{insurance.carrierName}}<br/>Re: Our Client: {{client.fullName}}<br/>Claim No: {{insurance.claimNumber}}<br/>Date of Loss: {{custom.accidentDate}}</p>
<p>Dear {{insurance.adjusterName}}:</p>
<p>This firm represents {{client.fullName}} in connection with injuries sustained in an automobile accident on {{custom.accidentDate}}. We write to present a demand for fair and reasonable compensation.</p>

<h3>LIABILITY</h3>
<p>On {{custom.accidentDate}}, our client was involved in an automobile accident caused by the negligence of your insured. The police report (Incident No. {{custom.policeReportNumber}}) confirms that your insured was at fault.</p>

<h3>INJURIES AND TREATMENT</h3>
<p>As a result of this accident, our client sustained the following injuries: {{custom.injuries}}</p>
<p>Our client has been treated by the following medical providers and has incurred the following expenses:</p>
<p><strong>Total Medical Specials: {{billing.totalSpecials | currency}}</strong></p>

{% if custom.lostWages > 0 %}
<h3>LOST WAGES</h3>
<p>Our client was unable to work for {{custom.weeksOut}} weeks, resulting in lost wages of {{custom.lostWages | currency}}.</p>
{% endif %}

<h3>DEMAND</h3>
<p>Based on the foregoing, we demand the total sum of <strong>{{custom.demandAmount | currency}}</strong> in full and final settlement of all claims.</p>
<p>Please respond within thirty (30) days. Failure to respond will result in the commencement of litigation.</p>
<p>Very truly yours,</p>
<p>{{attorney.fullName}}<br/>{{firm.name}}</p>`,
      mergeFieldSchema: [
        { fieldKey: "client.fullName", label: "Client Name", source: "client", dataType: "text", isRequired: true },
        { fieldKey: "firm.name", label: "Firm Name", source: "firm", dataType: "text", isRequired: true },
        { fieldKey: "attorney.fullName", label: "Attorney Name", source: "attorney", dataType: "text" },
        { fieldKey: "insurance.adjusterName", label: "Adjuster Name", source: "insurance", dataType: "text" },
        { fieldKey: "insurance.carrierName", label: "Insurance Carrier", source: "insurance", dataType: "text" },
        { fieldKey: "insurance.claimNumber", label: "Claim Number", source: "insurance", dataType: "text" },
        { fieldKey: "custom.accidentDate", label: "Accident Date", source: "custom_fields", dataType: "date" },
        { fieldKey: "custom.injuries", label: "Injuries Description", source: "custom_fields", dataType: "text" },
        { fieldKey: "custom.demandAmount", label: "Demand Amount", source: "custom_fields", dataType: "number" },
        { fieldKey: "custom.lostWages", label: "Lost Wages", source: "custom_fields", dataType: "number" },
        { fieldKey: "custom.weeksOut", label: "Weeks Out of Work", source: "custom_fields", dataType: "number" },
        { fieldKey: "billing.totalSpecials", label: "Total Specials", source: "billing", dataType: "number" },
        { fieldKey: "dates.todayLong", label: "Today's Date", source: "dates", dataType: "date" },
      ],
      isSystemTemplate: true, firmId: FIRM_ID,
    },
  });

  // Immigration Cover Letter
  await prisma.assemblyTemplate.create({
    data: {
      name: "Immigration — USCIS Filing Cover Letter",
      description: "Cover letter template for USCIS petition filings with form-specific variants",
      documentType: "letter", practiceArea: "immigration", jurisdiction: "any", status: "active",
      content: `<p>{{dates.todayLong}}</p>
<p>U.S. Citizenship and Immigration Services<br/>{{custom.uscisServiceCenter}}</p>
<p>Re: {{custom.formNumber}} Petition<br/>Petitioner: {{client.fullName}}<br/>{% if custom.alienNumber is_not_empty %}A#: {{custom.alienNumber}}{% endif %}</p>
<p>Dear Sir or Madam:</p>
<p>Enclosed please find the {{custom.formNumber}} petition filed on behalf of {{client.fullName}}.</p>
<p><strong>Enclosed Documents:</strong></p>
<ul>
<li>Form {{custom.formNumber}} with all required supplements</li>
<li>Filing fee: {{custom.filingFee | currency}} (check enclosed)</li>
{% if custom.formNumber == "I-485" %}
<li>Form I-693 (Medical Examination)</li>
<li>Form I-864 (Affidavit of Support)</li>
<li>Copy of birth certificate with translation</li>
<li>Copy of passport biographical page</li>
<li>Two passport-style photographs</li>
{% elif custom.formNumber == "I-130" %}
<li>Evidence of petitioner's U.S. citizenship or permanent residency</li>
<li>Evidence of bona fide marriage (if applicable)</li>
<li>Passport-style photographs of petitioner and beneficiary</li>
{% endif %}
</ul>
<p>Please do not hesitate to contact our office with any questions.</p>
<p>Respectfully submitted,</p>
<p>{{attorney.fullName}}<br/>{{firm.name}}</p>`,
      mergeFieldSchema: [
        { fieldKey: "client.fullName", label: "Client/Petitioner Name", source: "client", dataType: "text", isRequired: true },
        { fieldKey: "firm.name", label: "Firm Name", source: "firm", dataType: "text" },
        { fieldKey: "attorney.fullName", label: "Attorney Name", source: "attorney", dataType: "text" },
        { fieldKey: "custom.formNumber", label: "USCIS Form Number (I-485, I-130, etc.)", source: "custom_fields", dataType: "text", isRequired: true },
        { fieldKey: "custom.alienNumber", label: "Alien Number", source: "custom_fields", dataType: "text" },
        { fieldKey: "custom.uscisServiceCenter", label: "USCIS Service Center", source: "custom_fields", dataType: "text" },
        { fieldKey: "custom.filingFee", label: "Filing Fee", source: "custom_fields", dataType: "number" },
        { fieldKey: "dates.todayLong", label: "Today's Date", source: "dates", dataType: "date" },
      ],
      isSystemTemplate: true, firmId: FIRM_ID,
    },
  });

  console.log("Seeded 3 assembly templates.");
  console.log("Document assembly seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
