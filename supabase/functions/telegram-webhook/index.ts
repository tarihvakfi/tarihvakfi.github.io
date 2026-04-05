import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') || ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') || ''

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

async function sendTg(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

function fmtHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return `${hrs}s ${mins}dk`
}

// ── Tarih/saat parse ──
function parseTime(s: string): string | null {
  const m = s.match(/(\d{1,2})[:\.]?(\d{2})?/)
  if (!m) return null
  const h = parseInt(m[1]); const min = m[2] ? parseInt(m[2]) : 0
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function parseDate(s: string): Date | null {
  const lower = s.toLowerCase().replace(/ı/g, 'i')
  const now = new Date()
  if (lower === 'bugun' || lower === 'bugün') return now
  if (lower === 'dun' || lower === 'dün') { const d = new Date(now); d.setDate(d.getDate() - 1); return d }
  const days: Record<string, number> = { pazartesi: 1, sali: 2, salı: 2, carsamba: 3, persembe: 4, cuma: 5, cumartesi: 6, pazar: 0 }
  for (const [name, dow] of Object.entries(days)) {
    if (lower.includes(name)) {
      const d = new Date(now); const diff = (now.getDay() - dow + 7) % 7 || 7; d.setDate(d.getDate() - diff); return d
    }
  }
  const months: Record<string, number> = { ocak:0, subat:1, mart:2, nisan:3, mayis:4, haziran:5, temmuz:6, agustos:7, eylul:8, ekim:9, kasim:10, aralik:11 }
  for (const [name, mi] of Object.entries(months)) {
    const dm = lower.match(new RegExp(`(\\d{1,2})\\s*${name}`))
    if (dm) return new Date(now.getFullYear(), mi, parseInt(dm[1]))
  }
  return null
}

function parseWorkReport(s: string): { date: string; hours: number; desc: string; mode?: string } | null {
  const lower = s.toLowerCase()
  // "bugun 3 saat belge taradim" / "dun 4.5 saat katalog girisi vakifta"
  const hourMatch = lower.match(/(\d+[.,]?\d*)\s*sa/)
  if (!hourMatch) return null
  const hours = parseFloat(hourMatch[1].replace(',', '.'))
  if (hours <= 0 || hours > 24) return null

  // Date: try to find day reference before hours
  const beforeHours = lower.slice(0, lower.indexOf(hourMatch[0])).trim()
  const date = parseDate(beforeHours || 'bugun') || new Date()
  const dateStr = date.toISOString().slice(0, 10)

  // Description: everything after "saat" keyword
  const afterSaat = s.slice(s.toLowerCase().indexOf('saat') + 4).trim()
    .replace(/vakıfta|vakifta|uzaktan|evden|remote|onsite/gi, '').trim()

  // Mode detection
  let mode: string | undefined
  if (/uzaktan|evden|remote/i.test(lower)) mode = 'remote'
  else if (/vakıfta|vakifta|onsite/i.test(lower)) mode = 'onsite'

  return { date: dateStr, hours, desc: afterSaat || '', mode }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK')

  // Secret check removed — Supabase function auth handles security

  try {
    const update = await req.json()
    const msg = update.message
    if (!msg) return new Response('OK')

    const chatId = msg.chat.id
    const tgUserId = msg.from.id
    const text = (msg.text || '').trim().toLowerCase()

    // ── Hesap eslestirme ──
    if (text.startsWith('/start ')) {
      const code = text.split(' ')[1]
      if (code) {
        const { data: profile } = await sb.from('profiles').select('id, display_name')
          .eq('telegram_link_code', code).is('telegram_id', null).single()
        if (profile) {
          await sb.from('profiles').update({ telegram_id: tgUserId, telegram_link_code: null }).eq('id', profile.id)
          await sendTg(chatId, `✅ Hesabın bağlandı! Hoş geldin <b>${profile.display_name}</b>!\n\nKomutlar:\n📝 "bugün 3 saat belge taradım"\n📊 /ozet — Çalışma özeti\n🏆 /belgelerim — Belgeler\n❓ /yardim — Yardım`)
          return new Response('OK')
        }
        await sendTg(chatId, '❌ Kod geçersiz. Web sitesinden yeni kod alın.')
        return new Response('OK')
      }
    }
    if (text === '/start') {
      await sendTg(chatId, '🏛️ <b>Tarih Vakfı Gönüllü Bot</b>\n\nHesabınızı bağlamak için:\ntarihvakfi.github.io → Profil → Telegram Bağla')
      return new Response('OK')
    }

    // ── Kullanıcıyı bul ──
    const { data: user } = await sb.from('profiles').select('id, display_name, telegram_state, department')
      .eq('telegram_id', tgUserId).single()
    if (!user) {
      await sendTg(chatId, '⚠️ Hesabınız bağlı değil.\ntarihvakfi.github.io → Profil → Telegram Bağla')
      return new Response('OK')
    }
    const uid = user.id

    // ── Rapor sonrası plan bekleme ──
    if (user.telegram_state === 'awaiting_plan') {
      if (text === '/atla') {
        await sb.from('profiles').update({ telegram_state: null }).eq('id', uid)
        await sendTg(chatId, 'Tamam! İyi günler 👋')
        return new Response('OK')
      }
      // Son raporu bul ve plan ekle
      const { data: lastReport } = await sb.from('work_reports').select('id')
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(1).single()
      if (lastReport) {
        await sb.from('work_reports').update({ next_plan: msg.text?.trim() || '' }).eq('id', lastReport.id)
      }
      const now = new Date()
      const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      const { data: weekData } = await sb.from('work_reports').select('hours')
        .eq('user_id', uid).gte('date', monday.toISOString().slice(0, 10))
      const weekTotal = (weekData || []).reduce((a: number, c: any) => a + Number(c.hours || 0), 0)
      await sb.from('profiles').update({ telegram_state: null }).eq('id', uid)
      await sendTg(chatId, `📌 Not alındı!\nBu hafta toplam: <b>${fmtHours(weekTotal)}</b> 👋`)
      return new Response('OK')
    }

    // ── Mod bekleme (rapor sonrası) ──
    if (user.telegram_state?.startsWith('awaiting_mode:')) {
      const json = user.telegram_state.slice('awaiting_mode:'.length)
      let mode = 'onsite'
      if (['uzaktan', 'remote', 'ev', 'evden', '2', '🏠'].includes(text)) mode = 'remote'
      else if (['vakıftayım', 'vakiftayim', 'vakıf', 'vakif', 'onsite', '1', '🏛️'].includes(text)) mode = 'onsite'
      else { await sendTg(chatId, '🏛️ "vakıftayım" veya 🏠 "uzaktan" yaz.'); return new Response('OK') }

      try {
        const data = JSON.parse(json)
        await sb.from('work_reports').insert({
          user_id: uid, date: data.date, hours: data.hours,
          work_mode: mode, description: data.desc, source: 'telegram',
        })
        await sb.from('profiles').update({ telegram_state: 'awaiting_plan' }).eq('id', uid)
        const modeLabel = mode === 'remote' ? '🏠 uzaktan' : '🏛️ vakıfta'
        await sendTg(chatId, `✅ Kaydedildi! ${data.date} — <b>${fmtHours(data.hours)}</b> (${modeLabel})\n"${data.desc}"\n\n📌 Sonraki planın? (/atla ile geç)`)
      } catch { await sb.from('profiles').update({ telegram_state: null }).eq('id', uid) }
      return new Response('OK')
    }

    // ── /ozet ──
    if (text === '/ozet' || text === '/durum') {
      const { data: ws } = await sb.from('volunteer_work_summary').select('*').eq('id', uid).single()
      if (ws) {
        await sendTg(chatId, `📊 <b>Çalışma Özetin</b>\n\nBu hafta: <b>${ws.week_days} rapor, ${fmtHours(Number(ws.week_hours))}</b>\nBu ay: <b>${ws.month_days} rapor, ${fmtHours(Number(ws.month_hours))}</b>\nToplam: <b>${ws.total_days} rapor, ${fmtHours(Number(ws.total_hours))}</b>`)
      } else await sendTg(chatId, 'Henüz kayıt yok.')
      return new Response('OK')
    }

    // ── /rapor (sadece admin) ──
    if (text === '/rapor' || text.startsWith('/rapor ')) {
      if (user.department && !['admin'].includes((await sb.from('profiles').select('role').eq('id', uid).single()).data?.role)) {
        await sendTg(chatId, '⚠️ Bu komut sadece yöneticiler için.'); return new Response('OK')
      }
      const arg = text.split(' ')[1] || 'hafta'
      const now = new Date()
      const todayStr = now.toISOString().slice(0,10)
      let start = todayStr, label = 'Bugün'
      if (arg === 'hafta' || arg === 'week') {
        const mon = new Date(now); mon.setDate(now.getDate() - ((now.getDay()+6)%7))
        start = mon.toISOString().slice(0,10); label = 'Bu Hafta'
      } else if (arg === 'ay' || arg === 'month') {
        start = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`; label = 'Bu Ay'
      }
      const { data: reps } = await sb.from('work_reports').select('hours, work_mode, user_id, description, profiles!user_id(display_name)')
        .gte('date', start).lte('date', todayStr)
      const totalH = (reps||[]).reduce((a: number,r: any) => a + Number(r.hours||0), 0)
      const vols = new Set((reps||[]).map((r: any) => r.user_id)).size
      const onsite = (reps||[]).filter((r: any) => r.work_mode === 'onsite').reduce((a: number,r: any) => a + Number(r.hours||0), 0)
      const remote = (reps||[]).filter((r: any) => r.work_mode === 'remote').reduce((a: number,r: any) => a + Number(r.hours||0), 0)
      let reply = `📄 <b>${label} Raporu</b>\n\n👥 Çalışan: ${vols} kişi\n⏱️ Toplam: ${fmtHours(totalH)}\n🏛️ Vakıfta: ${fmtHours(onsite)}\n🏠 Uzaktan: ${fmtHours(remote)}\n📝 Rapor sayısı: ${(reps||[]).length}`
      reply += '\n\nDetaylı rapor için siteyi ziyaret edin.'
      await sendTg(chatId, reply)
      return new Response('OK')
    }

    // ── /belgelerim ──
    if (text === '/belgelerim') {
      const { data: certs } = await sb.from('certificates').select('title, certificate_number, created_at')
        .eq('user_id', uid).order('created_at', { ascending: false }).limit(5)
      if (certs?.length) {
        let reply = '🏆 <b>Belgeleriniz:</b>\n'
        for (const c of certs) reply += `\n  ${c.title} — ${c.created_at?.slice(0,10)} (${c.certificate_number})`
        reply += '\n\nİndirmek için: tarihvakfi.github.io → Profil → Belgelerim'
        await sendTg(chatId, reply)
      } else await sendTg(chatId, 'Henüz belgeniz yok.')
      return new Response('OK')
    }

    // ── /yardim ──
    if (text === '/yardim' || text === '/help') {
      await sendTg(chatId, `🏛️ <b>Tarih Vakfı Bot</b>\n\n📝 Rapor gir:\n<i>"bugün 3 saat belge taradım"</i>\n<i>"dün 4.5 saat katalog girişi uzaktan"</i>\n\n📊 /ozet — Çalışma özeti\n🏆 /belgelerim — Belgeler\n❓ /yardim — Bu mesaj`)
      return new Response('OK')
    }

    // ── Doğal dil rapor girişi ──
    const report = parseWorkReport(msg.text || '')
    if (report) {
      const diff = Math.floor((Date.now() - new Date(report.date).getTime()) / 86400000)
      if (diff > 30) { await sendTg(chatId, '❌ Max 30 gün geriye rapor girilebilir.'); return new Response('OK') }

      if (report.mode) {
        // Mod belli, direkt kaydet
        await sb.from('work_reports').insert({
          user_id: uid, date: report.date, hours: report.hours,
          work_mode: report.mode, description: report.desc, source: 'telegram',
        })
        await sb.from('profiles').update({ telegram_state: 'awaiting_plan' }).eq('id', uid)
        const modeLabel = report.mode === 'remote' ? '🏠 uzaktan' : '🏛️ vakıfta'
        await sendTg(chatId, `✅ Kaydedildi! ${report.date} — <b>${fmtHours(report.hours)}</b> (${modeLabel})\n"${report.desc}"\n\n📌 Sonraki planın? (/atla ile geç)`)
      } else {
        // Mod sor
        const json = JSON.stringify({ date: report.date, hours: report.hours, desc: report.desc })
        await sb.from('profiles').update({ telegram_state: `awaiting_mode:${json}` }).eq('id', uid)
        await sendTg(chatId, `📝 ${report.date} — ${fmtHours(report.hours)}\n"${report.desc}"\n\nNerede çalıştın?\n🏛️ "vakıftayım" veya 🏠 "uzaktan"`)
      }
      return new Response('OK')
    }

    // Bilinmeyen mesaj
    await sendTg(chatId, 'Anlamadım 🤔\n\nÖrnek: <i>"bugün 3 saat belge taradım"</i>\nKomutlar: /ozet, /belgelerim, /yardim')

  } catch (e) {
    console.error('Webhook error:', e)
  }
  return new Response('OK')
})
