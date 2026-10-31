// 共通の定数と関数

// 日程別回答15項目（Excel D〜R列 = idx 0〜14）
export const DAYS = [
  { n: 1, start: 0,  labels: ['出席', '昼食', 'おやつ', '夕食', '宿泊'] },
  { n: 2, start: 5,  labels: ['出席', '朝食', '昼食', 'おやつ', '夕食', '宿泊'] },
  { n: 3, start: 11, labels: ['出欠', '朝食', '昼食', 'おやつ'] },
];
export const COLS = DAYS.flatMap(d => d.labels.map((label, k) => ({ idx: d.start + k, day: d.n, label })));
export const LUNCH_IDX = { 1: 1, 2: 7, 3: 13 };
export const ITEM_KEYS = ['出欠', '朝食', '昼食', 'おやつ', '夕食', '宿泊'];
export const keyOf = label => (label === '出席' ? '出欠' : label);

/** 日程(null=全日)と項目キー(null=すべて)に当てはまるidx一覧 */
export function idxFor(day, key) {
  return COLS.filter(c => (!day || c.day === day) && (!key || keyOf(c.label) === key)).map(c => c.idx);
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** 名前の照合用に正規化（全角半角・空白の違いを無視） */
export const norm = s => String(s ?? '').normalize('NFKC').replace(/[\s　]/g, '');

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 例: 26-1010.11ガード男子出席表.xlsx → 2026/10/10, 11 */
export function parseFileName(name) {
  const m = String(name ?? '').normalize('NFKC').match(/(\d{2})-(\d{2})(\d{2})((?:\.\d{1,2})*)/);
  if (!m) return null;
  const y = 2000 + Number(m[1]);
  const mo = Number(m[2]) - 1;
  const days = [Number(m[3]), ...m[4].split('.').filter(Boolean).map(Number)];
  // 1〜3日目の日付。ファイル名に足りない日は連続した日付で補う
  const dates = [0, 1, 2].map(i => {
    const d = days[i] !== undefined ? days[i] : days[days.length - 1] + (i - days.length + 1);
    return iso(new Date(y, mo, d));
  });
  return { dates, namedDays: Math.min(days.length, 3) };
}

const parts = s => s.split('-').map(Number);
export function dayHead(meta, n) {
  const s = meta?.dates?.[n - 1];
  if (!s) return '';
  const [y, m, d] = parts(s);
  return `${m}/${d}(${WD[new Date(y, m - 1, d).getDay()]})`;
}
export function dateLabel(meta) {
  const list = (meta?.dates || []).slice(0, meta?.namedDays || 0);
  if (!list.length) return '';
  return list.map((s, i) => {
    const [y, m, d] = parts(s);
    const wd = WD[new Date(y, m - 1, d).getDay()];
    return i === 0 ? `${y}年${m}月${d}日(${wd})` : `${d}日(${wd})`;
  }).join('・');
}

/** クリップボードにコピー（失敗時は選択方式にフォールバック） */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* noop */ }
    ta.remove();
    return ok;
  }
}

export const toggleChar = (str, i) => str.slice(0, i) + (str[i] === '1' ? '0' : '1') + str.slice(i + 1);
export const setChar = (str, i, v) => str.slice(0, i) + v + str.slice(i + 1);
export const countChanged = row => { let n = 0; for (let i = 0; i < 15; i++) if (row.current[i] !== row.initial[i]) n++; return n; };
