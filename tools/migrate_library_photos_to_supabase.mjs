#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const concurrency = Math.max(1, Number(process.env.CONCURRENCY || 8));
if (!base || !key) throw new Error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.');

const headers = { apikey: key, Authorization: `Bearer ${key}` };

async function rest(path, options = {}) {
  const response = await fetch(`${base}/rest/v1/${path}`, {
    ...options, headers: { ...headers, ...(options.body ? { 'Content-Type':'application/json' } : {}), ...(options.headers || {}) },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${path}: ${text.slice(0,300)}`);
  return text ? JSON.parse(text) : null;
}

function driveId(url) {
  return (String(url || '').match(/[-\w]{25,}/) || [])[0] || '';
}

async function download(url) {
  const id = driveId(url);
  const source = id ? `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w2200` : url;
  let last;
  for (let attempt=1; attempt<=3; attempt++) {
    try {
      const response = await fetch(source, { redirect:'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const type = response.headers.get('content-type') || 'image/jpeg';
      if (!type.startsWith('image/')) throw new Error(`Fotoğraf yerine ${type} geldi`);
      return { bytes:new Uint8Array(await response.arrayBuffer()), type };
    } catch (error) { last=error; await new Promise(r=>setTimeout(r,attempt*500)); }
  }
  throw last;
}

async function upload(path, photo) {
  const response = await fetch(`${base}/storage/v1/object/library-photos/${path}`, {
    method:'POST', headers:{...headers,'Content-Type':photo.type,'x-upsert':'true'}, body:photo.bytes,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} yükleme: ${text.slice(0,300)}`);
}

async function pool(tasks, worker) {
  let cursor=0, done=0, failed=[];
  await Promise.all(Array.from({length:concurrency},async()=>{
    while (cursor<tasks.length) {
      const task=tasks[cursor++];
      try { await worker(task); }
      catch(error){failed.push({task,error:String(error?.message||error)});}
      done++; if(done%25===0||done===tasks.length) console.log(`${done}/${tasks.length} fotoğraf işlendi`);
    }
  }));
  return failed;
}

const source=JSON.parse(await readFile('.migration/library-export.json','utf8'));
const books=await rest('library_books?select=id,legacy_no,imprint_photo_path,cover_photo_path&limit=1000');
const counts=await rest('library_shelf_counts?select=id,legacy_source_key,photo_path&limit=1000');
const bookByNo=new Map(books.map(row=>[Number(row.legacy_no),row]));
const countByKey=new Map(counts.map(row=>[row.legacy_source_key,row]));
const tasks=[];

for(const old of source.books){
  const row=bookByNo.get(Number(old.legacy_no));if(!row)continue;
  if(old.legacy_imprint_url&&!row.imprint_photo_path)tasks.push({kind:'book',id:row.id,field:'imprint_photo_path',path:`books/${row.id}/imprint.jpg`,url:old.legacy_imprint_url});
  if(old.legacy_cover_url&&!row.cover_photo_path)tasks.push({kind:'book',id:row.id,field:'cover_photo_path',path:`books/${row.id}/cover.jpg`,url:old.legacy_cover_url});
}
for(const old of source.shelfCounts){
  const row=countByKey.get(old.legacy_source_key);if(!row||!old.legacy_photo_url||row.photo_path)continue;
  tasks.push({kind:'count',id:row.id,field:'photo_path',path:`shelves/${old.shelf_code}/${row.id}.jpg`,url:old.legacy_photo_url});
}

console.log(`${tasks.length} fotoğraf Supabase Storage'a taşınacak.`);
const failures=await pool(tasks,async task=>{
  const photo=await download(task.url);await upload(task.path,photo);
  const table=task.kind==='book'?'library_books':'library_shelf_counts';
  const {error}=await rest(`${table}?${task.kind==='book'?'id':'id'}=eq.${task.id}`,{method:'PATCH',body:JSON.stringify({[task.field]:task.path}),headers:{Prefer:'return=minimal'}}).then(()=>({})).catch(error=>({error}));
  if(error)throw error;
});
console.log(JSON.stringify({requested:tasks.length,succeeded:tasks.length-failures.length,failed:failures.length,failures:failures.slice(0,10)},null,2));
if(failures.length)process.exitCode=1;
