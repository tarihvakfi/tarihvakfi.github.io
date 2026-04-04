'use client';

import { useState, useEffect } from 'react';
import * as db from '../../lib/supabase';

const TYPES = {
  participation: { l: 'Katılım Belgesi', i: '📋' },
  thanks: { l: 'Teşekkür Belgesi', i: '🙏' },
  achievement: { l: 'Başarı Belgesi', i: '⭐' },
  period: { l: 'Dönem Sertifikası', i: '📅' },
  special: { l: 'Özel Takdir Belgesi', i: '🌟' },
};

const TEMPLATES = {
  classic: { l: 'Klasik', i: '🏛️', bg: '#f8f6f0', border: '#8B7355', accent: '#2d5a4e' },
  modern: { l: 'Modern', i: '🎨', bg: '#ffffff', border: '#2d5a4e', accent: '#E07A5F' },
  ottoman: { l: 'Osmanlı', i: '📜', bg: '#f5eed5', border: '#8B6914', accent: '#8B6914' },
};

const MO = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const fdf = d => { if (!d) return ''; const x = new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };

function generatePdfHtml(cert, profile, template) {
  const t = TEMPLATES[template] || TEMPLATES.classic;
  const verifyUrl = `https://tarihvakfi.github.io/verify/?code=${cert.verify_code}`;

  const borderStyle = template === 'ottoman'
    ? 'border: 12px double #8B6914; padding: 40px;'
    : template === 'modern'
    ? 'border-left: 8px solid #2d5a4e; padding: 40px;'
    : 'border: 3px solid #8B7355; padding: 40px;';

  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
<style>
  @page { size: A4 landscape; margin: 0; }
  body { margin: 0; font-family: 'Open Sans', sans-serif; background: ${t.bg}; }
  .cert { width: 297mm; height: 210mm; box-sizing: border-box; ${borderStyle} display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; position: relative; }
  .logo { font-size: 48px; margin-bottom: 8px; }
  .org { font-family: 'Playfair Display', serif; font-size: 28px; color: ${t.accent}; margin-bottom: 4px; }
  .type { font-family: 'Playfair Display', serif; font-size: 36px; color: ${t.accent}; margin: 16px 0; letter-spacing: 2px; }
  .recipient { font-size: 28px; font-weight: 600; color: #333; margin: 12px 0; font-style: italic; }
  .desc { font-size: 16px; color: #555; max-width: 600px; line-height: 1.6; margin: 12px auto; }
  .stats { display: flex; gap: 40px; justify-content: center; margin: 16px 0; }
  .stat { text-align: center; }
  .stat-val { font-size: 24px; font-weight: 700; color: ${t.accent}; }
  .stat-lbl { font-size: 12px; color: #888; }
  .footer { position: absolute; bottom: 30px; left: 40px; right: 40px; display: flex; justify-content: space-between; align-items: flex-end; }
  .sign { text-align: center; }
  .sign-line { width: 200px; border-top: 1px solid #999; margin-top: 40px; }
  .sign-name { font-size: 12px; color: #666; margin-top: 4px; }
  .verify { font-size: 9px; color: #aaa; text-align: right; }
  .date { font-size: 13px; color: #888; }
</style></head><body>
<div class="cert">
  <div class="logo">🏛️</div>
  <div class="org">Tarih Vakfı</div>
  <div class="type">${TYPES[cert.type]?.l || cert.title}</div>
  <div class="recipient">Sayın ${profile.display_name}</div>
  <div class="desc">${cert.description}</div>
  ${cert.total_days > 0 || cert.total_hours > 0 ? `<div class="stats">
    ${cert.total_days > 0 ? `<div class="stat"><div class="stat-val">${cert.total_days}</div><div class="stat-lbl">Çalışma Günü</div></div>` : ''}
    ${cert.total_hours > 0 ? `<div class="stat"><div class="stat-val">${Math.round(cert.total_hours)}</div><div class="stat-lbl">Toplam Saat</div></div>` : ''}
    ${cert.department ? `<div class="stat"><div class="stat-val">${cert.department}</div><div class="stat-lbl">Departman</div></div>` : ''}
  </div>` : ''}
  ${cert.period_start && cert.period_end ? `<div class="date">${fdf(cert.period_start)} — ${fdf(cert.period_end)}</div>` : ''}
  <div class="footer">
    <div class="sign"><div class="sign-line"></div><div class="sign-name">Tarih Vakfı Yönetim Kurulu</div></div>
    <div class="verify">Belge No: ${cert.certificate_number}<br>Doğrulama: ${verifyUrl}<br>${fdf(cert.created_at)}</div>
  </div>
</div></body></html>`;
}

function downloadPdf(cert, profile) {
  const html = generatePdfHtml(cert, profile, cert.template);
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); }, 500);
}

// ── Belge Oluşturma Modal ──
export function CertificateModal({ vol, summary, issuerId, onClose, onCreated }) {
  const [type, setType] = useState('thanks');
  const [template, setTemplate] = useState('classic');
  const [desc, setDesc] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const defaultDesc = `Tarih Vakfı${vol.department ? ` ${vol.department}` : ''} departmanında gösterdiği özverili gönüllü çalışmaları için teşekkür ederiz.`;
    setDesc(defaultDesc);
  }, [vol]);

  const create = async () => {
    setSaving(true);
    const { data: cert } = await db.createCertificate({
      user_id: vol.id, type, title: TYPES[type].l, description: desc, template,
      period_start: periodStart || null, period_end: periodEnd || null,
      total_days: Number(summary?.total_days || 0), total_hours: Number(summary?.total_hours || 0),
      department: vol.department, issued_by: issuerId,
    });
    if (cert) {
      await db.sendNotification(vol.id, 'system', `🏆 Yeni belgeniz: ${TYPES[type].l}`, 'Belgelerim bölümünden indirebilirsiniz.');
      downloadPdf(cert, vol);
      onCreated?.(cert);
    }
    setSaving(false); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-lg">🏆 Belge Oluştur</h3>
          <button onClick={onClose} className="text-gray-400">✕</button>
        </div>
        <div className="card !p-3 text-center">
          <div className="font-bold">{vol.display_name}</div>
          <div className="text-sm text-gray-400">{vol.department || '—'} · {summary?.total_days || 0} gün · {Math.round(summary?.total_hours || 0)} saat</div>
        </div>

        <select className="input-field" value={type} onChange={e => setType(e.target.value)}>
          {Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.i} {v.l}</option>)}
        </select>

        <div className="flex gap-2">
          {Object.entries(TEMPLATES).map(([k, v]) => (
            <button key={k} onClick={() => setTemplate(k)} className={`flex-1 text-center py-2 rounded-xl text-sm font-semibold transition-all ${template === k ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-400'}`}>{v.i} {v.l}</button>
          ))}
        </div>

        {type === 'period' && (
          <div className="grid grid-cols-2 gap-2">
            <div><label className="text-xs text-gray-500">Başlangıç</label><input type="date" className="input-field" value={periodStart} onChange={e => setPeriodStart(e.target.value)} /></div>
            <div><label className="text-xs text-gray-500">Bitiş</label><input type="date" className="input-field" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} /></div>
          </div>
        )}

        <textarea className="input-field" rows={3} value={desc} onChange={e => setDesc(e.target.value)} />
        <button onClick={create} disabled={saving} className="btn-primary w-full disabled:opacity-50">{saving ? '...' : '🏆 Oluştur ve İndir'}</button>
      </div>
    </div>
  );
}

// ── Belgelerim (Profil) ──
export function MyCertificates({ uid, me }) {
  const [certs, setCerts] = useState([]);
  useEffect(() => { db.getMyCertificates(uid).then(({ data }) => setCerts(data || [])); }, [uid]);

  if (certs.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="font-bold text-sm mb-2">🏆 Belgelerim</h3>
      {certs.map(c => (
        <div key={c.id} className="card mb-2 !py-3 flex items-center gap-3">
          <span className="text-lg">{TYPES[c.type]?.i || '📋'}</span>
          <div className="flex-1">
            <div className="font-semibold text-sm">{c.title}</div>
            <div className="text-xs text-gray-400">{fdf(c.created_at)} · {c.certificate_number}</div>
          </div>
          <button onClick={() => downloadPdf(c, me)} className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg">PDF</button>
        </div>
      ))}
    </div>
  );
}
