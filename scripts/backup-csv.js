#!/usr/bin/env node
/**
 * CSV yedekleme — backups/ klasorune kaydet
 * Son 30 yedeği tutar, eskileri siler.
 */

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Eksik: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

async function supabaseGet(table) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status}`);
  return res.json();
}

function toCsv(data) {
  if (!data.length) return '';
  const keys = Object.keys(data[0]);
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [keys.map(esc).join(','), ...data.map(r => keys.map(k => esc(r[k])).join(','))].join('\n');
}

async function main() {
  const tables = ['profiles','tasks','hour_logs','shifts','announcements','applications','requests','messages','task_comments','task_progress_logs','shift_notes','notifications','visibility_settings'];

  const now = new Date();
  const stamp = now.toISOString().slice(0, 10);
  const dir = path.join(__dirname, '..', 'backups', stamp);
  fs.mkdirSync(dir, { recursive: true });

  let total = 0;
  for (const t of tables) {
    const data = await supabaseGet(t);
    fs.writeFileSync(path.join(dir, `${t}.csv`), '\uFEFF' + toCsv(data));
    total += data.length;
    console.log(`  ${t}: ${data.length} kayit`);
  }

  // Son 30 yedeği tut
  const backupsDir = path.join(__dirname, '..', 'backups');
  const dirs = fs.readdirSync(backupsDir).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  while (dirs.length > 30) {
    const old = dirs.shift();
    fs.rmSync(path.join(backupsDir, old), { recursive: true });
    console.log(`  Eski yedek silindi: ${old}`);
  }

  console.log(`\nCSV yedekleme tamamlandi: ${total} kayit → backups/${stamp}/`);
}

main().catch(err => { console.error('HATA:', err.message); process.exit(1); });
