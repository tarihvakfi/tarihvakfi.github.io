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

    // Aktivite durumu
    const actProfiles = await sbGet('profiles', 'display_name,activity_score,activity_status', 'role=eq.vol&status=eq.active');
    const actCounts = { active:0, slowing:0, inactive:0, dormant:0 };
    actProfiles.forEach(p => { actCounts[p.activity_status || 'active']++; });
    lines.push('');
    lines.push('📊 Gönüllü Aktivite:');
    lines.push(`  🟢 Aktif: ${actCounts.active} | 🟡 Yavaşlıyor: ${actCounts.slowing} | 🟠 Pasifleşiyor: ${actCounts.inactive} | 🔴 Hareketsiz: ${actCounts.dormant}`);
    const slowing = actProfiles.filter(p => ['slowing','inactive','dormant'].includes(p.activity_status));
    if (slowing.length) {
      lines.push('  Dikkat:');
      for (const s of slowing.slice(0,5)) lines.push(`    ${s.activity_status === 'slowing' ? '🟡' : s.activity_status === 'inactive' ? '🟠' : '🔴'} ${s.display_name} (skor: ${s.activity_score})`);
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

  // ── Aktivite skoru + kademeli hatırlatma (sadece günlük) ──
  if (type === 'daily') {
    console.log('\nAktivite skoru hesaplaniyor...');
    const allVols = await sbGet('profiles', 'id,display_name,email,status,role,telegram_id,activity_score,activity_status', 'role=eq.vol&status=eq.active');
    const allReports = await sbGet('work_reports', 'user_id,date', 'order=date.desc');
    const allProgress = await sbGet('task_progress_logs', 'user_id,created_at', 'order=created_at.desc');
    const allNotifReads = await sbGet('notifications', 'user_id,is_read,created_at', 'is_read=eq.true&order=created_at.desc');
    const existingNotifs = await sbGet('notifications', 'user_id,title', 'order=created_at.desc&limit=500');
    const admins = profiles.filter(p => p.role === 'admin');
    const coords = profiles.filter(p => p.role === 'coord');
    const now = new Date();
    const d7 = new Date(now - 7*86400000).toISOString().slice(0,10);
    const d14 = new Date(now - 14*86400000).toISOString().slice(0,10);
    const d30 = new Date(now - 30*86400000).toISOString().slice(0,10);
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

    // Tekrar gonderimi engelle
    const hasNotif = (uid, titlePrefix) => existingNotifs.some(n => n.user_id === uid && n.title?.startsWith(titlePrefix));

    for (const vol of allVols) {
      const volReports = allReports.filter(r => r.user_id === vol.id);
      const lastReport = volReports[0];
      const lastDate = lastReport ? new Date(lastReport.date) : new Date(0);
      const daysSince = Math.floor((now - lastDate) / 86400000);

      // Skor hesapla
      let score = 0;
      if (volReports.some(r => r.date >= d7)) score += 30;
      if (volReports.some(r => r.date >= d14)) score += 20;
      if (volReports.some(r => r.date >= d30)) score += 10;
      if (allProgress.some(p => p.user_id === vol.id && p.created_at >= monthStart)) score += 15;
      if (allNotifReads.some(n => n.user_id === vol.id && n.created_at >= monthStart)) score += 10;
      if (volReports.some(r => r.date >= monthStart)) score += 15;

      const status = score >= 80 ? 'active' : score >= 50 ? 'slowing' : score >= 20 ? 'inactive' : 'dormant';
      const statusIcon = score >= 80 ? '🟢' : score >= 50 ? '🟡' : score >= 20 ? '🟠' : '🔴';

      await sbUpdate('profiles', { activity_score: score, activity_status: status, last_activity_at: lastDate.toISOString() }, `id=eq.${vol.id}`);

      // Kademeli hatırlatma
      if (daysSince >= 30) {
        console.log(`  🔴 ${vol.display_name}: ${daysSince}g skor:${score} → pasife`);
        await sbUpdate('profiles', { status: 'inactive' }, `id=eq.${vol.id}`);
        await sbInsert('notifications', { user_id: vol.id, type: 'system', title: 'Hesabınız pasife alındı', body: 'Ara vermek istersen bize bildir, döndüğünde buradayız. 🙂' });
        for (const a of admins) await sbInsert('notifications', { user_id: a.id, type: 'system', title: `${vol.display_name} otomatik pasife alındı`, body: `${daysSince} gündür raporlama yapmadı.` });
        if (vol.telegram_id) await sendTg(vol.telegram_id, 'Hesabınız pasife alındı. Ara vermek istersen bize bildir, döndüğünde buradayız. 🙂');
      } else if (daysSince >= 20 && !hasNotif(vol.id, '⚠️ Seni bekliyoruz')) {
        console.log(`  🟠 ${vol.display_name}: ${daysSince}g skor:${score} → son uyari`);
        await sbInsert('notifications', { user_id: vol.id, type: 'system', title: '⚠️ Seni bekliyoruz', body: 'Ara vermek istersen bize bildir. 10 gün içinde raporlama olmazsa hesabın pasife alınacak.' });
        for (const c of coords.filter(c => c.department === vol.department)) await sbInsert('notifications', { user_id: c.id, type: 'system', title: `${vol.display_name} 20+ gündür aktif değil`, body: '' });
        if (vol.telegram_id) await sendTg(vol.telegram_id, 'Seni bekliyoruz! Ara vermek istersen bize bildir. 🙂\n10 gün içinde raporlama olmazsa hesabın pasife alınacak.');
      } else if (daysSince >= 14 && !hasNotif(vol.id, 'Seni özledik')) {
        console.log(`  🟠 ${vol.display_name}: ${daysSince}g skor:${score} → 14g uyari`);
        await sbInsert('notifications', { user_id: vol.id, type: 'system', title: 'Seni özledik! 🙂', body: 'Devam etmek istersen bekliyoruz. Ara vermek istersen bize bildir.' });
        for (const c of coords.filter(c => c.department === vol.department)) await sbInsert('notifications', { user_id: c.id, type: 'system', title: `${vol.display_name} 14 gündür aktif değil`, body: '' });
        if (vol.telegram_id) await sendTg(vol.telegram_id, 'Seni özledik! Devam etmek istersen bekliyoruz. 🙂');
      } else if (daysSince >= 7 && !hasNotif(vol.id, 'Nasılsın')) {
        console.log(`  🟡 ${vol.display_name}: ${daysSince}g skor:${score} → 7g hatirlatma`);
        await sbInsert('notifications', { user_id: vol.id, type: 'system', title: 'Nasılsın? 🙂', body: 'Son raporundan beri 7 gün geçti. Her şey yolunda mı?' });
        if (vol.telegram_id) await sendTg(vol.telegram_id, 'Nasılsın? Son raporundan beri 7 gün geçti. Her şey yolunda mı? 🙂');
      } else {
        if (score !== vol.activity_score) console.log(`  ${statusIcon} ${vol.display_name}: skor ${vol.activity_score||0}→${score}`);
      }
    }
    console.log('Aktivite kontrolu tamamlandi.');

    // Gecikme uyarısı
    console.log('Gecikme kontrolu...');
    const allTasks = await sbGet('tasks', 'id,title,status,deadline,assigned_to,department', 'status=neq.done&status=neq.cancelled');
    const todayStr = now.toISOString().slice(0, 10);
    for (const t of allTasks) {
      if (t.deadline && t.deadline < todayStr) {
        const deptCoords = profiles.filter(p => p.role === 'coord' && p.department === t.department);
        for (const c of [...deptCoords, ...admins]) {
          if (!hasNotif(c.id, `⚠️ Gecikme: ${t.title}`)) {
            await sbInsert('notifications', { user_id: c.id, type: 'system', title: `⚠️ Gecikme: ${t.title}`, body: `Deadline ${t.deadline} idi, hâlâ tamamlanmadı.` });
          }
        }
      }
    }

    // Boşta gönüllü uyarısı (haftalık — pazar günü)
    if (now.getDay() === 0) {
      console.log('Bosta gonullu kontrolu...');
      for (const vol of allVols) {
        const hasTask = allTasks.some(t => (t.assigned_to || []).includes(vol.id));
        if (!hasTask) {
          const deptCoords = profiles.filter(p => p.role === 'coord' && p.department === vol.department);
          for (const c of deptCoords) {
            await sbInsert('notifications', { user_id: c.id, type: 'system', title: `📋 ${vol.display_name} boşta`, body: 'Aktif ama atanmış işi yok. İş atamayı düşünün.' });
          }
        }
      }
    }
  }
}

main().catch(e => { console.error('HATA:', e.message); process.exit(1); });
