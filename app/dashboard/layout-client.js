'use client';
import { useState, useEffect, useCallback } from 'react';
import * as db from '../../lib/supabase';
import { CertificateModal, MyCertificates } from './certificates';
import { ReportArchive } from './reports';


/* ═══ CONSTANTS ═══ */
const DEPTS=[{id:'arsiv',l:'Arşiv ve Dokümantasyon'},{id:'egitim',l:'Eğitim ve Atölye'},{id:'etkinlik',l:'Etkinlik ve Organizasyon'},{id:'dijital',l:'Dijital ve Sosyal Medya'},{id:'rehber',l:'Rehberlik ve Gezi'},{id:'baski',l:'Yayın ve Baskı'},{id:'bagis',l:'Bağış ve Sponsorluk'},{id:'idari',l:'İdari İşler'}];
const DM=Object.fromEntries(DEPTS.map(d=>[d.id,d]));
const ROLES={admin:'Yönetici',coord:'Koordinatör',vol:'Gönüllü'};
const DAYS=['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'];
const MO=['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
const WDAYS=['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
const fd=d=>{const x=new Date(d);return`${x.getDate()} ${MO[x.getMonth()]}`;};
const fdf=d=>{const x=new Date(d);return`${x.getDate()} ${MO[x.getMonth()]} ${x.getFullYear()}`;};
const today=()=>new Date().toISOString().slice(0,10);
const fmtH=h=>{const hrs=Math.floor(h),mins=Math.round((h-hrs)*60);return mins>0?`${hrs}s ${mins}dk`:`${hrs}s`;};
const todayLabel=()=>{const d=new Date();return`${d.getDate()} ${MO[d.getMonth()]} ${d.getFullYear()}, ${WDAYS[d.getDay()]}`;};
const timeAgo=ts=>{const m=Math.floor((Date.now()-new Date(ts).getTime())/60000);if(m<1)return'az önce';if(m<60)return`${m} dk önce`;const h=Math.floor(m/60);if(h<24)return`${h} saat önce`;return`${Math.floor(h/24)} gün önce`;};
const AVC=['#DBEAFE','#EDE9FE','#FEE2E2','#D1FAE5','#FEF3C7'];
const AVT=['#1D4ED8','#6D28D9','#991B1B','#065F46','#92400E'];
const avc=n=>{const i=(n||'A').charCodeAt(0)%5;return{bg:AVC[i],color:AVT[i]};};

function useToast(){const[t,setT]=useState(null);const show=(msg,ok=true)=>{setT({msg,ok});setTimeout(()=>setT(null),3000);};const Toast=()=>t?<div className={`toast ${t.ok?'toast-ok':'toast-err'}`}>{t.msg}</div>:null;return{show,Toast};}
function Slide({open,children}){return<div className={`slide-wrap ${open?'open':''}`}><div className="slide-inner">{children}</div></div>;}
function Overlay({title,onClose,children}){return(<div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center" onClick={onClose}><div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto" onClick={e=>e.stopPropagation()}><div className="sticky top-0 bg-white border-b border-[#F3F4F6] px-6 py-4 flex items-center justify-between z-10"><span className="text-[15px] font-semibold">{title}</span><button onClick={onClose} className="text-[#9CA3AF] hover:text-[#111] text-lg">&times;</button></div><div className="px-6 py-5">{children}</div></div></div>);}

/* ═══ MAIN SHELL ═══ */
export default function Dashboard({session}){
  const uid=session.user.id;
  const[me,setMe]=useState(null);
  const[page,setPage]=useState(null);
  const[loading,setLoading]=useState(true);
  const[unread,setUnread]=useState(0);
  const[showNotifs,setShowNotifs]=useState(false);
  const[showProfile,setShowProfile]=useState(false);
  const[modal,setModal]=useState(null);
  const[sideOpen,setSideOpen]=useState(false);

  // ── Admin power features ──
  const[viewAsRole,setViewAsRole]=useState(null); // null=normal, 'vol','coord','admin'
  const[managingUser,setManagingUser]=useState(null); // full profile object or null — "olarak yönet"
  const[editMode,setEditMode]=useState(false);
  const[quickReportFor,setQuickReportFor]=useState(null); // vol profile for quick report modal

  useEffect(()=>{(async()=>{const{data}=await db.getProfile(uid);if(data)setMe(data);setUnread(await db.getUnreadCount(uid));setLoading(false);})();},[uid]);
  useEffect(()=>{const sub=db.subscribeNotifications(uid,()=>setUnread(n=>n+1));return()=>sub.unsubscribe();},[uid]);
  useEffect(()=>{if(!me)return;if(me.role==='admin')setPage('genel');else if(me.role==='coord')setPage('calisma');else setPage('ana');},[me?.role]);

  // Keyboard shortcuts (admin-only: E=edit, 1/2/3=view switch, Esc=reset)
  useEffect(()=>{const h=e=>{
    if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
    if(e.key==='Escape'){setShowNotifs(false);setShowProfile(false);setModal(null);setSideOpen(false);if(managingUser){setManagingUser(null);setPage('gonulluler');return;}if(viewAsRole){setViewAsRole(null);setPage('genel');return;}}
    if(me?.role==='admin'){
      if(e.key==='e'||e.key==='E'){setEditMode(p=>!p);return;}
      if(e.key==='1'){setViewAsRole(null);setManagingUser(null);setPage('genel');return;}
      if(e.key==='2'){switchView('coord');return;}
      if(e.key==='3'){switchView('vol');return;}
    }
  };window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h);},[me?.role,viewAsRole,managingUser]);

  const switchView=(role)=>{
    if(role==='admin'||role===null){setViewAsRole(null);setManagingUser(null);setEditMode(false);setPage('genel');}
    else{setViewAsRole(role);setManagingUser(null);setEditMode(false);setPage(role==='vol'?'ana':'calisma');}
  };
  const startManaging=(vol)=>{
    if(vol.role==='admin')return; // can't manage other admins
    setManagingUser(vol);setViewAsRole(null);setEditMode(false);
    setPage(vol.role==='coord'?'calisma':'ana');
    db.logAdminAction(uid,vol.id,'manage_as',{display_name:vol.display_name});
  };
  const stopManaging=()=>{setManagingUser(null);setPage('gonulluler');};

  if(loading||!me)return<div className="flex items-center justify-center min-h-screen"><div className="space-y-3 w-48"><div className="skeleton h-3 w-full"/><div className="skeleton h-3 w-3/4"/><div className="skeleton h-3 w-1/2"/></div></div>;

  const restricted=['paused','inactive','resigned','pending','rejected','blocked'].includes(me.status);
  if(restricted)return<RestrictedShell me={me} uid={uid}/>;

  const realAdmin=me.role==='admin';

  // Effective role: if managing a user, use their role; if view-as, use that
  const effectiveRole=managingUser?managingUser.role:viewAsRole||me.role;
  const isVol=effectiveRole==='vol',isCoord=effectiveRole==='coord',isAdmin=effectiveRole==='admin';
  const openModal=v=>{setModal(v);setShowProfile(false);};
  const hasSidebar=isCoord||isAdmin;

  // The uid to use for data fetching (managing mode)
  const dataUid=managingUser?managingUser.id:uid;
  // The me to display
  const displayMe=managingUser||me;
  // Whether we're in managing mode (admin acting on behalf)
  const isManaging=!!managingUser;

  // Content max-width
  const mw=isVol?'max-w-[440px]':isCoord?'max-w-[600px]':'max-w-[680px]';

  // Nav items per role
  const volPages=[{id:'ana',l:'Ana Sayfa'},{id:'raporlarim',l:'Raporlarım'},{id:'islerim',l:'İşlerim'},{id:'belgelerim',l:'Belgelerim'},{id:'vakif',l:'Vakıf Durumu'}];

  const coordNav=[
    {section:'BENİM',items:[{id:'calisma',l:'Çalışmam'},{id:'raporlarim',l:'Raporlarım'}]},
    {section:'DEPARTMANIM',items:[{id:'onaylar',l:'Onaylar',badge:true},{id:'gonulluler',l:'Gönüllüler'},{id:'isler',l:'İşler'},{id:'duyurular',l:'Duyurular'},{id:'vardiya',l:'Vardiya'}]},
    {section:'GENEL',items:[{id:'vakif',l:'Vakıf Durumu'}]},
  ];

  const adminNav=[
    {section:'YÖNETİM',items:[{id:'genel',l:'Genel Bakış'},{id:'onaylar',l:'Onaylar',badge:true},{id:'gonulluler',l:'Gönüllüler'},{id:'isler',l:'İşler'},{id:'iletisim',l:'İletişim'}]},
    {section:'VERİ',items:[{id:'raporlar',l:'Raporlar'},{id:'belgeler',l:'Belgeler'},{id:'yedekleme',l:'Yedekleme'},{id:'icerik',l:'İçerik Yönetimi'}]},
  ];

  const sideNav=isCoord?coordNav:isAdmin?adminNav:[];

  // Pending count for badge
  const [pendingCount,setPendingCount]=useState(0);
  useEffect(()=>{if(!hasSidebar)return;(async()=>{const{data}=await db.getPendingReports();setPendingCount((data||[]).length);})();},[hasSidebar]);

  // SidebarContent inlined directly in JSX below

  return(
    <div className="min-h-screen bg-[#FAFAFA]">
      {/* ── Managing / view banners ── */}
      {managingUser&&(
        <div className="bg-[#FEF3C7] text-[#92400E] text-[12px] text-center py-1.5 px-4 font-medium sticky top-0 z-[51]">
          <b>{managingUser.display_name}</b> olarak yönetiyorsun ({ROLES[managingUser.role]||'Gönüllü'}{managingUser.department?' — '+DM[managingUser.department]?.l?.split(' ')[0]:''}) — <button onClick={stopManaging} className="underline font-semibold">Yöneticiye dön</button>
        </div>
      )}
      {!managingUser&&viewAsRole&&viewAsRole!=='admin'&&(
        <div className="bg-[#FEF3C7] text-[#92400E] text-[12px] text-center py-1.5 px-4 font-medium">
          {viewAsRole==='vol'?'Gönüllü':'Koordinatör'} görünümündesin — <button onClick={()=>switchView('admin')} className="underline font-semibold">Yöneticiye dön</button>
        </div>
      )}
      {editMode&&(
        <div className="bg-[#FEE2E2] text-[#991B1B] text-[12px] text-center py-1.5 px-4 font-medium">
          Düzenleme modu açık — Değişiklikler anında kaydedilir
        </div>
      )}

      {/* ── HEADER ── */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 md:px-6 bg-white border-b border-[#F3F4F6]" style={{height:56}}>
        <div className="flex items-center gap-4">
          {hasSidebar&&<button onClick={()=>setSideOpen(!sideOpen)} className="md:hidden text-[#6B7280] text-[18px]">&#9776;</button>}
          <a href="/" className="font-semibold text-[15px] text-[#111827]">Tarih Vakfı</a>
          {/* Vol top nav */}
          {isVol&&<nav className="hidden sm:flex items-center gap-1 ml-6">{volPages.map(p=>(
            <button key={p.id} onClick={()=>setPage(p.id)} className={`px-3 py-1.5 text-[13px] font-medium rounded-md transition-all ${page===p.id?'text-[#059669] bg-[#ECFDF5]':'text-[#6B7280] hover:text-[#111]'}`}>{p.l}</button>
          ))}</nav>}
        </div>
        <div className="flex items-center gap-4 text-[13px] text-[#6B7280]">
          <button onClick={()=>{setShowNotifs(!showNotifs);setShowProfile(false);if(!showNotifs){db.markAllRead(uid);setUnread(0);}}} className="relative hover:text-[#111] transition-colors">
            Bildirimler{unread>0&&<span className="absolute -top-1 -right-2 w-[6px] h-[6px] rounded-full bg-[#EF4444]"/>}
          </button>
          <button onClick={()=>{setShowProfile(!showProfile);setShowNotifs(false);}} className="font-medium text-[#374151] hover:text-[#111] transition-colors">{(displayMe.display_name||'').split(' ')[0]} &#9662;</button>
        </div>
      </header>

      {showNotifs&&<NotifPanel uid={uid} onClose={()=>setShowNotifs(false)}/>}
      {showProfile&&<ProfilePanel me={me} uid={uid} onUpdate={setMe} onModal={openModal} onClose={()=>setShowProfile(false)}/>}
      {modal==='certs'&&<Overlay title="Belgelerim" onClose={()=>setModal(null)}><MyCertificates uid={dataUid} me={displayMe}/></Overlay>}
      {modal==='summary'&&<Overlay title="Çalışma Özeti" onClose={()=>setModal(null)}><WorkSummary uid={dataUid}/></Overlay>}
      {modal==='help'&&<Overlay title="Yardım" onClose={()=>setModal(null)}><HelpContent me={displayMe}/></Overlay>}
      {quickReportFor&&<QuickReportModal vol={quickReportFor} adminUid={uid} onClose={()=>setQuickReportFor(null)}/>}

      <div className="flex" style={{minHeight:'calc(100vh - 56px)'}}>
        {/* ── SIDEBAR (desktop) ── */}
        {hasSidebar&&<aside className="hidden md:block w-[200px] bg-[#FAFAFA] border-r border-[#F3F4F6] flex-shrink-0 p-4"><div className="font-semibold text-[15px] mb-4">Tarih Vakfı</div>{sideNav.map(sec=><div key={sec.section} className="mb-4"><div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#C4C4C4] px-1 mb-1">{sec.section}</div>{sec.items.map(item=><button key={item.id} onClick={()=>{setPage(item.id);setSideOpen(false);}} className={`w-full text-left px-3 py-[9px] rounded-[7px] text-[13px] transition-all mb-0.5 ${page===item.id?'bg-[#ECFDF5] text-[#059669] font-medium':'text-[#6B7280] hover:bg-[#F3F4F6]'}`}>{String(item.l)}</button>)}</div>)}</aside>}

        {/* ── SIDEBAR OVERLAY (mobile) ── */}
        {hasSidebar&&sideOpen&&(<>
          <div className="fixed inset-0 bg-black/30 z-[55] md:hidden" onClick={()=>setSideOpen(false)}/>
          <aside className="fixed top-0 left-0 bottom-0 w-[240px] bg-white z-[56] md:hidden shadow-xl p-4"><div className="font-semibold text-[15px] mb-4">Tarih Vakfı</div>{sideNav.map(sec=><div key={sec.section} className="mb-4"><div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#C4C4C4] px-1 mb-1">{sec.section}</div>{sec.items.map(item=><button key={item.id} onClick={()=>{setPage(item.id);setSideOpen(false);}} className={`w-full text-left px-3 py-[9px] rounded-[7px] text-[13px] mb-0.5 ${page===item.id?'bg-[#ECFDF5] text-[#059669] font-medium':'text-[#6B7280]'}`}>{String(item.l)}</button>)}</div>)}</aside>
        </>)}

        {/* ── CONTENT ── */}
        <main className="flex-1 overflow-x-hidden">
          <div className={`mx-auto px-4 md:px-6 py-8 ${mw}`}>
            {/* Vol pages */}
            {isVol&&page==='ana'&&<VolHome uid={dataUid} me={displayMe} onModal={openModal} isManaging={isManaging} adminUid={uid}/>}
            {isVol&&page==='raporlarim'&&<MyReports uid={dataUid}/>}
            {isVol&&page==='islerim'&&<MyTasks uid={dataUid} me={displayMe}/>}
            {isVol&&page==='belgelerim'&&<MyCertificates uid={dataUid} me={displayMe}/>}
            {isVol&&page==='vakif'&&<VakifDurumu me={displayMe}/>}

            {/* Coord pages */}
            {isCoord&&page==='calisma'&&<VolHome uid={dataUid} me={displayMe} onModal={openModal} isManaging={isManaging} adminUid={uid}/>}
            {isCoord&&page==='raporlarim'&&<MyReports uid={dataUid}/>}
            {isCoord&&page==='onaylar'&&<ApprovalsPage uid={uid} onCount={setPendingCount}/>}
            {isCoord&&page==='gonulluler'&&<VolunteersPage uid={uid} me={me}/>}
            {isCoord&&page==='isler'&&<TasksPage uid={uid} me={me}/>}
            {isCoord&&page==='duyurular'&&<AnnouncementsPage uid={uid} me={me}/>}
            {isCoord&&page==='vardiya'&&<ShiftPage uid={uid} me={me}/>}
            {isCoord&&page==='vakif'&&<VakifDurumu me={me} isCoord/>}

            {/* Admin pages */}
            {isAdmin&&page==='genel'&&<AdminOverview uid={uid} me={me} onNav={setPage}/>}
            {isAdmin&&page==='onaylar'&&<ApprovalsPage uid={uid} onCount={setPendingCount} showUsers/>}
            {isAdmin&&page==='gonulluler'&&<VolunteersPage uid={uid} me={me} admin onManage={startManaging} onQuickReport={setQuickReportFor} editMode={editMode}/>}
            {isAdmin&&page==='isler'&&<TasksPage uid={uid} me={me} editMode={editMode}/>}
            {isAdmin&&page==='iletisim'&&<CommPage uid={uid} me={me}/>}
            {isAdmin&&page==='raporlar'&&<ReportsPage uid={uid}/>}
            {isAdmin&&page==='belgeler'&&<BelgelerPage uid={uid} me={me}/>}
            {isAdmin&&page==='yedekleme'&&<SimpleBackup uid={uid}/>}
            {isAdmin&&page==='icerik'&&<ContentManager uid={uid}/>}
          </div>
        </main>
      </div>

      {/* Vol mobile bottom nav */}
      {isVol&&<nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-white border-t border-[#F3F4F6]" style={{height:48}}>
        {volPages.map(p=><button key={p.id} onClick={()=>setPage(p.id)} className={`flex-1 text-[11px] font-medium py-1 ${page===p.id?'text-[#059669] border-t-2 border-[#059669]':'text-[#9CA3AF]'}`}>{p.l}</button>)}
      </nav>}
    </div>
  );
}

/* ═══ DROPDOWNS ═══ */
function NotifPanel({uid,onClose}){const[items,setItems]=useState([]);useEffect(()=>{(async()=>{const{data}=await db.getNotifications(uid,15);setItems(data||[]);await db.markAllRead(uid);})();},[uid]);return(<div className="fixed top-14 right-4 z-[55] dropdown-panel w-[280px] max-h-[400px] overflow-y-auto"><div className="px-4 py-2 text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">Bildirimler</div>{items.map(n=>(<div key={n.id} className={`dd-item ${!n.is_read?'bg-[#FAFFFE]':''}`}><div><div className="font-medium text-[13px]">{n.title}</div>{n.body&&<div className="text-[11px] text-[#9CA3AF] mt-0.5">{n.body}</div>}<div className="text-[11px] text-[#C4C4C4] mt-1">{timeAgo(n.created_at)}</div></div></div>))}{items.length===0&&<div className="px-4 py-8 text-center text-[13px] text-[#9CA3AF]">Bildirim yok</div>}<div className="dd-sep"/><button onClick={onClose} className="dd-item text-center w-full text-[12px] text-[#9CA3AF]">Kapat</button></div>);}

function ProfilePanel({me,uid,onUpdate,onModal,onClose}){
  const[editing,setEditing]=useState(false);const[f,setF]=useState({display_name:me.display_name,city:me.city||''});const[tgCode,setTgCode]=useState(null);
  const save=async()=>{const{data}=await db.updateProfile(uid,f);if(data)onUpdate(data);setEditing(false);};
  const linkTg=async()=>{const code=String(Math.floor(100000+Math.random()*900000));await db.updateProfile(uid,{telegram_link_code:code});setTgCode(code);};
  return(<div className="fixed top-14 right-4 z-[55] dropdown-panel w-[220px]">
    <div className="px-4 py-3 border-b border-[#F3F4F6]"><div className="text-[13px] font-medium">{me.display_name}</div><div className="text-[11px] text-[#9CA3AF]">{me.email||ROLES[me.role]}</div></div>
    {!editing?(<div>
      <button className="dd-item w-full text-left" onClick={()=>{onModal('summary');onClose();}}>Çalışma özeti</button>
      <button className="dd-item w-full text-left" onClick={()=>setEditing(true)}>Profili düzenle</button>
      {me.telegram_id?<div className="px-4 py-2 text-[12px] text-[#059669]">Telegram bağlı</div>:tgCode?<div className="px-4 py-2 space-y-1"><div className="text-[11px] text-[#9CA3AF]">@tarihvakfi_bot&apos;a gönderin:</div><div className="font-mono font-bold text-center text-lg tracking-widest">{tgCode}</div><button onClick={()=>navigator.clipboard.writeText(`/start ${tgCode}`)} className="text-[11px] text-[#059669]">Kopyala</button></div>:<button className="dd-item w-full text-left" onClick={linkTg}>Telegram bağla</button>}
      <button className="dd-item w-full text-left" onClick={()=>{onModal('help');onClose();}}>Yardım</button>
      <div className="dd-sep"/><button className="dd-item w-full text-left text-[#EF4444]" onClick={db.signOut}>Çıkış</button>
    </div>):(<div className="p-3 space-y-2">
      <input className="inp text-[13px] !py-2" value={f.display_name} onChange={e=>setF({...f,display_name:e.target.value})} placeholder="İsim"/>
      <input className="inp text-[13px] !py-2" value={f.city} onChange={e=>setF({...f,city:e.target.value})} placeholder="Şehir"/>
      <div className="flex gap-2"><button onClick={save} className="flex-1 bg-[#059669] text-white text-[13px] font-medium py-2 rounded-lg">Kaydet</button><button onClick={()=>setEditing(false)} className="text-[12px] text-[#9CA3AF] px-2">İptal</button></div>
    </div>)}
  </div>);
}

function WorkSummary({uid}){const[s,setS]=useState(null);useEffect(()=>{db.getWorkSummary(uid).then(({data})=>setS(data));},[uid]);if(!s)return<div className="skeleton h-20 w-full"/>;return(<div className="space-y-3">{[['Bu Hafta',`${s.week_days} rapor, ${fmtH(Number(s.week_hours))}`],['Bu Ay',`${s.month_days} rapor, ${fmtH(Number(s.month_hours))}`],['Toplam',`${s.total_days} rapor, ${fmtH(Number(s.total_hours))}`]].map(([l,v],i)=>(<div key={i} className="flex justify-between py-2 border-b border-[#F3F4F6] last:border-0"><span className="text-[13px] text-[#6B7280]">{l}</span><span className={`text-[13px] font-medium ${i===2?'text-[#059669]':''}`}>{v}</span></div>))}</div>);}

/* ═══ VOLUNTEER HOME (shared by vol + coord "Çalışmam") ═══ */
function VolHome({uid,me,onModal,isManaging,adminUid}){
  const[showForm,setShowForm]=useState(false);const[editR,setEditR]=useState(null);
  const[reports,setReports]=useState([]);const[tasks,setTasks]=useState([]);
  const[summary,setSummary]=useState(null);const[editingId,setEditingId]=useState(null);const[editForm,setEditForm]=useState({});const[confirmDel,setConfirmDel]=useState(null);
  const toast=useToast();

  const load=useCallback(async()=>{const[r,t,s]=await Promise.all([db.getWeekReports(uid),db.getTasks({assigned_to:uid}),db.getWorkSummary(uid)]);setReports(r.data||[]);setTasks((t.data||[]).filter(t=>['active','pending','review'].includes(t.status)));setSummary(s.data);},[uid]);
  useEffect(()=>{load();},[load]);

  const weekD=summary?Number(summary.week_days):0,weekH=summary?Number(summary.week_hours):0,monthH=summary?Number(summary.month_hours):0;
  const lastPlan=reports.length>0?reports[0].next_plan:null;

  const saveReport=async data=>{
    if(editR){await db.updateWorkReport(editR.id,data);toast.show('Güncellendi');}
    else{
      const reportData={...data,user_id:uid,source:'web'};
      if(isManaging&&adminUid){reportData.entered_by=adminUid;reportData.status='approved';reportData.approved_by=adminUid;}
      await db.createWorkReport(reportData);
      if(isManaging&&adminUid)await db.logAdminAction(adminUid,uid,'create_report',{hours:data.hours,desc:data.description});
      toast.show('Kaydedildi');
    }
    setShowForm(false);setEditR(null);load();
  };
  const deleteReport=async id=>{await db.deleteWorkReport(id);setConfirmDel(null);toast.show('Silindi');load();};
  const startEdit=r=>{setEditingId(r.id);setEditForm({h:String(r.hours),desc:r.description||'',mode:r.work_mode||'onsite'});};
  const saveInline=async id=>{const h=parseFloat(editForm.h);if(!h||h<=0||h>24)return;await db.updateWorkReport(id,{hours:h,description:editForm.desc,work_mode:editForm.mode});setEditingId(null);toast.show('Güncellendi');load();};

  let motiv='Hoş geldin, bugün ne çalışacaksın?';
  if(monthH===0&&weekD===0)motiv='İlk raporunu bekliyoruz!';else if(monthH>=5)motiv='Bu ay harika gidiyorsun!';

  return(<div><toast.Toast/>
    <div className="greeting">Merhaba, {(me.display_name||'').split(' ')[0]}</div>
    <div className="meta mt-1">Bu ay {summary?summary.month_days:0} gün, {fmtH(monthH)} çalıştın</div>
    <div className="text-[13px] text-[#9CA3AF] mt-1">{motiv}</div>
    {lastPlan&&<div className="mt-2 text-[13px] text-[#6B7280] bg-[#F9FAFB] rounded-lg px-3 py-2">Geçen notun: {lastPlan}</div>}

    <div className="grid grid-cols-2 gap-3 my-7">
      <div className="stat-box"><div className="stat-n">{weekD}</div><div className="stat-l">gün</div></div>
      <div className="stat-box"><div className="stat-n">{fmtH(weekH)}</div><div className="stat-l">saat</div></div>
    </div>

    <button onClick={()=>{showForm?setShowForm(false):(setEditR(null),setShowForm(true));}} className="btn">{showForm?'Kapat':'Çalışma raporu'}</button>
    <Slide open={showForm}><div className="py-4"><ReportForm editReport={editR} tasks={tasks} onSave={saveReport} onCancel={()=>{setShowForm(false);setEditR(null);}}/></div></Slide>

    <div className="sec-label">Bu hafta</div>
    {reports.length===0?<div className="text-[13px] text-[#9CA3AF]">Henüz rapor yok.</div>:
    <div>{reports.map(r=><div key={r.id}>
      {editingId===r.id?<div className="py-3 px-3 bg-[#F9FAFB] rounded-lg mb-2 space-y-2">
        <div className="flex gap-2"><input type="number" step="0.5" className="inp !py-1.5 text-[13px] w-20" value={editForm.h} onChange={e=>setEditForm({...editForm,h:e.target.value})}/><input className="inp !py-1.5 text-[13px] flex-1" value={editForm.desc} onChange={e=>setEditForm({...editForm,desc:e.target.value})}/></div>
        <div className="radio-group">{[['onsite','Vakıfta'],['remote','Uzaktan']].map(([v,l])=><span key={v} className="radio-opt" onClick={()=>setEditForm({...editForm,mode:v})}><span className={`radio-dot ${editForm.mode===v?'on':''}`}/>{l}</span>)}</div>
        <div className="flex gap-2 items-center"><button onClick={()=>saveInline(r.id)} className="btn-sm btn-approve">Kaydet</button><button onClick={()=>setEditingId(null)} className="text-[12px] text-[#9CA3AF]">İptal</button><button onClick={()=>setConfirmDel(r.id)} className="btn-danger-text ml-auto text-[12px]">Sil</button></div>
      </div>:
      <div className="report-row" onClick={()=>startEdit(r)}>
        <div className={`sl ${r.status==='approved'?'sl-green':'sl-yellow'}`}/>
        <div className="flex-1 min-w-0"><div className="text-[14px] font-medium">{fd(r.date)} — {fmtH(r.hours)}</div><div className="text-[12px] text-[#9CA3AF]">{r.description||'—'}, {r.work_mode==='remote'?'uzaktan':'vakıfta'}</div></div>
        <div className={`text-[12px] flex-shrink-0 ${r.status==='approved'?'text-[#059669]':'text-[#F59E0B]'}`}>{r.status==='approved'?'onaylı':'bekliyor'}</div>
      </div>}
      {confirmDel===r.id&&<div className="flex items-center gap-3 py-2 px-2 text-[13px]"><span className="text-[#EF4444]">Silinsin mi?</span><button onClick={()=>deleteReport(r.id)} className="font-medium text-[#EF4444]">Evet</button><button onClick={()=>setConfirmDel(null)} className="text-[#9CA3AF]">Hayır</button></div>}
    </div>)}</div>}

    <div className="text-center mt-8 text-[13px] text-[#C4C4C4]">Sorunun mu var? <button onClick={async()=>{const{data:a}=await db.getProfilesByRole('admin');for(const x of(a||[]))await db.sendNotification(x.id,'system',`${me.display_name} yardım istiyor`,'');toast.show('İletildi');}} className="text-[#059669] font-medium">İletişim</button></div>
  </div>);
}

function ReportForm({editReport:e,tasks,onSave,onCancel}){
  const[f,setF]=useState({h:e?String(e.hours):'',desc:e?e.description||'':'',mode:e?e.work_mode||'onsite':'onsite',date:e?e.date:today(),plan:e?e.next_plan||'':'',taskId:e?e.task_id||'':''});
  const[extra,setExtra]=useState(!!e);const[saving,setSaving]=useState(false);
  const submit=async()=>{const h=parseFloat(f.h);if(!h||h<=0||h>24)return;setSaving(true);await onSave({hours:h,description:f.desc.trim(),work_mode:f.mode,date:f.date,next_plan:f.plan.trim()||null,task_id:f.taskId||null});setSaving(false);};
  return(<div>
    <div className="page-title mb-1">{e?'Raporu düzenle':'Çalışma raporu'}</div>
    <div className="meta mb-6">{e?fdf(e.date):'Çalıştığını kaydet'}</div>
    <div className="mb-5"><label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Süre</label><input type="number" step="0.5" min="0.5" max="24" value={f.h} onChange={e=>setF({...f,h:e.target.value})} className="inp inp-big" placeholder="3"/></div>
    <div className="mb-5"><label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Ne yaptın?</label><textarea value={f.desc} onChange={e=>setF({...f,desc:e.target.value})} className="inp inp-area" placeholder="Belgeleri taradım..."/></div>
    <div className="mb-5"><label className="block text-[12px] text-[#6B7280] font-medium mb-2">Konum</label><div className="radio-group">{[['onsite','Vakıfta'],['remote','Uzaktan']].map(([v,l])=><span key={v} className="radio-opt" onClick={()=>setF({...f,mode:v})}><span className={`radio-dot ${f.mode===v?'on':''}`}/>{l}</span>)}</div></div>
    <button onClick={submit} disabled={saving} className="btn mt-4">{saving?'Kaydediliyor...':e?'Güncelle':'Kaydet'}</button>
    {e&&<div className="text-center mt-3"><button onClick={onCancel} className="btn-danger-text">Raporu sil</button><div className="text-[11px] text-[#C4C4C4] mt-1">Onaylanmış rapor düzenlenirse tekrar onay gerekir</div></div>}
    <div className="text-center mt-4"><button onClick={()=>setExtra(!extra)} className="link-muted">{extra?'Gizle':'Tarih · İlgili iş · Plan'}</button></div>
    <Slide open={extra}><div className="pt-4 space-y-4">
      <div><label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Tarih</label><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})} className="inp"/></div>
      <div><label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Plan</label><input value={f.plan} onChange={e=>setF({...f,plan:e.target.value})} className="inp" placeholder="Yarın devam..."/></div>
      {tasks&&tasks.length>0&&<div><label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">İlgili iş</label><select value={f.taskId} onChange={e=>setF({...f,taskId:e.target.value})} className="inp bg-white"><option value="">Bağımsız</option>{tasks.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}</select></div>}
    </div></Slide>
  </div>);
}

/* ═══ MY REPORTS (vol + coord) ═══ */
function MyReports({uid}){
  const[reports,setReports]=useState([]);const[loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{const{data}=await db.getMyReports(uid,50);setReports(data||[]);setLoading(false);})();},[uid]);
  if(loading)return<div className="space-y-3"><div className="skeleton h-4 w-full"/><div className="skeleton h-4 w-3/4"/></div>;
  return(<div>
    <div className="page-title mb-6">Raporlarım</div>
    {reports.length===0?<div className="text-[13px] text-[#9CA3AF]">Henüz rapor yok.</div>:
    reports.map(r=>(
      <div key={r.id} className="report-row">
        <div className={`sl ${r.status==='approved'?'sl-green':'sl-yellow'}`}/>
        <div className="flex-1 min-w-0"><div className="text-[14px] font-medium">{fdf(r.date)} — {fmtH(r.hours)}</div><div className="text-[12px] text-[#9CA3AF]">{r.description||'—'}, {r.work_mode==='remote'?'uzaktan':'vakıfta'}</div></div>
        <div className={`text-[12px] ${r.status==='approved'?'text-[#059669]':'text-[#F59E0B]'}`}>{r.status==='approved'?'onaylı':'bekliyor'}</div>
      </div>
    ))}
  </div>);
}

/* ═══ MY TASKS (vol) ═══ */
function MyTasks({uid,me}){
  const[tasks,setTasks]=useState([]);const[exp,setExp]=useState(null);const[pv,setPv]=useState(0);const[pn,setPn]=useState('');
  const toast=useToast();
  const load=useCallback(async()=>{const{data}=await db.getTasks({assigned_to:uid});setTasks((data||[]).filter(t=>['active','pending','review'].includes(t.status)));},[uid]);
  useEffect(()=>{load();},[load]);
  const update=async tid=>{await db.updateTaskProgress(tid,pv);if(pn)await db.addProgressLog({task_id:tid,user_id:uid,progress:pv,note:pn});if(pv>=100)await db.updateTask(tid,{status:'review'});setExp(null);load();toast.show('Güncellendi');};
  return(<div><toast.Toast/>
    <div className="page-title mb-6">İşlerim</div>
    {tasks.length===0?<div className="text-[13px] text-[#9CA3AF]">Henüz atanmış iş yok.</div>:
    tasks.map(t=>{const dl=t.deadline?Math.round((new Date(t.deadline+'T12:00:00')-new Date(today()+'T12:00:00'))/864e5):999;return(<div key={t.id}>
      <div onClick={()=>{setExp(exp===t.id?null:t.id);setPv(t.progress||0);setPn('');}} className={`task-card ${dl<=3&&dl>=0?'!bg-red-50/50':''}`}>
        <div className="flex justify-between mb-1"><span className="text-[14px] font-medium">{t.title}</span><span className="text-[12px] text-[#9CA3AF]">{Math.round(t.progress||0)}%</span></div>
        {t.deadline&&<div className="text-[12px] text-[#9CA3AF]">Son: {fd(t.deadline)}{dl<0?' (gecikmiş)':dl<=3?` (${dl} gün)`:''}</div>}
        <div className="progress-track mt-2"><div className="progress-fill" style={{width:`${t.progress||0}%`}}/></div>
      </div>
      <Slide open={exp===t.id}><div className="px-4 py-3 space-y-2 border border-[#F3F4F6] rounded-b-lg -mt-2 mb-2">
        <div className="flex items-center gap-3"><input type="range" min="0" max="100" step="5" value={pv} onChange={e=>setPv(Number(e.target.value))} className="flex-1 accent-[#059669]"/><span className="text-[14px] font-semibold w-10 text-right">{pv}%</span></div>
        <input className="inp text-[13px] !py-2" placeholder="Not" value={pn} onChange={e=>setPn(e.target.value)}/>
        <button onClick={()=>update(t.id)} className="bg-[#059669] text-white text-[13px] font-medium py-2 px-4 rounded-lg">Güncelle</button>
      </div></Slide>
    </div>);})}
  </div>);
}

/* ═══ APPROVALS (coord + admin) ═══ */
function ApprovalsPage({uid,onCount,showUsers}){
  const[pending,setPending]=useState([]);const[users,setUsers]=useState([]);
  const toast=useToast();
  const load=useCallback(async()=>{const{data}=await db.getPendingReports();const reps=data||[];setPending(reps);onCount(reps.length);if(showUsers){const{data:p}=await db.getAllProfiles();setUsers((p||[]).filter(u=>u.status==='pending'));}},[onCount,showUsers]);
  useEffect(()=>{load();},[load]);
  const approve=async id=>{await db.approveReport(id,uid);load();toast.show('Onaylandı');};
  const approveAll=async()=>{const ids=pending.filter(r=>r.user_id!==uid).map(r=>r.id);await db.approveAllReports(ids,uid);load();toast.show('Tümü onaylandı');};
  const approveUser=async id=>{await db.setUserStatus(id,'active');await db.sendNotification(id,'welcome','Hesabınız onaylandı!','');load();toast.show('Onaylandı');};
  const rejectUser=async id=>{await db.setUserStatus(id,'rejected');load();};
  return(<div><toast.Toast/>
    <div className="page-title mb-6">Onaylar</div>
    {showUsers&&users.length>0&&(<><div className="sec-label" style={{marginTop:0}}>Yeni kayıtlar</div>{users.map(u=>{const av=avc(u.display_name);return(<div key={u.id} className="appr-card"><div className="av" style={{background:av.bg,color:av.color}}>{(u.display_name||'?')[0]}</div><div className="flex-1"><div className="text-[14px] font-medium">{u.display_name}</div><div className="text-[12px] text-[#9CA3AF]">{u.email}</div></div><div className="appr-actions"><button onClick={()=>approveUser(u.id)} className="btn-sm btn-approve">Onayla</button><button onClick={()=>rejectUser(u.id)} className="btn-sm btn-reject">Reddet</button></div></div>);})}</>)}
    {pending.length>0&&<div className="flex justify-between items-center mb-3"><span className="text-[14px] font-medium">{pending.length} rapor bekliyor</span>{pending.filter(r=>r.user_id!==uid).length>1&&<button onClick={approveAll} className="btn-ghost">Tümünü onayla &rarr;</button>}</div>}
    {pending.map(r=>{const av=avc(r.profiles?.display_name);return(<div key={r.id} className="appr-card"><div className="av" style={{background:av.bg,color:av.color}}>{(r.profiles?.display_name||'?').slice(0,2).toUpperCase()}</div><div className="flex-1 min-w-0"><div className="text-[14px] font-medium">{r.profiles?.display_name}</div><div className="text-[12px] text-[#9CA3AF]">{fmtH(r.hours)} — {r.description?.slice(0,40)} — {r.work_mode==='remote'?'Uzaktan':'Vakıfta'} — {fd(r.date)}</div></div>{r.user_id!==uid?<div className="appr-actions"><button onClick={()=>approve(r.id)} className="btn-sm btn-approve">Onayla</button><button onClick={async()=>{await db.deleteWorkReport(r.id);load();}} className="btn-sm btn-reject">Reddet</button></div>:<span className="text-[11px] text-[#C4C4C4]">Kendi</span>}</div>);})}
    {pending.length===0&&(!showUsers||users.length===0)&&<div className="text-[13px] text-[#9CA3AF] text-center py-6">Tüm onaylar tamam</div>}
  </div>);
}

/* ═══ VOLUNTEERS PAGE ═══ */
function VolunteersPage({uid,me,admin,onManage,onQuickReport,editMode}){
  const[vols,setVols]=useState([]);const[sums,setSums]=useState({});const[search,setSearch]=useState('');const[exp,setExp]=useState(null);const[certVol,setCertVol]=useState(null);
  const[volReports,setVolReports]=useState({});const[msgTo,setMsgTo]=useState(null);const[msgText,setMsgText]=useState('');
  const toast=useToast();
  const load=useCallback(async()=>{const[v,s]=await Promise.all([db.getAllProfiles(),db.getAllWorkSummaries()]);setVols((v.data||[]).filter(u=>u.status!=='pending'));setSums(Object.fromEntries((s.data||[]).map(s=>[s.id,s])));},[]);
  useEffect(()=>{load();},[load]);

  // Load recent reports for expanded volunteer
  const loadVolReports=async(vid)=>{if(volReports[vid])return;const{data}=await db.getUserReports(vid,5);setVolReports(p=>({...p,[vid]:data||[]}));};
  useEffect(()=>{if(exp)loadVolReports(exp);},[exp]);

  const filtered=vols.filter(v=>!search||v.display_name?.toLowerCase().includes(search.toLowerCase()));
  const changeRole=async(id,r)=>{await db.setUserRole(id,r);if(admin)await db.logAdminAction(uid,id,'change_role',{role:r});load();toast.show('Güncellendi');};
  const changeDept=async(id,d)=>{await db.setUserDept(id,d);if(admin)await db.logAdminAction(uid,id,'change_dept',{dept:d});load();toast.show('Güncellendi');};
  const changeStatus=async(id,s)=>{await db.setUserStatus(id,s);if(admin)await db.logAdminAction(uid,id,'change_status',{status:s});load();toast.show('Güncellendi');};
  const sendMsg=async()=>{if(!msgText.trim()||!msgTo)return;await db.sendNotification(msgTo,'system',msgText.trim(),'');if(admin)await db.logAdminAction(uid,msgTo,'send_notification',{msg:msgText.trim()});setMsgTo(null);setMsgText('');toast.show('Gönderildi');};

  return(<div><toast.Toast/>
    <div className="page-title mb-1">Gönüllüler</div>
    <div className="meta mb-4">{vols.filter(v=>v.status==='active').length} aktif, {vols.filter(v=>v.status!=='active').length} pasif</div>
    <input value={search} onChange={e=>setSearch(e.target.value)} className="inp text-[13px] mb-4" placeholder="Ara..."/>
    {filtered.slice(0,30).map(v=>{const s=sums[v.id];const av=avc(v.display_name);const st=v.activity_status||'active';const dotC=v.status!=='active'?'bg-[#D1D5DB]':st==='active'?'bg-[#059669]':st==='slowing'?'bg-[#F59E0B]':'bg-[#EF4444]';const stL=v.status!=='active'?'pasif':st==='active'?'aktif':st==='slowing'?'yavaşlıyor':'inaktif';
      return(<div key={v.id}>
        <div onClick={()=>setExp(exp===v.id?null:v.id)} className="flex items-center gap-3 py-3 border-b border-[#F5F5F5] cursor-pointer hover:bg-[#FAFAFA] rounded-lg px-2 -mx-2 transition-colors">
          <div className="av" style={{background:av.bg,color:av.color}}>{(v.display_name||'?')[0]}</div>
          <div className="flex-1 min-w-0"><div className="text-[14px] font-medium">{v.display_name}</div><div className="text-[12px] text-[#9CA3AF]">{DM[v.department]?.l?.split(' ')[0]||'—'} · {s?fmtH(Number(s.month_hours)):'0s'} bu ay</div></div>
          <span className={`dot ${dotC}`}/>
        </div>
        <Slide open={exp===v.id}><div className="py-4 px-4 bg-[#F9FAFB] rounded-b-lg mb-2 space-y-3">
          {/* Identity */}
          <div className="text-[13px] font-medium text-[#111]">{v.display_name} — {DM[v.department]?.l||'—'} — {ROLES[v.role]||'Gönüllü'}</div>

          {/* Stats */}
          <div className="text-[12px] text-[#6B7280] space-y-0.5">
            <div>Bu ay: {s?`${fmtH(Number(s.month_hours))} / ${s.month_days} gün`:'—'}</div>
            <div>Toplam: {s?`${fmtH(Number(s.total_hours))} / ${s.total_days} gün`:'—'}</div>
            <div>Son aktivite: {v.last_activity_at?fd(v.last_activity_at):'—'}</div>
            <div>Telegram: {v.telegram_id?'Bağlı':'Bağlı değil'}</div>
            <div>Aktivite skoru: {v.activity_score||0} ({stL})</div>
          </div>

          {/* Admin controls */}
          {admin&&v.id!==uid&&(<>
            <div className="flex flex-wrap gap-3 items-center text-[12px]">
              <label className="text-[#9CA3AF]">Rol:</label><select value={v.role} onChange={e=>changeRole(v.id,e.target.value)} className="inp !w-auto !py-1 !px-2 !text-[12px] bg-white"><option value="vol">Gönüllü</option><option value="coord">Koordinatör</option><option value="admin">Yönetici</option></select>
              <label className="text-[#9CA3AF]">Dept:</label><select value={v.department||''} onChange={e=>changeDept(v.id,e.target.value)} className="inp !w-auto !py-1 !px-2 !text-[12px] bg-white"><option value="">—</option>{DEPTS.map(d=><option key={d.id} value={d.id}>{d.l}</option>)}</select>
              <label className="text-[#9CA3AF]">Durum:</label>
              {v.status==='active'?<button onClick={()=>changeStatus(v.id,'blocked')} className="btn-danger-text text-[12px]">Engelle</button>:<button onClick={()=>changeStatus(v.id,'active')} className="btn-ghost text-[12px]">Aktifleştir</button>}
            </div>

            {/* Recent reports */}
            {volReports[v.id]&&volReports[v.id].length>0&&(
              <div><div className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide mb-1">Son raporlar</div>
                {volReports[v.id].map(r=>(
                  <div key={r.id} className="text-[12px] text-[#6B7280] py-1 border-b border-[#F3F4F6] last:border-0">
                    {fd(r.date)} — {fmtH(r.hours)} — {r.description?.slice(0,30)||'—'} <span className={r.status==='approved'?'text-[#059669]':'text-[#F59E0B]'}>({r.status==='approved'?'onaylı':'bekliyor'})</span>
                    {r.entered_by&&<span className="text-[#9CA3AF]"> · yönetici girdi</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 pt-1">
              {v.role!=='admin'&&onManage&&<button onClick={()=>onManage(v)} className="btn-sm btn-approve text-[12px] font-medium">Olarak yönet</button>}
              {onQuickReport&&<button onClick={()=>onQuickReport(v)} className="btn-sm text-[12px]">Rapor gir</button>}
              <button onClick={()=>{setMsgTo(v.id);setMsgText('');}} className="btn-sm text-[12px]">Mesaj gönder</button>
              <button onClick={()=>setCertVol(v)} className="btn-sm text-[12px]">Belge oluştur</button>
            </div>
          </>)}
        </div></Slide>
      </div>);
    })}

    {/* Send message modal */}
    {msgTo&&<Overlay title="Mesaj gönder" onClose={()=>setMsgTo(null)}>
      <div className="space-y-3">
        <div className="text-[13px] text-[#6B7280]">{vols.find(v=>v.id===msgTo)?.display_name} kişisine bildirim gönder</div>
        <input className="inp text-[13px]" placeholder="Mesajınız..." value={msgText} onChange={e=>setMsgText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendMsg()}/>
        <button onClick={sendMsg} className="bg-[#059669] text-white text-[13px] font-medium py-2 px-4 rounded-lg">Gönder</button>
      </div>
    </Overlay>}

    {certVol&&<CertificateModal vol={certVol} summary={sums[certVol.id]} issuerId={uid} onClose={()=>setCertVol(null)}/>}
  </div>);
}

/* ═══ TASKS PAGE ═══ */
function TasksPage({uid,me,editMode}){
  const[tasks,setTasks]=useState([]);const[vols,setVols]=useState([]);const[show,setShow]=useState(false);const[editId,setEditId]=useState(null);const[ef,setEf]=useState({});
  const[tf,setTf]=useState({title:'',description:'',department:me.department||'arsiv',assigned_to:'',deadline:''});
  const toast=useToast();
  const load=useCallback(async()=>{const[t,v]=await Promise.all([db.getTasks(),db.getAllProfiles()]);setTasks(t.data||[]);setVols((v.data||[]).filter(v=>v.status==='active'));},[]);
  useEffect(()=>{load();},[load]);
  const create=async()=>{if(!tf.title)return;await db.createTask({...tf,priority:'medium',assigned_to:tf.assigned_to?[tf.assigned_to]:[],created_by:uid});setShow(false);setTf({title:'',description:'',department:me.department||'arsiv',assigned_to:'',deadline:''});load();toast.show('Oluşturuldu');};
  const complete=async id=>{await db.updateTask(id,{status:'done',completed_at:new Date().toISOString()});load();};
  const startEdit=t=>{setEditId(t.id);setEf({title:t.title,deadline:t.deadline||'',progress:t.progress||0,status:t.status});};
  const saveEdit=async id=>{await db.updateTask(id,{title:ef.title,deadline:ef.deadline||null,status:ef.status});if(ef.progress!==undefined)await db.updateTaskProgress(id,ef.progress);setEditId(null);load();toast.show('Güncellendi');};
  return(<div><toast.Toast/>
    <div className="flex justify-between items-center mb-6"><div className="page-title">İşler</div><button onClick={()=>setShow(!show)} className="btn-ghost">{show?'Kapat':'+ Yeni İş'}</button></div>
    <Slide open={show}><div className="p-4 border border-[#F3F4F6] rounded-lg mb-4 space-y-3">
      <input className="inp text-[13px]" placeholder="Başlık" value={tf.title} onChange={e=>setTf({...tf,title:e.target.value})}/>
      <textarea className="inp inp-area text-[13px]" rows={2} placeholder="Açıklama" value={tf.description} onChange={e=>setTf({...tf,description:e.target.value})}/>
      <div className="grid grid-cols-2 gap-2"><select className="inp text-[13px] bg-white" value={tf.assigned_to} onChange={e=>setTf({...tf,assigned_to:e.target.value})}><option value="">Atanacak</option>{vols.map(v=><option key={v.id} value={v.id}>{v.display_name}</option>)}</select><input type="date" className="inp text-[13px]" value={tf.deadline} onChange={e=>setTf({...tf,deadline:e.target.value})}/></div>
      <button onClick={create} className="bg-[#059669] text-white text-[13px] font-medium py-2 px-4 rounded-lg">Oluştur</button>
    </div></Slide>
    {tasks.filter(t=>t.status!=='cancelled').slice(0,20).map(t=>{const od=t.deadline&&t.deadline<today();return(
      <div key={t.id}>
        {editMode&&editId===t.id?(
          <div className="py-3 px-3 bg-[#F9FAFB] rounded-lg mb-2 space-y-2 border-2 border-blue-200">
            <input className="inp text-[13px] !py-1.5" value={ef.title} onChange={e=>setEf({...ef,title:e.target.value})}/>
            <div className="flex gap-2 items-center">
              <input type="date" className="inp text-[13px] !py-1.5 flex-1" value={ef.deadline} onChange={e=>setEf({...ef,deadline:e.target.value})}/>
              <select className="inp text-[13px] !py-1.5 !w-auto bg-white" value={ef.status} onChange={e=>setEf({...ef,status:e.target.value})}><option value="pending">Bekliyor</option><option value="active">Devam</option><option value="review">Kontrol</option><option value="done">Tamamlandı</option></select>
            </div>
            <div className="flex items-center gap-2"><input type="range" min="0" max="100" step="5" value={ef.progress} onChange={e=>setEf({...ef,progress:Number(e.target.value)})} className="flex-1 accent-[#059669]"/><span className="text-[12px] w-8 text-right">{ef.progress}%</span></div>
            <div className="flex gap-2"><button onClick={()=>saveEdit(t.id)} className="btn-sm btn-approve">Kaydet</button><button onClick={()=>setEditId(null)} className="text-[12px] text-[#9CA3AF]">İptal</button><button onClick={async()=>{await db.updateTask(t.id,{status:'cancelled'});setEditId(null);load();}} className="btn-danger-text text-[12px] ml-auto">Sil</button></div>
          </div>
        ):(
          <div onClick={()=>{if(editMode)startEdit(t);}} className={`flex items-center gap-3 py-3 border-b border-[#F5F5F5] ${t.status==='done'?'opacity-40':''} ${editMode?'cursor-pointer hover:bg-blue-50/30 border-l-2 border-l-blue-200 pl-2':''}`}>
            <div className="flex-1 min-w-0"><span className="text-[14px] font-medium">{t.title}</span>{od&&<span className="text-[12px] text-[#EF4444] ml-2">gecikmiş</span>}</div>
            <div className="w-20 flex items-center gap-1.5"><div className="flex-1 progress-track"><div className="progress-fill" style={{width:`${t.progress||0}%`}}/></div><span className="text-[11px] text-[#9CA3AF]">{Math.round(t.progress||0)}%</span></div>
            {t.deadline&&<span className="text-[11px] text-[#9CA3AF] w-12">{fd(t.deadline)}</span>}
            {!editMode&&t.status==='review'&&<button onClick={()=>complete(t.id)} className="btn-sm btn-approve text-[11px]">Tamamla</button>}
            {!editMode&&!['done','cancelled'].includes(t.status)&&<button onClick={async()=>{await db.updateTask(t.id,{status:'cancelled'});load();}} className="text-[11px] text-[#9CA3AF] hover:text-[#EF4444]">iptal</button>}
          </div>
        )}
      </div>
    );})}
    {tasks.filter(t=>t.status!=='cancelled').length===0&&<div className="text-[13px] text-[#9CA3AF] text-center py-6">Henüz iş yok</div>}
  </div>);
}

/* ═══ ANNOUNCEMENTS ═══ */
function AnnouncementsPage({uid,me}){
  const[show,setShow]=useState(false);const[f,setF]=useState({title:'',body:''});
  const toast=useToast();
  const create=async()=>{if(!f.title||!f.body)return;await db.createAnnouncement({...f,department:null,is_pinned:false,is_public:false,author_id:uid});setShow(false);setF({title:'',body:''});toast.show('Yayınlandı');};
  return(<div><toast.Toast/>
    <div className="flex justify-between items-center mb-6"><div className="page-title">Duyurular</div><button onClick={()=>setShow(!show)} className="btn-ghost">{show?'Kapat':'+ Yeni'}</button></div>
    <Slide open={show}><div className="p-4 border border-[#F3F4F6] rounded-lg mb-4 space-y-3">
      <input className="inp text-[13px]" placeholder="Başlık" value={f.title} onChange={e=>setF({...f,title:e.target.value})}/>
      <textarea className="inp inp-area text-[13px]" rows={2} placeholder="İçerik" value={f.body} onChange={e=>setF({...f,body:e.target.value})}/>
      <button onClick={create} className="bg-[#059669] text-white text-[13px] font-medium py-2 px-4 rounded-lg">Yayınla</button>
    </div></Slide>
  </div>);
}

/* ═══ SHIFT PAGE ═══ */
function ShiftPage({uid,me}){
  const[shifts,setShifts]=useState([]);const[vols,setVols]=useState([]);const[show,setShow]=useState(false);
  const[f,setF]=useState({volunteer_id:'',day_of_week:'Pzt',start_time:'10:00',end_time:'14:00',department:me.department||'arsiv'});
  const load=useCallback(async()=>{const[s,v]=await Promise.all([db.getShifts({}),db.getAllProfiles()]);setShifts(s.data||[]);setVols((v.data||[]).filter(v=>v.status==='active'));},[]);
  useEffect(()=>{load();},[load]);
  const create=async()=>{if(!f.volunteer_id)return;await db.createShift({...f,created_by:uid});setShow(false);load();};
  const del=async id=>{await db.deleteShift(id);load();};
  return(<div>
    <div className="flex justify-between items-center mb-6"><div className="page-title">Vardiya</div><button onClick={()=>setShow(!show)} className="btn-ghost">{show?'Kapat':'+ Ekle'}</button></div>
    <Slide open={show}><div className="p-4 border border-[#F3F4F6] rounded-lg mb-4 space-y-3">
      <select className="inp text-[13px] bg-white" value={f.volunteer_id} onChange={e=>setF({...f,volunteer_id:e.target.value})}><option value="">Gönüllü seç</option>{vols.map(v=><option key={v.id} value={v.id}>{v.display_name}</option>)}</select>
      <div className="grid grid-cols-3 gap-2"><select className="inp text-[13px] bg-white" value={f.day_of_week} onChange={e=>setF({...f,day_of_week:e.target.value})}>{DAYS.map(d=><option key={d}>{d}</option>)}</select><input type="time" className="inp text-[13px]" value={f.start_time} onChange={e=>setF({...f,start_time:e.target.value})}/><input type="time" className="inp text-[13px]" value={f.end_time} onChange={e=>setF({...f,end_time:e.target.value})}/></div>
      <button onClick={create} className="bg-[#059669] text-white text-[13px] font-medium py-2 w-full rounded-lg">Ekle</button>
    </div></Slide>
    {DAYS.filter(d=>shifts.some(s=>s.day_of_week===d)).map(day=>(
      <div key={day} className="mb-3"><div className="text-[12px] font-semibold text-[#9CA3AF] mb-1">{day}</div>
        {shifts.filter(s=>s.day_of_week===day).map(sh=>(
          <div key={sh.id} className="flex items-center justify-between py-2 border-b border-[#F9FAFB] text-[13px]">
            <span>{sh.profiles?.display_name} · {sh.start_time?.slice(0,5)}–{sh.end_time?.slice(0,5)}</span>
            <button onClick={()=>del(sh.id)} className="text-[#C4C4C4] hover:text-[#EF4444] text-[12px]">&times;</button>
          </div>
        ))}
      </div>
    ))}
    {shifts.length===0&&<div className="text-[13px] text-[#9CA3AF] text-center py-6">Vardiya yok</div>}
  </div>);
}

/* ═══ COMMUNICATION (admin) ═══ */
function CommPage({uid,me}){
  const[tab,setTab]=useState('sohbet');
  return(<div>
    <div className="page-title mb-4">İletişim</div>
    <div className="tab-bar mb-4">{[['sohbet','Sohbet'],['duyuru','Duyuru'],['vardiya','Vardiya']].map(([k,l])=><button key={k} onClick={()=>setTab(k)} className={`tab-item ${tab===k?'active':''}`}>{l}</button>)}</div>
    {tab==='sohbet'&&<ChatSection uid={uid} me={me}/>}
    {tab==='duyuru'&&<AnnouncementsPage uid={uid} me={me}/>}
    {tab==='vardiya'&&<ShiftPage uid={uid} me={me}/>}
  </div>);
}

function ChatSection({uid,me}){
  const isCA=me.role==='admin'||me.role==='coord';const[dept,setDept]=useState(me.department||'arsiv');const[msgs,setMsgs]=useState([]);const[text,setText]=useState('');
  const load=useCallback(async()=>{const{data}=await db.getMessages(dept);setMsgs((data||[]).reverse());},[dept]);
  useEffect(()=>{load();},[load]);useEffect(()=>{const sub=db.subscribeMessages(dept,()=>load());return()=>sub.unsubscribe();},[dept,load]);
  const send=async()=>{if(!text.trim())return;await db.sendMessage(uid,dept,text.trim());setText('');load();};
  return(<div className="space-y-3">
    {isCA&&<div className="flex gap-1 flex-wrap">{DEPTS.map(d=><button key={d.id} onClick={()=>setDept(d.id)} className={`text-[11px] px-2 py-1 rounded-md ${dept===d.id?'bg-[#111] text-white':'bg-[#F3F4F6] text-[#9CA3AF]'}`}>{d.l.split(' ')[0]}</button>)}</div>}
    <div className="bg-white rounded-lg p-3 space-y-1.5 max-h-56 overflow-y-auto border border-[#F3F4F6]">
      {msgs.length===0&&<div className="text-center text-[13px] text-[#C4C4C4] py-6">Henüz mesaj yok</div>}
      {msgs.map((m,i)=><div key={m.id||i} className={`flex ${m.user_id===uid?'justify-end':'justify-start'}`}><div className={`max-w-[75%] rounded-lg px-3 py-1.5 text-[14px] ${m.user_id===uid?'bg-[#059669] text-white':'bg-[#F3F4F6]'}`}>{m.user_id!==uid&&<div className="text-[11px] font-semibold text-[#059669] mb-0.5">{m.profiles?.display_name}</div>}{m.content}</div></div>)}
    </div>
    <div className="flex gap-2"><input className="inp flex-1 !py-2 text-[13px]" placeholder="Mesaj..." value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&send()}/><button onClick={send} disabled={!text.trim()} className="bg-[#059669] text-white text-[13px] font-medium px-4 py-2 rounded-lg disabled:opacity-30">Gönder</button></div>
  </div>);
}

/* ═══ ADMIN OVERVIEW ═══ */
function AdminOverview({uid,me,onNav}){
  const[pu,setPu]=useState([]);const[pr,setPr]=useState([]);const[vols,setVols]=useState([]);const[tasks,setTasks]=useState([]);const[sums,setSums]=useState({});const[recent,setRecent]=useState([]);const[lwH,setLwH]=useState(0);
  const[showAnn,setShowAnn]=useState(false);const[annF,setAnnF]=useState({title:'',body:''});
  const toast=useToast();
  const load=useCallback(async()=>{const[p,rp,ws,t,rc,lw]=await Promise.all([db.getAllProfiles(),db.getPendingReports(),db.getAllWorkSummaries(),db.getTasks(),db.getRecentReports(8),db.getLastWeekHours()]);const all=p.data||[];setPu(all.filter(u=>u.status==='pending'));setVols(all.filter(u=>u.status!=='pending'));setPr(rp.data||[]);setTasks(t.data||[]);setSums(Object.fromEntries((ws.data||[]).map(s=>[s.id,s])));setRecent(rc.data||[]);setLwH(lw);},[]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{const sub=db.subscribeReports(()=>load());return()=>sub.unsubscribe();},[load]);
  const approveR=async id=>{await db.approveReport(id,uid);load();toast.show('Onaylandı');};
  const approveU=async id=>{await db.setUserStatus(id,'active');await db.sendNotification(id,'welcome','Onaylandı!','');load();toast.show('Onaylandı');};
  const createAnn=async()=>{if(!annF.title||!annF.body)return;await db.createAnnouncement({...annF,department:null,is_pinned:false,is_public:false,author_id:uid});setShowAnn(false);setAnnF({title:'',body:''});toast.show('Yayınlandı');};

  const aV=vols.filter(v=>v.status==='active');const aT=tasks.filter(t=>['active','pending','review'].includes(t.status));const dT=tasks.filter(t=>t.status==='done');const oT=aT.filter(t=>t.deadline&&t.deadline<today());
  const attn=vols.filter(v=>v.status==='active'&&v.role==='vol'&&['slowing','inactive','dormant'].includes(v.activity_status));
  const wH=Object.values(sums).reduce((a,s)=>a+Number(s.week_hours||0),0);
  const wC=lwH>0?Math.round((wH-lwH)/lwH*100):0;
  const dH={};aV.forEach(v=>{if(v.department&&sums[v.id]){dH[v.department]=(dH[v.department]||0)+Number(sums[v.id].week_hours||0);}});const mD=Math.max(...Object.values(dH),1);
  const hasPending=pu.length>0||pr.length>0;

  return(<div><toast.Toast/>
    <div className="text-[12px] text-[#9CA3AF] mb-1">{todayLabel()}</div>
    <div className="page-title text-[24px] mb-6">Genel bakış</div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="stat-box"><div className="stat-n text-[#059669]">{aV.length}</div><div className="stat-l">aktif gönüllü</div></div>
      <div className="stat-box"><div className="stat-n">{fmtH(wH)}</div><div className="stat-l">bu hafta</div></div>
      <div className="stat-box"><div className="stat-n text-[#059669]">{dT.length}</div><div className="stat-l">tamamlanan</div></div>
      <div className="stat-box"><div className={`stat-n ${oT.length>0?'text-[#EF4444]':''}`}>{oT.length}</div><div className="stat-l">gecikmiş</div></div>
    </div>

    <div className="hero-gradient mb-6">
      <div className="text-[12px] opacity-60 uppercase tracking-wide">Bu hafta özeti</div>
      <div className="text-[28px] font-semibold mt-1 tracking-tight">{aV.length} gönüllü, {fmtH(wH)}</div>
      {wC!==0&&<div className="text-[13px] opacity-75 mt-1">Geçen haftaya göre {wC>0?`%${wC} artış ↑`:`%${Math.abs(wC)} düşüş ↓`}</div>}
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <div>
        {Object.entries(dH).filter(([,h])=>h>0).sort((a,b)=>b[1]-a[1]).length>0&&<><div className="sec-label" style={{marginTop:0}}>Departman aktivitesi</div>{Object.entries(dH).filter(([,h])=>h>0).sort((a,b)=>b[1]-a[1]).map(([d,h])=><div key={d} className="bar-row"><span className="bar-label">{DM[d]?.l?.split(' ')[0]||d}</span><div className="bar-track"><div className="bar-fill" style={{width:`${(h/mD)*100}%`,transition:'width .5s'}}/></div><span className="bar-val text-[12px] text-[#9CA3AF]">{fmtH(h)}</span></div>)}</>}
        {hasPending&&<><div className="sec-label">Bekleyen işlemler</div>
          {pu.map(u=><div key={u.id} className="appr-card !p-3"><div className="av av-sm" style={((c)=>({background:c.bg,color:c.color}))(avc(u.display_name))}>{(u.display_name||'?')[0]}</div><div className="flex-1 text-[13px]"><b>{u.display_name}</b> — yeni kayıt</div><button onClick={()=>approveU(u.id)} className="btn-sm btn-approve text-[11px]">Onayla</button></div>)}
          {pr.slice(0,5).map(r=><div key={r.id} className="appr-card !p-3"><div className="av av-sm" style={((c)=>({background:c.bg,color:c.color}))(avc(r.profiles?.display_name))}>{(r.profiles?.display_name||'?')[0]}</div><div className="flex-1 text-[13px]"><b>{r.profiles?.display_name}</b> — {fmtH(r.hours)}</div>{r.user_id!==uid?<button onClick={()=>approveR(r.id)} className="btn-sm btn-approve text-[11px]">Onayla</button>:<span className="text-[11px] text-[#C4C4C4]">Kendi</span>}</div>)}
        </>}
      </div>
      <div>
        {recent.length>0&&<><div className="sec-label" style={{marginTop:0}}>Son gelişmeler</div>{recent.slice(0,6).map((r,i)=><div key={r.id||i} className="tl-item"><div className={`tl-dot ${r.status==='approved'?'tl-dot-green':''}`}/><div><div className="text-[13px] text-[#6B7280]"><b className="text-[#111] font-medium">{r.profiles?.display_name}</b> — {fmtH(r.hours)}</div><div className="text-[11px] text-[#C4C4C4] mt-0.5">{timeAgo(r.created_at)}</div></div></div>)}</>}
        {attn.length>0&&<><div className="sec-label">Dikkat gerektiren</div>{attn.sort((a,b)=>(a.activity_score||0)-(b.activity_score||0)).slice(0,5).map(v=>{const days=v.last_activity_at?Math.floor((Date.now()-new Date(v.last_activity_at).getTime())/864e5):999;const dc=v.activity_status==='slowing'?'bg-[#F59E0B]':'bg-[#EF4444]';return<div key={v.id} className="flex items-center gap-2 py-2 text-[13px]"><span className={`dot ${dc}`}/><span>{v.display_name} — {days<999?`${days} gün`:'hiç rapor yok'}</span></div>;})}</>}
      </div>
    </div>

    <div className="flex flex-wrap gap-3 mt-6">
      <button onClick={()=>onNav('gonulluler')} className="qa-item">Gönüllüler &rarr;</button>
      <button onClick={()=>onNav('isler')} className="qa-item">İşler &rarr;</button>
      <button onClick={()=>setShowAnn(!showAnn)} className="qa-item">Duyuru yaz</button>
    </div>
    <Slide open={showAnn}><div className="p-4 border border-[#F3F4F6] rounded-lg mt-4 space-y-3">
      <input className="inp text-[13px]" placeholder="Başlık" value={annF.title} onChange={e=>setAnnF({...annF,title:e.target.value})}/>
      <textarea className="inp inp-area text-[13px]" rows={2} placeholder="İçerik" value={annF.body} onChange={e=>setAnnF({...annF,body:e.target.value})}/>
      <button onClick={createAnn} className="bg-[#059669] text-white text-[13px] font-medium py-2 px-4 rounded-lg">Yayınla</button>
    </div></Slide>
  </div>);
}

/* ═══ REPORTS PAGE (admin) ═══ */
function ReportsPage({uid}){
  const[period,setPeriod]=useState(null);const[data,setData]=useState(null);const[loading,setLoading]=useState(false);
  const[custom,setCustom]=useState(false);const[cs,setCs]=useState('');const[ce,setCe]=useState('');
  const toast=useToast();
  const gen=async p=>{setPeriod(p);setLoading(true);setData(null);const now=new Date();let start=today(),end=today(),label='Bugün';
    if(p==='week'){const m=new Date(now);m.setDate(now.getDate()-((now.getDay()+6)%7));start=m.toISOString().slice(0,10);label='Bu hafta';}
    else if(p==='month'){start=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;label='Bu ay';}
    else if(p==='custom'&&cs&&ce){start=cs;end=ce;label='Özel dönem';}
    const[reps,profs,tsk]=await Promise.all([db.getReportsInRange(start,end),db.getAllProfiles(),db.getTasks()]);
    const R=reps.data||[];const T=tsk.data||[];
    const tH=R.reduce((a,r)=>a+Number(r.hours||0),0);const oH=R.filter(r=>r.work_mode==='onsite').reduce((a,r)=>a+Number(r.hours||0),0);
    const ppl=new Set(R.map(r=>r.user_id)).size;const comp=T.filter(t=>t.status==='done'&&t.completed_at&&t.completed_at>=start).length;
    const dM={};R.forEach(r=>{const d=r.profiles?.department||'diger';dM[d]=(dM[d]||0)+Number(r.hours||0);});const mxD=Math.max(...Object.values(dM),1);
    const pM={};R.forEach(r=>{const n=r.profiles?.display_name||'?';if(!pM[r.user_id])pM[r.user_id]={name:n,hours:0,days:new Set()};pM[r.user_id].hours+=Number(r.hours||0);pM[r.user_id].days.add(r.date);});
    const pL=Object.values(pM).map(p=>({...p,days:p.days.size})).sort((a,b)=>b.hours-a.hours);
    setData({label,dr:`${fdf(start)} — ${fdf(end)}`,tH,oH,rH:tH-oH,ppl,comp,dM,mxD,pL});setLoading(false);
  };
  const copy=()=>{if(!data)return;let t=`${data.label}\n${data.dr}\n\n${data.ppl} gönüllü, ${fmtH(data.tH)}\n`;Object.entries(data.dM).sort((a,b)=>b[1]-a[1]).forEach(([d,h])=>{t+=`${DM[d]?.l||d}: ${fmtH(h)}\n`;});data.pL.forEach(p=>{t+=`${p.name}: ${p.days}g ${fmtH(p.hours)}\n`;});navigator.clipboard.writeText(t);toast.show('Kopyalandı');};
  return(<div><toast.Toast/>
    <div className="page-title mb-1">Raporlar</div><div className="meta mb-6">Dönemi seç, rapor otomatik oluşsun</div>
    <div className="grid grid-cols-3 gap-3 mb-2">{[['today','Bugün'],['week','Bu hafta'],['month','Bu ay']].map(([k,l])=><button key={k} onClick={()=>gen(k)} className={`stat-box cursor-pointer transition-all ${period===k?'outline outline-2 outline-[#059669] -outline-offset-2':''}`}><span className="text-[14px] font-medium">{l}</span></button>)}</div>
    <button onClick={()=>setCustom(!custom)} className="link-muted text-[12px]">{custom?'Kapat':'Özel dönem...'}</button>
    <Slide open={custom}><div className="flex gap-2 mt-3 items-end"><input type="date" className="inp text-[13px] flex-1" value={cs} onChange={e=>setCs(e.target.value)}/><span className="text-[#9CA3AF]">—</span><input type="date" className="inp text-[13px] flex-1" value={ce} onChange={e=>setCe(e.target.value)}/><button onClick={()=>gen('custom')} className="btn-sm btn-approve">Oluştur</button></div></Slide>
    {loading&&<div className="mt-6 space-y-3"><div className="skeleton h-6 w-1/3"/><div className="skeleton h-4 w-full"/></div>}
    {data&&<div className="border border-[#F3F4F6] rounded-xl p-6 mt-6">
      <div className="text-[12px] text-[#9CA3AF]">{data.dr}</div><div className="text-[22px] font-semibold mt-1">{data.label}</div>
      <hr className="border-[#F3F4F6] my-5"/>
      <div className="grid grid-cols-3 gap-4 mb-5"><div><div className="text-[32px] font-semibold">{data.ppl}</div><div className="text-[11px] text-[#9CA3AF]">gönüllü</div></div><div><div className="text-[32px] font-semibold">{fmtH(data.tH)}</div><div className="text-[11px] text-[#9CA3AF]">toplam</div></div><div><div className="text-[32px] font-semibold">{data.comp}</div><div className="text-[11px] text-[#9CA3AF]">tamamlanan</div></div></div>
      {Object.keys(data.dM).length>0&&<><hr className="border-[#F3F4F6] my-5"/><div className="sec-label" style={{marginTop:0}}>Departmanlar</div>{Object.entries(data.dM).sort((a,b)=>b[1]-a[1]).map(([d,h])=><div key={d} className="bar-row"><span className="bar-label">{DM[d]?.l?.split(' ')[0]||d}</span><div className="bar-track"><div className="bar-fill" style={{width:`${(h/data.mxD)*100}%`}}/></div><span className="bar-val text-[12px] text-[#9CA3AF]">{fmtH(h)}</span></div>)}</>}
      {data.pL.length>0&&<><hr className="border-[#F3F4F6] my-5"/><div className="sec-label" style={{marginTop:0}}>Kişiler</div>{data.pL.map((p,i)=><div key={i} className="flex justify-between py-2 text-[13px] border-b border-[#F9FAFB] last:border-0"><span className="font-medium">{p.name}</span><span className="text-[#9CA3AF]">{p.days} gün, {fmtH(p.hours)}</span></div>)}</>}
      <hr className="border-[#F3F4F6] my-5"/><button onClick={copy} className="btn-outline">Kopyala</button>
    </div>}
    <div className="sec-label">Arşiv</div><div className="border border-[#F3F4F6] rounded-xl p-5"><ReportArchive/></div>
  </div>);
}

/* ═══ BELGELER PAGE (admin) ═══ */
function BelgelerPage({uid,me}){
  const[vols,setVols]=useState([]);const[sums,setSums]=useState({});const[sel,setSel]=useState(null);
  useEffect(()=>{(async()=>{const[v,s]=await Promise.all([db.getAllProfiles(),db.getAllWorkSummaries()]);setVols((v.data||[]).filter(u=>u.status==='active'));setSums(Object.fromEntries((s.data||[]).map(s=>[s.id,s])));})();},[]);
  return(<div>
    <div className="page-title mb-6">Belgeler</div>
    <div className="text-[13px] text-[#6B7280] mb-4">Gönüllü seç ve belge oluştur:</div>
    {vols.map(v=><button key={v.id} onClick={()=>setSel(v)} className="block w-full text-left py-2 px-3 text-[13px] hover:bg-[#F9FAFB] rounded-lg transition-colors">{v.display_name} — {sums[v.id]?fmtH(Number(sums[v.id].total_hours)):'0s'}</button>)}
    {sel&&<CertificateModal vol={sel} summary={sums[sel.id]} issuerId={uid} onClose={()=>setSel(null)}/>}
  </div>);
}

/* ═══ HELP ═══ */
function HelpContent({me}){
  const fallbackVol=[{q:'Nasıl rapor girerim?',a:'Çalışma raporu butonuna tıkla, saat yaz, açıklama yaz, konum seç, kaydet.'},{q:'Raporu nasıl düzenlerim?',a:'Rapor satırına tıkla, inline düzenleme açılır.'},{q:'Telegram nasıl bağlanır?',a:'Profil menüsünden Telegram Bağla seç, kodu @tarihvakfi_bot\'a gönder.'}];
  const fallbackCoord=[{q:'Raporları nasıl onaylarım?',a:'Onaylar sayfasından onayla veya reddet.'},{q:'İş nasıl oluştururum?',a:'İşler sayfasında Yeni İş butonuna tıkla.'}];
  const fallbackAdmin=[{q:'Rapor nasıl oluştururum?',a:'Raporlar sayfasından dönem seç, otomatik oluşur.'}];
  const role=me?.role||'vol';
  let items=[...fallbackVol];
  if(role!=='vol')items.push(...fallbackCoord);
  if(role==='admin')items.push(...fallbackAdmin);
  const[open,setOpen]=useState(null);
  return(<div>{items.map((item,i)=><div key={i} onClick={()=>setOpen(open===i?null:i)} className="cursor-pointer py-3 border-b border-[#F3F4F6] last:border-0"><div className="flex justify-between"><span className="text-[14px] font-medium">{item.q}</span><span className="text-[#C4C4C4] text-[12px]">{open===i?'−':'+'}</span></div>{open===i&&<p className="text-[13px] text-[#6B7280] mt-2 leading-relaxed">{item.a}</p>}</div>)}</div>);
}

/* ═══ VAKIF DURUMU (everyone sees) ═══ */
function VakifDurumu({me,isCoord}){
  const[dash,setDash]=useState(null);const[depts,setDepts]=useState([]);const[tasks,setTasks]=useState([]);
  const[deptVols,setDeptVols]=useState([]);
  useEffect(()=>{(async()=>{
    const[d,dp,t]=await Promise.all([db.getPublicDashboard(),db.getPublicDeptWeekly(),db.getPublicTasksOverview()]);
    setDash(d);setDepts(dp.data||[]);setTasks(t.data||[]);
    if(isCoord&&me.department){const{data}=await db.getAllWorkSummaries();setDeptVols(data||[]);}
  })();},[isCoord,me?.department]);
  if(!dash)return<div className="space-y-3"><div className="skeleton h-6 w-1/3"/><div className="skeleton h-4 w-full"/><div className="skeleton h-4 w-2/3"/></div>;
  const maxH=Math.max(...depts.map(d=>Number(d.weekly_hours)),1);
  const doneTasks=tasks.filter(t=>t.status==='done');
  const openTasks=tasks.filter(t=>t.status!=='done');
  return(<div>
    <div className="page-title mb-1">Vakıf durumu</div>
    <div className="meta mb-6">{todayLabel()}</div>

    <div className="grid grid-cols-3 gap-3 mb-8">
      <div className="stat-box"><div className="stat-n text-[#059669]">{dash.active_volunteers}</div><div className="stat-l">aktif gönüllü</div></div>
      <div className="stat-box"><div className="stat-n">{fmtH(Number(dash.weekly_hours))}</div><div className="stat-l">bu hafta</div></div>
      <div className="stat-box"><div className="stat-n">{dash.completed_this_week}</div><div className="stat-l">tamamlanan iş</div></div>
    </div>

    {depts.length>0&&<><div className="sec-label">Departmanlar</div>
      {depts.map(d=><div key={d.department} className="bar-row"><span className="bar-label">{DM[d.department]?.l?.split(' ')[0]||d.department}</span><div className="bar-track"><div className="bar-fill" style={{width:`${(Number(d.weekly_hours)/maxH)*100}%`,transition:'width .5s'}}/></div><span className="bar-val text-[12px] text-[#9CA3AF]">{fmtH(Number(d.weekly_hours))}</span></div>)}
    </>}

    <div className="sec-label">Bu hafta</div>
    <div className="text-[14px] text-[#6B7280] leading-relaxed mb-1">{dash.weekly_volunteers} gönüllü çalıştı</div>
    <div className="text-[14px] text-[#6B7280] leading-relaxed mb-1">{fmtH(Number(dash.weekly_hours))} ({fmtH(Number(dash.weekly_onsite))} vakıfta, {fmtH(Number(dash.weekly_remote))} uzaktan)</div>
    <div className="text-[14px] text-[#6B7280] leading-relaxed">{dash.completed_this_week} iş tamamlandı</div>

    {doneTasks.length>0&&<><div className="sec-label">Son tamamlanan işler</div>
      {doneTasks.slice(0,5).map((t,i)=><div key={i} className="text-[13px] text-[#6B7280] py-1.5 border-b border-[#F5F5F5] last:border-0">{t.title} — tamamlandı</div>)}
    </>}

    {openTasks.length>0&&<><div className="sec-label">Açık işler</div>
      {openTasks.slice(0,8).map((t,i)=><div key={i} className="py-2 border-b border-[#F5F5F5] last:border-0">
        <div className="flex justify-between text-[13px] mb-1"><span className="text-[#374151] font-medium">{t.title}</span><span className="text-[#9CA3AF]">{Math.round(t.progress||0)}%</span></div>
        <div className="progress-track"><div className="progress-fill" style={{width:`${t.progress||0}%`}}/></div>
      </div>)}
    </>}

    {/* Coord extra: department detail with names */}
    {isCoord&&me.department&&deptVols.length>0&&(<>
      <div className="sec-label">Departmanım detay</div>
      <div className="text-[12px] text-[#9CA3AF] mb-2">{DM[me.department]?.l}</div>
      {deptVols.filter(v=>v.department===me.department&&Number(v.total_hours)>0).map(v=>(
        <div key={v.id} className="flex items-center justify-between py-2 border-b border-[#F5F5F5] last:border-0 text-[13px]">
          <span className="font-medium">{v.display_name}</span>
          <span className="text-[#9CA3AF]">{fmtH(Number(v.week_hours))} hafta · {fmtH(Number(v.month_hours))} ay</span>
        </div>
      ))}
    </>)}
  </div>);
}

/* ═══ SIMPLE BACKUP (admin) ═══ */
function SimpleBackup({uid}){
  const[lastBackup,setLastBackup]=useState(null);const[loading,setLoading]=useState(false);
  const toast=useToast();
  useEffect(()=>{(async()=>{const{data}=await db.getBackups();if(data&&data.length>0)setLastBackup(data[0]);})();},[]);

  const handleCsv=async()=>{
    setLoading(true);
    try{
      const{tables}=await db.getAllDataForBackup();
      const JSZip=(await import('jszip')).default;
      const zip=new JSZip();
      for(const[name,rows]of Object.entries(tables)){
        if(!rows||rows.length===0)continue;
        const headers=Object.keys(rows[0]);
        const csv=[headers.join(','),...rows.map(r=>headers.map(h=>`"${String(r[h]||'').replace(/"/g,'""')}"`).join(','))].join('\n');
        zip.file(`${name}.csv`,csv);
      }
      const blob=await zip.generateAsync({type:'blob'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`tarihvakfi-backup-${today()}.zip`;a.click();URL.revokeObjectURL(url);
      await db.createBackupRecord({type:'csv',record_count:Object.values(tables).reduce((a,t)=>a+(t?.length||0),0),created_by:uid});
      toast.show('CSV indirildi');
    }catch(e){toast.show('Hata: '+e.message,false);}
    setLoading(false);
  };

  const sheetsUrl=lastBackup?.sheets_url;

  return(<div><toast.Toast/>
    <div className="page-title mb-1">Yedekleme</div>
    <div className="meta mb-6">Verilerin otomatik ve manuel yedeklenmesi</div>

    <div className="bg-white rounded-[10px] border border-[#F3F4F6] p-5 mb-4">
      <div className="text-[14px] font-medium mb-2">Son yedek</div>
      {lastBackup?(<>
        <div className="text-[13px] text-[#374151]">{fdf(lastBackup.created_at)}</div>
        <div className="text-[12px] text-[#9CA3AF]">{lastBackup.type==='sheets'?'Google Sheets':'CSV'} — {lastBackup.record_count} kayıt — Başarılı</div>
      </>):(<div className="text-[13px] text-[#9CA3AF]">Henüz yedek alınmamış</div>)}
    </div>

    <div className="bg-[#F9FAFB] rounded-[10px] p-4 mb-4 text-[13px] text-[#6B7280]">
      <div className="font-medium text-[#374151] mb-1">Otomatik yedekleme</div>
      Her gece 03:00 (TR) — Google Sheets
    </div>

    <div className="flex gap-3 mb-4">
      {sheetsUrl&&<a href={sheetsUrl} target="_blank" rel="noopener noreferrer" className="btn-outline text-[13px]">Sheets&apos;i aç</a>}
    </div>

    <div className="sec-label" style={{marginTop:16}}>Manuel indirme</div>
    <button onClick={handleCsv} disabled={loading} className="btn-outline text-[13px] mt-2">{loading?'Hazırlanıyor...':'Tüm verileri indir (.zip)'}</button>
  </div>);
}

/* ═══ CONTENT MANAGER (admin CMS) ═══ */
function ContentManager({uid}){
  const[cms,setCms]=useState({});const[saving,setSaving]=useState(null);
  const toast=useToast();
  useEffect(()=>{(async()=>{const data=await db.getAllSiteContent();setCms(data||{});})();},[]);

  const save=async(key,content)=>{
    setSaving(key);
    await db.upsertSiteContent(key,content,uid);
    setSaving(null);toast.show('Kaydedildi');
  };

  const updateField=(key,field,value)=>{
    setCms(prev=>({...prev,[key]:{...(prev[key]||{}), [field]:value}}));
  };

  const SECTIONS=[
    {key:'homepage_hero',title:'Anasayfa — Hero',fields:[{f:'title',l:'Başlık',type:'text'},{f:'subtitle',l:'Alt başlık',type:'textarea'}]},
    {key:'homepage_about',title:'Anasayfa — Hakkımızda',fields:[{f:'title',l:'Başlık',type:'text'},{f:'text',l:'Metin',type:'textarea'}]},
    {key:'homepage_steps',title:'Anasayfa — Adımlar',fields:null,custom:'steps'},
    {key:'help_volunteer',title:'Yardım — Gönüllü',fields:null,custom:'faq'},
    {key:'help_coordinator',title:'Yardım — Koordinatör',fields:null,custom:'faq'},
    {key:'help_admin',title:'Yardım — Yönetici',fields:null,custom:'faq'},
  ];

  return(<div><toast.Toast/>
    <div className="page-title mb-1">İçerik Yönetimi</div>
    <div className="meta mb-6">Anasayfa ve yardım içeriklerini düzenleyin. Değişiklikler anında yansır.</div>

    {SECTIONS.map(sec=>(
      <div key={sec.key} className="mb-8">
        <div className="text-[14px] font-medium text-[#374151] mb-3">{sec.title}</div>
        <div className="bg-white rounded-[10px] border border-[#F3F4F6] p-4 space-y-3">
          {sec.fields&&sec.fields.map(fld=>(
            <div key={fld.f}>
              <label className="block text-[12px] text-[#6B7280] font-medium mb-1">{fld.l}</label>
              {fld.type==='text'?
                <input className="inp text-[13px]" value={cms[sec.key]?.[fld.f]||''} onChange={e=>updateField(sec.key,fld.f,e.target.value)} onBlur={()=>save(sec.key,cms[sec.key])}/>:
                <textarea className="inp inp-area text-[13px]" value={cms[sec.key]?.[fld.f]||''} onChange={e=>updateField(sec.key,fld.f,e.target.value)} onBlur={()=>save(sec.key,cms[sec.key])}/>
              }
            </div>
          ))}

          {sec.custom==='steps'&&(<>
            {(cms[sec.key]?.steps||[]).map((step,i)=>(
              <div key={i} className="flex gap-2 items-start">
                <span className="text-[12px] text-[#9CA3AF] mt-3 w-4">{step.n||i+1}.</span>
                <div className="flex-1 space-y-1">
                  <input className="inp text-[13px] !py-1.5" value={step.t||''} onChange={e=>{const s=[...(cms[sec.key]?.steps||[])];s[i]={...s[i],t:e.target.value};updateField(sec.key,'steps',s);}} onBlur={()=>save(sec.key,cms[sec.key])} placeholder="Başlık"/>
                  <input className="inp text-[13px] !py-1.5" value={step.d||''} onChange={e=>{const s=[...(cms[sec.key]?.steps||[])];s[i]={...s[i],d:e.target.value};updateField(sec.key,'steps',s);}} onBlur={()=>save(sec.key,cms[sec.key])} placeholder="Açıklama"/>
                </div>
              </div>
            ))}
          </>)}

          {sec.custom==='faq'&&(<>
            {(cms[sec.key]?.items||[]).map((item,i)=>(
              <div key={i} className="space-y-1 border-b border-[#F3F4F6] pb-3 last:border-0">
                <input className="inp text-[13px] !py-1.5 font-medium" value={item.q||''} onChange={e=>{const items=[...(cms[sec.key]?.items||[])];items[i]={...items[i],q:e.target.value};updateField(sec.key,'items',items);}} onBlur={()=>save(sec.key,cms[sec.key])} placeholder="Soru"/>
                <textarea className="inp text-[13px] !py-1.5" rows={2} value={item.a||''} onChange={e=>{const items=[...(cms[sec.key]?.items||[])];items[i]={...items[i],a:e.target.value};updateField(sec.key,'items',items);}} onBlur={()=>save(sec.key,cms[sec.key])} placeholder="Cevap"/>
                <button onClick={()=>{const items=[...(cms[sec.key]?.items||[])];items.splice(i,1);updateField(sec.key,'items',items);save(sec.key,{...cms[sec.key],items});}} className="btn-danger-text text-[11px]">Kaldır</button>
              </div>
            ))}
            <button onClick={()=>{const items=[...(cms[sec.key]?.items||[]),{q:'',a:''}];updateField(sec.key,'items',items);}} className="btn-ghost text-[12px]">+ Soru ekle</button>
          </>)}

          {saving===sec.key&&<div className="text-[11px] text-[#059669]">Kaydediliyor...</div>}
        </div>
      </div>
    ))}
  </div>);
}

/* ═══ QUICK REPORT MODAL (admin enters report on behalf of a volunteer) ═══ */
function QuickReportModal({vol,adminUid,onClose}){
  const[f,setF]=useState({h:'',desc:'',mode:'onsite',date:today()});
  const[saving,setSaving]=useState(false);
  const toast=useToast();
  const submit=async()=>{
    const h=parseFloat(f.h);if(!h||h<=0||h>24)return;
    setSaving(true);
    await db.createReportForUser({user_id:vol.id,hours:h,description:f.desc.trim(),work_mode:f.mode,date:f.date,source:'web',entered_by:adminUid,status:'approved',approved_by:adminUid});
    await db.logAdminAction(adminUid,vol.id,'create_report',{hours:h,desc:f.desc.trim()});
    setSaving(false);toast.show('Kaydedildi');onClose();
  };
  return(<Overlay title={`${vol.display_name} adına rapor gir`} onClose={onClose}>
    <toast.Toast/>
    <div className="space-y-4">
      <div><label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Süre</label><input type="number" step="0.5" min="0.5" max="24" value={f.h} onChange={e=>setF({...f,h:e.target.value})} className="inp text-center text-[24px] font-semibold" placeholder="3"/></div>
      <div><label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Ne yaptı?</label><textarea value={f.desc} onChange={e=>setF({...f,desc:e.target.value})} className="inp inp-area" placeholder="Açıklama..."/></div>
      <div><label className="block text-[12px] text-[#6B7280] font-medium mb-2">Konum</label><div className="radio-group">{[['onsite','Vakıfta'],['remote','Uzaktan']].map(([v,l])=><span key={v} className="radio-opt" onClick={()=>setF({...f,mode:v})}><span className={`radio-dot ${f.mode===v?'on':''}`}/>{l}</span>)}</div></div>
      <div><label className="block text-[12px] text-[#6B7280] font-medium mb-1.5">Tarih</label><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})} className="inp"/></div>
      <button onClick={submit} disabled={saving} className="btn">{saving?'Kaydediliyor...':'Kaydet'}</button>
      <div className="text-[11px] text-[#C4C4C4] text-center">Bu rapor otomatik onaylı olarak kaydedilir.</div>
    </div>
  </Overlay>);
}

/* ═══ RESTRICTED ═══ */
function RestrictedShell({me,uid}){
  const[sent,setSent]=useState(false);
  const msgs={pending:{bg:'#FEF3C7',icon:'?',t:'Hesabınız onay bekliyor',d:'Yönetici onayladığında bildirim alacaksınız.'},rejected:{bg:'#FEE2E2',icon:'x',t:'Kaydınız reddedildi',d:'Yöneticiyle iletişime geçin.'},blocked:{bg:'#FEE2E2',icon:'x',t:'Hesabınız engellendi',d:'Yönetici tarafından engellenmiştir.'},paused:{bg:'#FEF3C7',icon:'!',t:'Hesap duraklatıldı',d:'Tekrar aktif olmak için talep gönderin.'},inactive:{bg:'#FEE2E2',icon:'!',t:'Hesap pasif',d:'30 gündür raporlama yapılmadığı için pasife alındı.'},resigned:{bg:'#F3F4F6',icon:'—',t:'Ayrıldınız',d:'Verileriniz korunuyor.'}};
  const m=msgs[me.status]||msgs.blocked;
  const canR=['paused','inactive','resigned'].includes(me.status);
  const react=async()=>{const{data:a}=await db.getProfilesByRole('admin');for(const x of(a||[]))await db.sendNotification(x.id,'system',`${me.display_name} tekrar aktif olmak istiyor`,'');setSent(true);};
  return(<div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center p-6"><div className="text-center max-w-sm space-y-5">
    <div className="w-[60px] h-[60px] rounded-full mx-auto flex items-center justify-center text-[24px] font-bold" style={{background:m.bg}}>{m.icon}</div>
    <div className="text-[20px] font-medium">{m.t}</div><div className="text-[14px] text-[#6B7280] leading-relaxed">{m.d}</div>
    {canR&&!sent&&<button onClick={react} className="btn !w-auto !inline-block !px-8">{me.status==='resigned'?'Tekrar Katıl':'Tekrar Aktif Ol'}</button>}
    {sent&&<div className="text-[14px] text-[#059669]">Talebiniz iletildi.</div>}
    <div><button onClick={db.signOut} className="btn-outline">Çıkış</button></div>
  </div></div>);
}
