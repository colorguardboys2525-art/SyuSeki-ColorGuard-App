# 出席表アプリ Firebase設定手順

フロントエンドはビルド不要の静的サイトです。Firebase Hosting、GitHub Pagesなど、どこに置いても動きます。

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | 画面の土台 |
| `css/style.css` | デザイン（緑系・大きめボタン） |
| `js/app.js` | 起動・画面切替・データ購読 |
| `js/firebase-config.js` | **自分のFirebaseのWeb設定を入れる場所** |
| `js/backend-firebase.js` | Authentication と Firestore の読み書き |
| `js/backend-local.js` | デモ用（Firebase未設定のときだけ使用。ブラウザ内保存） |
| `js/excel.js` | Excel読み込み（C列・D〜R列・T列・U列、3行目以降） |
| `js/pages/login.js` | ログイン画面 |
| `js/pages/table.js` | 出席表（検索・フィルター・日程切替・ピンチ拡大・編集・Excel取込） |
| `js/pages/copy.js` | メンバーコピー |
| `js/pages/memo.js` | 変更連絡のメモ＆抽出 |
| `js/pages/filters.js` | フィルター管理 |
| `firebase/firestore.rules` | **Firestoreセキュリティルール** |
| `firebase/firestore.indexes.json` | インデックス（現状は空でOK） |
| `firebase.json` | Firebase CLI用設定 |
| `tools/add-admin.mjs` | 管理者の登録スクリプト（任意） |

## 手順

### 1. プロジェクトとWebアプリ
1. [Firebaseコンソール](https://console.firebase.google.com/)でプロジェクトを作成（または既存を選択）。
2. 「プロジェクトの設定」→「マイアプリ」→ Web（`</>`）を追加。
3. 表示された設定値を `js/firebase-config.js` に貼り付けます。これは公開されても問題ないWeb設定です。

### 2. Authentication
「Authentication」→「Sign-in method」で次の2つを**有効**にします。
- **Google**（管理者ログイン用）
- **匿名**（一般利用者の閲覧用。パスワード不要で出席表を読むために使います）

「設定」→「承認済みドメイン」に、公開するドメイン（例：`xxxx.web.app` や `ユーザー名.github.io`）を追加してください。

### 3. Firestore
「Firestore Database」→「データベースを作成」→ 本番モード（ロケーションは `asia-northeast1` など）。

### 4. ルールを公開
```bash
npm install -g firebase-tools
firebase login
firebase use --add          # 自分のプロジェクトを選択
firebase deploy --only firestore:rules
```
コンソールの「Firestore → ルール」に `firebase/firestore.rules` の中身を貼り付けて公開する方法でも同じです。

### 5. 管理者アカウントの事前登録（登録していないGoogleアカウントは使えません）
**方法A（コンソール・かんたん）**
Firestoreで `admins` コレクションを作り、**ドキュメントID＝管理者のGmailアドレス（小文字）** で作成します。フィールドは何でも構いません（例：`note` = `代表`）。

**方法B（スクリプト）**
`tools/add-admin.mjs` の先頭のコメント参照。サービスアカウントキーは自分のパソコンの安全な場所に置き、環境変数でパスを渡します。**キーをこのフォルダ・HTML・JavaScript・GitHubへ入れないでください。** （`.gitignore` で鍵ファイルを除外しています）

登録を外すときは、そのドキュメントを削除します。

### 6. 公開
```bash
firebase deploy --only hosting
```
Hostingを使う場合は、`firebase init hosting` を行わず、このフォルダの `firebase.json` をそのまま使えます。

## データの持ち方（Firestore）

| パス | 内容 | 読み取り | 書き込み |
|---|---|---|---|
| `admins/{メール}` | 管理者名簿 | 本人のみ | コンソール／スクリプトのみ |
| `attendance/current` | 取込情報（ファイル名・日付・取込日時） | ログイン済み | 管理者 |
| `attendance/current/rows/{r0001…}` | 1人1ドキュメント。`name` `bento` `reason` `initial`（15文字の0/1）`current`（編集後） | ログイン済み | 管理者 |
| `filters/{自動ID}` | `name` `members[]` | ログイン済み | 管理者 |
| `memos/{m0〜m9}` | `text`（最大10枚） | 管理者のみ | 管理者のみ |

「ログイン済み」には匿名ログインの一般利用者を含みます。Firebaseの仕様上、**一般利用者の閲覧は匿名ログインで実現**しており、アプリのURLを知っている人は出席表を読めます。氏名などの個人情報を含む場合は、URLの扱いにご注意ください。

## Excel再取込のルール（実装済み）
管理者が「Excelを取り込む」→ 確認画面で「置き換えて取り込む」を押すと、次のとおり処理します（`js/backend-firebase.js` の `importBatch`）。

| 項目 | 処理 |
|---|---|
| 出席表の初期データ | 新しいExcelの内容に更新 |
| 編集データ | リセットし、新Excelの内容を初期値(`current = initial`)にする |
| 変更の色付け | `current` と `initial` が一致するため、すべて解除 |
| フィルター・メンバー | **そのまま維持** |
| メモ | すべて削除し、空にする |
| 確認画面 | 出席表・編集内容・メモが置き換わることを事前に表示 |

## デモモードで画面だけ確認する
`js/firebase-config.js` を「YOUR_」のままにしておくと、データをブラウザ内に保存するデモモードになります（画面上部に黄色の帯が出ます）。ローカルで見る場合は、このフォルダで `python3 -m http.server 8000` を実行し、`http://localhost:8000` を開いてください（`file://` ではモジュールが読み込めません）。

## ブラウザに含めないもの
- サービスアカウントキー（Admin SDKの秘密鍵）：`tools/` のスクリプトをあなたのパソコンで使うときだけ、フォルダ外のファイルを環境変数で指定します。
- 管理者の判定はブラウザの選択ではなく、Googleログイン後に `admins` を確認し、Firestoreルールでも同じ条件を検査します。
