/**
 * Kas Villa — storage, auth, utilities (+ cloud sync via sync.js)
 */
const STORAGE_KEY = 'kas_villa_v6';
const SESSION_KEY = 'kas_villa_session';

const DEFAULT_STATE = {
  config: {
    count: 10,
    prefix: 'M',
    nominal: 20000,
    villaName: 'Kas Villa',
    adminUser: 'admin',
    adminPass: 'admin123',
    adminWa: ''
  },
  members: [],
  transactions: [],
  announcements: [],
  activityLog: [],
  paymentClaims: []
};

function migrateLegacyStorage() {
  const old = localStorage.getItem('villa_pro_v5_plus');
  if (old && !localStorage.getItem(STORAGE_KEY)) {
    try {
      const parsed = JSON.parse(old);
      const merged = { ...structuredClone(DEFAULT_STATE), ...parsed };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (_) {}
  }
}

function mergeStateFromCloud(parsed) {
  return {
    ...structuredClone(DEFAULT_STATE),
    ...parsed,
    config: { ...DEFAULT_STATE.config, ...(parsed.config || {}) }
  };
}

function loadStateLocal() {
  migrateLegacyStorage();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return mergeStateFromCloud(JSON.parse(raw));
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

let state = structuredClone(DEFAULT_STATE);

function saveStateLocalOnly() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function saveState() {
  if (typeof Sync !== 'undefined' && Sync.save) {
    Sync.save(state);
  } else {
    saveStateLocalOnly();
  }
}

function formatRupiah(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function parseDate(d) {
  const dt = new Date(d || Date.now());
  return isNaN(dt.getTime()) ? new Date() : dt;
}

function formatDate(d) {
  return parseDate(d).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateTime(d) {
  return parseDate(d).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function uid(prefix = '') {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 7);
}

function logActivity(action, actor = 'Sistem') {
  state.activityLog.unshift({
    id: uid('log-'),
    action,
    actor,
    date: new Date().toISOString()
  });
  if (state.activityLog.length > 100) state.activityLog = state.activityLog.slice(0, 100);
  saveState();
}

function getSession() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
  } catch {
    return null;
  }
}

function setSession(data) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

function requireAuth(role) {
  const s = getSession();
  if (!s || s.role !== role) {
    window.location.href = '../index.html';
    return null;
  }
  return s;
}

function getMemberStats(member) {
  const payCount = member.weeks.filter(Boolean).length;
  const unpaidCount = state.config.count - payCount;
  const totalUnpaid = unpaidCount * state.config.nominal;
  const totalPaid = payCount * state.config.nominal;
  const pct = state.config.count
    ? Math.round((payCount / state.config.count) * 100)
    : 0;
  return { payCount, unpaidCount, totalUnpaid, totalPaid, pct, isLunas: unpaidCount === 0 };
}

function getTotals() {
  const masuk = state.transactions
    .filter((t) => t.type === 'masuk')
    .reduce((a, b) => a + b.amount, 0);
  const keluar = state.transactions
    .filter((t) => t.type === 'keluar')
    .reduce((a, b) => a + b.amount, 0);
  const target = state.members.length * state.config.count * state.config.nominal;
  const collected = state.members.reduce(
    (sum, m) => sum + m.weeks.filter(Boolean).length * state.config.nominal,
    0
  );
  const penunggak = state.members.filter(
    (m) => m.weeks.filter(Boolean).length < state.config.count
  ).length;
  return { masuk, keluar, saldo: masuk - keluar, target, collected, penunggak };
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function findMemberByPhone(phone) {
  const n = normalizePhone(phone);
  return state.members.find((m) => normalizePhone(m.phone) === n);
}

function findMemberById(id) {
  return state.members.find((m) => m.id === id);
}

function ensureMemberPin(member) {
  if (!member.pin) {
    member.pin = String(1000 + Math.floor(Math.random() * 9000));
    saveState();
  }
  return member.pin;
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'kas-villa-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  if (!parsed.config || !Array.isArray(parsed.members)) throw new Error('Format tidak valid');
  state = mergeStateFromCloud(parsed);
  saveState();
  logActivity('Data dipulihkan dari file cadangan', 'Admin');
}

function logout() {
  clearSession();
  window.location.href = '../index.html';
}

function showAppLoading(show) {
  const el = document.getElementById('app-loading');
  if (el) el.classList.toggle('hidden', !show);
}
