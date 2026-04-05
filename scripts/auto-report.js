#!/usr/bin/env node
/**
 * Otomatik rapor olusturma
 * GitHub Actions ile gunluk/haftalik/aylik calisir
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Eksik: SUPABASE_URL, SUPABASE_SERVICE_KEY'); process.exit(1); }

async function sbGet(table, select = '*', extra = '') {
  const params = new URLSearchParams({ select });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}${extra ? '&' + extra : ''}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status}`);
  return res.json();
}
async function sbInsert(table, data) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  });
}
async function sbUpdate(table, data, filter) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(data),
  });
}
async function sendTg(chatId, text) {
  if (!BOT_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  }).catch(() => {});
}

const MO = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const fdf = d => { if (!d) return ''; const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };
const fmtH = h => { const hrs = Math.floor(h); const mins = Math.round((h - hrs) * 60); return `${hrs}s ${mins}dk`; };
const DEPTS = ['arsiv','egitim','etkinlik','dijital','rehber','baski','bagis','idari'];
const DL = { arsiv:'Arşiv',egitim:'Eğitim',etkinlik:'Etkinlik',dijital:'Dijital',rehber:'Rehber',baski:'Yayın',bagis:'Bağış',idari:'İdari' };

function detectType() {
  if (process.env.REPORT_TYPE) return process.env.REPORT_TYPE;
  const now = new Date();
  const hour = now.getUTCHours();
  const day = now.getUTCDay();
  const date = now.getUTCDate();
  if (date === 1 && hour >= 21) return 'monthly';
  if (day === 0 && hour >= 21) return 'weekly';
  return 'daily';
}

function getPeriod(type) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (type === 'daily') return { start: today, end: today };
  if (type === 'weekly') {
    const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { start: mon.toISOString().slice(0, 10), end: today };
  }
  // monthly: gecen ay
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: lastMonth.toISOString().slice(0, 10), end: lastDay.toISOString().slice(0, 10) };
}

async function main() {
  const type = detectType();
  const period = getPeriod(type);
  console.log(`Rapor tipi: ${type}, Dönem: ${period.start} — ${period.end}`);

  const [profiles, reports, tasks] = await Promise.all([
    sbGet('profiles', 'id,display_name,email,role,department,status,telegram_id', 'status=eq.active'),
    sbGet('work_reports', '*', `date=gte.${period.start}&date=lte.${period.end}&order=date.desc`),
    sbGet('tasks', '*', 'order=created_at.desc'),
  ]);

  const name = id => profiles.find(p => p.id === id)?.display_name || '';
  const totalH = reports.reduce((a, r) => a + Number(r.hours || 0), 0);
  const totalDays = new Set(reports.map(r => r.date)).size;
  const uniqueVols = new Set(reports.map(r => r.user_id)).size;
  const onsite = reports.filter(r => r.work_mode === 'onsite').reduce((a, r) => a + Number(r.hours || 0), 0);
  const remote = reports.filter(r => r.work_mode === 'remote').reduce((a, r) => a + Number(r.hours || 0), 0);
  const done = tasks.filter(t => t.status === 'done' && t.completed_at >= period.start + 'T00:00:00');
  const active = tasks.filter(t => ['active', 'review', 'pending'].includes(t.status));
  const overdue = active.filter(t => t.deadline && t.deadline < period.end);
  const pending = reports.filter(r => r.status === 'pending');

  const lines = [];
  const typeLabel = type === 'daily' ? 'Günlük Rapor' : type === 'weekly' ? 'Haftalık Özet' : 'Aylık Rapor';
  lines.push(`🏛️ Tarih Vakfı — ${typeLabel}`);
  lines.push(`📅 ${fdf(period.start)}${period.start !== period.end ? ' — ' + fdf(period.end) : ''}`);
  lines.push('');

  // Genel ozet
  lines.push(`👥 Çalışan: ${uniqueVols} kişi`);
  lines.push(`⏱️ Toplam: ${fmtH(totalH)} / ${totalDays} gün`);
  if (totalH > 0) {
    lines.push(`  🏛️ Vakıfta: ${fmtH(onsite)} (%${Math.round(onsite/totalH*100)})`);
    lines.push(`  🏠 Uzaktan: ${fmtH(remote)} (%${Math.round(remote/totalH*100)})`);
  }
  lines.push(`📋 Tamamlanan: ${done.length} | Devam eden: ${active.length}`);
  if (overdue.length) lines.push(`⚠️ Gecikmiş iş: ${overdue.length}`);
  if (pending.length) lines.push(`⏳ Onay bekleyen: ${pending.length} rapor`);

  // Departman
  lines.push('');
  lines.push('🏢 Departman bazlı:');
  for (const d of DEPTS) {
    const dr = reports.filter(r => { const p = profiles.find(p => p.id === r.user_id); return p?.department === d; });
    const dh = dr.reduce((a, r) => a + Number(r.hours || 0), 0);
    const dp = new Set(dr.map(r => r.user_id)).size;
    if (dh > 0) lines.push(`  ${DL[d]}: ${fmtH(dh)} (${dp} kişi)`);
  }

  // Gunluk: detay
  if (type === 'daily') {
    if (reports.length) {
      lines.push('');
      lines.push('📝 Bugün çalışanlar:');
      for (const r of reports) {
        const mode = r.work_mode === 'remote' ? '🏠' : '🏛️';
        lines.push(`  ${name(r.user_id)} — ${fmtH(r.hours)} ${mode} — ${r.description || ''}`);
      }
    }
    const plans = reports.filter(r => r.next_plan).map(r => `  ${name(r.user_id)}: ${r.next_plan}`);
    if (plans.length) { lines.push(''); lines.push('📌 Yarın planı:'); lines.push(...plans); }
    if (reports.length === 0) lines.push('\n⚠️ Bugün hiç rapor girilmedi.');
  }

  // Kisi bazli (haftalik/aylik)
  if (type === 'weekly' || type === 'monthly') {
    lines.push('');
    lines.push('👥 Kişi bazlı:');
    const byPerson = {};
    for (const r of reports) {
      if (!byPerson[r.user_id]) byPerson[r.user_id] = { hours: 0, days: new Set() };
      byPerson[r.user_id].hours += Number(r.hours || 0);
      byPerson[r.user_id].days.add(r.date);
    }
    const sorted = Object.entries(byPerson).sort(([,a], [,b]) => b.hours - a.hours);
    for (const [uid, s] of sorted) {
      lines.push(`  ${name(uid)}: ${s.days.size} gün, ${fmtH(s.hours)}`);
    }

    // Uyarilar
    if (type === 'weekly') {
      const lastWeekStart = new Date(period.start);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      const inactive = profiles.filter(p => !reports.some(r => r.user_id === p.id));
      if (inactive.length) {
        lines.push('');
        lines.push('⚠️ Bu dönem çalışmayan:');
        for (const p of inactive.slice(0, 5)) lines.push(`  ${p.display_name}`);
      }
    }

    if (type === 'monthly') {
      const topPerson = sorted[0];
      if (topPerson) lines.push(`\n🏆 En aktif: ${name(topPerson[0])} (${fmtH(topPerson[1].hours)})`);
    }
  }

  const content = lines.join('\n');
  console.log('\n' + content + '\n');

  // Supabase'e kaydet
  console.log('Supabase kayit...');
  await sbInsert('reports', { type, content, period_start: period.start, period_end: period.end, data: { total_hours: totalH, total_days: totalDays, vol_count: uniqueVols } });

  // Bildirim gonder
  const notifyRoles = type === 'daily' ? ['admin'] : ['admin', 'coord'];
  const notifyUsers = profiles.filter(p => notifyRoles.includes(p.role));
  const shortMsg = `📊 ${typeLabel} hazır — ${uniqueVols} kişi, ${fmtH(totalH)}, ${done.length} iş tamamlandı`;

  for (const u of notifyUsers) {
    await sbInsert('notifications', { user_id: u.id, type: 'system', title: shortMsg, body: '' });
    if (u.telegram_id && BOT_TOKEN) {
      const tgContent = type === 'monthly' ? content.slice(0, 3000) + '\n\nDetay: tarihvakfi.github.io' : content;
      await sendTg(u.telegram_id, tgContent);
    }
  }

  console.log(`Rapor tamamlandi. ${notifyUsers.length} kisiye bildirim gonderildi.`);

  // ── Inactivity check (sadece gunluk raporda) ──
  if (type === 'daily') {
    console.log('\nInactivity kontrolu...');
    const allVols = await sbGet('profiles', 'id,display_name,email,status,role,telegram_id', 'role=eq.vol&status=eq.active');
    const allReports = await sbGet('work_reports', 'user_id,date', 'order=date.desc');
    const admins = profiles.filter(p => p.role === 'admin');
    const now = new Date();

    for (const vol of allVols) {
      const lastReport = allReports.find(r => r.user_id === vol.id);
      const lastDate = lastReport ? new Date(lastReport.date) : new Date(0);
      const daysSince = Math.floor((now - lastDate) / 86400000);

      if (daysSince >= 30) {
        // Pasife al
        console.log(`  ❌ ${vol.display_name}: ${daysSince} gun → pasife aliniyor`);
        await sbUpdate('profiles', { status: 'inactive' }, `id=eq.${vol.id}`);
        await sbInsert('notifications', { user_id: vol.id, type: 'system', title: '⚠️ Hesabınız pasife alındı', body: '30 gündür çalışma raporu girmediniz. Tekrar aktif olmak için yöneticiyle iletişime geçin.' });
        for (const a of admins) {
          await sbInsert('notifications', { user_id: a.id, type: 'system', title: `${vol.display_name} otomatik pasife alındı`, body: '30 gün raporlama yapmadı.' });
        }
        if (vol.telegram_id) await sendTg(vol.telegram_id, '⚠️ Hesabınız 30 gündür raporlama yapılmadığı için pasife alındı.\nTekrar aktif olmak için yöneticiyle iletişime geçin.');
      } else if (daysSince === 25) {
        console.log(`  ⚠️ ${vol.display_name}: 25 gun — son uyari`);
        await sbInsert('notifications', { user_id: vol.id, type: 'system', title: '⚠️ Son uyarı: 5 gün kaldı', body: '5 gün içinde çalışma raporu girmezseniz hesabınız pasife alınacak.' });
        if (vol.telegram_id) await sendTg(vol.telegram_id, '⚠️ Son uyarı: 5 gün içinde çalışma raporu girmezseniz hesabınız pasife alınacak.');
      } else if (daysSince === 20) {
        console.log(`  ⚠️ ${vol.display_name}: 20 gun — ilk uyari`);
        await sbInsert('notifications', { user_id: vol.id, type: 'system', title: '⚠️ 20 gündür rapor girmediniz', body: '10 gün içinde raporlama yapmazsanız hesabınız pasife alınacak.' });
        if (vol.telegram_id) await sendTg(vol.telegram_id, '⚠️ 20 gündür çalışma raporu girmediniz.\n10 gün içinde raporlama yapmazsanız hesabınız pasife alınacak.');
      }
    }
    console.log('Inactivity kontrolu tamamlandi.');
  }
}

main().catch(e => { console.error('HATA:', e.message); process.exit(1); });
