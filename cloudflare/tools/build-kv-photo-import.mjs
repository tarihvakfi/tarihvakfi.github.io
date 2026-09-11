#!/usr/bin/env node

import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, join, relative, sep } from "node:path";

const sourceDir = process.argv[2];
const outputDir = process.argv[3];
if (!sourceDir || !outputDir) {
  console.error("Kullanım: node tools/build-kv-photo-import.mjs <fotoğraf-klasörü> <çıktı-klasörü>");
  process.exit(1);
}

const types = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".gif": "image/gif", ".heic": "image/heic",
};

async function filesUnder(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes:true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

await mkdir(outputDir, { recursive:true, mode:0o700 });
const files = (await filesUnder(sourceDir)).sort();
const chunks = [];
let current = [];
let currentBytes = 0;

for (const file of files) {
  const content = await readFile(file);
  const key = relative(sourceDir, file).split(sep).join("/");
  const item = {
    key,
    value:content.toString("base64"),
    base64:true,
    metadata:{ contentType:types[extname(file).toLowerCase()] || "application/octet-stream" },
  };
  const itemBytes = Buffer.byteLength(JSON.stringify(item));
  if (current.length && (current.length >= 80 || currentBytes + itemBytes > 45_000_000)) {
    chunks.push(current); current = []; currentBytes = 0;
  }
  current.push(item); currentBytes += itemBytes;
}
if (current.length) chunks.push(current);

for (let index = 0; index < chunks.length; index++) {
  const name = `photos-${String(index + 1).padStart(3, "0")}.json`;
  await writeFile(join(outputDir, name), JSON.stringify(chunks[index]), { mode:0o600 });
}
await writeFile(join(outputDir, "manifest.json"), JSON.stringify({ files:files.length, chunks:chunks.length }, null, 2), { mode:0o600 });
console.log(JSON.stringify({ files:files.length, chunks:chunks.length }, null, 2));
