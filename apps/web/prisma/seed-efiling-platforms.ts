import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Seeding e-filing platforms...");

  await prisma.eFilingPlatform.upsert({
    where: { code: "NYSCEF" },
    create: {
      code: "NYSCEF", name: "NYSCEF — New York State Courts Electronic Filing",
      baseUrl: "https://iapps.courts.state.ny.us/nyscef",
      loginUrl: "https://iapps.courts.state.ny.us/nyscef/Login",
      supportedStates: ["NY"],
      supportedCourts: [
        { code: "NY-SUPREME-QUEENS", name: "Queens County Supreme Court", nyscefCountyCode: "28" },
        { code: "NY-SUPREME-KINGS", name: "Kings County Supreme Court", nyscefCountyCode: "11" },
        { code: "NY-SUPREME-NASSAU", name: "Nassau County Supreme Court", nyscefCountyCode: "30" },
        { code: "NY-SUPREME-SUFFOLK", name: "Suffolk County Supreme Court", nyscefCountyCode: "35" },
        { code: "NY-SUPREME-NEWYORK", name: "New York County Supreme Court", nyscefCountyCode: "60" },
        { code: "NY-SUPREME-BRONX", name: "Bronx County Supreme Court", nyscefCountyCode: "3" },
        { code: "NY-SUPREME-RICHMOND", name: "Richmond County Supreme Court", nyscefCountyCode: "31" },
        { code: "NY-FAMILY-QUEENS", name: "Queens County Family Court", nyscefCountyCode: "28F" },
        { code: "NY-FAMILY-KINGS", name: "Kings County Family Court", nyscefCountyCode: "11F" },
        { code: "NY-SURROGATE-QUEENS", name: "Queens County Surrogate's Court", nyscefCountyCode: "28S" },
      ],
      authType: "username_password",
      maxFileSizeMb: 25,
      allowedFileTypes: ["pdf", "tif", "tiff"],
    },
    update: {},
  });

  await prisma.eFilingPlatform.upsert({
    where: { code: "PACER_CMECF" },
    create: {
      code: "PACER_CMECF", name: "PACER/CM-ECF — Federal Courts",
      baseUrl: "https://pacer.login.uscourts.gov",
      loginUrl: "https://pacer.login.uscourts.gov/csologin/login.jsf",
      supportedStates: ["Federal"],
      supportedCourts: [
        { code: "EDNY", name: "Eastern District of New York", url: "https://ecf.nyed.uscourts.gov" },
        { code: "SDNY", name: "Southern District of New York", url: "https://ecf.nysd.uscourts.gov" },
        { code: "2CA", name: "Second Circuit Court of Appeals", url: "https://ecf.ca2.uscourts.gov" },
        { code: "NDNY", name: "Northern District of New York", url: "https://ecf.nynd.uscourts.gov" },
        { code: "WDNY", name: "Western District of New York", url: "https://ecf.nywd.uscourts.gov" },
      ],
      authType: "username_password",
      maxFileSizeMb: 50,
      allowedFileTypes: ["pdf"],
    },
    update: {},
  });

  await prisma.eFilingPlatform.upsert({
    where: { code: "TYLER_ODYSSEY" },
    create: {
      code: "TYLER_ODYSSEY", name: "Tyler Odyssey File & Serve",
      baseUrl: "https://api.efileng.com/EFMFirmService",
      supportedStates: ["TX", "IL", "OH", "CA", "IN", "MN", "UT", "ME"],
      supportedCourts: [],
      authType: "api_key",
      maxFileSizeMb: 35,
      allowedFileTypes: ["pdf", "docx", "rtf"],
    },
    update: {},
  });

  console.log("Seeded 3 e-filing platforms (NYSCEF, PACER, Tyler Odyssey).");

  // Demo credential
  await prisma.eFilingPlatformCredential.create({
    data: {
      platformId: (await prisma.eFilingPlatform.findUnique({ where: { code: "NYSCEF" } }))!.id,
      firmId: "demo-firm",
      displayName: "Firm NYSCEF Account",
      username: "rubinstein_law",
      passwordEnc: "encrypted_demo_password",
      lastVerifiedAt: new Date(),
    },
  }).catch(() => {}); // skip if exists

  console.log("E-filing seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
