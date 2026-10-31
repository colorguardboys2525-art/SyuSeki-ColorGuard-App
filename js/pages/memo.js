// 変更連絡のメモ＆抽出：メモカード(最大10枚・横スクロール) → 名前抽出 → 1/空白の編集 → 確認して確定
import { DAYS, COLS, esc, norm, dayHead, toggleChar } from '../util.js';

const MEMO_MAX = 10;

export function mountMemo(root, ctx) {
  const { store, ui } = ctx;
  const drafts = {};          // 入力中のテキスト { id: text }
  const timers = {};
  let selected = '';          // 抽出対象のメモID
  let pending = {};           // 未確定の編集 { rowId: currentString }
  let lastBatch = store.meta?.batchId;
  let stripSig = '';

  root.innerHTML = `
  <section class="page">
    <h1 class="page-title">変更連絡のメモ＆抽出</h1>
    <p class="hint">連絡文を貼り付けて「抽出」を押すと、名前が一致した人の行が下に出ます。セルをタップで 1／空白 を切り替え、確認してから確定します。</p>
    <div class="memo-strip" id="strip"></div>
    <div id="result"></div>
    <div class="commit-bar" id="bar" hidden>
      <button class="btn btn-ghost" id="undo" type="button">取り消し</button>
      <button class="btn btn-main" id="commit" type="button">変更を確認して確定</button>
    </div>
  </section>`;
  const $ = id => root.querySelector('#' + id);

  const memoText = m => (drafts[m.id] !== undefined ? drafts[m.id] : m.text);
  const sortedMemos = () => [...store.memos].sort((a, b) => a.id.localeCompare(b.id));
  const view = r => pending[r.id] ?? r.current;

  // ---- メモカード ----
  function renderStrip() {
    const memos = sortedMemos();
    stripSig = memos.map(m => m.id).join(',');
    if (selected && !memos.some(m => m.id === selected)) selected = '';
    $('strip').innerHTML = memos.map((m, n) => `
      <article class="memo-card${m.id === selected ? ' sel' : ''}" data-id="${esc(m.id)}">
        <div class="memo-head"><span>メモ ${n + 1}</span>
          <button class="icon-btn danger" data-del="${esc(m.id)}" type="button" aria-label="メモ${n + 1}を削除"><svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button></div>
        <textarea class="input" data-id="${esc(m.id)}" placeholder="変更連絡をここに貼り付け">${esc(memoText(m))}</textarea>
        <button class="btn btn-sub" data-extract="${esc(m.id)}" type="button">このメモから抽出</button>
      </article>`).join('')
      + (memos.length < MEMO_MAX ? `<button class="memo-add" id="add" type="button">＋ メモを追加<br><small>${memos.length} / ${MEMO_MAX}枚</small></button>` : '');
  }

  function saveNow(id) {
    clearTimeout(timers[id]);
    const text = drafts[id];
    if (text === undefined) return Promise.resolve();
    return ctx.data.saveMemo(id, text).catch(() => ui.toast('メモを保存できませんでした', 'error'));
  }

  $('strip').addEventListener('input', e => {
    const ta = e.target.closest('textarea'); if (!ta) return;
    const id = ta.dataset.id;
    drafts[id] = ta.value;
    clearTimeout(timers[id]);
    timers[id] = setTimeout(() => saveNow(id), 700);
  });
  $('strip').addEventListener('focusout', e => { const ta = e.target.closest('textarea'); if (ta) saveNow(ta.dataset.id); });
  $('strip').addEventListener('click', async e => {
    const add = e.target.closest('#add');
    if (add) {
      const used = new Set(store.memos.map(m => m.id));
      for (let i = 0; i < MEMO_MAX; i++) {
        const id = 'm' + i;
        if (!used.has(id)) { await ctx.data.saveMemo(id, ''); selected = id; break; }
      }
      return;
    }
    const del = e.target.closest('[data-del]');
    if (del) {
      const ok = await ui.confirm({ title: 'このメモを削除しますか？', html: '<p>メモの内容が消えます。元に戻せません。</p>', okLabel: '削除する', danger: true });
      if (ok) { delete drafts[del.dataset.del]; await ctx.data.deleteMemo(del.dataset.del); }
      return;
    }
    const ex = e.target.closest('[data-extract]');
    if (ex) {
      selected = ex.dataset.extract;
      await saveNow(selected);
      $('strip').querySelectorAll('.memo-card').forEach(c => c.classList.toggle('sel', c.dataset.id === selected));
      renderResult();
      $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ---- 抽出 ----
  function extract(text) {
    const t = norm(text);
    if (!t) return [];
    const found = [];
    store.rows.forEach(r => {
      const n = norm(r.name);
      const pos = n ? t.indexOf(n) : -1;
      if (pos >= 0) found.push({ r, pos });
    });
    return found.sort((a, b) => a.pos - b.pos).map(x => x.r);
  }

  function renderResult() {
    const memo = store.memos.find(m => m.id === selected);
    if (!memo) { $('result').innerHTML = '<p class="empty">メモを選んで「このメモから抽出」を押してください。</p>'; renderBar(); return; }
    const list = extract(memoText(memo));
    if (!list.length) { $('result').innerHTML = '<p class="empty">出席表の名前と一致する人が見つかりませんでした。<br>氏名の表記（姓と名）を確認してください。</p>'; renderBar(); return; }
    const head1 = `<tr><th rowspan="2" class="name">氏名</th>${DAYS.map(d => `<th colspan="${d.labels.length}">${d.n}日目 ${esc(dayHead(store.meta, d.n))}</th>`).join('')}</tr>`;
    const head2 = `<tr>${COLS.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>`;
    const body = list.map(r => {
      const cur = view(r);
      return `<tr><td class="name">${esc(r.name)}</td>${COLS.map(c => {
        const on = cur[c.idx] === '1';
        const chg = cur[c.idx] !== r.initial[c.idx];
        const pend = cur[c.idx] !== r.current[c.idx];
        return `<td class="cell${on ? ' on' : ''}${chg ? ' chg' : ''}${pend ? ' pend' : ''}" data-r="${esc(r.id)}" data-i="${c.idx}" tabindex="0" role="button">${on ? '1' : ''}</td>`;
      }).join('')}</tr>`;
    }).join('');
    $('result').innerHTML = `
      <div class="card">
        <div class="result-head"><h2>抽出結果</h2><span><b>${list.length}</b>人</span></div>
        <div class="mini-wrap"><table class="mini"><thead>${head1}${head2}</thead><tbody>${body}</tbody></table></div>
        <p class="hint">黄色＝Excelの初期値から変更　点線＝まだ確定していない変更</p>
      </div>`;
    renderBar();
  }

  function flip(td) {
    const row = store.rows.find(r => r.id === td.dataset.r);
    if (!row) return;
    const next = toggleChar(view(row), Number(td.dataset.i));
    if (next === row.current) delete pending[row.id]; else pending[row.id] = next;
    renderResult();
  }
  $('result').addEventListener('click', e => { const td = e.target.closest('td.cell'); if (td) flip(td); });
  $('result').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('td.cell')) { e.preventDefault(); flip(e.target); }
  });

  // ---- 確認して確定 ----
  function diffs() {
    const out = [];
    Object.entries(pending).forEach(([id, next]) => {
      const r = store.rows.find(x => x.id === id);
      if (!r) return;
      COLS.forEach(c => { if (next[c.idx] !== r.current[c.idx]) out.push({ name: r.name, day: c.day, label: c.label, to: next[c.idx] === '1' }); });
    });
    return out;
  }
  function renderBar() {
    const n = diffs().length;
    $('bar').hidden = !n;
    $('commit').textContent = `${n}件を確認して確定`;
  }
  $('undo').onclick = () => { pending = {}; renderResult(); };
  $('commit').onclick = async () => {
    const list = diffs();
    if (!list.length) return;
    const rowsHtml = list.map(d => `<tr><td>${esc(d.name)}</td><td>${d.day}日目 ${esc(d.label)}</td><td>${d.to ? '空白 → <b>1</b>' : '1 → <b>空白</b>'}</td></tr>`).join('');
    const ok = await ui.confirm({
      title: `${list.length}件の変更を確定しますか？`, okLabel: '確定する',
      html: `<table class="diff-table"><thead><tr><th>氏名</th><th>項目</th><th>変更</th></tr></thead><tbody>${rowsHtml}</tbody></table>`,
    });
    if (!ok) return;
    try {
      await ctx.data.commitRows(Object.entries(pending).map(([id, current]) => ({ id, current })));
      pending = {};
      ui.toast('変更を確定しました');
      renderResult();
    } catch { ui.toast('確定できませんでした。権限と通信状況を確認してください', 'error'); }
  };

  renderStrip();
  renderResult();
  return {
    update() {
      // 再取込があったら未確定の編集は破棄（初期データが入れ替わるため）
      if (store.meta?.batchId !== lastBatch) { lastBatch = store.meta?.batchId; pending = {}; Object.keys(drafts).forEach(k => delete drafts[k]); stripSig = ''; }
      const sig = sortedMemos().map(m => m.id).join(',');
      if (sig !== stripSig) renderStrip();
      renderResult();
    },
  };
}
