import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const supabase = createClient(url, key);

// ═══════════════════════════════════════════
// AUTH — 5 Giriş Yöntemi
// ═══════════════════════════════════════════

// 1) Google ile giriş (herkes)
export const signInWithGoogle = () =>
  supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}` },
  });

// 2) GitHub ile giriş (teknik kullanıcılar)
export const signInWithGitHub = () =>
  supabase.auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: `${window.location.origin}` },
  });

// 3) E-posta + Şifre (klasik kayıt/giriş)
export const signUpWithEmail = (email, password, displayName) =>
  supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName } },
  });

export const signInWithEmail = (email, password) =>
  supabase.auth.signInWithPassword({ email, password });

// 4) Magic Link (şifresiz, e-postaya link gider)
export const signInWithMagicLink = (email) =>
  supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}` },
  });

// 5) Telefon + SMS kodu
export const signInWithPhone = (phone) =>
  supabase.auth.signInWithOtp({ phone });

export const verifyPhoneOtp = (phone, token) =>
  supabase.auth.verifyOtp({ phone, token, type: 'sms' });

// Şifre sıfırlama
export const resetPassword = (email) =>
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset`,
  });

// Çıkış
export const signOut = () => supabase.auth.signOut();

// ═══════════════════════════════════════════
// PROFİLLER
// ═══════════════════════════════════════════

export const getProfile = (uid) =>
  supabase.from('profiles').select('*').eq('id', uid).single();

export const updateProfile = (uid, data) =>
  supabase.from('profiles').update(data).eq('id', uid).select().single();

export const getAllProfiles = () =>
  supabase.from('profiles').select('*').order('display_name');

export const getProfilesByRole = (role) =>
  supabase.from('profiles').select('*').eq('role', role).eq('status', 'active');

export const getProfilesByDept = (dept) =>
  supabase.from('profiles').select('*').eq('department', dept).eq('status', 'active');

export const setUserRole = (uid, role) =>
  supabase.from('profiles').update({ role }).eq('id', uid);

export const setUserDept = (uid, department) =>
  supabase.from('profiles').update({ department }).eq('id', uid);

export const setUserStatus = (uid, status) =>
  supabase.from('profiles').update({ status }).eq('id', uid);

export const addSecondaryDept = async (uid, dept) => {
  const { data: p } = await supabase.from('profiles').select('secondary_departments').eq('id', uid).single();
  const arr = p?.secondary_departments || [];
  if (!arr.includes(dept)) {
    return supabase.from('profiles').update({ secondary_departments: [...arr, dept] }).eq('id', uid);
  }
};

export const getCoordsByDept = (dept) =>
  supabase.from('profiles').select('*').eq('department', dept).eq('role', 'coord').eq('status', 'active');

// ═══════════════════════════════════════════
// GÖREVLER
// ═══════════════════════════════════════════

export const getTasks = (filters = {}) => {
  let q = supabase.from('tasks').select('*').order('created_at', { ascending: false });
  if (filters.department) q = q.eq('department', filters.department);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.assignedTo) q = q.contains('assigned_to', [filters.assignedTo]);
  return q;
};

export const createTask = (task) =>
  supabase.from('tasks').insert(task).select().single();

export const updateTask = (id, data) =>
  supabase.from('tasks').update(data).eq('id', id).select().single();

export const deleteTask = (id) =>
  supabase.from('tasks').delete().eq('id', id);

// ═══════════════════════════════════════════
// SAAT KAYITLARI
// ═══════════════════════════════════════════

export const getHourLogs = (filters = {}) => {
  let q = supabase.from('hour_logs').select('*, profiles!volunteer_id(display_name, avatar_url, department)')
    .order('date', { ascending: false });
  if (filters.volunteerId) q = q.eq('volunteer_id', filters.volunteerId);
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.department) q = q.eq('department', filters.department);
  return q.limit(filters.limit || 100);
};

export const logHours = (data) =>
  supabase.from('hour_logs').insert(data).select().single();

export const reviewHours = (id, status, reviewerId, note = '') =>
  supabase.from('hour_logs').update({
    status,
    reviewed_by: reviewerId,
    reviewed_at: new Date().toISOString(),
    review_note: note,
  }).eq('id', id).select().single();

export const deleteHourLog = (id) =>
  supabase.from('hour_logs').delete().eq('id', id);

// ═══════════════════════════════════════════
// VARDİYALAR
// ═══════════════════════════════════════════

export const getShifts = (filters = {}) => {
  let q = supabase.from('shifts').select('*, profiles!volunteer_id(display_name, avatar_url)')
    .order('start_time');
  if (filters.volunteerId) q = q.eq('volunteer_id', filters.volunteerId);
  if (filters.day) q = q.eq('day_of_week', filters.day);
  if (filters.department) q = q.eq('department', filters.department);
  return q;
};

export const createShift = (data) =>
  supabase.from('shifts').insert(data).select().single();

export const updateShift = (id, data) =>
  supabase.from('shifts').update(data).eq('id', id);

export const deleteShift = (id) =>
  supabase.from('shifts').delete().eq('id', id);

// ═══════════════════════════════════════════
// DUYURULAR
// ═══════════════════════════════════════════

export const getAnnouncements = () =>
  supabase.from('announcements').select('*, profiles!author_id(display_name)')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

export const createAnnouncement = (data) =>
  supabase.from('announcements').insert(data).select().single();

export const updateAnnouncement = (id, data) =>
  supabase.from('announcements').update(data).eq('id', id);

export const deleteAnnouncement = (id) =>
  supabase.from('announcements').delete().eq('id', id);

// ═══════════════════════════════════════════
// BAŞVURULAR
// ═══════════════════════════════════════════

export const getApplications = (status) => {
  let q = supabase.from('applications').select('*').order('applied_at', { ascending: false });
  if (status) q = q.eq('status', status);
  return q;
};

export const submitApplication = (data) =>
  supabase.from('applications').insert(data).select().single();

export const reviewApplication = (id, status, reviewerId, note = '') =>
  supabase.from('applications').update({
    status,
    reviewed_by: reviewerId,
    review_note: note,
  }).eq('id', id);

// ═══════════════════════════════════════════
// BİLDİRİMLER
// ═══════════════════════════════════════════

export const getNotifications = (uid, limit = 30) =>
  supabase.from('notifications').select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false })
    .limit(limit);

export const getUnreadCount = async (uid) => {
  const { count } = await supabase.from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', uid).eq('is_read', false);
  return count || 0;
};

export const markRead = (id) =>
  supabase.from('notifications').update({ is_read: true }).eq('id', id);

export const markAllRead = (uid) =>
  supabase.from('notifications').update({ is_read: true })
    .eq('user_id', uid).eq('is_read', false);

export const sendNotification = (userId, type, title, body = '') =>
  supabase.from('notifications').insert({ user_id: userId, type, title, body });

// ═══════════════════════════════════════════
// TALEPLER
// ═══════════════════════════════════════════

export const getMyRequests = (uid) =>
  supabase.from('requests').select('*, tasks:target_task_id(title)')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

export const getAllRequests = (filters = {}) => {
  let q = supabase.from('requests').select('*, profiles!user_id(display_name, department, avatar_url), tasks:target_task_id(title)')
    .order('created_at', { ascending: false });
  if (filters.status) q = q.eq('status', filters.status);
  if (filters.type) q = q.eq('type', filters.type);
  return q;
};

export const createRequest = (data) =>
  supabase.from('requests').insert(data).select().single();

export const cancelRequest = (id) =>
  supabase.from('requests').update({ status: 'cancelled' }).eq('id', id);

export const reviewRequest = (id, status, reviewerId, note = '') =>
  supabase.from('requests').update({
    status,
    reviewed_by: reviewerId,
    review_note: note,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id).select('*, profiles!user_id(display_name, department), tasks:target_task_id(title)').single();

export const getPendingRequestCount = async (role, dept) => {
  let q = supabase.from('requests').select('*', { count: 'exact', head: true }).eq('status', 'pending');
  const { count } = await q;
  return count || 0;
};

// ═══════════════════════════════════════════
// İSTATİSTİKLER / RAPORLAR
// ═══════════════════════════════════════════

export const getVolunteerStats = () =>
  supabase.from('volunteer_stats').select('*');

export const getDepartmentStats = () =>
  supabase.from('department_stats').select('*');

export const getMonthlyReport = async (year) => {
  const { data } = await supabase.from('hour_logs')
    .select('date, hours, department, volunteer_id')
    .eq('status', 'approved')
    .gte('date', `${year}-01-01`)
    .lte('date', `${year}-12-31`);
  return data || [];
};

// ═══════════════════════════════════════════
// DEPARTMAN SOHBETİ
// ═══════════════════════════════════════════

export const getMessages = (department, limit = 50) =>
  supabase.from('messages').select('*, profiles!user_id(display_name, avatar_url, role)')
    .eq('department', department)
    .order('created_at', { ascending: false })
    .limit(limit);

export const sendMessage = (userId, department, content) =>
  supabase.from('messages').insert({ user_id: userId, department, content }).select().single();

export const subscribeMessages = (department, callback) =>
  supabase.channel(`messages-${department}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `department=eq.${department}`,
    }, callback)
    .subscribe();

// ═══════════════════════════════════════════
// GÖREV İLERLEME
// ═══════════════════════════════════════════

export const updateTaskProgress = (taskId, progress) =>
  supabase.from('tasks').update({ progress, status: progress >= 100 ? 'review' : 'active' }).eq('id', taskId);

export const addProgressLog = (data) =>
  supabase.from('task_progress_logs').insert(data).select().single();

export const getProgressLogs = (taskId) =>
  supabase.from('task_progress_logs').select('*, profiles!user_id(display_name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

// ═══════════════════════════════════════════
// GÖREV YORUMLARI
// ═══════════════════════════════════════════

export const getTaskComments = (taskId) =>
  supabase.from('task_comments').select('*, profiles!user_id(display_name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

export const addTaskComment = (data) =>
  supabase.from('task_comments').insert(data).select().single();

// ═══════════════════════════════════════════
// VARDİYA NOTLARI
// ═══════════════════════════════════════════

export const getShiftNotes = (department, date) =>
  supabase.from('shift_notes').select('*, profiles!user_id(display_name)')
    .eq('department', department)
    .eq('date', date)
    .order('created_at', { ascending: false });

export const addShiftNote = (data) =>
  supabase.from('shift_notes').insert(data).select().single();

// ═══════════════════════════════════════════
// HAFTALIK DEPARTMAN ÖZETİ
// ═══════════════════════════════════════════

export const getWeeklyDeptSummary = async () => {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekStart = monday.toISOString().slice(0, 10);
  const weekEnd = new Date(monday.getTime() + 6 * 86400000).toISOString().slice(0, 10);

  const [hours, tasks, profiles] = await Promise.all([
    supabase.from('hour_logs').select('department, hours').eq('status', 'approved').gte('date', weekStart).lte('date', weekEnd),
    supabase.from('tasks').select('department, status').eq('status', 'done').gte('completed_at', weekStart + 'T00:00:00'),
    supabase.from('profiles').select('department').eq('status', 'active').not('department', 'is', null),
  ]);

  const summary = {};
  (hours.data || []).forEach(h => {
    if (!summary[h.department]) summary[h.department] = { hours: 0, tasks: 0, vols: new Set() };
    summary[h.department].hours += Number(h.hours);
  });
  (tasks.data || []).forEach(t => {
    if (!summary[t.department]) summary[t.department] = { hours: 0, tasks: 0, vols: new Set() };
    summary[t.department].tasks += 1;
  });
  (profiles.data || []).forEach(p => {
    if (!summary[p.department]) summary[p.department] = { hours: 0, tasks: 0, vols: new Set() };
    summary[p.department].vols.add(p.department);
  });
  // count unique vols per dept from profiles
  const volCounts = {};
  (profiles.data || []).forEach(p => {
    volCounts[p.department] = (volCounts[p.department] || 0) + 1;
  });

  return Object.entries(summary).map(([dept, s]) => ({
    department: dept,
    hours: s.hours,
    tasks: s.tasks,
    vols: volCounts[dept] || 0,
  }));
};

// ═══════════════════════════════════════════
// REALTIME
// ═══════════════════════════════════════════

export const subscribeNotifications = (uid, callback) =>
  supabase.channel(`notifs-${uid}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${uid}`,
    }, callback)
    .subscribe();

export const subscribeAnnouncements = (callback) =>
  supabase.channel('announcements')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'announcements',
    }, callback)
    .subscribe();
