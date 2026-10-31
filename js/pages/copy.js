// メンバーコピーページ：条件はすべてAND
import { DAYS, ITEM_KEYS, idxFor, esc, norm, copyText } from '../util.js';

export function mountCopy(root, ctx) {
  const { store, ui } = ctx;
  const s = { day: '', item: '', state: '1', filterId: '' };

  root.innerHTML = `
  <section class="page">
    <h1 class="page-title">メンバーコピー</h1>
    <p class="hint">条件をすべて満たす人だけを表示します（すべてAND）。</p>
    <div class="card">
      <div class="row2">
        <div class="field"><label for="cDay">日程</label>
          <select class="input" id="cDay"><option value="">指定なし</option>${DAYS.map(d => `<option value="${d.n}">${d.n}日目</option>`).join('')}</select></div>
        <div class="field"><label for="cItem">項目</label>
          <select class="input" id="cItem"><option value="">指定なし</option>${ITEM_KEYS.map(k => `<option>${k}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>状態</label>
        <div class="seg" id="cState"><button type="button" data-v="1" class="active">出席（1）</button><button type="button" data-v="0">欠席（空白）</button></div></div>
      <div class="field"><label for="cFilter">フィルターメンバー</label><select class="input" id="cFilter"></select></div>
    </div>

    <div class="card">
      <div class="result-head"><h2>該当メンバー</h2><span><b id="cCount">0</b>人</span></div>
      <ul class="name-list" id="cList"></ul>
      <button class="btn btn-main" id="cCopy" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>
        名前をコピー（1行1人）
      </button>
    </div>
  </section>`;
  const $ = id => root.querySelector('#' + id);

  function matches() {
    const idx = idxFor(s.day ? Number(s.day) : null, s.item || null);
    if (!idx.length) return []; // 例：1日目の朝食は存在しない
    const f = store.filters.find(x => x.id === s.filterId);
    const members = f ? new Set(f.members.map(norm)) : null;
    return store.rows.filter(r => {
      if (members && !members.has(norm(r.name))) return false;
      return s.state === '1' ? idx.some(i => r.current[i] === '1') : idx.every(i => r.current[i] !== '1');
    });
  }

  function renderFilters() {
    $('cFilter').innerHTML = '<option value="">指定なし</option>' + store.filters.map(f => `<option value="${esc(f.id)}">${esc(f.name)}（${f.members.length}人）</option>`).join('');
    if (!store.filters.some(f => f.id === s.filterId)) s.filterId = '';
    $('cFilter').value = s.filterId;
  }
  function render() {
    const list = matches();
    $('cCount').textContent = list.length;
    $('cList').innerHTML = list.length ? list.map(r => `<li>${esc(r.name)}</li>`).join('') : '<li style="background:none;color:var(--ink-soft)">該当する人はいません</li>';
    $('cCopy').disabled = !list.length;
  }

  $('cDay').onchange = e => { s.day = e.target.value; render(); };
  $('cItem').onchange = e => { s.item = e.target.value; render(); };
  $('cFilter').onchange = e => { s.filterId = e.target.value; render(); };
  $('cState').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    s.state = b.dataset.v;
    $('cState').querySelectorAll('button').forEach(x => x.classList.toggle('active', x === b));
    render();
  };
  $('cCopy').onclick = async () => {
    const text = matches().map(r => r.name).join('\n');
    ui.toast((await copyText(text)) ? `${text.split('\n').length}人分をコピーしました` : 'コピーできませんでした');
  };

  renderFilters(); render();
  return { update() { renderFilters(); render(); } };
}
