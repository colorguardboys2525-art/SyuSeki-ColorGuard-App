// 管理者アカウントの登録・削除（あなたのパソコンで実行します。ブラウザ側には含まれません）
//
// 使い方:
//   cd tools && npm install firebase-admin
//   export GOOGLE_APPLICATION_CREDENTIALS=/安全な場所/serviceAccount.json   # 鍵ファイルはこのフォルダの外に置く
//   node add-admin.mjs add    taro@gmail.com
//   node add-admin.mjs remove taro@gmail.com
//   node add-admin.mjs list
//
// Firebaseコンソールで admins コレクションに手作業でドキュメントを作る方法でも同じです（README参照）。
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const [cmd, emailArg] = process.argv.slice(2);
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS に鍵ファイルのパスを設定してください（鍵はリポジトリに入れないこと）。');
  process.exit(1);
}
initializeApp({ credential: applicationDefault() });
const db = getFirestore();
const email = (emailArg || '').trim().toLowerCase();

if (cmd === 'add' && email) {
  await db.doc(`admins/${email}`).set({ addedAt: FieldValue.serverTimestamp() });
  console.log(`登録しました: ${email}`);
} else if (cmd === 'remove' && email) {
  await db.doc(`admins/${email}`).delete();
  console.log(`削除しました: ${email}`);
} else if (cmd === 'list') {
  (await db.collection('admins').get()).forEach(d => console.log(d.id));
} else {
  console.error('使い方: node add-admin.mjs add|remove <メールアドレス> / list');
  process.exit(1);
}
