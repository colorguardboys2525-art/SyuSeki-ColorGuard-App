// Firebase（Authentication + Firestore）バックエンド
// 秘密鍵・サービスアカウントキーはここに含めません。Web設定(firebase-config.js)は公開前提の値で、
// データの保護は firebase/firestore.rules と Authentication の設定で行います。
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithPopup, GoogleAuthProvider, signOut as fbSignOut,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {
  getFirestore, collection, doc, onSnapshot, getDoc, getDocs, setDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';

const MEMO_MAX = 10;
const CHUNK = 400; // 1バッチの上限(500)に余裕を持たせる

export function createFirebaseBackend(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const metaRef = doc(db, 'attendance', 'current');
  const rowsCol = collection(db, 'attendance', 'current', 'rows');
  const filtersCol = collection(db, 'filters');
  const memosCol = collection(db, 'memos');

  // 管理者かどうか：admins/{メールアドレス} が存在するか（ルール側でも同じ判定をします）
  async function isRegisteredAdmin(email) {
    if (!email) return false;
    try { return (await getDoc(doc(db, 'admins', email.toLowerCase()))).exists(); } catch { return false; }
  }

  const fail = (code, message) => Object.assign(new Error(message), { code });

  return {
    demo: false,
    auth: {
      onChange(cb) {
        return onAuthStateChanged(auth, async u => {
          if (!u) return cb(null);
          if (u.isAnonymous) return cb({ role: 'viewer' });
          if (!(await isRegisteredAdmin(u.email))) { await fbSignOut(auth); return cb(null); }
          cb({ role: 'admin', email: u.email });
        });
      },
      async signInViewer() {
        try { await signInAnonymously(auth); }
        catch (e) {
          if (e.code === 'auth/operation-not-allowed') throw fail('anon-disabled', 'Firebase Authenticationで「匿名」ログインを有効にしてください。');
          throw e;
        }
      },
      async signInAdmin() {
        const res = await signInWithPopup(auth, new GoogleAuthProvider());
        if (!(await isRegisteredAdmin(res.user.email))) {
          await fbSignOut(auth);
          throw fail('not-registered', 'このGoogleアカウントは管理者として登録されていません。');
        }
      },
      async signOut() { await fbSignOut(auth); },
    },
    data: {
      subscribe(role, h) {
        const unsubs = [
          onSnapshot(metaRef, s => h.meta(s.exists() ? s.data() : null)),
          onSnapshot(query(rowsCol, orderBy('order')), s => h.rows(s.docs.map(d => ({ id: d.id, ...d.data() })))),
          onSnapshot(filtersCol, s => h.filters(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdMs || 0) - (b.createdMs || 0)))),
        ];
        if (role === 'admin') {
          unsubs.push(onSnapshot(memosCol, s => h.memos(s.docs.map(d => ({ id: d.id, text: d.data().text || '' })).sort((a, b) => a.id.localeCompare(b.id)))));
        }
        return () => unsubs.forEach(u => u());
      },

      setCurrent: (rowId, current) => updateDoc(doc(rowsCol, rowId), { current }),

      async commitRows(list) {
        for (let i = 0; i < list.length; i += CHUNK) {
          const b = writeBatch(db);
          list.slice(i, i + CHUNK).forEach(x => b.update(doc(rowsCol, x.id), { current: x.current }));
          await b.commit();
        }
      },

      // 再取込：出席表の初期データ・編集データ・メモを新Excelで置き換え。フィルターは触りません。
      async importBatch(batch) {
        const ops = [];
        const newIds = new Set();
        batch.rows.forEach(r => {
          const id = 'r' + String(r.order).padStart(4, '0');
          newIds.add(id);
          ops.push(b => b.set(doc(rowsCol, id), { order: r.order, name: r.name, bento: r.bento, reason: r.reason, initial: r.initial, current: r.initial }));
        });
        (await getDocs(rowsCol)).docs.forEach(d => { if (!newIds.has(d.id)) ops.push(b => b.delete(d.ref)); });
        (await getDocs(memosCol)).docs.forEach(d => ops.push(b => b.delete(d.ref)));
        for (let i = 0; i < ops.length; i += CHUNK) {
          const b = writeBatch(db);
          ops.slice(i, i + CHUNK).forEach(f => f(b));
          await b.commit();
        }
        // 最後にメタ情報を書き込む（画面側はこれで取込完了を判定）
        await setDoc(metaRef, {
          fileName: batch.fileName, dates: batch.dates, namedDays: batch.namedDays, rowCount: batch.rows.length,
          batchId: String(Date.now()), importedAt: serverTimestamp(), importedBy: auth.currentUser?.email || '',
        });
      },

      async addFilter(name, members) {
        const ref = doc(filtersCol);
        await setDoc(ref, { name, members, createdMs: Date.now(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        return ref.id;
      },
      setFilterMembers: (id, members) => updateDoc(doc(filtersCol, id), { members, updatedAt: serverTimestamp() }),
      deleteFilter: id => deleteDoc(doc(filtersCol, id)),

      // メモは m0〜m9 の10枠だけ使います（ルールで最大10枚を保証）
      saveMemo: (id, text) => setDoc(doc(memosCol, id), { text, updatedAt: serverTimestamp() }),
      deleteMemo: id => deleteDoc(doc(memosCol, id)),
    },
    MEMO_MAX,
  };
}
