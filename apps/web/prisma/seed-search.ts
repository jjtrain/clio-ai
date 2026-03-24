import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding search synonyms...");

  const synonyms = [
    // Legal abbreviations
    { term: "disco", canonicalTerm: "discovery", category: "document_type" },
    { term: "sj", canonicalTerm: "summary judgment", category: "document_type" },
    { term: "msj", canonicalTerm: "motion for summary judgment", category: "document_type" },
    { term: "oc", canonicalTerm: "opposing counsel", category: "entity" },
    { term: "sol", canonicalTerm: "statute of limitations", category: "legal_concept" },
    { term: "bop", canonicalTerm: "bill of particulars", category: "document_type" },
    { term: "noi", canonicalTerm: "note of issue", category: "document_type" },
    { term: "ime", canonicalTerm: "independent medical examination", category: "event_type" },
    { term: "ebt", canonicalTerm: "examination before trial", category: "event_type" },
    { term: "rji", canonicalTerm: "request for judicial intervention", category: "document_type" },
    { term: "pi", canonicalTerm: "personal injury", category: "practice_area" },
    { term: "wc", canonicalTerm: "workers compensation", category: "practice_area" },
    { term: "work comp", canonicalTerm: "workers compensation", category: "practice_area" },
    { term: "mtd", canonicalTerm: "motion to dismiss", category: "document_type" },
    { term: "mtc", canonicalTerm: "motion to compel", category: "document_type" },
    { term: "tro", canonicalTerm: "temporary restraining order", category: "document_type" },
    { term: "osc", canonicalTerm: "order to show cause", category: "document_type" },
    { term: "stip", canonicalTerm: "stipulation", category: "document_type" },
    { term: "aff", canonicalTerm: "affidavit", category: "document_type" },
    { term: "cert", canonicalTerm: "certification", category: "document_type" },
    { term: "ret", canonicalTerm: "retainer agreement", category: "document_type" },
    { term: "retainer", canonicalTerm: "retainer agreement", category: "document_type" },
    { term: "med recs", canonicalTerm: "medical record", category: "document_type" },
    { term: "medical records", canonicalTerm: "medical record", category: "document_type" },
    // Status synonyms
    { term: "waiting on", canonicalTerm: "pending", category: "status" },
    { term: "overdue", canonicalTerm: "missed", category: "status" },
    { term: "late", canonicalTerm: "missed", category: "status" },
    { term: "past due", canonicalTerm: "missed", category: "status" },
    { term: "upcoming", canonicalTerm: "pending", category: "status" },
    { term: "coming up", canonicalTerm: "pending", category: "status" },
    { term: "soon", canonicalTerm: "pending", category: "status" },
    { term: "settled", canonicalTerm: "settled", category: "status" },
    { term: "resolved", canonicalTerm: "settled", category: "status" },
    { term: "active", canonicalTerm: "active", category: "status" },
    { term: "open", canonicalTerm: "active", category: "status" },
    { term: "closed", canonicalTerm: "closed", category: "status" },
    { term: "done", canonicalTerm: "closed", category: "status" },
    { term: "finished", canonicalTerm: "closed", category: "status" },
    { term: "in progress", canonicalTerm: "active", category: "status" },
    { term: "waiting", canonicalTerm: "pending", category: "status" },
    { term: "pending", canonicalTerm: "pending", category: "status" },
    { term: "outstanding", canonicalTerm: "pending", category: "status" },
    { term: "complete", canonicalTerm: "completed", category: "status" },
    { term: "canceled", canonicalTerm: "archived", category: "status" },
    { term: "cancelled", canonicalTerm: "archived", category: "status" },
    // Sort synonyms
    { term: "new", canonicalTerm: "newest", category: "sort" },
    { term: "recent", canonicalTerm: "newest", category: "sort" },
  ];

  for (const syn of synonyms) {
    await prisma.searchSynonym.upsert({
      where: {
        id: `synonym-${syn.term.replace(/\s+/g, "-")}`,
      },
      create: {
        id: `synonym-${syn.term.replace(/\s+/g, "-")}`,
        term: syn.term,
        canonicalTerm: syn.canonicalTerm,
        category: syn.category,
        firmId: null, // global synonyms
      },
      update: {
        canonicalTerm: syn.canonicalTerm,
        category: syn.category,
      },
    });
  }

  console.log(`Seeded ${synonyms.length} search synonyms.`);

  // Seed sample saved searches
  console.log("Seeding saved searches...");

  const savedSearches = [
    {
      id: "saved-overdue-deadlines",
      name: "Overdue Deadlines",
      queryText: "show me all overdue deadlines",
      isPinned: true,
      alertEnabled: true,
      alertFrequency: "daily",
    },
    {
      id: "saved-hot-leads",
      name: "Hot Leads This Week",
      queryText: "new qualified intake leads this week grade A",
      isPinned: true,
      alertEnabled: false,
    },
    {
      id: "saved-discovery-matters",
      name: "Matters in Discovery",
      queryText: "all active matters currently in discovery phase",
      isPinned: false,
      alertEnabled: false,
    },
    {
      id: "saved-unbilled-time",
      name: "Unbilled Time",
      queryText: "show me all unbilled time entries",
      isPinned: false,
      alertEnabled: true,
      alertFrequency: "weekly",
    },
  ];

  for (const search of savedSearches) {
    await prisma.savedSearch.upsert({
      where: { id: search.id },
      create: {
        id: search.id,
        name: search.name,
        queryText: search.queryText,
        isPinned: search.isPinned,
        alertEnabled: search.alertEnabled,
        alertFrequency: search.alertFrequency || null,
        userId: USER_ID,
        firmId: FIRM_ID,
      },
      update: {
        name: search.name,
        queryText: search.queryText,
        isPinned: search.isPinned,
        alertEnabled: search.alertEnabled,
        alertFrequency: search.alertFrequency || null,
      },
    });
  }

  console.log(`Seeded ${savedSearches.length} saved searches.`);
  console.log("Search seed complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
