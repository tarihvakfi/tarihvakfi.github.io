#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const sourceDir = process.argv[2];
const outputFile = process.argv[3] || "supabase-import.sql";

if (!sourceDir) {
  console.error("Kullanım: node tools/import-supabase-data.mjs <yedek-klasörü> [çıktı.sql]");
  process.exit(1);
}

const tables = [
  "library_members",
  "library_locations",
  "library_shelf_positions",
  "library_boxes",
  "library_books",
  "library_shelf_counts",
  "library_decision_opinions",
  "library_decision_resolutions",
  "library_decision_events",
  "library_contact_messages",
];

const generatedColumns = new Set(["total_count", "voter_key"]);

function sqlValue(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `'${text.replaceAll("'", "''")}'`;
}

const output = [
  "PRAGMA foreign_keys = OFF;",
  ...[...tables].reverse().map((table) => `DELETE FROM ${table};`),
];

const counts = {};
for (const table of tables) {
  const rows = JSON.parse(await readFile(join(sourceDir, `${table}.json`), "utf8"));
  counts[table] = rows.length;
  if (!rows.length) continue;

  const columns = Object.keys(rows[0]).filter((column) => !generatedColumns.has(column));
  for (let start = 0; start < rows.length; start += 40) {
    const batch = rows.slice(start, start + 40);
    output.push(
      `INSERT INTO ${table} (${columns.map((column) => `"${column}"`).join(", ")}) VALUES\n` +
        batch
          .map((row) => `(${columns.map((column) => sqlValue(row[column])).join(", ")})`)
          .join(",\n") +
        ";",
    );
  }
}

output.push("PRAGMA foreign_keys = ON;");
await writeFile(outputFile, `${output.join("\n\n")}\n`, { mode: 0o600 });
console.log(JSON.stringify({ outputFile, counts }, null, 2));
