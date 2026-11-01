// フィルター管理：一覧・コピー・メンバー追加削除・フィルター追加削除（削除は確認あり）
import { esc, norm, copyText } from '../util.js';

export function mountFilters(root, ctx) {
  const { store, ui } = ctx;
  const open = new Set();
  let sig = '';

  root.innerHTML = `
  <section class="page">
    <h1 class="page-title">フィルター管理</h1>
    <p class="hint">フィルターは、一部のメンバーだけの名簿です。出席表やコピー画面の絞り込みに使えます。</p>

    <div class="card">
      <h2>新しいフィルター</h2>
      <div class="field"><label for="nfName">フィルター名</label><input class="input" id="nfName" placeholder="例：26年大会メンバー" autocomplete="off"></div>
      <div class="field"><label for="nfMembers">メンバー（貼り付け可・改行で次の人）</label>
        <textarea class="input" id="nfMembers" rows="5" placeholder="神戸太郎&#10;尼崎三郎&#10;甲南始"></textarea></div>
      <button class="btn btn-main" id="nfCreate" type="button">フィルターを作成</button>
    </div>

    <div id="list" class="page"></div>
  </section>`;
  const $ = id => root.querySelector('#' + id);

  const parseNames = text => {
    const seen = new Set(); const out = [];
    text.split(/\r?\n/).map(x => x.trim()).filter(Boolean).forEach(n => { const k = norm(n); if (!seen.has(k)) { seen.add(k); out.push(n); } });
    return out;
  };

  function renderList() {
    sig = JSON.stringify(store.filters);
    const unknown = f => f.members.filter(m => !store.rows.some(r => norm(r.name) === norm(m)));
    $('list').innerHTML = store.filters.length ? store.filters.map(f => `
      <details class="card filter-card" data-id="${esc(f.id)}"${open.has(f.id) ? ' open' : ''}>
        <summary><h3>${esc(f.name)}</h3><span class="count-pill">${f.members.length}人</span></summary>
        ${unknown(f).length ? `<p class="hint">出席表にいない名前：${unknown(f).map(esc).join('、')}</p>` : ''}
        <ul class="member-list">${f.members.map((m, i) => `
          <li><span>${esc(m)}</span><button class="icon-btn danger" data-rm="${i}" type="button" aria-label="${esc(m)}を削除"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></li>`).join('') || '<li><span class="hint">メンバーがいません</span></li>'}</ul>
        <div class="add-row"><input class="input" data-add-input placeholder="追加する氏名" autocomplete="off"><button class="btn btn-sub" data-add type="button" style="width:auto;min-width:88px">追加</button></div>
        <div class="btn-row">
          <button class="btn btn-sub" data-copy type="button">コピー</button>
          <button class="btn btn-ghost" data-del type="button" style="color:var(--danger)">フィルター削除</button>
        </div>
      </details>`).join('') : '<p class="empty">フィルターはまだありません。上のフォームから作成できます。</p>';
  }

  $('nfCreate').onclick = async () => {
    const name = $('nfName').value.trim();
    const members = parseNames($('nfMembers').value);
    if (!name) { ui.toast('フィルター名を入力してください', 'error'); return; }
    if (!members.length) { ui.toast('メンバーを1人以上入力してください', 'error'); return; }
    try {
      const id = await ctx.data.addFilter(name, members);
      open.add(id);
      $('nfName').value = ''; $('nfMembers').value = '';
      ui.toast(`「${name}」を作成しました（${members.length}人）`);
    } catch { ui.toast('作成できませんでした。権限と通信状況を確認してください', 'error'); }
  };

  const listEl = $('list');
  listEl.addEventListener('toggle', e => {
    const d = e.target.closest('details'); if (!d) return;
    d.open ? open.add(d.dataset.id) : open.delete(d.dataset.id);
  }, true);

  listEl.addEventListener('click', async e => {
    const card = e.target.closest('details'); if (!card) return;
    const f = store.filters.find(x => x.id === card.dataset.id); if (!f) return;
    try {
      if (e.target.closest('[data-copy]')) {
        ui.toast((await copyText(f.members.join('\n'))) ? `「${f.name}」をコピーしました` : 'コピーできませんでした');
      } else if (e.target.closest('[data-add]')) {
        const input = card.querySelector('[data-add-input]');
        const name = input.value.trim();
        if (!name) return;
        if (f.members.some(m => norm(m) === norm(name))) { ui.toast('すでに入っています', 'error'); return; }
        await ctx.data.setFilterMembers(f.id, [...f.members, name]);
      } else if (e.target.closest('[data-rm]')) {
        const i = Number(e.target.closest('[data-rm]').dataset.rm);
        const ok = await ui.confirm({ title: 'メンバーを削除しますか？', html: `<p><b>${esc(f.members[i])}</b> を「${esc(f.name)}」から外します。</p>`, okLabel: '削除する', danger: true });
        if (ok) await ctx.data.setFilterMembers(f.id, f.members.filter((_, k) => k !== i));
      } else if (e.target.closest('[data-del]')) {
        const ok = await ui.confirm({ title: 'フィルターを削除しますか？', html: `<p>「<b>${esc(f.name)}</b>」（${f.members.length}人）を削除します。元に戻せません。</p>`, okLabel: '削除する', danger: true });
        if (ok) await ctx.data.deleteFilter(f.id);
      }
    } catch { ui.toast('保存できませんでした。権限と通信状況を確認してください', 'error'); }
  });
  listEl.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('[data-add-input]')) e.target.closest('details').querySelector('[data-add]').click(); });

  renderList();
  return { update() { if (JSON.stringify(store.filters) !== sig) renderList(); } };
}
