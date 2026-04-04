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

    // ── Giriş (geldim) ──
    if (['geldim', 'gel', 'merhaba', 'giris', 'giriş'].includes(text)) {
      // Aktif check-in var mı?
      const { data: existing } = await sb.from('checkins').select('id, check_in')
        .eq('user_id', uid).eq('status', 'active').limit(1).single()
      if (existing) {
        await sendTg(chatId, `⚠️ Zaten giriş yapmışsın! (${fmtTime(existing.check_in)})\nÖnce "çıkıyorum" yaz.`)
        return new Response('OK')
      }

      const now = new Date().toISOString()
      await sb.from('checkins').insert({
        user_id: uid, check_in: now, date: now.slice(0, 10), source: 'telegram',
      })

      // Önceki plan
      const { data: last } = await sb.from('checkins').select('next_plan')
        .eq('user_id', uid).eq('status', 'completed').order('check_out', { ascending: false }).limit(1).single()

      let reply = `🟢 Hoş geldin <b>${user.display_name}</b>!\n✓ Giriş: ${fmtTime(now)}`
      if (last?.next_plan) reply += `\n\n📌 Geçen seferden notun:\n"${last.next_plan}"`
      await sendTg(chatId, reply)
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
    if (text === '/yardim' || text === '/help') {
      await sendTg(chatId, `🏛️ <b>Tarih Vakfı Bot Komutları</b>\n\n🟢 <b>geldim</b> — Giriş yap\n🔴 <b>çıkıyorum</b> — Çıkış yap\n📊 <b>/durum</b> — Haftalık özet\n❓ <b>/yardim</b> — Bu mesaj\n\nÇıkışta ne yaptığını yaz, fotoğraf da gönderebilirsin!`)
      return new Response('OK')
    }

    // Bilinmeyen mesaj
    await sendTg(chatId, 'Anlamadım 🤔\nKomutlar: geldim, çıkıyorum, /durum, /yardim')

  } catch (e) {
    console.error('Webhook error:', e)
  }

  return new Response('OK')
})
