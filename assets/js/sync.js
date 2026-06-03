/**
 * Sinkronisasi cloud Firebase Firestore — otomatis antar perangkat
 */
const Sync = (function () {
  let db = null;
  let docRef = null;
  let enabled = false;
  let suppressUntil = 0;
  let saveTimer = null;

  function isConfigured() {
    const cfg = window.FIREBASE_CONFIG;
    return (
      cfg &&
      cfg.apiKey &&
      cfg.apiKey !== 'ISI_API_KEY' &&
      cfg.projectId &&
      window.VILLA_SYNC_ID &&
      window.VILLA_SYNC_ID.length > 3
    );
  }

  function setStatus(mode, detail) {
    window.__syncStatus = mode;
    window.__syncDetail = detail || '';
    document.querySelectorAll('[data-sync-status]').forEach((el) => {
      el.dataset.syncStatus = mode;
      const label = el.querySelector('.sync-label');
      if (!label) return;
      const map = {
        synced: 'Sinkron cloud',
        saving: 'Menyimpan…',
        loading: 'Memuat data…',
        local: 'Hanya perangkat ini',
        error: 'Gagal sinkron',
        offline: 'Offline — cache lokal'
      };
      label.textContent = map[mode] || mode;
    });
  }

  function pushToCloud() {
    if (!enabled || !docRef) return Promise.resolve();
    setStatus('saving');
    suppressUntil = Date.now() + 900;
    const payload = { ...state, _syncedAt: firebase.firestore.FieldValue.serverTimestamp() };
    return docRef
      .set(payload)
      .then(() => setStatus('synced'))
      .catch((err) => {
        console.error('Sync save failed', err);
        setStatus('error', err.message);
      });
  }

  function applyRemote(data) {
    const copy = { ...data };
    delete copy._syncedAt;
    state = mergeStateFromCloud(copy);
    saveStateLocalOnly();
    window.dispatchEvent(new CustomEvent('stateupdated'));
  }

  function init() {
    if (!isConfigured()) {
      state = loadStateLocal();
      setStatus('local', 'Aktifkan Firebase — lihat SETUP-FIREBASE.md');
      return Promise.resolve();
    }

    if (typeof firebase === 'undefined') {
      state = loadStateLocal();
      setStatus('error', 'Firebase SDK belum dimuat');
      return Promise.resolve();
    }

    enabled = true;
    setStatus('loading');
    firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.firestore();
    docRef = db.collection('kasVilla').doc(window.VILLA_SYNC_ID);

    return new Promise((resolve) => {
      let resolved = false;

      docRef.onSnapshot(
        (snap) => {
          if (Date.now() < suppressUntil) return;

          if (snap.exists) {
            applyRemote(snap.data());
            if (!resolved) {
              resolved = true;
              resolve();
            }
            setStatus('synced');
            return;
          }

          if (!resolved) {
            const local = loadStateLocal();
            const hasData =
              local.members.length > 0 ||
              local.transactions.length > 0 ||
              local.announcements.length > 0;
            state = hasData ? local : structuredClone(DEFAULT_STATE);
            saveStateLocalOnly();
            if (hasData) pushToCloud();
            resolved = true;
            resolve();
            setStatus(hasData ? 'synced' : 'synced');
          }
        },
        (err) => {
          console.error('Sync listener error', err);
          state = loadStateLocal();
          setStatus('offline', err.message);
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      );
    });
  }

  function save(currentState) {
    state = currentState;
    saveStateLocalOnly();
    if (!enabled) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => pushToCloud(), 350);
  }

  return {
    init,
    save,
    isConfigured,
    isEnabled: () => enabled,
    pushNow: () => (enabled ? pushToCloud() : Promise.resolve())
  };
})();

async function initData() {
  await Sync.init();
  return state;
}

function onStateUpdated(callback) {
  window.addEventListener('stateupdated', callback);
}
