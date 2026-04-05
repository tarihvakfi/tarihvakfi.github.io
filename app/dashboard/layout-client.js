'use client';

import { useState, useEffect, useCallback } from 'react';
import * as db from '../../lib/supabase';
import BackupView from './backup';
import { CertificateModal, MyCertificates } from './certificates';
import { ReportArchive } from './reports';

/* ═══ CONSTANTS ═══ */
const DEPTS = [
  {id:'arsiv',l:'Arşiv ve Dokümantasyon'},{id:'egitim',l:'Eğitim ve Atölye'},
  {id:'etkinlik',l:'Etkinlik ve Organizasyon'},{id:'dijital',l:'Dijital ve Sosyal Medya'},
  {id:'rehber',l:'Rehberlik ve Gezi'},{id:'baski',l:'Yayın ve Baskı'},
  {id:'bagis',l:'Bağış ve Sponsorluk'},{id:'idari',l:'İdari İşler'},
];
const DM = Object.fromEntries(DEPTS.map(d=>[d.id,d]));
const ROLES = {admin:'Yönetici',coord:'Koordinatör',vol:'Gönüllü'};
const DAYS = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const MO = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const WDAYS = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
const fd = d => { const x=new Date(d); return `${x.getDate()} ${MO[x.getMonth()]}`; };
const fdf = d => { const x=new Date(d); return `${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`; };
const today = () => new Date().toISOString().slice(0,10);
const fmtH = h => { const hrs=Math.floor(h),mins=Math.round((h-hrs)*60); return mins>0?`${hrs}s ${mins}dk`:`${hrs}s`; };
const todayLabel = () => { const d=new Date(); return `${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}, ${WDAYS[d.getDay()]}`; };
const timeAgo = ts => { const m=Math.floor((Date.now()-new Date(ts).getTime())/60000); if(m<1)return 'az önce'; if(m<60)return `${m} dk önce`; const h=Math.floor(m/60); if(h<24)return `${h} saat önce`; return `${Math.floor(h/24)} gün önce`; };
const AV_COLORS = ['#DBEAFE','#EDE9FE','#FEE2E2','#D1FAE5','#FEF3C7'];
const AV_TEXT   = ['#1D4ED8','#6D28D9','#991B1B','#065F46','#92400E'];
const avColor = name => { const i=(name||'A').charCodeAt(0)%5; return {bg:AV_COLORS[i],color:AV_TEXT[i]}; };

/* ═══ TOAST ═══ */
function useToast(){
  const [t,setT]=useState(null);
  const show=(msg,ok=true)=>{setT({msg,ok});setTimeout(()=>setT(null),3000);};
  const Toast=()=>t?<div className={`toast ${t.ok?'toast-ok':'toast-err'}`}>{t.msg}</div>:null;
  return {show,Toast};
}

/* ═══ DASHBOARD SHELL ═══ */
export default function Dashboard({session}){
  const uid=session.user.id;
  const [me,setMe]=useState(null);
  const [tab,setTab]=useState(null);
  const [loading,setLoading]=useState(true);
  const [unread,setUnread]=useState(0);
  const [showNotifs,setShowNotifs]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const [modal,setModal]=useState(null);

  useEffect(()=>{(async()=>{
    const {data}=await db.getProfile(uid); if(data) setMe(data);
    setUnread(await db.getUnreadCount(uid)); setLoading(false);
  })();},[uid]);

  useEffect(()=>{const sub=db.subscribeNotifications(uid,()=>setUnread(n=>n+1));return()=>sub.unsubscribe();},[uid]);
  useEffect(()=>{if(!me)return;if(me.role==='admin')setTab('genel');else if(me.role==='coord')setTab('calisma');},[me?.role]);

  // Keyboard shortcuts
  useEffect(()=>{
    const h=e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.key==='Escape'){setShowNotifs(false);setShowProfile(false);setModal(null);}};
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);
  },[]);

  if(loading||!me) return <div className="flex items-center justify-center min-h-screen"><div className="space-y-3 w-48"><div className="skeleton h-3 w-full"/><div className="skeleton h-3 w-3/4"/><div className="skeleton h-3 w-1/2"/></div></div>;

  const restricted=['paused','inactive','resigned','pending','rejected','blocked'].includes(me.status);
  if(restricted) return <RestrictedShell me={me} uid={uid}/>;

  const isVol=me.role==='vol', isCoord=me.role==='coord', isAdmin=me.role==='admin';

  const openModal=v=>{setModal(v);setShowProfile(false);};

  // Admin tabs: Genel + Raporlar (bottom nav)
  // Coord tabs: Çalışmam + Departmanım (bottom nav)
  // Vol: no tabs

  return(
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-6 bg-white border-b border-[#F3F4F6]" style={{height:56}}>
        <a href="/" className="font-semibold text-[15px] text-[#111827]">Tarih Vakfı</a>
        <div className="flex items-center gap-4 text-[13px] text-[#6B7280]">
          <button onClick={()=>{setShowNotifs(!showNotifs);setShowProfile(false);if(!showNotifs){db.markAllRead(uid);setUnread(0);}}} className="relative hover:text-[#111827] transition-colors">
            Bildirimler{unread>0&&<span className="absolute -top-1 -right-2 w-[6px] h-[6px] rounded-full bg-[#EF4444]"/>}
          </button>
          <button onClick={()=>{setShowProfile(!showProfile);setShowNotifs(false);}} className="font-medium text-[#374151] hover:text-[#111827] transition-colors">
            {(me.display_name||'').split(' ')[0]} &#9662;
          </button>
        </div>
      </header>

      {/* Dropdowns */}
      {showNotifs&&<NotifPanel uid={uid} onClose={()=>setShowNotifs(false)}/>}
      {showProfile&&<ProfilePanel me={me} uid={uid} onUpdate={setMe} onModal={openModal} onClose={()=>setShowProfile(false)}/>}

      {/* Modals */}
      {modal==='certs'&&<Overlay title="Belgelerim" onClose={()=>setModal(null)}><MyCertificates uid={uid} me={me}/></Overlay>}
      {modal==='summary'&&<Overlay title="Çalışma özeti" onClose={()=>setModal(null)}><WorkSummary uid={uid}/></Overlay>}
      {modal==='help'&&<Overlay title="Yardım" onClose={()=>setModal(null)}><HelpContent me={me}/></Overlay>}

      {/* Content */}
      <main className={`mx-auto px-4 md:px-6 py-8 ${isVol||isCoord&&tab==='calisma'?'max-w-[440px]':'max-w-[680px]'} ${(isCoord||isAdmin)?'pb-20':''}`}>
        {isVol&&<VolunteerView uid={uid} me={me} onModal={openModal}/>}
        {isCoord&&tab==='calisma'&&<VolunteerView uid={uid} me={me} onModal={openModal}/>}
        {isCoord&&tab==='departman'&&<DeptView uid={uid} me={me}/>}
        {isAdmin&&tab==='genel'&&<AdminView uid={uid} me={me}/>}
        {isAdmin&&tab==='raporlar'&&<ReportsView uid={uid}/>}
      </main>

      {/* Bottom nav */}
      {isCoord&&(
        <nav className="fixed bottom-0 left-0 right-0 z-50 bnav">
          <button onClick={()=>setTab('calisma')} className={`bnav-item ${tab==='calisma'?'active':''}`}>Çalışmam</button>
          <button onClick={()=>setTab('departman')} className={`bnav-item ${tab==='departman'?'active':''}`}>Departmanım</button>
        </nav>
      )}
      {isAdmin&&(
        <nav className="fixed bottom-0 left-0 right-0 z-50 bnav">
          <button onClick={()=>setTab('genel')} className={`bnav-item ${tab==='genel'?'active':''}`}>Genel</button>
          <button onClick={()=>setTab('raporlar')} className={`bnav-item ${tab==='raporlar'?'active':''}`}>Raporlar</button>
        </nav>
      )}
    </div>
  );
}

/* ═══ SHARED UI ═══ */

function Overlay({title,children,onClose}){
  return(
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-[#F3F4F6] px-6 py-4 flex items-center justify-between z-10">
          <span className="text-[15px] font-semibold">{title}</span>
          <button onClick={onClose} className="text-[#9CA3AF] hover:text-[#111827] text-lg">&times;</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

function NotifPanel({uid,onClose}){
  const [items,setItems]=useState([]);
  useEffect(()=>{(async()=>{const{data}=await db.getNotifications(uid,15);setItems(data||[]);await db.markAllRead(uid);})();},[uid]);
  return(
    <div className="fixed top-14 right-4 z-[55] dropdown-panel w-[280px] max-h-[400px] overflow-y-auto">
      <div className="px-4 py-2 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Bildirimler</div>
      {items.map(n=>(
        <div key={n.id} className={`dd-item ${!n.is_read?'bg-[#FAFFFE]':''}`}>
          <div><div className="font-medium text-[13px]">{n.title}</div>{n.body&&<div className="text-[11px] text-[#9CA3AF] mt-0.5">{n.body}</div>}<div className="text-[11px] text-[#C4C4C4] mt-1">{timeAgo(n.created_at)}</div></div>
        </div>
      ))}
      {items.length===0&&<div className="px-4 py-8 text-center text-[13px] text-[#9CA3AF]">Bildirim yok</div>}
      <div className="dd-sep"/><button onClick={onClose} className="dd-item text-center w-full text-[12px] text-[#9CA3AF]">Kapat</button>
    </div>
  );
}

function ProfilePanel({me,uid,onUpdate,onModal,onClose}){
  const [editing,setEditing]=useState(false);
  const [f,setF]=useState({display_name:me.display_name,city:me.city||''});
  const [tgCode,setTgCode]=useState(null);
  const save=async()=>{const{data}=await db.updateProfile(uid,f);if(data)onUpdate(data);setEditing(false);};
  const linkTg=async()=>{const code=String(Math.floor(100000+Math.random()*900000));await db.updateProfile(uid,{telegram_link_code:code});setTgCode(code);};

  return(
    <div className="fixed top-14 right-4 z-[55] dropdown-panel w-[220px]">
      <div className="px-4 py-3 border-b border-[#F3F4F6]">
        <div className="text-[13px] font-medium">{me.display_name}</div>
        <div className="text-[11px] text-[#9CA3AF]">{me.email||ROLES[me.role]}</div>
      </div>
      {!editing?(
        <div>
          <button className="dd-item w-full text-left" onClick={()=>{onModal('report');onClose();}}>Hızlı rapor</button>
          <button className="dd-item w-full text-left" onClick={()=>{onModal('summary');onClose();}}>Çalışma özeti</button>
          <div className="dd-sep"/>
          <button className="dd-item w-full text-left" onClick={()=>setEditing(true)}>Profili düzenle</button>
          {me.telegram_id?(
            <div className="px-4 py-2 text-[12px] text-[#059669]">Telegram bağlı</div>
          ):tgCode?(
            <div className="px-4 py-2 space-y-1.5">
              <div className="text-[11px] text-[#9CA3AF]">@tarihvakfi_bot&apos;a gönderin:</div>
              <div className="font-mono font-bold text-center text-lg tracking-widest">{tgCode}</div>
              <button onClick={()=>navigator.clipboard.writeText(`/start ${tgCode}`)} className="text-[11px] text-[#059669]">Kopyala</button>
            </div>
          ):(
            <button className="dd-item w-full text-left" onClick={linkTg}>Telegram bağla</button>
          )}
          <button className="dd-item w-full text-left" onClick={()=>{onModal('certs');onClose();}}>Belgelerim</button>
          <button className="dd-item w-full text-left" onClick={()=>{onModal('help');onClose();}}>Yardım</button>
          <div className="dd-sep"/>
          <button className="dd-item w-full text-left text-[#EF4444]" onClick={db.signOut}>Çıkış</button>
        </div>
      ):(
        <div className="p-3 space-y-2">
          <input className="inp text-[13px] !py-2" value={f.display_name} onChange={e=>setF({...f,display_name:e.target.value})} placeholder="İsim"/>
          <input className="inp text-[13px] !py-2" value={f.city} onChange={e=>setF({...f,city:e.target.value})} placeholder="Şehir"/>
          <div className="flex gap-2">
            <button onClick={save} className="flex-1 bg-[#059669] text-white text-[13px] font-medium py-2 rounded-lg">Kaydet</button>
            <button onClick={()=>setEditing(false)} className="text-[12px] text-[#9CA3AF] px-2">İptal</button>
          </div>
        </div>
      )}
    </div>
  );
}

function WorkSummary({uid}){
  const [s,setS]=useState(null);
  useEffect(()=>{db.getWorkSummary(uid).then(({data})=>setS(data));},[uid]);
  if(!s) return <div className="skeleton h-20 w-full"/>;
  return(
    <div className="space-y-3">
      {[['Bu Hafta',`${s.week_days} rapor, ${fmtH(Number(s.week_hours))}`],['Bu Ay',`${s.month_days} rapor, ${fmtH(Number(s.month_hours))}`],['Toplam',`${s.total_days} rapor, ${fmtH(Number(s.total_hours))}`]].map(([l,v],i)=>(
        <div key={i} className="flex justify-between py-2 border-b border-[#F3F4F6] last:border-0">
          <span className="text-[13px] text-[#6B7280]">{l}</span>
          <span className={`text-[13px] font-medium ${i===2?'text-[#059669]':'text-[#111827]'}`}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Slide({open,children}){
  return <div className={`slide-wrap ${open?'open':''}`}><div className="slide-inner">{children}</div></div>;
}

/* ═══ VOLUNTEER VIEW ═══ */

function VolunteerView({uid,me,onModal}){
  const [showForm,setShowForm]=useState(false);
  const [editR,setEditR]=useState(null);
  const [reports,setReports]=useState([]);
  const [tasks,setTasks]=useState([]);
  const [expandTask,setExpandTask]=useState(null);
  const [progVal,setProgVal]=useState(0);
  const [progNote,setProgNote]=useState('');
  const [summary,setSummary]=useState(null);
  const [editingId,setEditingId]=useState(null);
  const [editForm,setEditForm]=useState({});
  const [confirmDel,setConfirmDel]=useState(null);
  const toast=useToast();

  const load=useCallback(async()=>{
    const [r,t,s]=await Promise.all([db.getWeekReports(uid),db.getTasks({assigned_to:uid}),db.getWorkSummary(uid)]);
    setReports(r.data||[]);setTasks((t.data||[]).filter(t=>['active','pending','review'].includes(t.status)));setSummary(s.data);
  },[uid]);
  useEffect(()=>{load();},[load]);

  const weekDays=summary?Number(summary.week_days):0;
  const weekH=summary?Number(summary.week_hours):0;
  const monthH=summary?Number(summary.month_hours):0;
  const lastPlan=reports.length>0?reports[0].next_plan:null;

  const openNew=()=>{setEditR(null);setShowForm(true);setEditingId(null);};
  const openEdit=r=>{setEditR(r);setShowForm(true);setEditingId(null);};

  const saveReport=async(data)=>{
    if(editR){await db.updateWorkReport(editR.id,data);toast.show('Rapor güncellendi');}
    else{await db.createWorkReport({...data,user_id:uid,source:'web'});toast.show('Kaydedildi');}
    setShowForm(false);setEditR(null);load();
  };

  const deleteReport=async(id)=>{await db.deleteWorkReport(id);setConfirmDel(null);toast.show('Rapor silindi');load();};

  const updateProg=async(tid)=>{
    await db.updateTaskProgress(tid,progVal);
    if(progNote) await db.addProgressLog({task_id:tid,user_id:uid,progress:progVal,note:progNote});
    if(progVal>=100) await db.updateTask(tid,{status:'review'});
    setExpandTask(null);setProgVal(0);setProgNote('');load();toast.show('Güncellendi');
  };

  // Inline edit
  const startInlineEdit=(r)=>{setEditingId(r.id);setEditForm({h:String(r.hours),desc:r.description||'',mode:r.work_mode||'onsite'});};
  const saveInlineEdit=async(id)=>{
    const h=parseFloat(editForm.h);if(!h||h<=0||h>24)return;
    await db.updateWorkReport(id,{hours:h,description:editForm.desc,work_mode:editForm.mode});
    setEditingId(null);toast.show('Güncellendi');load();
  };

  // Motivation message
  let motivation='Hoş geldin, bugün ne çalışacaksın?';
  if(monthH===0&&weekDays===0) motivation='İlk raporunu bekliyoruz!';
  else if(monthH>=5) motivation='Bu ay harika gidiyorsun!';

  return(
    <div>
      <toast.Toast/>

      {/* Greeting */}
      <div className="greeting">Merhaba, {(me.display_name||'').split(' ')[0]}</div>
      <div className="meta mt-1">Bu ay {summary?summary.month_days:0} gün, {fmtH(monthH)} çalıştın</div>
      <div className="text-[13px] text-[#9CA3AF] mt-1">{motivation}</div>
      {lastPlan&&<div className="mt-2 text-[13px] text-[#6B7280] bg-[#F9FAFB] rounded-lg px-3 py-2">Geçen seferden notun: {lastPlan}</div>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 my-7">
        <div className="stat-box"><div className="stat-n">{weekDays}</div><div className="stat-l">gün</div></div>
        <div className="stat-box"><div className="stat-n">{fmtH(weekH)}</div><div className="stat-l">saat</div></div>
      </div>

      {/* Report button */}
      <button onClick={()=>{showForm?setShowForm(false):openNew();}} className="btn mb-2">{showForm?'Kapat':'Çalışma raporu'}</button>

      {/* Inline report form */}
      <Slide open={showForm}>
        <div className="py-4">
          <ReportForm editReport={editR} tasks={tasks} onSave={saveReport} onCancel={()=>{setShowForm(false);setEditR(null);}}/>
        </div>
      </Slide>

      {/* Tasks */}
      <div className="sec-label">Atanan işlerim</div>
      {tasks.length===0?(
        <div className="text-[13px] text-[#9CA3AF] leading-relaxed">Henüz atanmış iş yok. Çalışmanı yukarıdan raporlayabilirsin.</div>
      ):(
        <div className="space-y-2">
          {tasks.map(t=>{
            const daysLeft=t.deadline?Math.round((new Date(t.deadline+'T12:00:00')-new Date(today()+'T12:00:00'))/86400000):999;
            return(
              <div key={t.id}>
                <div onClick={()=>{setExpandTask(expandTask===t.id?null:t.id);setProgVal(t.progress||0);setProgNote('');}} className={`task-card ${daysLeft<=3&&daysLeft>=0?'bg-red-50/50':''}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[14px] font-medium">{t.title}</span>
                    <span className="text-[12px] text-[#9CA3AF]">{Math.round(t.progress||0)}%</span>
                  </div>
                  {t.deadline&&<div className="text-[12px] text-[#9CA3AF]">{DM[t.department]?.l?.split(' ')[0]||''} — Son: {fd(t.deadline)}{daysLeft<0?' (gecikmiş)':daysLeft<=3?` (${daysLeft} gün kaldı)`:''}</div>}
                  <div className="progress-track mt-2"><div className="progress-fill" style={{width:`${t.progress||0}%`}}/></div>
                </div>
                <Slide open={expandTask===t.id}>
                  <div className="px-4 py-3 space-y-2 border border-[#F3F4F6] rounded-b-lg -mt-2 mb-2">
                    <div className="flex items-center gap-3">
                      <input type="range" min="0" max="100" step="5" value={progVal} onChange={e=>setProgVal(Number(e.target.value))} className="flex-1 accent-[#059669]"/>
                      <span className="text-[14px] font-semibold w-10 text-right">{progVal}%</span>
                    </div>
                    <input className="inp text-[13px] !py-2" placeholder="Not (opsiyonel)" value={progNote} onChange={e=>setProgNote(e.target.value)}/>
                    <button onClick={()=>updateProg(t.id)} className="bg-[#059669] text-white text-[13px] font-medium py-2 px-4 rounded-lg">Güncelle</button>
                  </div>
                </Slide>
              </div>
            );
          })}
        </div>
      )}

      {/* Reports this week */}
      <div className="sec-label">Bu hafta</div>
      {reports.length===0?(
        <div className="text-[13px] text-[#9CA3AF]">Henüz rapor yok.</div>
      ):(
        <div>
          {reports.map(r=>(
            <div key={r.id}>
              {editingId===r.id?(
                /* Inline edit */
                <div className="py-3 px-3 bg-[#F9FAFB] rounded-lg mb-2 space-y-2">
                  <div className="flex gap-2">
                    <input type="number" step="0.5" min="0.5" max="24" className="inp !py-1.5 text-[13px] w-20" value={editForm.h} onChange={e=>setEditForm({...editForm,h:e.target.value})}/>
                    <input className="inp !py-1.5 text-[13px] flex-1" value={editForm.desc} onChange={e=>setEditForm({...editForm,desc:e.target.value})} placeholder="Açıklama"/>
                  </div>
                  <div className="radio-group">
                    {[['onsite','Vakıfta'],['remote','Uzaktan']].map(([v,l])=>(
                      <span key={v} className="radio-opt" onClick={()=>setEditForm({...editForm,mode:v})}><span className={`radio-dot ${editForm.mode===v?'on':''}`}/>{l}</span>
                    ))}
                  </div>
                  <div className="flex gap-2 items-center">
                    <button onClick={()=>saveInlineEdit(r.id)} className="btn-sm btn-approve">Kaydet</button>
                    <button onClick={()=>setEditingId(null)} className="text-[12px] text-[#9CA3AF]">İptal</button>
                    <button onClick={()=>setConfirmDel(r.id)} className="btn-danger-text ml-auto text-[12px]">Sil</button>
                  </div>
                </div>
              ):(
                /* Display row */
                <div className="report-row" onClick={()=>startInlineEdit(r)}>
                  <div className={`sl ${r.is_approved?'sl-green':'sl-yellow'}`}/>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium">{fd(r.date)} — {fmtH(r.hours)}</div>
                    <div className="text-[12px] text-[#9CA3AF]">{r.description||'—'}, {r.work_mode==='remote'?'uzaktan':'vakıfta'}</div>
                  </div>
                  <div className={`text-[12px] flex-shrink-0 ${r.is_approved?'text-[#059669]':'text-[#F59E0B]'}`}>{r.is_approved?'onaylı':'bekliyor'}</div>
                </div>
              )}
              {confirmDel===r.id&&(
                <div className="flex items-center gap-3 py-2 px-2 text-[13px]">
                  <span className="text-[#EF4444]">Silinsin mi?</span>
                  <button onClick={()=>deleteReport(r.id)} className="font-medium text-[#EF4444]">Evet</button>
                  <button onClick={()=>setConfirmDel(null)} className="text-[#9CA3AF]">Hayır</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-8 text-[13px] text-[#C4C4C4]">
        Sorunun mu var?{' '}
        <button onClick={async()=>{const{data:admins}=await db.getProfilesByRole('admin');for(const a of(admins||[]))await db.sendNotification(a.id,'system',`${me.display_name} yardım istiyor`,'');toast.show('Mesajın iletildi');}} className="text-[#059669] font-medium">İletişim</button>
      </div>
    </div>
  );
}

function ReportForm({editReport,tasks,onSave,onCancel}){
  const [f,setF]=useState({
    h:editReport?String(editReport.hours):'',
    desc:editReport?editReport.description||'':'',
    mode:editReport?editReport.work_mode||'onsite':'onsite',
    date:editReport?editReport.date:today(),
    plan:editReport?editReport.next_plan||'':'',
    taskId:editReport?editReport.task_id||'':'',
  });
  const [showExtra,setShowExtra]=useState(!!editReport);
  const [saving,setSaving]=useState(false);

  const submit=async()=>{
    const h=parseFloat(f.h);if(!h||h<=0||h>24)return;
    setSaving(true);
    await onSave({hours:h,description:f.desc.trim(),work_mode:f.mode,date:f.date,next_plan:f.plan.trim()||null,task_id:f.taskId||null});
    setSaving(false);
  };

  return(
    <div>
      <div className="page-title mb-1">{editReport?'Raporu düzenle':'Çalışma raporu'}</div>
      <div className="meta mb-6">{editReport?fdf(editReport.date):'Çalıştığını kaydet'}</div>

      <div className="mb-5">
        <label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Süre</label>
        <input type="number" step="0.5" min="0.5" max="24" value={f.h} onChange={e=>setF({...f,h:e.target.value})} className="inp inp-big" placeholder="3"/>
      </div>
      <div className="mb-5">
        <label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Ne yaptın?</label>
        <textarea value={f.desc} onChange={e=>setF({...f,desc:e.target.value})} className="inp inp-area" placeholder="Belgeleri taradım, sınıflandırdım..."/>
      </div>
      <div className="mb-5">
        <label className="block text-[12px] text-[#6B7280] font-medium mb-2">Konum</label>
        <div className="radio-group">
          {[['onsite','Vakıfta'],['remote','Uzaktan']].map(([v,l])=>(
            <span key={v} className="radio-opt" onClick={()=>setF({...f,mode:v})}><span className={`radio-dot ${f.mode===v?'on':''}`}/>{l}</span>
          ))}
        </div>
      </div>

      <button onClick={submit} disabled={saving} className="btn mt-4">{saving?'Kaydediliyor...':editReport?'Güncelle':'Kaydet'}</button>

      {editReport&&(
        <div className="text-center mt-4">
          <button onClick={onCancel} className="btn-danger-text">Raporu sil</button>
          <div className="text-[11px] text-[#C4C4C4] mt-2">Onaylanmış rapor düzenlenirse tekrar onay gerekir</div>
        </div>
      )}

      <div className="flex justify-center gap-6 mt-4">
        <button onClick={()=>setShowExtra(!showExtra)} className="link-muted">{showExtra?'Gizle':'Tarih değiştir · İlgili iş seç · Plan ekle'}</button>
      </div>

      <Slide open={showExtra}>
        <div className="pt-4 space-y-4">
          <div><label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Tarih</label><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})} className="inp"/></div>
          <div><label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Sonraki plan</label><input value={f.plan} onChange={e=>setF({...f,plan:e.target.value})} className="inp" placeholder="Yarın devam edeceğim..."/></div>
          {tasks&&tasks.length>0&&(
            <div><label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">İlgili iş</label>
              <select value={f.taskId} onChange={e=>setF({...f,taskId:e.target.value})} className="inp bg-white"><option value="">Bağımsız çalışma</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select>
            </div>
          )}
        </div>
      </Slide>
    </div>
  );
}

/* ═══ COORDINATOR — DEPARTMANIM ═══ */

function DeptView({uid,me}){
  const [subTab,setSubTab]=useState('onaylar');
  const [pending,setPending]=useState([]);
  const [tasks,setTasks]=useState([]);
  const [vols,setVols]=useState([]);
  const [summaries,setSummaries]=useState([]);
  const [certVol,setCertVol]=useState(null);
  const [showNewTask,setShowNewTask]=useState(false);
  const [tf,setTf]=useState({title:'',description:'',department:me.department||'arsiv',assigned_to:'',deadline:''});
  const [showAnn,setShowAnn]=useState(false);
  const [annF,setAnnF]=useState({title:'',body:''});
  const [search,setSearch]=useState('');
  const [expandVol,setExpandVol]=useState(null);
  const toast=useToast();

  const load=useCallback(async()=>{
    const [p,t,v,ws]=await Promise.all([db.getPendingReports(),db.getTasks(),db.getAllProfiles(),db.getAllWorkSummaries()]);
    setPending(p.data||[]);setTasks(t.data||[]);setVols((v.data||[]).filter(v=>v.status==='active'));setSummaries(ws.data||[]);
  },[]);
  useEffect(()=>{load();},[load]);

  const approve=async id=>{await db.approveReport(id,uid);load();toast.show('Onaylandı');};
  const approveAll=async()=>{const ids=pending.filter(r=>r.user_id!==uid).map(r=>r.id);await db.approveAllReports(ids,uid);load();toast.show('Tümü onaylandı');};
  const approveTask=async id=>{await db.updateTask(id,{status:'done',completed_at:new Date().toISOString()});load();};
  const createTask=async()=>{if(!tf.title)return;await db.createTask({title:tf.title,description:tf.description,department:tf.department,deadline:tf.deadline,priority:'medium',assigned_to:tf.assigned_to?[tf.assigned_to]:[],created_by:uid});setShowNewTask(false);setTf({title:'',description:'',department:me.department||'arsiv',assigned_to:'',deadline:''});load();toast.show('İş oluşturuldu');};
  const createAnn=async()=>{if(!annF.title||!annF.body)return;await db.createAnnouncement({...annF,department:null,is_pinned:false,is_public:false,author_id:uid});setShowAnn(false);setAnnF({title:'',body:''});toast.show('Duyuru yayınlandı');};

  const sumMap=Object.fromEntries(summaries.map(s=>[s.id,s]));
  const weekH=summaries.reduce((a,s)=>a+Number(s.week_hours||0),0);
  const activeTasks=tasks.filter(t=>['active','pending','review'].includes(t.status));
  const filteredVols=vols.filter(v=>!search||v.display_name?.toLowerCase().includes(search.toLowerCase()));

  const TABS=[['onaylar',`Onaylar (${pending.length})`],['gonulluler','Gönüllüler'],['isler','İşler'],['iletisim','İletişim']];

  return(
    <div>
      <toast.Toast/>
      <div className="page-title">{DM[me.department]?.l||'Departman'}</div>
      <div className="meta mb-4">{vols.length} gönüllü aktif, {fmtH(weekH)} bu hafta</div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[{n:pending.length,l:'bekleyen',c:pending.length>0?'text-[#F59E0B]':''},{n:vols.length,l:'gönüllü'},{n:activeTasks.length,l:'açık iş'},{n:fmtH(weekH),l:'bu hafta'}].map((s,i)=>(
          <div key={i} className="stat-box"><div className={`stat-n text-[24px] ${s.c||''}`}>{s.n}</div><div className="stat-l">{s.l}</div></div>
        ))}
      </div>

      <div className="tab-bar">
        {TABS.map(([k,l])=><button key={k} onClick={()=>setSubTab(k)} className={`tab-item ${subTab===k?'active':''}`}>{l}</button>)}
      </div>

      {/* ONAYLAR */}
      {subTab==='onaylar'&&(
        <div>
          {pending.length>0&&(
            <div className="flex justify-between items-center mb-3">
              <span className="text-[14px] font-medium">{pending.length} rapor bekliyor</span>
              {pending.filter(r=>r.user_id!==uid).length>1&&<button onClick={approveAll} className="btn-ghost">Tümünü onayla &rarr;</button>}
            </div>
          )}
          {pending.map(r=>{const av=avColor(r.profiles?.display_name);return(
            <div key={r.id} className="appr-card">
              <div className="av" style={{background:av.bg,color:av.color}}>{(r.profiles?.display_name||'?').slice(0,2).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium">{r.profiles?.display_name}</div>
                <div className="text-[12px] text-[#9CA3AF]">{fmtH(r.hours)} — {r.description?.slice(0,40)} — {r.work_mode==='remote'?'Uzaktan':'Vakıfta'} — {fd(r.date)}</div>
              </div>
              {r.user_id!==uid?(
                <div className="appr-actions">
                  <button onClick={()=>approve(r.id)} className="btn-sm btn-approve">Onayla</button>
                  <button onClick={async()=>{await db.deleteWorkReport(r.id);load();}} className="btn-sm btn-reject">Reddet</button>
                </div>
              ):<span className="text-[11px] text-[#C4C4C4]">Kendi</span>}
            </div>
          );})}
          {pending.length===0&&<div className="text-[13px] text-[#9CA3AF] text-center py-6">Tüm raporlar onaylı</div>}
        </div>
      )}

      {/* GÖNÜLLÜLER */}
      {subTab==='gonulluler'&&(
        <div>
          <input value={search} onChange={e=>setSearch(e.target.value)} className="inp mb-4 text-[13px]" placeholder="Gönüllü ara..."/>
          {filteredVols.map(v=>{const s=sumMap[v.id];const av=avColor(v.display_name);const status=v.activity_status||'active';const dotC=status==='active'?'bg-[#059669]':status==='slowing'?'bg-[#F59E0B]':status==='inactive'?'bg-[#F97316]':'bg-[#EF4444]';
            return(
              <div key={v.id}>
                <div onClick={()=>setExpandVol(expandVol===v.id?null:v.id)} className="flex items-center gap-3 py-3 border-b border-[#F5F5F5] cursor-pointer hover:bg-[#FAFAFA] transition-colors rounded-lg px-2 -mx-2">
                  <div className="av" style={{background:av.bg,color:av.color}}>{(v.display_name||'?')[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-medium">{v.display_name}</div>
                    <div className="text-[12px] text-[#9CA3AF]">{DM[v.department]?.l?.split(' ')[0]||'—'} · {s?fmtH(Number(s.month_hours)):'0s'} bu ay · Son: {v.last_activity_at?fd(v.last_activity_at):'—'}</div>
                  </div>
                  <span className={`dot ${dotC}`}/>
                  <button onClick={e=>{e.stopPropagation();setCertVol(v);}} className="text-[11px] text-[#9CA3AF] hover:text-[#F59E0B]">belge</button>
                </div>
                <Slide open={expandVol===v.id}>
                  <div className="py-3 px-3 bg-[#F9FAFB] rounded-b-lg mb-2 text-[12px] text-[#6B7280] space-y-2">
                    {s&&<div>Toplam: {s.total_days} gün, {fmtH(Number(s.total_hours))}</div>}
                    <div>Skor: {v.activity_score||0}</div>
                  </div>
                </Slide>
              </div>
            );
          })}
        </div>
      )}

      {/* İŞLER */}
      {subTab==='isler'&&(
        <div>
          <div className="flex justify-end mb-3"><button onClick={()=>setShowNewTask(!showNewTask)} className="btn-ghost">{showNewTask?'Kapat':'+ Yeni İş'}</button></div>
          <Slide open={showNewTask}>
            <div className="p-4 border border-[#F3F4F6] rounded-lg mb-4 space-y-3">
              <input className="inp text-[13px]" placeholder="İş başlığı" value={tf.title} onChange={e=>setTf({...tf,title:e.target.value})}/>
              <textarea className="inp inp-area text-[13px]" rows={2} placeholder="Açıklama" value={tf.description} onChange={e=>setTf({...tf,description:e.target.value})}/>
              <div className="grid grid-cols-2 gap-2">
                <select className="inp text-[13px] bg-white" value={tf.assigned_to} onChange={e=>setTf({...tf,assigned_to:e.target.value})}><option value="">Atanacak</option>{vols.map(v=><option key={v.id} value={v.id}>{v.display_name}</option>)}</select>
                <input type="date" className="inp text-[13px]" value={tf.deadline} onChange={e=>setTf({...tf,deadline:e.target.value})}/>
              </div>
              <button onClick={createTask} className="bg-[#059669] text-white text-[13px] font-medium py-2 px-4 rounded-lg">Oluştur</button>
            </div>
          </Slide>
          {tasks.filter(t=>t.status!=='cancelled').slice(0,15).map(t=>{const od=t.deadline&&t.deadline<today();return(
            <div key={t.id} className="flex items-center gap-3 py-3 border-b border-[#F5F5F5]">
              <div className="flex-1 min-w-0"><span className="text-[14px] font-medium">{t.title}</span>{od&&<span className="text-[12px] text-[#EF4444] ml-2">gecikmiş</span>}</div>
              <div className="w-20 flex items-center gap-1.5 flex-shrink-0"><div className="flex-1 progress-track"><div className="progress-fill" style={{width:`${t.progress||0}%`}}/></div><span className="text-[11px] text-[#9CA3AF]">{Math.round(t.progress||0)}%</span></div>
              {t.deadline&&<span className="text-[11px] text-[#9CA3AF] w-12 flex-shrink-0">{fd(t.deadline)}</span>}
              {t.status==='review'&&<button onClick={()=>approveTask(t.id)} className="btn-sm btn-approve text-[11px]">Tamamla</button>}
            </div>
          );})}
          {tasks.filter(t=>t.status!=='cancelled').length===0&&<div className="text-[13px] text-[#9CA3AF] text-center py-6">Henüz iş yok</div>}
        </div>
      )}

      {/* İLETİŞİM */}
      {subTab==='iletisim'&&(
        <div className="space-y-6">
          <div>
            <div className="flex justify-between items-center mb-3"><span className="text-[14px] font-medium">Duyuru</span><button onClick={()=>setShowAnn(!showAnn)} className="btn-ghost">{showAnn?'Kapat':'+ Yeni'}</button></div>
            <Slide open={showAnn}>
              <div className="p-4 border border-[#F3F4F6] rounded-lg mb-4 space-y-3">
                <input className="inp text-[13px]" placeholder="Başlık" value={annF.title} onChange={e=>setAnnF({...annF,title:e.target.value})}/>
                <textarea className="inp inp-area text-[13px]" rows={2} placeholder="İçerik" value={annF.body} onChange={e=>setAnnF({...annF,body:e.target.value})}/>
                <button onClick={createAnn} className="bg-[#059669] text-white text-[13px] font-medium py-2 px-4 rounded-lg">Yayınla</button>
              </div>
            </Slide>
          </div>
          <div><span className="text-[14px] font-medium block mb-3">Sohbet</span><ChatSection uid={uid} me={me}/></div>
        </div>
      )}

      {certVol&&<CertificateModal vol={certVol} summary={sumMap[certVol.id]} issuerId={uid} onClose={()=>setCertVol(null)}/>}
    </div>
  );
}

/* ═══ ADMIN — GENEL BAKIŞ ═══ */

function AdminView({uid,me}){
  const [pendingUsers,setPendingUsers]=useState([]);
  const [pendingReports,setPendingReports]=useState([]);
  const [vols,setVols]=useState([]);
  const [tasks,setTasks]=useState([]);
  const [summaries,setSummaries]=useState({});
  const [recent,setRecent]=useState([]);
  const [lastWeekH,setLastWeekH]=useState(0);
  const [volOverlay,setVolOverlay]=useState(false);
  const [certVol,setCertVol]=useState(null);
  const [showAnn,setShowAnn]=useState(false);
  const [annF,setAnnF]=useState({title:'',body:''});
  const toast=useToast();

  const load=useCallback(async()=>{
    const [p,pr,ws,t,rc,lw]=await Promise.all([db.getAllProfiles(),db.getPendingReports(),db.getAllWorkSummaries(),db.getTasks(),db.getRecentReports(8),db.getLastWeekHours()]);
    const all=p.data||[];
    setPendingUsers(all.filter(u=>u.status==='pending'));setVols(all.filter(u=>u.status!=='pending'));
    setPendingReports(pr.data||[]);setTasks(t.data||[]);
    setSummaries(Object.fromEntries((ws.data||[]).map(s=>[s.id,s])));
    setRecent(rc.data||[]);setLastWeekH(lw);
  },[]);
  useEffect(()=>{load();},[load]);

  // Realtime
  useEffect(()=>{const sub=db.subscribeReports(()=>load());return()=>sub.unsubscribe();},[load]);

  const approveUser=async id=>{await db.setUserStatus(id,'active');await db.sendNotification(id,'welcome','Hesabınız onaylandı!','');load();toast.show('Onaylandı');};
  const rejectUser=async id=>{await db.setUserStatus(id,'rejected');load();};
  const approveReport=async id=>{await db.approveReport(id,uid);load();toast.show('Onaylandı');};
  const approveAllR=async()=>{const ids=pendingReports.filter(r=>r.user_id!==uid).map(r=>r.id);await db.approveAllReports(ids,uid);load();toast.show('Tümü onaylandı');};
  const createAnn=async()=>{if(!annF.title||!annF.body)return;await db.createAnnouncement({...annF,department:null,is_pinned:false,is_public:false,author_id:uid});setShowAnn(false);setAnnF({title:'',body:''});toast.show('Duyuru yayınlandı');};

  const activeVols=vols.filter(v=>v.status==='active');
  const activeTasks=tasks.filter(t=>['active','pending','review'].includes(t.status));
  const doneTasks=tasks.filter(t=>t.status==='done');
  const overdueTasks=activeTasks.filter(t=>t.deadline&&t.deadline<today());
  const needsAttention=vols.filter(v=>v.status==='active'&&v.role==='vol'&&['slowing','inactive','dormant'].includes(v.activity_status));

  const weekH=Object.values(summaries).reduce((a,s)=>a+Number(s.week_hours||0),0);
  const weekChange=lastWeekH>0?Math.round((weekH-lastWeekH)/lastWeekH*100):0;

  // Dept hours
  const deptH={};activeVols.forEach(v=>{if(v.department&&summaries[v.id]){deptH[v.department]=(deptH[v.department]||0)+Number(summaries[v.id].week_hours||0);}});
  const maxDH=Math.max(...Object.values(deptH),1);
  const deptSorted=Object.entries(deptH).filter(([,h])=>h>0).sort((a,b)=>b[1]-a[1]);

  const hasPending=pendingUsers.length>0||pendingReports.length>0;

  return(
    <div>
      <toast.Toast/>

      <div className="text-[12px] text-[#9CA3AF] mb-1">{todayLabel()}</div>
      <div className="page-title text-[24px] mb-6">Genel bakış</div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="stat-box"><div className="stat-n text-[#059669]">{activeVols.length}</div><div className="stat-l">aktif gönüllü</div></div>
        <div className="stat-box"><div className="stat-n">{fmtH(weekH)}</div><div className="stat-l">bu hafta saat</div></div>
        <div className="stat-box"><div className="stat-n text-[#059669]">{doneTasks.length}</div><div className="stat-l">tamamlanan iş</div></div>
        <div className="stat-box"><div className={`stat-n ${overdueTasks.length>0?'text-[#EF4444]':''}`}>{overdueTasks.length}</div><div className="stat-l">gecikmiş iş</div></div>
      </div>

      {/* Hero */}
      <div className="hero-gradient mb-6">
        <div className="text-[12px] opacity-60 uppercase tracking-wide">Bu hafta özeti</div>
        <div className="text-[28px] font-semibold mt-1 tracking-tight">{activeVols.length} gönüllü çalıştı, {fmtH(weekH)}</div>
        {weekChange!==0&&<div className="text-[13px] opacity-75 mt-1">Geçen haftaya göre {weekChange>0?`%${weekChange} artış ↑`:`%${Math.abs(weekChange)} düşüş ↓`}</div>}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" style={{gridTemplateColumns:'1fr 1fr'}}>

        {/* Left */}
        <div>
          {deptSorted.length>0&&(<>
            <div className="sec-label" style={{marginTop:0}}>Departman aktivitesi</div>
            {deptSorted.map(([d,h])=>(
              <div key={d} className="bar-row"><span className="bar-label">{DM[d]?.l?.split(' ')[0]||d}</span><div className="bar-track"><div className="bar-fill" style={{width:`${(h/maxDH)*100}%`,transition:'width .5s'}}/></div><span className="bar-val text-[12px] text-[#9CA3AF]">{fmtH(h)}</span></div>
            ))}
          </>)}

          {hasPending&&(<>
            <div className="sec-label">Bekleyen işlemler</div>
            {pendingUsers.map(u=>{const av=avColor(u.display_name);return(
              <div key={u.id} className="appr-card !p-3">
                <div className="av av-sm" style={{background:av.bg,color:av.color}}>{(u.display_name||'?')[0]}</div>
                <div className="flex-1 min-w-0 text-[13px]"><b>{u.display_name}</b> — yeni kayıt</div>
                <button onClick={()=>approveUser(u.id)} className="btn-sm btn-approve text-[11px]">Onayla</button>
              </div>
            );})}
            {pendingReports.map(r=>{const av=avColor(r.profiles?.display_name);return(
              <div key={r.id} className="appr-card !p-3">
                <div className="av av-sm" style={{background:av.bg,color:av.color}}>{(r.profiles?.display_name||'?')[0]}</div>
                <div className="flex-1 min-w-0 text-[13px]"><b>{r.profiles?.display_name}</b> — {fmtH(r.hours)} {r.description?.slice(0,25)}</div>
                {r.user_id!==uid?<button onClick={()=>approveReport(r.id)} className="btn-sm btn-approve text-[11px]">Onayla</button>:<span className="text-[11px] text-[#C4C4C4]">Kendi</span>}
              </div>
            );})}
            {pendingReports.filter(r=>r.user_id!==uid).length>1&&<div className="text-right mt-2"><button onClick={approveAllR} className="btn-ghost text-[12px]">Tümünü onayla &rarr;</button></div>}
          </>)}
        </div>

        {/* Right */}
        <div>
          {recent.length>0&&(<>
            <div className="sec-label" style={{marginTop:0}}>Son gelişmeler</div>
            {recent.slice(0,6).map((r,i)=>(
              <div key={r.id||i} className="tl-item">
                <div className={`tl-dot ${r.is_approved?'tl-dot-green':''}`}/>
                <div><div className="text-[13px] text-[#6B7280]"><b className="text-[#111827] font-medium">{r.profiles?.display_name}</b> rapor girdi — {fmtH(r.hours)}</div><div className="text-[11px] text-[#C4C4C4] mt-0.5">{timeAgo(r.created_at)}</div></div>
              </div>
            ))}
          </>)}

          {needsAttention.length>0&&(<>
            <div className="sec-label">Dikkat gerektiren</div>
            {needsAttention.sort((a,b)=>(a.activity_score||0)-(b.activity_score||0)).slice(0,5).map(v=>{
              const days=v.last_activity_at?Math.floor((Date.now()-new Date(v.last_activity_at).getTime())/86400000):999;
              const dotC=v.activity_status==='slowing'?'bg-[#F59E0B]':v.activity_status==='inactive'?'bg-[#F97316]':'bg-[#EF4444]';
              return(
                <div key={v.id} className="flex items-center gap-2 py-2 text-[13px]">
                  <span className={`dot ${dotC}`}/><span>{v.display_name} — {days<999?`${days} gündür rapor yok`:'hiç rapor yok'}</span>
                </div>
              );
            })}
          </>)}
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3 mt-6">
        <button onClick={()=>setVolOverlay(true)} className="qa-item">Gönüllüler &rarr;</button>
        <button onClick={()=>setShowAnn(!showAnn)} className="qa-item">Duyuru yaz</button>
      </div>

      <Slide open={showAnn}>
        <div className="p-4 border border-[#F3F4F6] rounded-lg mt-4 space-y-3">
          <input className="inp text-[13px]" placeholder="Başlık" value={annF.title} onChange={e=>setAnnF({...annF,title:e.target.value})}/>
          <textarea className="inp inp-area text-[13px]" rows={2} placeholder="İçerik" value={annF.body} onChange={e=>setAnnF({...annF,body:e.target.value})}/>
          <button onClick={createAnn} className="bg-[#059669] text-white text-[13px] font-medium py-2 px-4 rounded-lg">Yayınla</button>
        </div>
      </Slide>

      {/* Volunteer overlay */}
      {volOverlay&&<VolunteerOverlay uid={uid} vols={vols} summaries={summaries} onCert={setCertVol} onClose={()=>setVolOverlay(false)} toast={toast}/>}
      {certVol&&<CertificateModal vol={certVol} summary={summaries[certVol.id]} issuerId={uid} onClose={()=>setCertVol(null)}/>}
    </div>
  );
}

function VolunteerOverlay({uid,vols,summaries,onCert,onClose,toast}){
  const [search,setSearch]=useState('');
  const [expand,setExpand]=useState(null);
  const filtered=vols.filter(v=>!search||v.display_name?.toLowerCase().includes(search.toLowerCase()));
  const changeRole=async(id,role)=>{await db.setUserRole(id,role);toast.show('Rol güncellendi');};
  const changeDept=async(id,dept)=>{await db.setUserDept(id,dept);toast.show('Departman güncellendi');};
  const changeStatus=async(id,st)=>{await db.setUserStatus(id,st);toast.show('Durum güncellendi');};

  return(
    <div className="fixed inset-0 bg-[#FAFAFA] z-[60] overflow-y-auto">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-6 bg-white border-b border-[#F3F4F6]" style={{height:56}}>
        <button onClick={onClose} className="text-[#6B7280] text-[14px]">&larr; Geri</button>
        <input value={search} onChange={e=>setSearch(e.target.value)} className="inp !w-[200px] !py-1.5 !text-[12px]" placeholder="Gönüllü ara..."/>
      </header>
      <div className="max-w-[680px] mx-auto px-4 md:px-6 py-6">
        <div className="page-title mb-1">Gönüllüler</div>
        <div className="meta mb-4">{vols.filter(v=>v.status==='active').length} aktif, {vols.filter(v=>v.status!=='active').length} pasif</div>

        <table className="tbl">
          <thead><tr><th>Gönüllü</th><th>Departman</th><th>Bu ay</th><th>Toplam</th><th>Durum</th><th>Son</th></tr></thead>
          <tbody>
            {filtered.slice(0,30).map(v=>{const s=summaries[v.id];const av=avColor(v.display_name);const st=v.activity_status||'active';const dotC=v.status!=='active'?'bg-[#D1D5DB]':st==='active'?'bg-[#059669]':st==='slowing'?'bg-[#F59E0B]':'bg-[#EF4444]';const stLabel=v.status!=='active'?'pasif':st==='active'?'aktif':st==='slowing'?'yavaşlıyor':'inaktif';
              return(
                <tr key={v.id} onClick={()=>setExpand(expand===v.id?null:v.id)} className="cursor-pointer hover:bg-[#FAFAFA]">
                  <td><div className="flex items-center gap-2"><div className="av av-sm" style={{background:av.bg,color:av.color}}>{(v.display_name||'?')[0]}</div><span className="font-medium">{v.display_name}</span></div></td>
                  <td>{DM[v.department]?.l?.split(' ')[0]||'—'}</td>
                  <td>{s?fmtH(Number(s.month_hours)):'—'}</td>
                  <td>{s?fmtH(Number(s.total_hours)):'—'}</td>
                  <td><span className={`dot ${dotC}`} style={{marginRight:4}}/>{stLabel}</td>
                  <td className="text-[#9CA3AF]">{v.last_activity_at?timeAgo(v.last_activity_at):'—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {expand&&(()=>{const v=vols.find(x=>x.id===expand);if(!v||v.id===uid)return null;const s=summaries[v.id];return(
          <div className="mt-2 p-4 bg-[#F9FAFB] rounded-lg text-[13px] space-y-3">
            {s&&<div className="text-[#6B7280]">Toplam: {s.total_days} gün, {fmtH(Number(s.total_hours))} · Skor: {v.activity_score||0}</div>}
            <div className="flex flex-wrap gap-3 items-center">
              <label className="text-[#9CA3AF] text-[12px]">Rol:</label>
              <select value={v.role} onChange={e=>changeRole(v.id,e.target.value)} className="inp !w-auto !py-1 !px-2 !text-[12px] bg-white"><option value="vol">Gönüllü</option><option value="coord">Koordinatör</option><option value="admin">Yönetici</option></select>
              <label className="text-[#9CA3AF] text-[12px]">Dept:</label>
              <select value={v.department||''} onChange={e=>changeDept(v.id,e.target.value)} className="inp !w-auto !py-1 !px-2 !text-[12px] bg-white"><option value="">—</option>{DEPTS.map(d=><option key={d.id} value={d.id}>{d.l}</option>)}</select>
            </div>
            <div className="flex gap-3 items-center">
              {v.status==='active'?<button onClick={()=>changeStatus(v.id,'blocked')} className="btn-danger-text text-[12px]">Engelle</button>:<button onClick={()=>changeStatus(v.id,'active')} className="btn-ghost text-[12px]">Aktifleştir</button>}
              <button onClick={()=>onCert(v)} className="text-[12px] text-[#6B7280] hover:text-[#F59E0B]">Belge oluştur</button>
            </div>
          </div>
        );})()}
      </div>
    </div>
  );
}

/* ═══ ADMIN — RAPORLAR ═══ */

function ReportsView({uid}){
  const [period,setPeriod]=useState(null);
  const [reportData,setReportData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [customRange,setCustomRange]=useState(false);
  const [cStart,setCStart]=useState('');
  const [cEnd,setCEnd]=useState('');
  const toast=useToast();

  const generate=async(p)=>{
    setPeriod(p);setLoading(true);setReportData(null);
    const now=new Date();
    let start=today(),end=today(),label='Bugün';
    if(p==='week'){const mon=new Date(now);mon.setDate(now.getDate()-((now.getDay()+6)%7));start=mon.toISOString().slice(0,10);label='Bu hafta';}
    else if(p==='month'){start=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;label='Bu ay';}
    else if(p==='custom'&&cStart&&cEnd){start=cStart;end=cEnd;label='Özel dönem';}

    const [reps,profs,tsk]=await Promise.all([db.getReportsInRange(start,end),db.getAllProfiles(),db.getTasks()]);
    const reports=reps.data||[];const profiles=profs.data||[];const allTasks=tsk.data||[];

    // Compute
    const totalH=reports.reduce((a,r)=>a+Number(r.hours||0),0);
    const onsiteH=reports.filter(r=>r.work_mode==='onsite').reduce((a,r)=>a+Number(r.hours||0),0);
    const remoteH=totalH-onsiteH;
    const people=new Set(reports.map(r=>r.user_id));
    const completed=allTasks.filter(t=>t.status==='done'&&t.completed_at&&t.completed_at>=start).length;
    const overdue=allTasks.filter(t=>['active','pending','review'].includes(t.status)&&t.deadline&&t.deadline<today()).length;

    // By dept
    const deptMap={};reports.forEach(r=>{const dept=r.profiles?.department||'diger';deptMap[dept]=(deptMap[dept]||0)+Number(r.hours||0);});
    const maxD=Math.max(...Object.values(deptMap),1);

    // By person
    const personMap={};reports.forEach(r=>{const n=r.profiles?.display_name||'?';if(!personMap[r.user_id])personMap[r.user_id]={name:n,hours:0,days:new Set()};personMap[r.user_id].hours+=Number(r.hours||0);personMap[r.user_id].days.add(r.date);});
    const personList=Object.values(personMap).map(p=>({...p,days:p.days.size})).sort((a,b)=>b.hours-a.hours);

    setReportData({label,dateRange:`${fdf(start)} — ${fdf(end)}`,totalH,onsiteH,remoteH,people:people.size,completed,overdue,deptMap,maxD,personList});
    setLoading(false);
  };

  const copyReport=()=>{
    if(!reportData)return;
    const d=reportData;
    let txt=`${d.label}\n${d.dateRange}\n\n${d.people} gönüllü, ${fmtH(d.totalH)} (${fmtH(d.onsiteH)} vakıfta, ${fmtH(d.remoteH)} uzaktan)\n${d.completed} iş tamamlandı`;
    if(d.overdue) txt+=`, ${d.overdue} gecikmiş`;
    txt+='\n\nDepartmanlar:\n';
    Object.entries(d.deptMap).sort((a,b)=>b[1]-a[1]).forEach(([dept,h])=>{txt+=`  ${DM[dept]?.l||dept}: ${fmtH(h)}\n`;});
    txt+='\nKişiler:\n';
    d.personList.forEach(p=>{txt+=`  ${p.name}: ${p.days} gün, ${fmtH(p.hours)}\n`;});
    navigator.clipboard.writeText(txt);toast.show('Kopyalandı');
  };

  return(
    <div>
      <toast.Toast/>
      <div className="page-title mb-1">Raporlar</div>
      <div className="meta mb-6">Dönemi seç, rapor otomatik oluşsun</div>

      <div className="grid grid-cols-3 gap-3 mb-2">
        {[['today','Bugün'],['week','Bu hafta'],['month','Bu ay']].map(([k,l])=>(
          <button key={k} onClick={()=>generate(k)} className={`stat-box cursor-pointer transition-all ${period===k?'outline outline-2 outline-[#059669] -outline-offset-2':''}`}><span className="text-[14px] font-medium">{l}</span></button>
        ))}
      </div>
      <button onClick={()=>setCustomRange(!customRange)} className="link-muted text-[12px]">{customRange?'Kapat':'Özel dönem seç...'}</button>
      <Slide open={customRange}>
        <div className="flex gap-2 mt-3 items-end">
          <input type="date" className="inp text-[13px] flex-1" value={cStart} onChange={e=>setCStart(e.target.value)}/>
          <span className="text-[#9CA3AF] text-[13px]">—</span>
          <input type="date" className="inp text-[13px] flex-1" value={cEnd} onChange={e=>setCEnd(e.target.value)}/>
          <button onClick={()=>generate('custom')} className="btn-sm btn-approve">Oluştur</button>
        </div>
      </Slide>

      {loading&&<div className="mt-6 space-y-3"><div className="skeleton h-6 w-1/3"/><div className="skeleton h-4 w-full"/><div className="skeleton h-4 w-2/3"/></div>}

      {reportData&&(
        <div className="border border-[#F3F4F6] rounded-xl p-6 mt-6">
          <div className="text-[12px] text-[#9CA3AF]">{reportData.dateRange}</div>
          <div className="text-[22px] font-semibold mt-1 tracking-tight">{reportData.label}</div>
          <hr className="border-[#F3F4F6] my-5"/>

          <div className="grid grid-cols-3 gap-4 mb-5">
            <div><div className="text-[32px] font-semibold">{reportData.people}</div><div className="text-[11px] text-[#9CA3AF]">gönüllü</div></div>
            <div><div className="text-[32px] font-semibold">{fmtH(reportData.totalH)}</div><div className="text-[11px] text-[#9CA3AF]">toplam saat</div></div>
            <div><div className="text-[32px] font-semibold">{reportData.completed}</div><div className="text-[11px] text-[#9CA3AF]">tamamlanan iş</div></div>
          </div>

          {Object.keys(reportData.deptMap).length>0&&(<>
            <hr className="border-[#F3F4F6] my-5"/>
            <div className="sec-label" style={{marginTop:0}}>Departmanlar</div>
            {Object.entries(reportData.deptMap).sort((a,b)=>b[1]-a[1]).map(([d,h])=>(
              <div key={d} className="bar-row"><span className="bar-label">{DM[d]?.l?.split(' ')[0]||d}</span><div className="bar-track"><div className="bar-fill" style={{width:`${(h/reportData.maxD)*100}%`}}/></div><span className="bar-val text-[12px] text-[#9CA3AF]">{fmtH(h)}</span></div>
            ))}
          </>)}

          {reportData.personList.length>0&&(<>
            <hr className="border-[#F3F4F6] my-5"/>
            <div className="sec-label" style={{marginTop:0}}>Kişiler</div>
            {reportData.personList.map((p,i)=>(
              <div key={i} className="flex items-center justify-between py-2 text-[13px] border-b border-[#F9FAFB] last:border-0">
                <span className="font-medium">{p.name}</span>
                <span className="text-[#9CA3AF]">{p.days} gün, {fmtH(p.hours)}</span>
              </div>
            ))}
          </>)}

          <hr className="border-[#F3F4F6] my-5"/>
          <div className="flex gap-3">
            <button onClick={copyReport} className="btn-outline">Kopyala</button>
          </div>
        </div>
      )}

      {/* Archive */}
      <div className="sec-label">Arşiv</div>
      <div className="border border-[#F3F4F6] rounded-xl p-5">
        <ReportArchive/>
      </div>

      {/* Backup */}
      <div className="mt-4 p-4 bg-[#F9FAFB] rounded-lg">
        <BackupView uid={uid}/>
      </div>
    </div>
  );
}

/* ═══ CHAT ═══ */

function ChatSection({uid,me}){
  const isCoordOrAdmin=me.role==='admin'||me.role==='coord';
  const [dept,setDept]=useState(me.department||'arsiv');
  const [messages,setMessages]=useState([]);
  const [text,setText]=useState('');
  const load=useCallback(async()=>{const{data}=await db.getMessages(dept);setMessages((data||[]).reverse());},[dept]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{const sub=db.subscribeMessages(dept,()=>load());return()=>sub.unsubscribe();},[dept,load]);
  const send=async()=>{if(!text.trim())return;await db.sendMessage(uid,dept,text.trim());setText('');load();};

  return(
    <div className="space-y-3">
      {isCoordOrAdmin&&<div className="flex gap-1 flex-wrap">{DEPTS.map(d=><button key={d.id} onClick={()=>setDept(d.id)} className={`text-[11px] px-2 py-1 rounded-md transition-colors ${dept===d.id?'bg-[#111827] text-white':'bg-[#F3F4F6] text-[#9CA3AF]'}`}>{d.l.split(' ')[0]}</button>)}</div>}
      <div className="bg-white rounded-lg p-3 space-y-1.5 max-h-56 overflow-y-auto border border-[#F3F4F6]">
        {messages.length===0&&<div className="text-center text-[13px] text-[#C4C4C4] py-6">Henüz mesaj yok</div>}
        {messages.map((m,i)=>(
          <div key={m.id||i} className={`flex ${m.user_id===uid?'justify-end':'justify-start'}`}>
            <div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-[14px] ${m.user_id===uid?'bg-[#059669] text-white':'bg-[#F3F4F6]'}`}>
              {m.user_id!==uid&&<div className="text-[11px] font-semibold text-[#059669] mb-0.5">{m.profiles?.display_name}</div>}
              {m.content}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input className="inp flex-1 !py-2 text-[13px]" placeholder="Mesaj..." value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}/>
        <button onClick={send} disabled={!text.trim()} className="bg-[#059669] text-white text-[13px] font-medium px-4 py-2 rounded-lg disabled:opacity-30">Gönder</button>
      </div>
    </div>
  );
}

/* ═══ HELP ═══ */

function HelpContent({me}){
  const items=[
    {q:'Nasıl çalışma raporu girerim?',a:'Çalışma Raporu butonuna tıkla, saat yaz, ne yaptığını yaz, konum seç, kaydet.'},
    {q:'Raporumu nasıl düzenlerim?',a:'Bu Hafta listesinde rapora tıkla, inline düzenleme açılır. Onaylanmış rapor düzenlenirse tekrar onay gerekir.'},
    {q:'Raporumu nasıl silerim?',a:'Rapora tıkla, düzenleme modunda "Sil" butonunu kullan.'},
    {q:'Telegram nasıl bağlanır?',a:'Profil menüsünden Telegram Bağla seçeneğini kullan. Verilen kodu @tarihvakfi_bot\'a gönder.'},
  ];
  if(me.role!=='vol') items.push(
    {q:'Raporları nasıl onaylarım?',a:'Departmanım sekmesinde Onaylar tabından onayla veya reddet.'},
    {q:'Nasıl iş oluştururum?',a:'İşler tabında + Yeni İş butonuna tıkla.'},
  );
  if(me.role==='admin') items.push(
    {q:'Rapor nasıl oluştururum?',a:'Raporlar sekmesinden dönem seç, rapor otomatik oluşur.'},
  );
  const [open,setOpen]=useState(null);
  return(
    <div>{items.map((item,i)=>(
      <div key={i} onClick={()=>setOpen(open===i?null:i)} className="cursor-pointer py-3 border-b border-[#F3F4F6] last:border-0">
        <div className="flex justify-between"><span className="text-[14px] font-medium">{item.q}</span><span className="text-[#C4C4C4] text-[12px]">{open===i?'−':'+'}</span></div>
        {open===i&&<p className="text-[13px] text-[#6B7280] mt-2 leading-relaxed">{item.a}</p>}
      </div>
    ))}</div>
  );
}

/* ═══ RESTRICTED ═══ */

function RestrictedShell({me,uid}){
  const [sent,setSent]=useState(false);
  const msgs={
    pending:{bg:'#FEF3C7',icon:'⏳',t:'Hesabınız onay bekliyor',d:'Kaydınız alındı. Yönetici onayladığında bildirim alacaksınız.'},
    rejected:{bg:'#FEE2E2',icon:'✕',t:'Kaydınız reddedildi',d:'Yöneticiyle iletişime geçin.'},
    blocked:{bg:'#FEE2E2',icon:'✕',t:'Hesabınız engellendi',d:'Bu hesap yönetici tarafından engellenmiştir.'},
    paused:{bg:'#FEF3C7',icon:'⏸',t:'Hesap duraklatıldı',d:'Tekrar aktif olmak için talep gönderin.'},
    inactive:{bg:'#FEE2E2',icon:'!',t:'Hesap pasif',d:'30 gündür raporlama yapılmadığı için pasife alındı.'},
    resigned:{bg:'#F3F4F6',icon:'—',t:'Ayrıldınız',d:'Eski verileriniz korunuyor.'},
  };
  const m=msgs[me.status]||msgs.blocked;
  const canReact=['paused','inactive','resigned'].includes(me.status);
  const react=async()=>{const{data:admins}=await db.getProfilesByRole('admin');for(const a of(admins||[]))await db.sendNotification(a.id,'system',`${me.display_name} tekrar aktif olmak istiyor`,'');setSent(true);};

  return(
    <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6">
      <div className="text-center max-w-sm space-y-5">
        <div className="w-[60px] h-[60px] rounded-full mx-auto flex items-center justify-center text-[24px] font-bold" style={{background:m.bg}}>{m.icon}</div>
        <div className="text-[20px] font-medium">{m.t}</div>
        <div className="text-[14px] text-[#6B7280] leading-relaxed">{m.d}</div>
        {canReact&&!sent&&<button onClick={react} className="btn !w-auto !inline-block !px-8">{me.status==='resigned'?'Tekrar Katıl':'Tekrar Aktif Ol'}</button>}
        {sent&&<div className="text-[14px] text-[#059669]">Talebiniz iletildi.</div>}
        <div><button onClick={db.signOut} className="btn-outline">Çıkış</button></div>
      </div>
    </div>
  );
}
