/**
 * Unified seed script — runs all seed files in dependency order.
 * Usage: npx ts-node prisma/seed-all.ts
 *
 * Dependencies:
 * - Base data (deadlines, search, billing-audit benchmarks) → no deps
 * - Fee structures, referrals, CLE → no deps
 * - Portal (needs clients/matters) → after base
 * - Status updates, pulse, payments → after portal
 * - Timeline, translations → after portal
 * - Scheduling, e-filing → after matters
 * - Next actions, discovery → after matters + deadlines
 * - Workflows → after cascades + discovery + fee structures
 * - Contingency, fee-splits → after matters + fee structures
 * - Forecast, invoicing → after billing data
 * - Quick invoice → after invoicing
 * - Trust accounting → after matters
 * - Assembly → standalone
 */

import { execSync } from "child_process";
import path from "path";

const seedFiles = [
  // Layer 0: No dependencies (base data, reference tables)
  "seed-deadlines.ts",
  "seed-search.ts",
  "seed-billing-audit.ts",
  "seed-fee-structures.ts",
  "seed-cle-jurisdictions.ts",
  "seed-referrals.ts",
  "seed-efiling-platforms.ts",
  "seed-translations.ts",
  "seed-assembly.ts",
  "seed-discovery-templates.ts",

  // Layer 1: Depends on matters/clients existing
  "seed-portal.ts",
  "seed-next-actions.ts",
  "seed-timeline.ts",
  "seed-trust-accounting.ts",
  "seed-scheduling.ts",
  "seed-contingency.ts",
  "seed-fee-splits.ts",

  // Layer 2: Depends on layer 1 data
  "seed-status-updates.ts",
  "seed-pulse.ts",
  "seed-payments.ts",
  "seed-invoicing.ts",
  "seed-forecast.ts",

  // Layer 3: Depends on layer 2
  "seed-quick-invoice.ts",
  "seed-workflows.ts",

  // Layer 4: Standalone / no deps on above
  "seed-cac.ts",
  "seed-aging.ts",
  "seed-benchmarks.ts",
  "seed-reports.ts",
  "seed-digest.ts",
  "seed-realization.ts",
  "seed-court-calendar.ts",
  "seed-accounting-sync.ts",
  "seed-gmail.ts",
  "seed-meetings.ts",
  "seed-api-integrations.ts",
];

async function main() {
  console.log("===========================================");
  console.log("  Managal — Unified Seed Script");
  console.log("  Running " + seedFiles.length + " seed files");
  console.log("===========================================\n");

  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const file of seedFiles) {
    const filePath = path.join(__dirname, file);
    console.log(`[${succeeded + failed + 1}/${seedFiles.length}] Running ${file}...`);

    try {
      execSync(`npx ts-node "${filePath}"`, {
        cwd: path.join(__dirname, ".."),
        stdio: "pipe",
        timeout: 60000,
        env: { ...process.env },
      });
      console.log(`  ✅ ${file} — success`);
      succeeded++;
    } catch (error: any) {
      const stderr = error.stderr?.toString().slice(0, 200) || error.message;
      console.log(`  ❌ ${file} — FAILED: ${stderr}`);
      errors.push(`${file}: ${stderr}`);
      failed++;
    }
  }

  console.log("\n===========================================");
  console.log(`  Results: ${succeeded} succeeded, ${failed} failed`);
  console.log("===========================================");

  if (errors.length > 0) {
    console.log("\nErrors:");
    for (const err of errors) {
      console.log(`  - ${err}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main();
