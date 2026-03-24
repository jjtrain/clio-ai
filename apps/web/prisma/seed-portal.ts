import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding portal branding themes...");

  const themes = [
    {
      practiceArea: "personal_injury",
      colorPrimary: "#2B7A78",
      colorSecondary: "#3AAFA9",
      colorAccent: "#17252A",
      colorBackground: "#F7FFFE",
      colorSurface: "#FFFFFF",
      colorText: "#17252A",
      colorMuted: "#6B8F8E",
      gradientStart: "#2B7A78",
      gradientEnd: "#3AAFA9",
      borderRadius: "12px",
      tone: "supportive",
      welcomeHeading: "Your Case Dashboard",
      welcomeSubtext: "Welcome back. Here's the latest on your case. We're working hard to get you the best possible outcome.",
      terminology: {
        matter: "your case",
        opposing_counsel: "the other side's attorney",
        discovery: "information exchange",
        deposition: "recorded testimony",
        interrogatories: "written questions",
        motion: "formal request to the court",
        statute_of_limitations: "legal time limit to file",
      },
      documentCategories: ["Medical Records", "Accident Documents", "Insurance", "Court Filings", "Correspondence", "Your Uploads"],
      quickActions: [
        { label: "Message Your Attorney", icon: "MessageCircle" },
        { label: "Upload Documents", icon: "Upload" },
        { label: "View Your Checklist", icon: "CheckSquare" },
      ],
      faqItems: [
        { q: "How long will my case take?", a: "Every case is different, but personal injury cases typically take 12-24 months. Your attorney will give you a more specific timeline." },
        { q: "What should I do if the insurance company calls?", a: "Do not speak with the other side's insurance company. Politely decline and let them know your attorney will be in contact." },
        { q: "Should I still see my doctor?", a: "Yes — continue all prescribed medical treatment. Gaps in treatment can be used against you." },
      ],
    },
    {
      practiceArea: "family_law",
      colorPrimary: "#7C6DAF",
      colorSecondary: "#A99DCF",
      colorAccent: "#4A3F6B",
      colorBackground: "#FAFAFE",
      colorSurface: "#FFFFFF",
      colorText: "#2D2845",
      colorMuted: "#8E87A5",
      gradientStart: "#7C6DAF",
      gradientEnd: "#B8A9D4",
      borderRadius: "16px",
      tone: "warm",
      welcomeHeading: "Your Family Matter",
      welcomeSubtext: "We understand this is a difficult time. We're here to guide you through every step and protect your interests and your family's future.",
      terminology: {
        matter: "your family matter",
        opposing_counsel: "your spouse's attorney",
        discovery: "financial disclosure process",
        respondent: "your spouse",
        pendente_lite: "temporary support",
        equitable_distribution: "fair division of assets",
      },
      documentCategories: ["Financial Documents", "Court Filings", "Agreements", "Children Related", "Correspondence", "Your Uploads"],
      quickActions: [
        { label: "Message Your Attorney", icon: "MessageCircle" },
        { label: "Upload Documents", icon: "Upload" },
        { label: "View Your Checklist", icon: "CheckSquare" },
      ],
      faqItems: [
        { q: "How long does a divorce take?", a: "Uncontested divorces can take 3-6 months. Contested cases may take 1-2 years depending on complexity." },
        { q: "Will I have to go to court?", a: "Many family matters are resolved through negotiation or mediation. Your attorney will advise if court appearances are needed." },
      ],
    },
    {
      practiceArea: "immigration",
      colorPrimary: "#1A3A5C",
      colorSecondary: "#2E6BA6",
      colorAccent: "#D4A843",
      colorBackground: "#F8FAFC",
      colorSurface: "#FFFFFF",
      colorText: "#1A2332",
      colorMuted: "#6B7D93",
      gradientStart: "#1A3A5C",
      gradientEnd: "#2E6BA6",
      borderRadius: "8px",
      tone: "professional",
      welcomeHeading: "Your Immigration Case",
      welcomeSubtext: "Welcome to your secure immigration case portal. Track your application status, upload documents, and communicate directly with your attorney.",
      terminology: {
        matter: "your immigration case",
        filing: "your application",
        adjudication: "review process",
        RFE: "request for additional information",
      },
      documentCategories: ["Application Materials", "Supporting Documents", "Government Notices", "Correspondence", "Your Uploads"],
      quickActions: [
        { label: "Message Attorney", icon: "MessageCircle" },
        { label: "Upload Documents", icon: "Upload" },
        { label: "Check Status", icon: "CheckSquare" },
      ],
      faqItems: [
        { q: "How long will processing take?", a: "Processing times vary by application type and service center. Your attorney will provide estimated timelines based on current USCIS data." },
        { q: "Can I travel while my case is pending?", a: "Travel restrictions depend on your visa status and pending applications. Always consult your attorney before traveling." },
      ],
    },
    {
      practiceArea: "corporate",
      colorPrimary: "#1B2A4A",
      colorSecondary: "#2C4470",
      colorAccent: "#3B82F6",
      colorBackground: "#F8F9FB",
      colorSurface: "#FFFFFF",
      colorText: "#111827",
      colorMuted: "#6B7280",
      gradientStart: "#1B2A4A",
      gradientEnd: "#2C4470",
      borderRadius: "4px",
      iconStyle: "filled",
      tone: "formal",
      welcomeHeading: "Your Deal Room",
      welcomeSubtext: "Welcome to your secure client portal. View project status, access documents, and coordinate with your legal team.",
      terminology: {
        matter: "your engagement",
        filing: "submission",
        document_review: "due diligence review",
      },
      documentCategories: ["Transaction Documents", "Due Diligence", "Executed Agreements", "Correspondence", "Your Uploads"],
      quickActions: [
        { label: "Message Team", icon: "MessageCircle" },
        { label: "Upload Documents", icon: "Upload" },
        { label: "View Action Items", icon: "CheckSquare" },
      ],
    },
    {
      practiceArea: "real_estate",
      colorPrimary: "#5B7553",
      colorSecondary: "#7A9971",
      colorAccent: "#C17F3E",
      colorBackground: "#FAFAF7",
      colorSurface: "#FFFFFF",
      colorText: "#2C3E2A",
      colorMuted: "#7A8B78",
      gradientStart: "#5B7553",
      gradientEnd: "#7A9971",
      borderRadius: "10px",
      tone: "professional",
      welcomeHeading: "Your Closing Dashboard",
      welcomeSubtext: "Track every step on the way to closing day. Upload documents, review your checklist, and stay informed.",
      terminology: { matter: "your transaction" },
      documentCategories: ["Purchase Documents", "Mortgage", "Title", "Inspections", "Correspondence", "Your Uploads"],
      quickActions: [
        { label: "Message Attorney", icon: "MessageCircle" },
        { label: "Upload Documents", icon: "Upload" },
        { label: "Closing Checklist", icon: "CheckSquare" },
      ],
    },
    {
      practiceArea: "estate",
      colorPrimary: "#2C3E50",
      colorSecondary: "#4A6274",
      colorAccent: "#C9A84C",
      colorBackground: "#FAF9F6",
      colorSurface: "#FFFFFF",
      colorText: "#1C2833",
      colorMuted: "#707B84",
      gradientStart: "#2C3E50",
      gradientEnd: "#4A6274",
      fontFamily: "Georgia, serif",
      borderRadius: "6px",
      tone: "formal",
      welcomeHeading: "Estate Administration Portal",
      welcomeSubtext: "We're guiding the administration of this estate with care and diligence. Here you can track progress and access important documents.",
      terminology: { matter: "the estate matter" },
      documentCategories: ["Estate Documents", "Court Filings", "Financial Records", "Correspondence", "Your Uploads"],
      quickActions: [
        { label: "Message Attorney", icon: "MessageCircle" },
        { label: "Upload Documents", icon: "Upload" },
        { label: "View Checklist", icon: "CheckSquare" },
      ],
    },
  ];

  for (const theme of themes) {
    await prisma.portalBrandingTheme.upsert({
      where: { practiceArea: theme.practiceArea },
      create: { ...theme, firmId: FIRM_ID },
      update: {
        colorPrimary: theme.colorPrimary,
        colorSecondary: theme.colorSecondary,
        welcomeHeading: theme.welcomeHeading,
        welcomeSubtext: theme.welcomeSubtext,
        terminology: theme.terminology,
        faqItems: theme.faqItems,
      },
    });
  }

  console.log(`Seeded ${themes.length} branding themes.`);

  // Seed demo portal account
  console.log("Seeding demo portal account...");

  const firstClient = await prisma.client.findFirst();
  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });

  if (firstClient && firstMatter) {
    const portalUser = await prisma.clientPortalUser.upsert({
      where: { email: "john.smith@example.com" },
      create: {
        clientId: firstClient.id,
        email: "john.smith@example.com",
        passwordHash: "$2a$10$placeholder",
        name: "John Smith",
        firstName: "John",
        lastName: "Smith",
        firmId: FIRM_ID,
      },
      update: { firstName: "John", lastName: "Smith", firmId: FIRM_ID },
    });

    // Grant matter access
    await prisma.portalMatterAccess.upsert({
      where: { portalUserId_matterId: { portalUserId: portalUser.id, matterId: firstMatter.id } },
      create: {
        portalUserId: portalUser.id,
        matterId: firstMatter.id,
        permissions: { documents: true, messages: true, billing: true, calendar: true, status: true, uploads: true },
      },
      update: {},
    });

    // Seed status updates
    const updates = [
      {
        title: "We've Filed Your Lawsuit",
        body: "Good news — we officially filed your lawsuit today. The next step is for the other side to respond, which they have 20 days to do. We'll let you know as soon as we hear back. No action is needed from you right now.",
        milestone: "case_filed",
        phase: "Filed Your Case",
        phasePercentage: 100,
      },
      {
        title: "Discovery Phase Has Begun",
        body: "Your case has moved into the information exchange phase. This is where both sides share evidence and information. We've sent the other side's attorney a formal request for documents. While we wait for their responses, please continue with your medical treatment and let us know if anything changes.",
        milestone: "discovery_started",
        phase: "Information Exchange",
        phasePercentage: 25,
      },
    ];

    for (const update of updates) {
      await prisma.portalStatusUpdate.create({
        data: {
          matterId: firstMatter.id,
          ...update,
          isPublished: true,
          isDraft: false,
          publishedAt: new Date(),
          userId: USER_ID,
          firmId: FIRM_ID,
        },
      });
    }

    // Seed sample messages
    const messages = [
      { direction: "FIRM_TO_CLIENT" as const, subject: "Welcome to Your Portal", content: "Welcome to our client portal! You can use this to communicate with us, upload documents, and track your case progress." },
      { direction: "CLIENT_TO_FIRM" as const, content: "Thank you! I have some medical records to upload. Where should I put those?" },
      { direction: "FIRM_TO_CLIENT" as const, content: "Great question! You can upload them in the Documents section under 'Medical Records'. You can also use your checklist to see what documents we still need." },
      { direction: "CLIENT_TO_FIRM" as const, content: "Perfect, I'll upload those tonight. Also, when is our next court date?" },
      { direction: "FIRM_TO_CLIENT" as const, content: "Our next court appearance is a preliminary conference scheduled for April 2. You don't need to attend — I'll appear on your behalf and update you right after." },
    ];

    for (const msg of messages) {
      await prisma.clientPortalMessage.create({
        data: {
          clientPortalUserId: portalUser.id,
          matterId: firstMatter.id,
          ...msg,
        },
      });
    }

    // Seed documents
    const docs = [
      { fileName: "Complaint.pdf", category: "Court Filings", description: "Filed complaint" },
      { fileName: "Retainer Agreement.pdf", category: "Agreements", description: "Signed retainer" },
      { fileName: "Insurance Policy.pdf", category: "Insurance", description: "Client's auto insurance policy", uploaderType: "client" },
    ];

    for (const doc of docs) {
      await prisma.portalDocument.create({
        data: {
          matterId: firstMatter.id,
          portalUserId: doc.uploaderType === "client" ? portalUser.id : null,
          fileName: doc.fileName,
          category: doc.category,
          description: doc.description,
          uploaderType: doc.uploaderType || "attorney",
          userId: USER_ID,
          firmId: FIRM_ID,
        },
      });
    }

    // Seed checklist
    const checklistItems = [
      { id: "1", label: "Photos of your injuries", priority: "asap", isCompleted: true, completedAt: new Date().toISOString() },
      { id: "2", label: "Photos of vehicle damage", priority: "asap", isCompleted: true, completedAt: new Date().toISOString() },
      { id: "3", label: "Copy of police/accident report", priority: "asap", isCompleted: true, completedAt: new Date().toISOString() },
      { id: "4", label: "Insurance information", priority: "asap", isCompleted: true, completedAt: new Date().toISOString() },
      { id: "5", label: "Medical records and bills", priority: "when_can", isCompleted: true, completedAt: new Date().toISOString() },
      { id: "6", label: "Proof of lost wages", priority: "when_can", isCompleted: false },
      { id: "7", label: "Prescription receipts", priority: "when_can", isCompleted: false },
      { id: "8", label: "List of all doctors and therapists", priority: "when_can", isCompleted: false },
    ];

    await prisma.portalChecklist.create({
      data: {
        matterId: firstMatter.id,
        portalUserId: portalUser.id,
        title: "Personal Injury Document Checklist",
        practiceArea: "personal_injury",
        items: checklistItems,
        totalItems: 8,
        completedItems: 5,
        userId: USER_ID,
        firmId: FIRM_ID,
      },
    });

    console.log("Seeded demo portal account with status updates, messages, documents, and checklist.");
  } else {
    console.log("No client/matter found for demo — skipping portal account seed.");
  }

  console.log("Portal seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
