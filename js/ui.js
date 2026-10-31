// モーダル（confirm/alertの代わり）とトースト
import { esc } from './util.js';

let toastTimer;
export function toast(message, kind = '') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 2800);
}

/**
 * 確認ダイアログ。OKならtrueを返す。
 * html は呼び出し側で esc() 済みの文字列を渡す。
 */
export function confirmDialog({ title, html = '', okLabel = 'OK', cancelLabel = 'キャンセル', danger = false }) {
  const root = document.getElementById('modalRoot');
  return new Promise(resolve => {
    root.innerHTML = `
      <div class="modal-back" role="presentation">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="mTitle">
          <h2 id="mTitle">${esc(title)}</h2>
          <div class="body">${html}</div>
          <div class="btn-row">
            <button class="btn btn-ghost" data-r="no" type="button">${esc(cancelLabel)}</button>
            <button class="btn ${danger ? 'btn-danger' : 'btn-main'}" data-r="yes" type="button">${esc(okLabel)}</button>
          </div>
        </div>
      </div>`;
    const done = v => { root.innerHTML = ''; document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = e => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', onKey);
    root.querySelector('[data-r="no"]').onclick = () => done(false);
    root.querySelector('[data-r="yes"]').onclick = () => done(true);
    root.querySelector('.modal-back').addEventListener('click', e => { if (e.target.classList.contains('modal-back')) done(false); });
    root.querySelector('[data-r="no"]').focus();
  });
}

export const ui = { toast, confirm: confirmDialog };
