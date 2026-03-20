import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";

// ── Starter field definitions for all 7 practice areas ─────────────────────

const STARTER_FIELDS: Record<
  string,
  Array<{
    fieldName: string;
    fieldLabel: string;
    fieldType: string;
    fieldOptions?: string;
    placeholder?: string;
    isRequired?: boolean;
    displayOrder: number;
    section: string;
    helpText?: string;
    defaultValue?: string;
  }>
> = {
  real_estate: [
    // dates
    { fieldName: "closingDate", fieldLabel: "Closing Date", fieldType: "CFT_DATE", section: "dates", isRequired: true, displayOrder: 1, helpText: "Scheduled closing date for the transaction" },
    { fieldName: "contractDate", fieldLabel: "Contract Date", fieldType: "CFT_DATE", section: "dates", isRequired: true, displayOrder: 2, helpText: "Date the purchase/sale contract was executed" },
    { fieldName: "inspectionDeadline", fieldLabel: "Inspection Deadline", fieldType: "CFT_DATE", section: "dates", displayOrder: 3, helpText: "Last day for property inspections" },
    { fieldName: "financingDeadline", fieldLabel: "Financing Deadline", fieldType: "CFT_DATE", section: "dates", displayOrder: 4, helpText: "Deadline for buyer to secure financing" },
    { fieldName: "appraisalDeadline", fieldLabel: "Appraisal Deadline", fieldType: "CFT_DATE", section: "dates", displayOrder: 5, helpText: "Deadline for property appraisal" },
    // details
    { fieldName: "propertyAddress", fieldLabel: "Property Address", fieldType: "CFT_TEXTAREA", section: "details", isRequired: true, displayOrder: 6, placeholder: "Full property address" },
    { fieldName: "purchasePrice", fieldLabel: "Purchase Price", fieldType: "CFT_CURRENCY", section: "details", isRequired: true, displayOrder: 7, helpText: "Agreed purchase price" },
    { fieldName: "earnestMoney", fieldLabel: "Earnest Money Deposit", fieldType: "CFT_CURRENCY", section: "details", displayOrder: 8 },
    { fieldName: "propertyType", fieldLabel: "Property Type", fieldType: "CFT_SELECT", section: "details", displayOrder: 9, fieldOptions: JSON.stringify(["Residential", "Commercial", "Industrial", "Land", "Multi-Family", "Condominium"]) },
    { fieldName: "transactionType", fieldLabel: "Transaction Type", fieldType: "CFT_SELECT", section: "details", isRequired: true, displayOrder: 10, fieldOptions: JSON.stringify(["Purchase", "Sale", "Refinance", "Lease", "Short Sale", "Foreclosure"]) },
    { fieldName: "titleCompany", fieldLabel: "Title Company", fieldType: "CFT_TEXT", section: "details", displayOrder: 11, placeholder: "Name of title company" },
    { fieldName: "lender", fieldLabel: "Lender", fieldType: "CFT_TEXT", section: "details", displayOrder: 12, placeholder: "Mortgage lender name" },
    { fieldName: "loanAmount", fieldLabel: "Loan Amount", fieldType: "CFT_CURRENCY", section: "details", displayOrder: 13 },
    { fieldName: "mlsNumber", fieldLabel: "MLS Number", fieldType: "CFT_TEXT", section: "details", displayOrder: 14, placeholder: "MLS listing number" },
    { fieldName: "parcelId", fieldLabel: "Parcel ID / Tax ID", fieldType: "CFT_TEXT", section: "details", displayOrder: 15 },
    // parties
    { fieldName: "buyerName", fieldLabel: "Buyer Name", fieldType: "CFT_TEXT", section: "parties", displayOrder: 16 },
    { fieldName: "sellerName", fieldLabel: "Seller Name", fieldType: "CFT_TEXT", section: "parties", displayOrder: 17 },
    { fieldName: "buyerAgent", fieldLabel: "Buyer's Agent", fieldType: "CFT_TEXT", section: "parties", displayOrder: 18 },
    { fieldName: "sellerAgent", fieldLabel: "Seller's Agent", fieldType: "CFT_TEXT", section: "parties", displayOrder: 19 },
    // notes
    { fieldName: "specialConditions", fieldLabel: "Special Conditions", fieldType: "CFT_TEXTAREA", section: "notes", displayOrder: 20, placeholder: "Any special conditions or contingencies" },
    { fieldName: "titleIssues", fieldLabel: "Title Issues", fieldType: "CFT_TEXTAREA", section: "notes", displayOrder: 21 },
  ],

  criminal: [
    // case_info
    { fieldName: "caseNumber", fieldLabel: "Case Number", fieldType: "CFT_TEXT", section: "case_info", isRequired: true, displayOrder: 1, placeholder: "Court case number" },
    { fieldName: "charges", fieldLabel: "Charges", fieldType: "CFT_TEXTAREA", section: "case_info", isRequired: true, displayOrder: 2, helpText: "List all charges" },
    { fieldName: "chargeLevel", fieldLabel: "Charge Level", fieldType: "CFT_SELECT", section: "case_info", isRequired: true, displayOrder: 3, fieldOptions: JSON.stringify(["Infraction", "Misdemeanor", "Felony", "Federal"]) },
    { fieldName: "jurisdiction", fieldLabel: "Jurisdiction", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 4, placeholder: "Court jurisdiction" },
    { fieldName: "court", fieldLabel: "Court", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 5 },
    { fieldName: "judge", fieldLabel: "Judge", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 6 },
    { fieldName: "prosecutor", fieldLabel: "Prosecutor", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 7 },
    // dates
    { fieldName: "arrestDate", fieldLabel: "Arrest Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 8 },
    { fieldName: "arraignmentDate", fieldLabel: "Arraignment Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 9 },
    { fieldName: "preliminaryHearingDate", fieldLabel: "Preliminary Hearing Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 10 },
    { fieldName: "trialDate", fieldLabel: "Trial Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 11 },
    { fieldName: "sentencingDate", fieldLabel: "Sentencing Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 12 },
    // bail
    { fieldName: "bailAmount", fieldLabel: "Bail Amount", fieldType: "CFT_CURRENCY", section: "bail", displayOrder: 13 },
    { fieldName: "bailStatus", fieldLabel: "Bail Status", fieldType: "CFT_SELECT", section: "bail", displayOrder: 14, fieldOptions: JSON.stringify(["No Bail Set", "Posted", "Denied", "Released on Own Recognizance", "Pending"]) },
    { fieldName: "bailConditions", fieldLabel: "Bail Conditions", fieldType: "CFT_TEXTAREA", section: "bail", displayOrder: 15 },
    // outcome
    { fieldName: "plea", fieldLabel: "Plea", fieldType: "CFT_SELECT", section: "outcome", displayOrder: 16, fieldOptions: JSON.stringify(["Not Yet Entered", "Not Guilty", "Guilty", "No Contest", "Alford Plea"]) },
    { fieldName: "verdict", fieldLabel: "Verdict", fieldType: "CFT_SELECT", section: "outcome", displayOrder: 17, fieldOptions: JSON.stringify(["Pending", "Guilty", "Not Guilty", "Dismissed", "Reduced", "Mistrial"]) },
    { fieldName: "sentence", fieldLabel: "Sentence", fieldType: "CFT_TEXTAREA", section: "outcome", displayOrder: 18, helpText: "Details of the sentence if applicable" },
    // notes
    { fieldName: "priorRecord", fieldLabel: "Prior Record", fieldType: "CFT_BOOLEAN", section: "notes", displayOrder: 19 },
    { fieldName: "victimInvolved", fieldLabel: "Victim Involved", fieldType: "CFT_BOOLEAN", section: "notes", displayOrder: 20 },
    { fieldName: "evidenceNotes", fieldLabel: "Evidence Notes", fieldType: "CFT_TEXTAREA", section: "notes", displayOrder: 21 },
  ],

  family: [
    // case_info
    { fieldName: "caseType", fieldLabel: "Case Type", fieldType: "CFT_SELECT", section: "case_info", isRequired: true, displayOrder: 1, fieldOptions: JSON.stringify(["Divorce", "Custody", "Child Support", "Adoption", "Guardianship", "Paternity", "Domestic Violence", "Modification", "Prenuptial Agreement"]) },
    { fieldName: "caseNumber", fieldLabel: "Case Number", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 2 },
    { fieldName: "court", fieldLabel: "Court", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 3 },
    { fieldName: "judge", fieldLabel: "Judge", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 4 },
    { fieldName: "opposingParty", fieldLabel: "Opposing Party", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 5 },
    { fieldName: "opposingCounsel", fieldLabel: "Opposing Counsel", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 6 },
    // dates
    { fieldName: "marriageDate", fieldLabel: "Marriage Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 7 },
    { fieldName: "separationDate", fieldLabel: "Separation Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 8 },
    { fieldName: "filingDate", fieldLabel: "Filing Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 9 },
    { fieldName: "hearingDate", fieldLabel: "Hearing Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 10 },
    { fieldName: "trialDate", fieldLabel: "Trial Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 11 },
    // children
    { fieldName: "numberOfChildren", fieldLabel: "Number of Children", fieldType: "CFT_NUMBER", section: "children", displayOrder: 12 },
    { fieldName: "childrenNames", fieldLabel: "Children's Names & DOBs", fieldType: "CFT_TEXTAREA", section: "children", displayOrder: 13, helpText: "List each child's name and date of birth" },
    { fieldName: "custodyArrangement", fieldLabel: "Custody Arrangement", fieldType: "CFT_SELECT", section: "children", displayOrder: 14, fieldOptions: JSON.stringify(["Sole - Client", "Sole - Other Party", "Joint", "Split", "Pending", "Not Applicable"]) },
    { fieldName: "childSupportAmount", fieldLabel: "Child Support Amount", fieldType: "CFT_CURRENCY", section: "children", displayOrder: 15 },
    { fieldName: "childSupportPayor", fieldLabel: "Child Support Payor", fieldType: "CFT_SELECT", section: "children", displayOrder: 16, fieldOptions: JSON.stringify(["Client", "Opposing Party", "Not Applicable"]) },
    // financial
    { fieldName: "spousalSupport", fieldLabel: "Spousal Support", fieldType: "CFT_BOOLEAN", section: "financial", displayOrder: 17 },
    { fieldName: "spousalSupportAmount", fieldLabel: "Spousal Support Amount", fieldType: "CFT_CURRENCY", section: "financial", displayOrder: 18 },
    { fieldName: "maritalAssets", fieldLabel: "Marital Assets Description", fieldType: "CFT_TEXTAREA", section: "financial", displayOrder: 19 },
    { fieldName: "maritalDebts", fieldLabel: "Marital Debts Description", fieldType: "CFT_TEXTAREA", section: "financial", displayOrder: 20 },
    // notes
    { fieldName: "domesticViolence", fieldLabel: "Domestic Violence Issues", fieldType: "CFT_BOOLEAN", section: "notes", displayOrder: 21 },
    { fieldName: "restrainingOrder", fieldLabel: "Restraining Order", fieldType: "CFT_BOOLEAN", section: "notes", displayOrder: 22 },
    { fieldName: "specialCircumstances", fieldLabel: "Special Circumstances", fieldType: "CFT_TEXTAREA", section: "notes", displayOrder: 23 },
  ],

  personal_injury: [
    // incident
    { fieldName: "incidentDate", fieldLabel: "Incident Date", fieldType: "CFT_DATE", section: "incident", isRequired: true, displayOrder: 1 },
    { fieldName: "incidentType", fieldLabel: "Incident Type", fieldType: "CFT_SELECT", section: "incident", isRequired: true, displayOrder: 2, fieldOptions: JSON.stringify(["Motor Vehicle Accident", "Slip and Fall", "Medical Malpractice", "Product Liability", "Workplace Injury", "Dog Bite", "Wrongful Death", "Other"]) },
    { fieldName: "incidentLocation", fieldLabel: "Incident Location", fieldType: "CFT_TEXTAREA", section: "incident", displayOrder: 3, placeholder: "Location where incident occurred" },
    { fieldName: "incidentDescription", fieldLabel: "Incident Description", fieldType: "CFT_TEXTAREA", section: "incident", displayOrder: 4 },
    { fieldName: "policeReportNumber", fieldLabel: "Police Report Number", fieldType: "CFT_TEXT", section: "incident", displayOrder: 5 },
    { fieldName: "policeReportFiled", fieldLabel: "Police Report Filed", fieldType: "CFT_BOOLEAN", section: "incident", displayOrder: 6 },
    // injuries
    { fieldName: "injuries", fieldLabel: "Injuries Sustained", fieldType: "CFT_TEXTAREA", section: "injuries", isRequired: true, displayOrder: 7, helpText: "Describe all injuries sustained" },
    { fieldName: "treatmentFacility", fieldLabel: "Treatment Facility", fieldType: "CFT_TEXT", section: "injuries", displayOrder: 8 },
    { fieldName: "treatingPhysician", fieldLabel: "Treating Physician", fieldType: "CFT_TEXT", section: "injuries", displayOrder: 9 },
    { fieldName: "ongoingTreatment", fieldLabel: "Ongoing Treatment", fieldType: "CFT_BOOLEAN", section: "injuries", displayOrder: 10 },
    { fieldName: "maxMedicalImprovement", fieldLabel: "Max Medical Improvement Date", fieldType: "CFT_DATE", section: "injuries", displayOrder: 11, helpText: "Date client reached MMI" },
    // damages
    { fieldName: "medicalExpenses", fieldLabel: "Medical Expenses to Date", fieldType: "CFT_CURRENCY", section: "damages", displayOrder: 12 },
    { fieldName: "futureMedialExpenses", fieldLabel: "Estimated Future Medical", fieldType: "CFT_CURRENCY", section: "damages", displayOrder: 13 },
    { fieldName: "lostWages", fieldLabel: "Lost Wages", fieldType: "CFT_CURRENCY", section: "damages", displayOrder: 14 },
    { fieldName: "futureLostEarnings", fieldLabel: "Future Lost Earnings", fieldType: "CFT_CURRENCY", section: "damages", displayOrder: 15 },
    { fieldName: "painAndSuffering", fieldLabel: "Pain & Suffering Estimate", fieldType: "CFT_CURRENCY", section: "damages", displayOrder: 16 },
    { fieldName: "propertyDamage", fieldLabel: "Property Damage", fieldType: "CFT_CURRENCY", section: "damages", displayOrder: 17 },
    // insurance
    { fieldName: "insuranceCompany", fieldLabel: "Insurance Company", fieldType: "CFT_TEXT", section: "insurance", displayOrder: 18 },
    { fieldName: "claimNumber", fieldLabel: "Claim Number", fieldType: "CFT_TEXT", section: "insurance", displayOrder: 19 },
    { fieldName: "policyLimit", fieldLabel: "Policy Limit", fieldType: "CFT_CURRENCY", section: "insurance", displayOrder: 20 },
    { fieldName: "adjusterName", fieldLabel: "Adjuster Name", fieldType: "CFT_TEXT", section: "insurance", displayOrder: 21 },
    { fieldName: "adjusterPhone", fieldLabel: "Adjuster Phone", fieldType: "CFT_PHONE", section: "insurance", displayOrder: 22 },
    // litigation
    { fieldName: "statuteOfLimitations", fieldLabel: "Statute of Limitations Date", fieldType: "CFT_DATE", section: "litigation", isRequired: true, displayOrder: 23, helpText: "Filing deadline" },
    { fieldName: "demandLetterSent", fieldLabel: "Demand Letter Sent", fieldType: "CFT_BOOLEAN", section: "litigation", displayOrder: 24 },
    { fieldName: "demandAmount", fieldLabel: "Demand Amount", fieldType: "CFT_CURRENCY", section: "litigation", displayOrder: 25 },
    { fieldName: "settlementAmount", fieldLabel: "Settlement Amount", fieldType: "CFT_CURRENCY", section: "litigation", displayOrder: 26 },
  ],

  immigration: [
    // case_info
    { fieldName: "caseType", fieldLabel: "Case Type", fieldType: "CFT_SELECT", section: "case_info", isRequired: true, displayOrder: 1, fieldOptions: JSON.stringify(["Family-Based Green Card", "Employment-Based Green Card", "Naturalization", "Asylum", "DACA", "TPS", "H-1B Visa", "L-1 Visa", "O-1 Visa", "K-1 Visa", "Student Visa", "Removal Defense", "Work Permit", "Travel Document", "Other"]) },
    { fieldName: "receiptNumber", fieldLabel: "Receipt Number", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 2, placeholder: "USCIS receipt number" },
    { fieldName: "alienNumber", fieldLabel: "A-Number", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 3, placeholder: "Alien registration number" },
    { fieldName: "priorityDate", fieldLabel: "Priority Date", fieldType: "CFT_DATE", section: "case_info", displayOrder: 4, helpText: "Immigration priority date" },
    { fieldName: "uscisOffice", fieldLabel: "USCIS Office", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 5 },
    // personal
    { fieldName: "countryOfBirth", fieldLabel: "Country of Birth", fieldType: "CFT_TEXT", section: "personal", isRequired: true, displayOrder: 6 },
    { fieldName: "countryOfCitizenship", fieldLabel: "Country of Citizenship", fieldType: "CFT_TEXT", section: "personal", isRequired: true, displayOrder: 7 },
    { fieldName: "dateOfEntry", fieldLabel: "Date of Last Entry to US", fieldType: "CFT_DATE", section: "personal", displayOrder: 8 },
    { fieldName: "i94Number", fieldLabel: "I-94 Number", fieldType: "CFT_TEXT", section: "personal", displayOrder: 9 },
    { fieldName: "currentStatus", fieldLabel: "Current Immigration Status", fieldType: "CFT_SELECT", section: "personal", displayOrder: 10, fieldOptions: JSON.stringify(["U.S. Citizen", "Permanent Resident", "H-1B", "H-4", "L-1", "L-2", "F-1", "J-1", "O-1", "B-1/B-2", "TPS", "DACA", "Asylum Pending", "Undocumented", "Other"]) },
    { fieldName: "statusExpirationDate", fieldLabel: "Status Expiration Date", fieldType: "CFT_DATE", section: "personal", displayOrder: 11 },
    { fieldName: "passportNumber", fieldLabel: "Passport Number", fieldType: "CFT_TEXT", section: "personal", displayOrder: 12 },
    { fieldName: "passportExpiration", fieldLabel: "Passport Expiration", fieldType: "CFT_DATE", section: "personal", displayOrder: 13 },
    // dates
    { fieldName: "filingDate", fieldLabel: "Filing Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 14 },
    { fieldName: "biometricsDate", fieldLabel: "Biometrics Appointment", fieldType: "CFT_DATE", section: "dates", displayOrder: 15 },
    { fieldName: "interviewDate", fieldLabel: "Interview Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 16 },
    { fieldName: "hearingDate", fieldLabel: "Court Hearing Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 17 },
    // employer
    { fieldName: "employerName", fieldLabel: "Employer / Sponsor Name", fieldType: "CFT_TEXT", section: "employer", displayOrder: 18 },
    { fieldName: "jobTitle", fieldLabel: "Job Title", fieldType: "CFT_TEXT", section: "employer", displayOrder: 19 },
    { fieldName: "prevailingWage", fieldLabel: "Prevailing Wage", fieldType: "CFT_CURRENCY", section: "employer", displayOrder: 20 },
    { fieldName: "lcaNumber", fieldLabel: "LCA Case Number", fieldType: "CFT_TEXT", section: "employer", displayOrder: 21 },
    // notes
    { fieldName: "previousDenials", fieldLabel: "Previous Denials", fieldType: "CFT_BOOLEAN", section: "notes", displayOrder: 22 },
    { fieldName: "criminalHistory", fieldLabel: "Criminal History", fieldType: "CFT_BOOLEAN", section: "notes", displayOrder: 23 },
    { fieldName: "additionalNotes", fieldLabel: "Additional Notes", fieldType: "CFT_TEXTAREA", section: "notes", displayOrder: 24 },
  ],

  corporate: [
    // entity_info
    { fieldName: "entityType", fieldLabel: "Entity Type", fieldType: "CFT_SELECT", section: "entity_info", isRequired: true, displayOrder: 1, fieldOptions: JSON.stringify(["Corporation (C-Corp)", "S-Corporation", "LLC", "LLP", "Partnership", "Sole Proprietorship", "Non-Profit", "Professional Corporation"]) },
    { fieldName: "entityName", fieldLabel: "Entity Name", fieldType: "CFT_TEXT", section: "entity_info", isRequired: true, displayOrder: 2 },
    { fieldName: "stateOfFormation", fieldLabel: "State of Formation", fieldType: "CFT_TEXT", section: "entity_info", displayOrder: 3 },
    { fieldName: "einNumber", fieldLabel: "EIN Number", fieldType: "CFT_TEXT", section: "entity_info", displayOrder: 4, placeholder: "XX-XXXXXXX" },
    { fieldName: "formationDate", fieldLabel: "Formation Date", fieldType: "CFT_DATE", section: "entity_info", displayOrder: 5 },
    { fieldName: "fiscalYearEnd", fieldLabel: "Fiscal Year End", fieldType: "CFT_TEXT", section: "entity_info", displayOrder: 6, placeholder: "e.g., December 31" },
    // transaction
    { fieldName: "transactionType", fieldLabel: "Transaction Type", fieldType: "CFT_SELECT", section: "transaction", displayOrder: 7, fieldOptions: JSON.stringify(["Formation", "Merger", "Acquisition", "Dissolution", "Reorganization", "Joint Venture", "Stock Purchase", "Asset Purchase", "Financing", "Compliance", "Governance", "Other"]) },
    { fieldName: "transactionValue", fieldLabel: "Transaction Value", fieldType: "CFT_CURRENCY", section: "transaction", displayOrder: 8 },
    { fieldName: "closingDate", fieldLabel: "Closing Date", fieldType: "CFT_DATE", section: "transaction", displayOrder: 9 },
    { fieldName: "dueDiligenceDeadline", fieldLabel: "Due Diligence Deadline", fieldType: "CFT_DATE", section: "transaction", displayOrder: 10 },
    // parties
    { fieldName: "registeredAgent", fieldLabel: "Registered Agent", fieldType: "CFT_TEXT", section: "parties", displayOrder: 11 },
    { fieldName: "principalOfficers", fieldLabel: "Principal Officers", fieldType: "CFT_TEXTAREA", section: "parties", displayOrder: 12, helpText: "List officers and their titles" },
    { fieldName: "boardMembers", fieldLabel: "Board Members", fieldType: "CFT_TEXTAREA", section: "parties", displayOrder: 13 },
    { fieldName: "shareholders", fieldLabel: "Shareholders / Members", fieldType: "CFT_TEXTAREA", section: "parties", displayOrder: 14 },
    // compliance
    { fieldName: "annualReportDue", fieldLabel: "Annual Report Due Date", fieldType: "CFT_DATE", section: "compliance", displayOrder: 15 },
    { fieldName: "franchiseTaxDue", fieldLabel: "Franchise Tax Due Date", fieldType: "CFT_DATE", section: "compliance", displayOrder: 16 },
    { fieldName: "goodStanding", fieldLabel: "Good Standing", fieldType: "CFT_BOOLEAN", section: "compliance", displayOrder: 17, defaultValue: "true" },
    { fieldName: "licensesRequired", fieldLabel: "Licenses Required", fieldType: "CFT_TEXTAREA", section: "compliance", displayOrder: 18 },
    // notes
    { fieldName: "operatingAgreement", fieldLabel: "Operating Agreement on File", fieldType: "CFT_BOOLEAN", section: "notes", displayOrder: 19 },
    { fieldName: "bylawsOnFile", fieldLabel: "Bylaws on File", fieldType: "CFT_BOOLEAN", section: "notes", displayOrder: 20 },
    { fieldName: "additionalNotes", fieldLabel: "Additional Notes", fieldType: "CFT_TEXTAREA", section: "notes", displayOrder: 21 },
  ],

  general_litigation: [
    // case_info
    { fieldName: "caseNumber", fieldLabel: "Case Number", fieldType: "CFT_TEXT", section: "case_info", isRequired: true, displayOrder: 1 },
    { fieldName: "litigationType", fieldLabel: "Litigation Type", fieldType: "CFT_SELECT", section: "case_info", isRequired: true, displayOrder: 2, fieldOptions: JSON.stringify(["Contract Dispute", "Tort", "Employment", "Intellectual Property", "Real Property", "Collections", "Insurance", "Civil Rights", "Administrative", "Other"]) },
    { fieldName: "clientRole", fieldLabel: "Client Role", fieldType: "CFT_SELECT", section: "case_info", isRequired: true, displayOrder: 3, fieldOptions: JSON.stringify(["Plaintiff", "Defendant", "Third Party", "Intervenor", "Cross-Claimant"]) },
    { fieldName: "court", fieldLabel: "Court", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 4 },
    { fieldName: "judge", fieldLabel: "Judge", fieldType: "CFT_TEXT", section: "case_info", displayOrder: 5 },
    { fieldName: "jurisdiction", fieldLabel: "Jurisdiction", fieldType: "CFT_SELECT", section: "case_info", displayOrder: 6, fieldOptions: JSON.stringify(["State", "Federal", "Arbitration", "Mediation"]) },
    // parties
    { fieldName: "opposingParty", fieldLabel: "Opposing Party", fieldType: "CFT_TEXT", section: "parties", displayOrder: 7 },
    { fieldName: "opposingCounsel", fieldLabel: "Opposing Counsel", fieldType: "CFT_TEXT", section: "parties", displayOrder: 8 },
    { fieldName: "opposingCounselFirm", fieldLabel: "Opposing Counsel Firm", fieldType: "CFT_TEXT", section: "parties", displayOrder: 9 },
    { fieldName: "opposingCounselPhone", fieldLabel: "Opposing Counsel Phone", fieldType: "CFT_PHONE", section: "parties", displayOrder: 10 },
    { fieldName: "opposingCounselEmail", fieldLabel: "Opposing Counsel Email", fieldType: "CFT_EMAIL", section: "parties", displayOrder: 11 },
    // dates
    { fieldName: "filingDate", fieldLabel: "Filing Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 12 },
    { fieldName: "serviceDate", fieldLabel: "Service Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 13 },
    { fieldName: "answerDueDate", fieldLabel: "Answer Due Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 14 },
    { fieldName: "discoveryDeadline", fieldLabel: "Discovery Deadline", fieldType: "CFT_DATE", section: "dates", displayOrder: 15 },
    { fieldName: "depositionDate", fieldLabel: "Deposition Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 16 },
    { fieldName: "mediationDate", fieldLabel: "Mediation Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 17 },
    { fieldName: "motionDeadline", fieldLabel: "Motion Deadline", fieldType: "CFT_DATE", section: "dates", displayOrder: 18 },
    { fieldName: "preTrialDate", fieldLabel: "Pre-Trial Conference Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 19 },
    { fieldName: "trialDate", fieldLabel: "Trial Date", fieldType: "CFT_DATE", section: "dates", displayOrder: 20 },
    // damages
    { fieldName: "amountInControversy", fieldLabel: "Amount in Controversy", fieldType: "CFT_CURRENCY", section: "damages", displayOrder: 21 },
    { fieldName: "damagesType", fieldLabel: "Damages Type", fieldType: "CFT_MULTI_SELECT", section: "damages", displayOrder: 22, fieldOptions: JSON.stringify(["Compensatory", "Punitive", "Statutory", "Liquidated", "Nominal", "Injunctive Relief"]) },
    { fieldName: "settlementDemand", fieldLabel: "Settlement Demand", fieldType: "CFT_CURRENCY", section: "damages", displayOrder: 23 },
    { fieldName: "settlementOffer", fieldLabel: "Settlement Offer", fieldType: "CFT_CURRENCY", section: "damages", displayOrder: 24 },
    // notes
    { fieldName: "causeOfAction", fieldLabel: "Cause of Action", fieldType: "CFT_TEXTAREA", section: "notes", displayOrder: 25, helpText: "Describe the cause(s) of action" },
    { fieldName: "keyIssues", fieldLabel: "Key Issues", fieldType: "CFT_TEXTAREA", section: "notes", displayOrder: 26 },
    { fieldName: "caseStrategy", fieldLabel: "Case Strategy Notes", fieldType: "CFT_TEXTAREA", section: "notes", displayOrder: 27 },
  ],
};

// ── Seed function ──────────────────────────────────────────────────────────

async function seedAllDefaults(): Promise<string[]> {
  const seeded: string[] = [];

  for (const [practiceArea, fields] of Object.entries(STARTER_FIELDS)) {
    const existing = await db.practiceAreaField.count({
      where: { practiceArea },
    });
    if (existing === 0) {
      await db.practiceAreaField.createMany({
        data: fields.map((f) => ({
          practiceArea,
          fieldName: f.fieldName,
          fieldLabel: f.fieldLabel,
          fieldType: f.fieldType as any,
          fieldOptions: f.fieldOptions ?? null,
          placeholder: f.placeholder ?? null,
          isRequired: f.isRequired ?? false,
          displayOrder: f.displayOrder,
          section: f.section,
          helpText: f.helpText ?? null,
          defaultValue: f.defaultValue ?? null,
        })),
      });
      seeded.push(practiceArea);
    }
  }

  return seeded;
}

// ── Router ─────────────────────────────────────────────────────────────────

export const practiceAreaFieldsRouter = router({
  "fields.list": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      const fields = await db.practiceAreaField.findMany({
        where: { practiceArea: input.practiceArea, isActive: true },
        orderBy: [{ section: "asc" }, { displayOrder: "asc" }],
      });

      const grouped: Record<string, typeof fields> = {};
      for (const field of fields) {
        if (!grouped[field.section]) grouped[field.section] = [];
        grouped[field.section].push(field);
      }
      return grouped;
    }),

  "fields.listAll": publicProcedure.query(async () => {
    return db.practiceAreaField.findMany({
      orderBy: [{ practiceArea: "asc" }, { section: "asc" }, { displayOrder: "asc" }],
    });
  }),

  "fields.create": publicProcedure
    .input(
      z.object({
        practiceArea: z.string(),
        fieldName: z.string(),
        fieldLabel: z.string(),
        fieldType: z.string(),
        fieldOptions: z.string().optional(),
        placeholder: z.string().optional(),
        isRequired: z.boolean().optional(),
        displayOrder: z.number().optional(),
        section: z.string().optional(),
        defaultValue: z.string().optional(),
        validationRule: z.string().optional(),
        helpText: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return db.practiceAreaField.create({
        data: {
          practiceArea: input.practiceArea,
          fieldName: input.fieldName,
          fieldLabel: input.fieldLabel,
          fieldType: input.fieldType as any,
          fieldOptions: input.fieldOptions,
          placeholder: input.placeholder,
          isRequired: input.isRequired ?? false,
          displayOrder: input.displayOrder ?? 0,
          section: input.section ?? "details",
          defaultValue: input.defaultValue,
          validationRule: input.validationRule,
          helpText: input.helpText,
        },
      });
    }),

  "fields.update": publicProcedure
    .input(z.object({ fieldId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.practiceAreaField.update({
        where: { id: input.fieldId },
        data: input.data,
      });
    }),

  "fields.delete": publicProcedure
    .input(z.object({ fieldId: z.string() }))
    .mutation(async ({ input }) => {
      return db.practiceAreaField.update({
        where: { id: input.fieldId },
        data: { isActive: false },
      });
    }),

  "fields.reorder": publicProcedure
    .input(z.object({ fieldIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      const updates = input.fieldIds.map((id, index) =>
        db.practiceAreaField.update({
          where: { id },
          data: { displayOrder: index },
        })
      );
      await Promise.all(updates);
      return { success: true };
    }),

  "fields.getForMatter": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const matter = await db.matter.findUniqueOrThrow({
        where: { id: input.matterId },
        select: { practiceArea: true },
      });

      const practiceArea = matter.practiceArea ?? "";

      const fields = await db.practiceAreaField.findMany({
        where: { practiceArea, isActive: true },
        orderBy: [{ section: "asc" }, { displayOrder: "asc" }],
      });

      const values = await db.matterCustomFieldValue.findMany({
        where: { matterId: input.matterId },
      });

      const valueMap = new Map(values.map((v) => [v.fieldId, v.value]));

      return {
        practiceArea,
        fields: fields.map((field) => ({
          ...field,
          value: valueMap.get(field.id) ?? null,
        })),
      };
    }),

  "fields.saveValues": publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        values: z.array(z.object({ fieldId: z.string(), value: z.string().nullable() })),
      })
    )
    .mutation(async ({ input }) => {
      const upserts = input.values.map((v) =>
        db.matterCustomFieldValue.upsert({
          where: {
            matterId_fieldId: {
              matterId: input.matterId,
              fieldId: v.fieldId,
            },
          },
          create: {
            matterId: input.matterId,
            fieldId: v.fieldId,
            value: v.value,
          },
          update: {
            value: v.value,
          },
        })
      );
      await Promise.all(upserts);
      return { savedCount: input.values.length };
    }),

  "fields.getAvailablePracticeAreas": publicProcedure.query(async () => {
    const results = await db.practiceAreaField.findMany({
      where: { isActive: true },
      select: { practiceArea: true },
      distinct: ["practiceArea"],
    });
    return results.map((r) => r.practiceArea);
  }),

  "fields.seedDefaults": publicProcedure.mutation(async () => {
    const seeded = await seedAllDefaults();
    return { seeded };
  }),

  "fields.duplicate": publicProcedure
    .input(z.object({ sourcePracticeArea: z.string(), targetPracticeArea: z.string() }))
    .mutation(async ({ input }) => {
      const sourceFields = await db.practiceAreaField.findMany({
        where: { practiceArea: input.sourcePracticeArea, isActive: true },
      });

      await db.practiceAreaField.createMany({
        data: sourceFields.map((f) => ({
          practiceArea: input.targetPracticeArea,
          fieldName: f.fieldName,
          fieldLabel: f.fieldLabel,
          fieldType: f.fieldType as any,
          fieldOptions: f.fieldOptions,
          placeholder: f.placeholder,
          isRequired: f.isRequired,
          displayOrder: f.displayOrder,
          section: f.section,
          defaultValue: f.defaultValue,
          validationRule: f.validationRule,
          helpText: f.helpText,
        })),
      });

      return { count: sourceFields.length };
    }),

  "fields.export": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      const fields = await db.practiceAreaField.findMany({
        where: { practiceArea: input.practiceArea, isActive: true },
        orderBy: [{ section: "asc" }, { displayOrder: "asc" }],
      });
      return fields;
    }),

  "fields.import": publicProcedure
    .input(
      z.object({
        practiceArea: z.string(),
        fields: z.array(
          z.object({
            fieldName: z.string(),
            fieldLabel: z.string(),
            fieldType: z.string(),
            fieldOptions: z.string().optional(),
            placeholder: z.string().optional(),
            isRequired: z.boolean().optional(),
            displayOrder: z.number().optional(),
            section: z.string().optional(),
            defaultValue: z.string().optional(),
            validationRule: z.string().optional(),
            helpText: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      await db.practiceAreaField.createMany({
        data: input.fields.map((f, index) => ({
          practiceArea: input.practiceArea,
          fieldName: f.fieldName,
          fieldLabel: f.fieldLabel,
          fieldType: f.fieldType as any,
          fieldOptions: f.fieldOptions ?? null,
          placeholder: f.placeholder ?? null,
          isRequired: f.isRequired ?? false,
          displayOrder: f.displayOrder ?? index,
          section: f.section ?? "details",
          defaultValue: f.defaultValue ?? null,
          validationRule: f.validationRule ?? null,
          helpText: f.helpText ?? null,
        })),
      });
      return { count: input.fields.length };
    }),
});
