// 出席表ページ（一般：閲覧のみ / 管理者：Excel取込・セル編集）
import { DAYS, COLS, LUNCH_IDX, esc, norm, dayHead, dateLabel, toggleChar } from '../util.js';
import { parseWorkbook } from '../excel.js';

const ZMIN = 0.3, ZMAX = 2;

export function mountTable(root, ctx) {
  const { store, ui } = ctx;
  const admin = store.role === 'admin';
  const s = { q: '', filterId: '', day: 'all', att: 'all', zoom: 1 };

  root.innerHTML = `
  <section class="page">
    <div class="date-banner" id="banner"></div>
    ${admin ? `
    <button class="btn btn-main" id="importBtn" type="button">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0-4 4m4-4 4 4M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
      Excelを取り込む
    </button>
    <input type="file" id="fileInput" accept=".xlsx,.xlsm,.xls" hidden>` : ''}

    <div class="card">
      <input class="input" id="q" type="search" placeholder="名前で検索（一部だけでOK）" autocomplete="off">
      <div class="row2">
        <select class="input" id="filterSel" aria-label="フィルター"></select>
        <select class="input" id="attSel" aria-label="出欠の絞り込み">
          <option value="all">出欠すべて</option>
          <option value="in">出席者のみ</option>
          <option value="out">欠席者のみ</option>
        </select>
      </div>
      <div class="seg" id="daySeg" role="group" aria-label="表示する日程">
        <button type="button" data-day="1">1日目</button>
        <button type="button" data-day="2">2日目</button>
        <button type="button" data-day="3">3日目</button>
        <button type="button" data-day="all" class="active">全日</button>
      </div>
    </div>

    <div class="zoom-bar">
      <button class="icon-btn" id="zOut" type="button" aria-label="縮小"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button>
      <output id="zVal">100%</output>
      <button class="icon-btn" id="zIn" type="button" aria-label="拡大"><svg viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg></button>
      <span>2本指で拡大・縮小（最小30%）／セルをタップで 1・空白 切替</span>
    </div>
    ${admin ? `<div class="legend"><span><i class="l-on"></i>1（あり）</span><span><i class="l-chg"></i>Excelの初期値から変更</span></div>` : ''}
    <div class="table-viewport" id="vp"><table class="att" id="tbl"></table></div>
    <p class="hint" id="countNote"></p>
    <div class="summary-grid" id="summary"></div>
  </section>`;

  const $ = id => root.querySelector('#' + id);
  const tbl = $('tbl'), vp = $('vp');

  // ----- 絞り込み -----
  function visibleRows() {
    const q = norm(s.q);
    const f = store.filters.find(x => x.id === s.filterId);
    const members = f ? new Set(f.members.map(norm)) : null;
    const days = s.day === 'all' ? COLS : COLS.filter(c => c.day === Number(s.day));
    return store.rows.filter(r => {
      const n = norm(r.name);
      if (q && !n.includes(q)) return false;
      if (members && !members.has(n)) return false;
      if (s.att !== 'all') {
        const any = days.some(c => r.current[c.idx] === '1');
        if (s.att === 'in' && !any) return false;
        if (s.att === 'out' && any) return false;
      }
      return true;
    });
  }

  // ----- 描画 -----
  function renderFilters() {
    const sel = $('filterSel');
    const opts = ['<option value="">フィルターなし</option>']
      .concat(store.filters.map(f => `<option value="${esc(f.id)}">${esc(f.name)}（${f.members.length}人）</option>`));
    sel.innerHTML = opts.join('');
    if (!store.filters.some(f => f.id === s.filterId)) s.filterId = '';
    sel.value = s.filterId;
  }

  function render() {
    const meta = store.meta;
    const label = dateLabel(meta);
    $('banner').innerHTML = meta
      ? `<strong>${esc(label || '日付がファイル名から読み取れませんでした')}</strong><span>${esc(meta.fileName)}</span>`
      : `<strong>出席表はまだありません</strong><span>${admin ? '上の「Excelを取り込む」から読み込んでください。' : '管理者の取り込みをお待ちください。'}</span>`;

    const cols = s.day === 'all' ? COLS : COLS.filter(c => c.day === Number(s.day));
    const rows = visibleRows();
    $('countNote').textContent = store.rows.length ? `表示中 ${rows.length}人 / 全${store.rows.length}人（合計行・弁当集計は表示中の人が対象）` : '';

    if (!store.rows.length) { tbl.innerHTML = ''; $('summary').innerHTML = ''; vp.hidden = true; return; }
    vp.hidden = false;

    const dayList = s.day === 'all' ? DAYS : DAYS.filter(d => d.n === Number(s.day));
    const head1 = `<tr><th class="col-name" rowspan="2">氏名</th><th class="col-bento" rowspan="2">弁当</th>`
      + dayList.map(d => `<th class="day-${d.n}" colspan="${d.labels.length}">${d.n}日目 ${esc(dayHead(meta, d.n))}</th>`).join('')
      + `<th class="col-reason" rowspan="2">理由</th></tr>`;
    const head2 = `<tr>${cols.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>`;

    const body = rows.map(r => `<tr><td class="col-name">${esc(r.name)}</td><td class="col-bento">${esc(r.bento)}</td>`
      + cols.map(c => {
        const on = r.current[c.idx] === '1';
        const chg = r.current[c.idx] !== r.initial[c.idx];
        return `<td class="cell${on ? ' on' : ''}${chg ? ' chg' : ''}${admin ? ' edit' : ''}" data-r="${esc(r.id)}" data-i="${c.idx}"${admin ? ' tabindex="0" role="button"' : ''}>${on ? '1' : ''}</td>`;
      }).join('')
      + `<td class="col-reason">${esc(r.reason)}</td></tr>`).join('');

    const foot = `<tr><td class="col-name">合計</td><td class="col-bento"></td>`
      + cols.map(c => `<td>${rows.filter(r => r.current[c.idx] === '1').length}</td>`).join('')
      + `<td class="col-reason"></td></tr>`;

    tbl.innerHTML = `<thead>${head1}${head2}</thead><tbody>${body}</tbody><tfoot>${foot}</tfoot>`;
    applyZoom();
    renderSummary(rows);
  }

  // 各日の昼食数 × 弁当サイズ
  function renderSummary(rows) {
    $('summary').innerHTML = DAYS.map(d => {
      const idx = LUNCH_IDX[d.n];
      const eaters = rows.filter(r => r.current[idx] === '1');
      const by = new Map();
      eaters.forEach(r => { const k = r.bento || '未記入'; by.set(k, (by.get(k) || 0) + 1); });
      const lines = [...by.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ja'))
        .map(([k, n]) => `<li><span>${esc(k)}</span><b>${n}</b></li>`).join('');
      return `<div class="sum-card"><h3><span>${d.n}日目 昼食 ${esc(dayHead(store.meta, d.n))}</span><b>${eaters.length}</b></h3><ul>${lines || '<li><span>なし</span><b>0</b></li>'}</ul></div>`;
    }).join('');
  }

  // ----- ズーム（ボタン＋2本指ピンチ。最小30%） -----
  function applyZoom() {
    tbl.style.zoom = s.zoom;
    $('zVal').textContent = Math.round(s.zoom * 100) + '%';
  }
  const setZoom = z => { s.zoom = Math.min(ZMAX, Math.max(ZMIN, Math.round(z * 100) / 100)); applyZoom(); };
  $('zIn').onclick = () => setZoom(s.zoom + 0.1);
  $('zOut').onclick = () => setZoom(s.zoom - 0.1);
  let pinch = null;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  vp.addEventListener('touchstart', e => { if (e.touches.length === 2) pinch = { d: dist(e.touches), z: s.zoom }; }, { passive: true });
  vp.addEventListener('touchmove', e => {
    if (pinch && e.touches.length === 2) { e.preventDefault(); setZoom(pinch.z * dist(e.touches) / pinch.d); }
  }, { passive: false });
  vp.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; });

  // ----- 操作 -----
  $('q').addEventListener('input', e => { s.q = e.target.value; render(); });
  $('filterSel').addEventListener('change', e => { s.filterId = e.target.value; render(); });
  $('attSel').addEventListener('change', e => { s.att = e.target.value; render(); });
  $('daySeg').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    s.day = b.dataset.day;
    $('daySeg').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    render();
  });

  if (admin) {
    const flip = async td => {
      const row = store.rows.find(r => r.id === td.dataset.r);
      if (!row) return;
      const next = toggleChar(row.current, Number(td.dataset.i));
      try { await ctx.data.setCurrent(row.id, next); }
      catch { ui.toast('保存できませんでした。通信状況と権限を確認してください', 'error'); }
    };
    tbl.addEventListener('click', e => { const td = e.target.closest('td.cell'); if (td) flip(td); });
    tbl.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('td.cell')) { e.preventDefault(); flip(e.target); }
    });

    const fileInput = $('fileInput');
    $('importBtn').onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      fileInput.value = '';
      if (!file) return;
      let batch;
      try { batch = await parseWorkbook(file); }
      catch (e) { ui.toast(e.message, 'error'); return; }
      const edited = store.rows.filter(r => r.current !== r.initial).length;
      const ok = await ui.confirm({
        title: 'Excelを取り込みます',
        okLabel: '置き換えて取り込む', danger: true,
        html: `
          <p><b>${esc(batch.fileName)}</b><br>${batch.rows.length}人分を読み込みました。</p>
          <div class="warn">取り込むと、次の内容が新しいExcelで置き換わります。<ul>
            <li>出席表（初期データ）</li>
            <li>編集した内容と変更の色付け${edited ? `（現在 ${edited}人分）` : ''}</li>
            <li>変更連絡のメモ（すべて削除）</li></ul></div>
          <div class="keep">フィルターと登録済みメンバーはそのまま残ります。</div>`,
      });
      if (!ok) return;
      ui.toast('取り込み中です…');
      try { await ctx.data.importBatch(batch); ui.toast('取り込みました'); }
      catch (e) { console.error(e); ui.toast('取り込みに失敗しました。権限と通信状況を確認してください', 'error'); }
    };
  }

  renderFilters();
  render();
  let lastFilters = JSON.stringify(store.filters);
  return {
    update() {
      const f = JSON.stringify(store.filters);
      if (f !== lastFilters) { lastFilters = f; renderFilters(); }
      render();
    },
  };
}
