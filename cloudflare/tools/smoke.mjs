#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const url = process.env.CF_LIBRARY_API_URL;
const coordinator = process.env.CF_TEST_COORDINATOR_PASSWORD;
const volunteer = process.env.CF_TEST_VOLUNTEER_PASSWORD;
if (!url || !coordinator || !volunteer) throw new Error("Test adresi ile iki test şifresi gerekli.");

const run = Date.now().toString(36).toUpperCase();
const actor = `Cloudflare kabul ${run}`;
const location = `T${run.slice(-4)}`;
const shelfCode = `${location}-ZZ01`;
const shelfId = randomUUID();
const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const timings = [];
let bookId = "";
let bookNo = 0;
let shelfPhoto = "";

function d1(command) {
  return execFileSync("npx", ["wrangler", "d1", "execute", "tarih-vakfi-library", "--remote", "--command", command, "--json"], { encoding:"utf8" });
}

async function api(action, extra = {}, password = coordinator) {
  const started = performance.now();
  const response = await fetch(url, {
    method:"POST", headers:{ "content-type":"text/plain;charset=utf-8" },
    body:JSON.stringify({ action, sifre:password, ...extra }), signal:AbortSignal.timeout(15000),
  });
  const data = await response.json();
  timings.push([action, Math.round(performance.now() - started)]);
  assert.equal(response.ok, true, `${action}: HTTP ${response.status}`);
  assert.equal(data.ok, true, `${action}: ${data.error || "başarısız"}`);
  return data;
}

try {
  d1(`INSERT INTO library_locations (code,name,sort_order) VALUES ('${location}','Geçici kabul testi',99999); INSERT INTO library_shelf_positions (id,code,location_code,bookcase_code,shelf_number,sort_order) VALUES ('${shelfId}','${shelfCode}','${location}','ZZ',1,99999);`);
  await api("config", {}, volunteer);
  const start = await api("koordinatorBaslangic", { adet:5 });
  assert.ok(start.durum && start.rafOzeti && start.kararlar);

  const chosen = await api("siraOner", { kaydeden:actor }, volunteer);
  assert.ok(chosen.anahtar);
  await api("siraBirak", { kaydeden:actor, anahtar:chosen.anahtar }, volunteer);
  const selected = await api("siraSec", { mekan:location, raf:"ZZ", sira:1, kaydeden:actor }, volunteer);
  assert.equal(selected.anahtar, shelfCode);
  const savedCount = await api("sayimKaydet", { mekan:location, raf:"ZZ", sira:1, sayan:actor, duzen:"tek", on:1, foto:pixel }, volunteer);
  shelfPhoto = decodeURIComponent(new URL(savedCount.fotoUrl).pathname.replace(/^\/photos\//, ""));
  const count = await api("sayimBilgisi", { mekan:location, raf:"ZZ", sira:1 }, volunteer);
  assert.equal(count.sayim.toplam, 1);

  const added = await api("ekle", { istemciId:`cf-${run}`, siraNo:1, kayit:{ mekan:location, raf:"ZZ", sira:1, baslik:"Geçici kabul kitabı", yazar:"Test", yil:"2026", nusha:1, durum:"Sağlam", kaydeden:actor } }, volunteer);
  bookNo = added.no;
  const bookRows = JSON.parse(d1(`SELECT id FROM library_books WHERE legacy_no=${bookNo};`));
  bookId = bookRows[0].results[0].id;
  await api("fotoEkle", { no:bookNo, hangi:"kapak", veri:pixel }, volunteer);
  await api("onayla", { no:bookNo, kayit:{ baslik:"Geçici kabul kitabı", yazar:"Test", yil:"2026", nusha:1, onaylayan:actor } });
  const decision = await api("kararVer", { numaralar:[bookNo], kategori:"gidecek", veren:actor, kural:"Cloudflare kabul testi" });
  assert.equal(decision.kesinlesti, true);
  await api("kararGeriAl", { numaralar:[bookNo], veren:actor });
  const found = await api("kayitBul", { yer:added.yerKodu }, volunteer);
  assert.equal(found.kayit.no, bookNo);
  console.log(JSON.stringify({ ok:true, actions:timings.length, maxMs:Math.max(...timings.map(([,ms]) => ms)), timings }, null, 2));
} finally {
  d1(`DELETE FROM library_decision_events WHERE book_id IN (SELECT id FROM library_books WHERE shelf_position_id='${shelfId}'); DELETE FROM library_decision_opinions WHERE book_id IN (SELECT id FROM library_books WHERE shelf_position_id='${shelfId}'); DELETE FROM library_decision_resolutions WHERE book_id IN (SELECT id FROM library_books WHERE shelf_position_id='${shelfId}'); DELETE FROM library_books WHERE shelf_position_id='${shelfId}'; DELETE FROM library_shelf_counts WHERE shelf_position_id='${shelfId}'; DELETE FROM library_shelf_positions WHERE id='${shelfId}'; DELETE FROM library_locations WHERE code='${location}';`);
  if (bookId) {
    execFileSync("npx", ["wrangler", "kv", "key", "delete", `books/${bookId}/cover.jpg`, "--binding", "PHOTOS", "--remote"], { stdio:"ignore" });
  }
  if (shelfPhoto) {
    execFileSync("npx", ["wrangler", "kv", "key", "delete", shelfPhoto, "--binding", "PHOTOS", "--remote"], { stdio:"ignore" });
  }
}
