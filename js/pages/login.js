// ログイン画面：一般（パスワード不要・閲覧のみ）／管理者（Googleログイン）
export function mountLogin(root, ctx) {
  root.innerHTML = `
  <section class="login">
    <header class="brand">
      <div class="logo" aria-hidden="true">
        <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="9" width="34" height="32" rx="8"/><path d="M16 5v8M32 5v8M7 20h34"/><path d="m17 30 5 5 9-10"/></svg>
      </div>
      <h1>出席表</h1>
      <p class="hint">みんなの出席を、かんたん確認！</p>
      <ul class="days" aria-label="3日間の日程"><li>1日目</li><li>2日目</li><li>3日目</li></ul>
    </header>

    <section class="card" aria-labelledby="tUser">
      <div class="card-head">
        <div class="badge" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.4c2 .7 3.5 2.4 3.5 5.6"/></svg></div>
        <div><h2 id="tUser">一般の方</h2><p class="hint">出席表を見るだけ</p></div>
      </div>
      <p class="hint">パスワードはいりません。ボタンを押すと出席表が開きます。</p>
      <button class="btn btn-main" id="btnUser" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.7-7 10-7 10 7 10 7-3.7 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>
        出席表を見る
      </button>
    </section>

    <section class="card" aria-labelledby="tAdmin">
      <div class="card-head">
        <div class="badge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3 20 6v5.5c0 4.6-3.2 7.8-8 9.5-4.8-1.7-8-4.9-8-9.5V6l8-3Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/></svg></div>
        <div><h2 id="tAdmin">管理者</h2><p class="hint">取り込み・編集・メニュー</p></div>
      </div>
      <button class="btn btn-google" id="btnAdmin" type="button">
        <svg viewBox="0 0 48 48" aria-hidden="true" style="fill:initial;stroke:none">
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.9 2.4 30.4 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5Z"/>
          <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5Z"/>
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1Z"/>
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48Z"/>
        </svg>
        Googleでログイン
      </button>
      <p class="note">事前に登録されたGoogleアカウントだけがログインできます。</p>
      <p class="error-box" id="loginError" hidden></p>
    </section>
  </section>`;

  const err = root.querySelector('#loginError');
  const showErr = msg => { err.textContent = msg; err.hidden = !msg; };
  const guard = (btn, fn) => btn.addEventListener('click', async () => {
    showErr(''); btn.disabled = true;
    try { await fn(); }
    catch (e) {
      const quiet = ['auth/popup-closed-by-user', 'auth/cancelled-popup-request'];
      if (!quiet.includes(e.code)) showErr(e.message || 'ログインできませんでした。もう一度お試しください。');
    } finally { btn.disabled = false; }
  });
  guard(root.querySelector('#btnUser'), () => ctx.backend.auth.signInViewer());
  guard(root.querySelector('#btnAdmin'), () => ctx.backend.auth.signInAdmin());
  return {};
}
