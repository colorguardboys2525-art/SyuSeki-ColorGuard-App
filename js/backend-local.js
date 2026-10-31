// デモ用バックエンド：データをこのブラウザのlocalStorageに保存します。
// firebase-config.js が未設定のときだけ使われます。本番ではbackend-firebase.jsが使われます。

const KEY = 'attendance-demo-v1';
const USER_KEY = 'attendance-demo-user';
const MEMO_MAX = 10;

const NAMES = ['神戸太郎', '尼崎三郎', '甲南始', '西宮花子', '芦屋次郎', '宝塚美咲', '伊丹健', '川西葵', '三田蓮', '明石陽菜', '姫路大輝', '加古川結衣', '須磨光', '垂水舞'];

function seed() {
  const rows = NAMES.map((name, i) => {
    const s = Array(15).fill('0');
    const set = (k, v) => { s[k] = v ? '1' : '0'; };
    const a = [0, 1, 2].map(d => (i + d) % 5 !== 4);
    if (a[0]) { set(0, 1); set(1, i % 2 === 0); set(2, 1); set(3, i % 3 !== 0); set(4, i % 2 === 1); }
    if (a[1]) { set(5, 1); set(6, i % 2 === 1); set(7, 1); set(8, i % 3 === 1); set(9, 1); set(10, i % 4 === 0); }
    if (a[2]) { set(11, 1); set(12, i % 2 === 0); set(13, 1); set(14, i % 3 === 2); }
    const initial = s.join('');
    return { id: 'r' + String(i + 1).padStart(4, '0'), order: i + 1, name, bento: ['大', '中', '小'][i % 3], reason: i % 5 === 4 ? '部活動のため' : '', initial, current: initial };
  });
  // 変更色付けの見本として、1人だけ編集済みにしておく
  rows[0].current = '0' + rows[0].initial.slice(1, 5) + '0' + rows[0].initial.slice(6);
  return {
    meta: { fileName: '26-1010.11ガード男子出席表.xlsx（デモ）', dates: ['2026-10-10', '2026-10-11', '2026-10-12'], namedDays: 2, rowCount: rows.length, batchId: 'demo' },
    rows,
    filters: [
      { id: 'f1', name: 'ガード男子', members: NAMES.slice(0, 4) },
      { id: 'f2', name: '1班', members: NAMES.slice(4, 8) },
    ],
    memos: [{ id: 'm0', text: '4班　ガード男子\n神戸太郎\n10日欠席\n10日おやつから11日朝食までキャンセル\n理由：本人の都合のため\n\nよろしくお願いいたします。' }],
  };
}

export function createLocalBackend() {
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
  if (!state || !state.rows) state = seed();

  const listeners = new Set();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* 保存不可でも動作継続 */ } };
  const commit = () => { save(); listeners.forEach(f => f()); };
  let authCb = null;

  const readUser = () => { try { return JSON.parse(sessionStorage.getItem(USER_KEY)); } catch { return null; } };
  const setUser = u => { try { u ? sessionStorage.setItem(USER_KEY, JSON.stringify(u)) : sessionStorage.removeItem(USER_KEY); } catch { /* noop */ } authCb && authCb(u); };

  return {
    demo: true,
    auth: {
      onChange(cb) { authCb = cb; queueMicrotask(() => cb(readUser())); return () => { authCb = null; }; },
      async signInViewer() { setUser({ role: 'viewer' }); },
      async signInAdmin() { setUser({ role: 'admin', email: 'demo-admin@example.com' }); },
      async signOut() { setUser(null); },
    },
    data: {
      subscribe(role, h) {
        const push = () => {
          h.meta(state.meta);
          h.rows(state.rows);
          h.filters(state.filters);
          if (role === 'admin') h.memos(state.memos);
        };
        listeners.add(push); push();
        return () => listeners.delete(push);
      },
      async setCurrent(rowId, current) {
        state = { ...state, rows: state.rows.map(r => (r.id === rowId ? { ...r, current } : r)) };
        commit();
      },
      async commitRows(list) {
        const map = new Map(list.map(x => [x.id, x.current]));
        state = { ...state, rows: state.rows.map(r => (map.has(r.id) ? { ...r, current: map.get(r.id) } : r)) };
        commit();
      },
      // 再取込：出席表・編集内容・メモを置き換え、フィルターは残す
      async importBatch(batch) {
        const rows = batch.rows.map(r => ({ ...r, id: 'r' + String(r.order).padStart(4, '0'), current: r.initial }));
        state = {
          ...state,
          meta: { fileName: batch.fileName, dates: batch.dates, namedDays: batch.namedDays, rowCount: rows.length, batchId: String(Date.now()) },
          rows,
          memos: [],
        };
        commit();
      },
      async addFilter(name, members) {
        const id = 'f' + Date.now().toString(36);
        state = { ...state, filters: [...state.filters, { id, name, members }] };
        commit(); return id;
      },
      async setFilterMembers(id, members) {
        state = { ...state, filters: state.filters.map(f => (f.id === id ? { ...f, members } : f)) };
        commit();
      },
      async deleteFilter(id) {
        state = { ...state, filters: state.filters.filter(f => f.id !== id) };
        commit();
      },
      async saveMemo(id, text) {
        const exists = state.memos.some(m => m.id === id);
        state = { ...state, memos: exists ? state.memos.map(m => (m.id === id ? { ...m, text } : m)) : [...state.memos, { id, text }].sort((a, b) => a.id.localeCompare(b.id)) };
        commit();
      },
      async deleteMemo(id) {
        state = { ...state, memos: state.memos.filter(m => m.id !== id) };
        commit();
      },
    },
    MEMO_MAX,
  };
}
