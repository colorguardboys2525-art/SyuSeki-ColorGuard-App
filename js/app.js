// アプリ起動・画面切替・データ購読
import { ui } from './ui.js';
import { mountLogin } from './pages/login.js';
import { mountTable } from './pages/table.js';
import { mountCopy } from './pages/copy.js';
import { mountMemo } from './pages/memo.js';
import { mountFilters } from './pages/filters.js';

const ROUTES = {
  '/login': mountLogin,
  '/table': mountTable,
  '/copy': mountCopy,
  '/memo': mountMemo,
  '/filters': mountFilters,
};
const ADMIN_ONLY = new Set(['/copy', '/memo', '/filters']);

const store = { role: null, email: '', meta: null, rows: [], filters: [], memos: [], ready: false };
let backend, unsubData = null, page = null, currentRoute = '';

async function pickBackend() {
  let cfg = null;
  try { cfg = (await import('./firebase-config.js')).firebaseConfig; } catch { /* 設定ファイルなし → デモ */ }
  const configured = cfg && cfg.apiKey && !String(cfg.apiKey).startsWith('YOUR_') && !String(cfg.projectId).startsWith('YOUR_');
  if (configured) return (await import('./backend-firebase.js')).createFirebaseBackend(cfg);
  return (await import('./backend-local.js')).createLocalBackend();
}

function route() {
  const hash = location.hash.replace(/^#/, '') || '/';
  let path = ROUTES[hash] ? hash : '/table';
  if (!store.role) path = '/login';
  else if (path === '/login') path = '/table';
  else if (store.role === 'viewer' && ADMIN_ONLY.has(path)) path = '/table';
  if (location.hash.replace(/^#/, '') !== path) { location.hash = path; return; }
  show(path);
}

function show(path) {
  if (path === currentRoute && page) return;
  currentRoute = path;
  const view = document.getElementById('view');
  view.innerHTML = '';
  page = ROUTES[path](view, ctx);
  chrome();
  window.scrollTo(0, 0);
}

function chrome() {
  const loggedIn = !!store.role;
  const admin = store.role === 'admin';
  document.getElementById('topbar').hidden = !loggedIn;
  document.getElementById('adminNav').hidden = !admin;
  document.body.classList.toggle('has-nav', admin);
  document.getElementById('roleChip').textContent = admin ? '管理者' : '閲覧のみ';
  document.getElementById('demoBanner').hidden = !backend.demo;
  document.querySelectorAll('#adminNav a').forEach(a => a.classList.toggle('active', a.dataset.route === currentRoute));
}

function startData() {
  stopData();
  unsubData = backend.data.subscribe(store.role, {
    meta: v => { store.meta = v; refresh(); },
    rows: v => { store.rows = v; store.ready = true; refresh(); },
    filters: v => { store.filters = v; refresh(); },
    memos: v => { store.memos = v; refresh(); },
  });
}
function stopData() {
  if (unsubData) unsubData();
  unsubData = null;
  Object.assign(store, { meta: null, rows: [], filters: [], memos: [], ready: false });
}
let raf = 0;
function refresh() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => page && page.update && page.update());
}

const ctx = { store, ui, get backend() { return backend; }, get data() { return backend.data; } };

async function boot() {
  backend = await pickBackend();
  ctx.MEMO_MAX = backend.MEMO_MAX;

  document.getElementById('logoutBtn').onclick = async () => {
    try { await backend.auth.signOut(); } catch (e) { ui.toast('ログアウトに失敗しました', 'error'); }
  };
  window.addEventListener('hashchange', route);

  backend.auth.onChange(user => {
    const prev = store.role;
    store.role = user ? user.role : null;
    store.email = user?.email || '';
    currentRoute = ''; page = null;
    if (user) { if (prev !== store.role || !unsubData) startData(); }
    else stopData();
    route();
  });
}
boot().catch(err => {
  console.error(err);
  document.getElementById('view').innerHTML = `<p class="error-box">起動に失敗しました：${String(err.message || err)}</p>`;
});
