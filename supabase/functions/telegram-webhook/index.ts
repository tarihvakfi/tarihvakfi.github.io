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

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
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
  if (lower === 'dun' || lower === 'dün') { const d = new Date(now); d.setDate(d.getDate() - 1); return d }
  if (lower === 'evvelsi' || lower === 'evvelsi gun') { const d = new Date(now); d.setDate(d.getDate() - 2); return d }
  const days: Record<string, number> = { pazartesi: 1, sali: 2, salı: 2, carsamba: 3, çarşamba: 3, persembe: 4, perşembe: 4, cuma: 5, cumartesi: 6, pazar: 0 }
  for (const [name, dow] of Object.entries(days)) {
    if (lower.includes(name)) {
      const d = new Date(now); const diff = (now.getDay() - dow + 7) % 7 || 7; d.setDate(d.getDate() - diff); return d
    }
  }
  // "3 nisan" format
  const months: Record<string, number> = { ocak:0, subat:1, şubat:1, mart:2, nisan:3, mayis:4, mayıs:4, haziran:5, temmuz:6, agustos:7, ağustos:7, eylul:8, eylül:8, ekim:9, kasim:10, kasım:10, aralik:11, aralık:11 }
  for (const [name, mi] of Object.entries(months)) {
    const dm = lower.match(new RegExp(`(\\d{1,2})\\s*${name}`))
    if (dm) { return new Date(now.getFullYear(), mi, parseInt(dm[1])) }
  }
  return null
}

function parseRetroNatural(s: string): { date: string; timeIn: string; timeOut: string } | null {
  const lower = s.toLowerCase()
  // "dün 10-15:30" or "pazartesi 09:00-14:00"
  const timeRange = lower.match(/(\d{1,2}[:\.]?\d{0,2})\s*[-–]\s*(\d{1,2}[:\.]?\d{0,2})/)
  if (!timeRange) return null
  const timeIn = parseTime(timeRange[1])
  const timeOut = parseTime(timeRange[2])
  if (!timeIn || !timeOut) return null
  // Remove time part to parse date
  const datePart = lower.replace(timeRange[0], '').trim()
  const d = parseDate(datePart || 'dün')
  if (!d) return null
  return { date: d.toISOString().slice(0, 10), timeIn, timeOut }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('OK')

  // Webhook secret check
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (WEBHOOK_SECRET && secret !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const update = await req.json()
    const msg = update.message
    if (!msg) return new Response('OK')

    const chatId = msg.chat.id
    const tgUserId = msg.from.id
    const text = (msg.text || '').trim().toLowerCase()

    // ── Hesap eslestirme kodu ──
    if (text.startsWith('/start ')) {
      const code = text.split(' ')[1]
      if (code) {
        const { data: profile } = await sb.from('profiles').select('id, display_name')
          .eq('telegram_link_code', code).is('telegram_id', null).single()
        if (profile) {
          await sb.from('profiles').update({ telegram_id: tgUserId, telegram_link_code: null })
            .eq('id', profile.id)
          await sendTg(chatId, `✅ Hesabın bağlandı!\nHoş geldin <b>${profile.display_name}</b>!\n\nKomutlar:\n🟢 geldim — Giriş yap\n🔴 çıkıyorum — Çıkış yap\n📊 /durum — Hafta özeti\n❓ /yardim — Yardım`)
          return new Response('OK')
        }
        await sendTg(chatId, '❌ Kod geçersiz veya süresi dolmuş. Web sitesinden yeni kod alın.')
        return new Response('OK')
      }
    }

    if (text === '/start') {
      await sendTg(chatId, '🏛️ <b>Tarih Vakfı Gönüllü Bot</b>\n\nHesabınızı bağlamak için web sitesinden kod alın:\ntarihvakfi.github.io → Profil → Telegram Bağla')
      return new Response('OK')
    }

    // ── Kullanıcıyı bul ──
    const { data: user } = await sb.from('profiles').select('id, display_name, telegram_state, department')
      .eq('telegram_id', tgUserId).single()

    if (!user) {
      await sendTg(chatId, '⚠️ Hesabınız bağlı değil.\nÖnce web sitesinden bağlayın:\ntarihvakfi.github.io → Profil → Telegram Bağla')
      return new Response('OK')
    }

    const uid = user.id

    // ── Durum makinesi: awaiting_report ──
    if (user.telegram_state === 'awaiting_report') {
      // Foto kontrolu
      if (msg.photo) {
        const fileId = msg.photo[msg.photo.length - 1].file_id
        // Foto URL al
        const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`)
        const fileData = await fileRes.json()
        const filePath = fileData.result?.file_path
        const photoUrl = filePath ? `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}` : ''

        // Aktif completed checkin bul (en son)
        const { data: checkin } = await sb.from('checkins').select('id')
          .eq('user_id', uid).eq('status', 'completed').order('check_out', { ascending: false }).limit(1).single()
        if (checkin && photoUrl) {
          await sb.from('checkins').update({ photo_url: photoUrl }).eq('id', checkin.id)
        }
        const caption = msg.caption?.trim()
        if (caption) {
          await sb.from('checkins').update({ work_done: caption }).eq('id', checkin?.id)
          await sb.from('profiles').update({ telegram_state: 'awaiting_plan' }).eq('id', uid)
          await sendTg(chatId, '📸 Fotoğraf ve açıklama kaydedildi!\n\n📌 Sonraki gelişinde ne yapacaksın?\n(/atla ile geç)')
        } else {
          await sendTg(chatId, '📸 Fotoğraf kaydedildi! Metin açıklama da eklemek ister misin? Yaz veya /atla')
        }
        return new Response('OK')
      }

      if (text && text !== '/atla') {
        const { data: checkin } = await sb.from('checkins').select('id')
          .eq('user_id', uid).eq('status', 'completed').order('check_out', { ascending: false }).limit(1).single()
        if (checkin) {
          await sb.from('checkins').update({ work_done: text }).eq('id', checkin.id)
        }
        await sb.from('profiles').update({ telegram_state: 'awaiting_plan' }).eq('id', uid)
        await sendTg(chatId, '✅ Kaydedildi!\n\n📌 Sonraki gelişinde ne yapacaksın?\n(/atla ile geç)')
        return new Response('OK')
      }
      if (text === '/atla') {
        await sb.from('profiles').update({ telegram_state: null }).eq('id', uid)
        await sendTg(chatId, 'Tamam! İyi günler 👋')
        return new Response('OK')
      }
    }

    // ── Durum: awaiting_plan ──
    if (user.telegram_state === 'awaiting_plan') {
      if (text === '/atla') {
        await sb.from('profiles').update({ telegram_state: null }).eq('id', uid)
        await sendTg(chatId, 'Tamam! İyi günler 👋')
        return new Response('OK')
      }
      const { data: checkin } = await sb.from('checkins').select('id')
        .eq('user_id', uid).eq('status', 'completed').order('check_out', { ascending: false }).limit(1).single()
      if (checkin) {
        await sb.from('checkins').update({ next_plan: msg.text?.trim() || '' }).eq('id', checkin.id)
      }
      // Hafta toplam
      const now = new Date()
      const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      const { data: weekData } = await sb.from('checkins').select('hours')
        .eq('user_id', uid).gte('date', monday.toISOString().slice(0, 10)).neq('status', 'active')
      const weekTotal = (weekData || []).reduce((a: number, c: any) => a + Number(c.hours || 0), 0)

      await sb.from('profiles').update({ telegram_state: null }).eq('id', uid)
      await sendTg(chatId, `📌 Not alındı!\nBu hafta toplam: <b>${fmtHours(weekTotal)}</b>\n\nİyi günler 👋`)
      return new Response('OK')
    }

    // ── Giriş — mod tespiti ──
    const isCheckinCmd = ['geldim', 'gel', 'merhaba', 'giris', 'giriş', '/gel'].includes(text)
    const isRemote = ['uzaktan geldim', 'evden çalışıyorum', 'evden calisiyorum', 'uzaktan', '/uzaktan', 'remote'].includes(text)
    const isOnsite = ['vakıftayım', 'vakiftayim', 'geldim vakıf', 'geldim vakif', '/vakif', '/vakıf'].includes(text)

    if (isCheckinCmd || isRemote || isOnsite) {
      const { data: existing } = await sb.from('checkins').select('id, check_in')
        .eq('user_id', uid).eq('status', 'active').limit(1).single()
      if (existing) {
        await sendTg(chatId, `⚠️ Zaten giriş yapmışsın! (${fmtTime(existing.check_in)})\nÖnce "çıkıyorum" yaz.`)
        return new Response('OK')
      }

      // Mod belirlenmemiş → sor
      if (isCheckinCmd && !isRemote && !isOnsite) {
        await sb.from('profiles').update({ telegram_state: 'awaiting_mode' }).eq('id', uid)
        await sendTg(chatId, `Nasıl çalışacaksın?\n\n🏛️ Vakıfta → "vakıftayım"\n🏠 Uzaktan → "uzaktan"`)
        return new Response('OK')
      }

      const mode = isRemote ? 'remote' : 'onsite'
      const now = new Date().toISOString()
      await sb.from('checkins').insert({
        user_id: uid, check_in: now, date: now.slice(0, 10), source: 'telegram', work_mode: mode,
      })
      await sb.from('profiles').update({ telegram_state: null }).eq('id', uid)

      const { data: last } = await sb.from('checkins').select('next_plan')
        .eq('user_id', uid).eq('status', 'completed').order('check_out', { ascending: false }).limit(1).single()

      const modeLabel = mode === 'remote' ? '🏠 uzaktan' : '🏛️ vakıfta'
      let reply = `🟢 Hoş geldin <b>${user.display_name}</b>! (${modeLabel})\n✓ Giriş: ${fmtTime(now)}`
      if (last?.next_plan) reply += `\n\n📌 Geçen seferden notun:\n"${last.next_plan}"`
      await sendTg(chatId, reply)
      return new Response('OK')
    }

    // ── Mod seçim bekleniyor ──
    if (user.telegram_state === 'awaiting_mode') {
      if (['vakıftayım', 'vakiftayim', 'vakıf', 'vakif', 'onsite', '1'].includes(text)) {
        // Redirect to onsite checkin
        await sb.from('profiles').update({ telegram_state: null }).eq('id', uid)
        const now = new Date().toISOString()
        await sb.from('checkins').insert({ user_id: uid, check_in: now, date: now.slice(0, 10), source: 'telegram', work_mode: 'onsite' })
        const { data: last } = await sb.from('checkins').select('next_plan').eq('user_id', uid).eq('status', 'completed').order('check_out', { ascending: false }).limit(1).single()
        let reply = `🟢 Hoş geldin <b>${user.display_name}</b>! (🏛️ vakıfta)\n✓ Giriş: ${fmtTime(now)}`
        if (last?.next_plan) reply += `\n\n📌 "${last.next_plan}"`
        await sendTg(chatId, reply)
        return new Response('OK')
      }
      if (['uzaktan', 'remote', 'ev', 'evden', '2'].includes(text)) {
        await sb.from('profiles').update({ telegram_state: null }).eq('id', uid)
        const now = new Date().toISOString()
        await sb.from('checkins').insert({ user_id: uid, check_in: now, date: now.slice(0, 10), source: 'telegram', work_mode: 'remote' })
        const { data: last } = await sb.from('checkins').select('next_plan').eq('user_id', uid).eq('status', 'completed').order('check_out', { ascending: false }).limit(1).single()
        let reply = `🟢 Hoş geldin <b>${user.display_name}</b>! (🏠 uzaktan)\n✓ Giriş: ${fmtTime(now)}`
        if (last?.next_plan) reply += `\n\n📌 "${last.next_plan}"`
        await sendTg(chatId, reply)
        return new Response('OK')
      }
      await sendTg(chatId, '🏛️ "vakıftayım" veya 🏠 "uzaktan" yaz.')
      return new Response('OK')
    }

    // ── Çıkış (çıkıyorum) ──
    if (['çıkıyorum', 'cikiyorum', 'çıkış', 'cikis', 'bb', 'bye'].includes(text)) {
      const { data: active } = await sb.from('checkins').select('id, check_in')
        .eq('user_id', uid).eq('status', 'active').limit(1).single()
      if (!active) {
        await sendTg(chatId, '⚠️ Aktif giriş yok. Önce "geldim" yaz.')
        return new Response('OK')
      }

      const now = new Date()
      const hours = Math.round((now.getTime() - new Date(active.check_in).getTime()) / 3600000 * 100) / 100
      await sb.from('checkins').update({
        check_out: now.toISOString(), hours, status: 'completed',
      }).eq('id', active.id)

      await sb.from('profiles').update({ telegram_state: 'awaiting_report' }).eq('id', uid)
      await sendTg(chatId, `🔴 Çıkış: ${fmtTime(now.toISOString())}\nBugün <b>${fmtHours(hours)}</b> çalıştın!\n\n📝 Bugün ne yaptın?\n(metin ve/veya fotoğraf gönder)`)
      return new Response('OK')
    }

    // ── /durum ──
    if (text === '/durum') {
      const now = new Date()
      const monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))
      const { data: week } = await sb.from('checkins').select('date, hours, work_done')
        .eq('user_id', uid).gte('date', monday.toISOString().slice(0, 10)).neq('status', 'active').order('date')
      const total = (week || []).reduce((a: number, c: any) => a + Number(c.hours || 0), 0)

      const { data: tasks } = await sb.from('tasks').select('title, progress, status')
        .contains('assigned_to', [uid]).in('status', ['active', 'pending', 'review'])

      let reply = `📊 <b>Haftalık Durum</b>\n\n⏱️ Bu hafta: <b>${fmtHours(total)}</b>`
      if (week?.length) {
        reply += '\n'
        for (const c of week) reply += `\n  ${c.date?.slice(5)} — ${fmtHours(c.hours || 0)} ${c.work_done ? '· ' + c.work_done.slice(0, 30) : ''}`
      }
      if (tasks?.length) {
        reply += '\n\n📋 <b>Aktif İşlerin:</b>'
        for (const t of tasks) reply += `\n  • ${t.title} (%${Math.round(t.progress || 0)})`
      }
      await sendTg(chatId, reply)
      return new Response('OK')
    }

    // ── /yardim ──
    // ── /belgelerim ──
    if (text === '/belgelerim') {
      const { data: certs } = await sb.from('certificates').select('title, certificate_number, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(5)
      if (certs?.length) {
        let reply = '🏆 <b>Belgeleriniz:</b>\n'
        for (const c of certs) reply += `\n  ${c.title} — ${c.created_at?.slice(0,10)} (${c.certificate_number})`
        reply += '\n\nİndirmek için: tarihvakfi.github.io → Profil → Belgelerim'
        await sendTg(chatId, reply)
      } else {
        await sendTg(chatId, 'Henüz belgeniz yok.')
      }
      return new Response('OK')
    }

    // ── /ozet ──
    if (text === '/ozet') {
      const { data: ws } = await sb.from('volunteer_work_summary').select('*').eq('id', uid).single()
      if (ws) {
        await sendTg(chatId, `📊 <b>Çalışma Özetin</b>\n\nBu hafta: <b>${ws.week_days} gün, ${fmtHours(Number(ws.week_hours))}</b>\nBu ay: <b>${ws.month_days} gün, ${fmtHours(Number(ws.month_hours))}</b>\nToplam: <b>${ws.total_days} gün, ${fmtHours(Number(ws.total_hours))}</b>\n${ws.last_visit ? `\nSon giriş: ${ws.last_visit}` : ''}`)
      } else {
        await sendTg(chatId, 'Henüz kayıt yok.')
      }
      return new Response('OK')
    }

    if (text === '/yardim' || text === '/help') {
      await sendTg(chatId, `🏛️ <b>Tarih Vakfı Bot Komutları</b>\n\n🟢 <b>geldim</b> — Giriş yap\n🔴 <b>çıkıyorum</b> — Çıkış yap\n📊 <b>/durum</b> — Haftalık özet\n📈 <b>/ozet</b> — Çalışma özeti\n⏰ <b>/gecmis</b> — Geçmiş kayıt ekle\n❓ <b>/yardim</b> — Bu mesaj\n\nÖrnekler:\n<i>dün 10-15:30</i>\n<i>pazartesi 09:00-14:00</i>`)
      return new Response('OK')
    }

    // ── /gecmis komutu ──
    if (text === '/gecmis') {
      await sb.from('profiles').update({ telegram_state: 'awaiting_retro_date' }).eq('id', uid)
      await sendTg(chatId, '⏰ <b>Geçmiş kayıt</b>\nHangi gün? (örn: dün, pazartesi, 3 nisan)')
      return new Response('OK')
    }
    if (user.telegram_state === 'awaiting_retro_date') {
      const d = parseDate(msg.text?.trim() || '')
      if (!d) { await sendTg(chatId, '❌ Tarihi anlayamadım. Örn: dün, pazartesi, 3 nisan'); return new Response('OK') }
      const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
      if (diff > 7 || diff < 0) { await sendTg(chatId, '❌ Max 7 gün geriye kayıt eklenebilir.'); return new Response('OK') }
      const dateStr = d.toISOString().slice(0, 10)
      const { data: exists } = await sb.from('checkins').select('id').eq('user_id', uid).eq('date', dateStr).limit(1)
      if (exists?.length) { await sendTg(chatId, '❌ Bu güne zaten kayıt var.'); await sb.from('profiles').update({ telegram_state: null }).eq('id', uid); return new Response('OK') }
      // Store date temporarily
      await sb.from('profiles').update({ telegram_state: `retro_time:${dateStr}` }).eq('id', uid)
      await sendTg(chatId, `📅 ${dateStr}\nKaçta geldin? (örn: 10:00)`)
      return new Response('OK')
    }
    if (user.telegram_state?.startsWith('retro_time:')) {
      const dateStr = user.telegram_state.split(':').slice(1).join(':')
      const timeIn = parseTime(msg.text?.trim() || '')
      if (!timeIn) { await sendTg(chatId, '❌ Saati anlayamadım. Örn: 10:00'); return new Response('OK') }
      await sb.from('profiles').update({ telegram_state: `retro_out:${dateStr}:${timeIn}` }).eq('id', uid)
      await sendTg(chatId, `✓ Giriş: ${timeIn}\nKaçta çıktın? (örn: 15:30)`)
      return new Response('OK')
    }
    if (user.telegram_state?.startsWith('retro_out:')) {
      const parts = user.telegram_state.split(':')
      const dateStr = parts[1]
      const timeIn = parts.slice(2, 4).join(':')
      const timeOut = parseTime(msg.text?.trim() || '')
      if (!timeOut) { await sendTg(chatId, '❌ Saati anlayamadım. Örn: 15:30'); return new Response('OK') }
      const checkIn = `${dateStr}T${timeIn}:00`
      const checkOut = `${dateStr}T${timeOut}:00`
      const hours = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3600000 * 100) / 100
      if (hours <= 0) { await sendTg(chatId, '❌ Çıkış girişten sonra olmalı.'); return new Response('OK') }
      await sb.from('checkins').insert({ user_id: uid, date: dateStr, check_in: checkIn, check_out: checkOut, hours, status: 'completed', is_retroactive: true, source: 'telegram' })
      await sb.from('profiles').update({ telegram_state: 'awaiting_report' }).eq('id', uid)
      await sendTg(chatId, `✅ Geçmiş kayıt eklendi:\n📅 ${dateStr} | ${timeIn} — ${timeOut} | <b>${fmtHours(hours)}</b>\n\n📝 O gün ne yaptın?`)
      return new Response('OK')
    }

    // ── Doğal dil geçmiş kayıt: "dün 10-15:30" ──
    const retroMatch = parseRetroNatural(msg.text?.trim() || '')
    if (retroMatch) {
      const { date: dateStr, timeIn, timeOut } = retroMatch
      const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
      if (diff > 7 || diff < 0) { await sendTg(chatId, '❌ Max 7 gün geriye kayıt eklenebilir.'); return new Response('OK') }
      const { data: exists } = await sb.from('checkins').select('id').eq('user_id', uid).eq('date', dateStr).limit(1)
      if (exists?.length) { await sendTg(chatId, '❌ Bu güne zaten kayıt var.'); return new Response('OK') }
      const checkIn = `${dateStr}T${timeIn}:00`
      const checkOut = `${dateStr}T${timeOut}:00`
      const hours = Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3600000 * 100) / 100
      if (hours <= 0) { await sendTg(chatId, '❌ Çıkış girişten sonra olmalı.'); return new Response('OK') }
      await sb.from('checkins').insert({ user_id: uid, date: dateStr, check_in: checkIn, check_out: checkOut, hours, status: 'completed', is_retroactive: true, source: 'telegram' })
      await sb.from('profiles').update({ telegram_state: 'awaiting_report' }).eq('id', uid)
      await sendTg(chatId, `✅ Geçmiş kayıt:\n📅 ${dateStr} | ${timeIn} — ${timeOut} | <b>${fmtHours(hours)}</b>\n\n📝 O gün ne yaptın?`)
      return new Response('OK')
    }

    // Bilinmeyen mesaj
    await sendTg(chatId, 'Anlamadım 🤔\nKomutlar: geldim, çıkıyorum, /durum, /gecmis, /yardim\nÖrnek: <i>dün 10-15:30</i>')

  } catch (e) {
    console.error('Webhook error:', e)
  }

  return new Response('OK')
})
