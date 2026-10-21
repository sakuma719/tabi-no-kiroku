# 旅のきろく

自分のペースで旅を計画する、日本語の個人用旅行Webアプリです。第1段階として「デジタル旅のしおり」を実装しています。バックエンド、アカウント、APIキーは必要ありません。

## できること

- 複数の旅行の作成・編集・削除。旅行名から「○○の旅」と表示し、日程からDAYを生成
- 日別の予定の追加・編集。開始・終了時刻、カテゴリ、移動手段、発車時刻、手動の移動時間、折りたたみメモ
- 滞在時間と次の予定までの間隔の自動計算。時間の重複、並び順と時刻の矛盾を警告
- ハンドルのドラッグで並び替え（タッチ対応）。上下ボタンとキーボードでも操作可能
- カードの左スワイプで削除ボタンを表示。削除の取り消し、編集画面からの削除
- スポットの新規作成・既存選択。住所・緯度経度・GoogleマップURLを保持し、IDで予定と連携
- Leafletの地図、スポットのピンと名前、表示範囲の自動調整、地図の折りたたみ
- IndexedDBへの永続保存、JSONバックアップ・検証付きの一括復元
- 操作を試せる任意の「別府の旅」サンプル（サンプルの交通時刻は実際のダイヤではありません）

## 使用技術

- React 19 / TypeScript / Vite 6
- CSS（テーマ・余白・文字サイズは `src/styles.css` のCSS変数で管理）
- Dexie / IndexedDB、Zodによるデータ検証
- Leaflet / OpenStreetMap（APIキー不要）
- dnd-kit（Pointer・Keyboardセンサー）
- Vitest / fake-indexeddb、Playwright
- GitHub Actions / GitHub Pages

## ローカル起動

Node.js **22.12以上**を使用してください（推奨：Node.js 22 LTS）。

```sh
npm ci
npm run dev
```

Viteが表示するローカルアドレスをブラウザで開きます。iPhoneから同一ネットワーク内の開発PCにアクセスする場合は、PCのLANアドレスとViteのポートを指定してください。`dev` は `0.0.0.0` で待ち受けます。

```sh
npm run build     # TypeScriptの型チェック + 本番ビルド（dist/）
npm run preview   # 本番ビルドをローカル確認
npm test          # 時間計算、URL検証、IndexedDB、復元・ロールバック
npm run test:e2e  # デスクトップ / iPhoneサイズのChromiumで操作テスト
```

E2Eは静的ファイルを `/tabi-no-kiroku/` 以下で配信し、GitHub Pages相当のサブディレクトリで検証します。地図タイルはテスト用のローカル応答に置き換え、公衆タイルサーバーへの反復アクセスを避けます。ピン・ポップアップ・地図操作は本物のLeafletです。

ブラウザの準備（システムChromiumがある場合は自動利用）：

```sh
npx playwright install chromium
# Safari系エンジンを検証できる環境では：
npx playwright install --with-deps webkit
npm run test:safari
```

任意のChromiumを使う場合は `PLAYWRIGHT_CHROMIUM_EXECUTABLE` を指定できます。WebKit実行時に別のインストール先を使った場合は `PLAYWRIGHT_BROWSERS_PATH` も指定します。iPhoneサイズのChromiumやPlaywright WebKitは、iPhone Safari実機の検証を完全には代替しません。

## GitHub Pagesへの公開

1. リポジトリの **Settings → Pages → Build and deployment → Source** で **GitHub Actions** を選びます。すでに選択済みなら再設定は不要です。
2. アプリ本体と `.github/workflows/deploy.yml` を含む変更をコミットし、GitHubの `main` に反映します。Sourceの変更だけでは実行履歴は作られません。初回はワークフローだけでなく、`src/`、`public/`、`index.html`、`package.json`、`package-lock.json`、TypeScript・Vite設定なども必要です。

   リポジトリのルートで、`git status` の内容を確認してから実行します。

   ```sh
   git status
   git add .
   git commit -m "Set up travel app and GitHub Pages deployment"
   git push origin HEAD:main
   ```

   `HEAD:main` は現在のブランチ（このクラウド環境では `work`）のコミットを、GitHubの `main` へpushします。ブランチ保護で直接pushできない場合は、`git push -u origin work` で作業ブランチを送信し、GitHubで `work` → `main` のPull Requestを作成してマージしてください。マージでも `main` のpushイベントが発生します。

3. **Actions → Deploy GitHub Pages** に実行履歴が現れます。`build` でNode.js 22を準備し、`npm ci` → `npm test` → `npm run build` を実行します。続いて `dist/` をアップロードし、`deploy` でGitHub Pagesへ配置します。以降も `main` へのpushで自動実行されます。ワークフロー反映後は **Run workflow** から `main` を選んで手動実行することもできます。
4. `build` と `deploy` の成功後、Actionsのデプロイ結果に表示される公開URLへアクセスします。このリポジトリの公開先は `https://sakuma719.github.io/tabi-no-kiroku/` です。

Viteの `base: '/tabi-no-kiroku/'` とハッシュ形式の画面遷移により、プロジェクトのサブディレクトリに対応しています。ローカル開発・previewでも `/tabi-no-kiroku/` 以下を開いてください。しおりのURLを再読み込みしても、サーバー側のルーティング設定は不要です。URLを共有しても端末内の旅行データは共有されません。リポジトリ名を変える場合は、`vite.config.ts` のbaseも合わせて変更してください。

公開状況はGitHubのActionsで確認できます。`build` と `deploy` が成功してから公開URLを開いてください。リポジトリでGitHub Pagesの利用とActions実行が可能である必要があります。

## 使い方・計算ルール

1. 「新しい旅行」で旅行名・日程・エリアを入力します。旅行期間は最大366日です。
2. DAYを選んで「予定を追加」。日付の初期値は開いているDAYです。
3. 「移動・スポット情報」を開くと、その目的地へ向かう移動を入力できます。電車・バスでは発車時刻が現れます。移動時間は分単位の手動入力です。
4. 「新しいスポットを設定」で座標やURLを入力できます。「スポット一覧に保存」を選ぶとほかの予定から再利用できます。未選択の場合も場所情報はその予定とIDで紐付けて保存します。
5. 既存スポットの情報を編集すると、同じIDを参照しているすべての予定に反映されます。別の場所にする場合は新規スポットを作成します。

滞在時間は `終了 − 開始`。予定間の間隔は **表示順の前の予定の終了から次の予定の開始** で、移動時間を差し引きません。前の終了が未入力なら間隔を表示しません。時間が重なる場合も、警告を確認すれば保存できます。隣り合わない長い予定の重複も検出します。

新規の予定は時刻に応じて挿入します。その後のドラッグや上下ボタンの順序は保存され、時刻は変えません。既存予定の時刻を編集しても並び順は維持します。深夜をまたぐ予定は日付ごとに分けてください。旅行の日程から予定が外れる編集は拒否し、先に予定の日付変更か削除を案内します。

削除直後は画面下の「取り消す」で直近1件を復元できます。通知を閉じた場合、ページ再読み込み後、旅行自体の削除後は取り消せません。旅行の削除には確認があり、スポットは他の旅行で再利用できるよう保持します。

## 地図と外部サービス

- タイルは `https://tile.openstreetmap.org/{z}/{x}/{y}.png` を使用。地図上のOpenStreetMap著作権表示を保持します。
- [OpenStreetMapタイル利用ポリシー](https://operations.osmfoundation.org/policies/tiles/)に従い、画面上で必要なタイルのみ要求します。バルク取得、オフライン取得、独自タイルキャッシュは実装していません。ブラウザの標準キャッシュを使い、Refererを送る設定です。
- APIキー不要ですが、公衆タイルサービスに可用性保証はありません。大規模な公開利用に成長した場合は、利用条件に合うプロバイダーへの切り替えを検討してください。
- 地図には旅行全体の登録地点を表示します。同じスポットを複数予定で使った場合、ピンは1つです。
- 座標付きスポットがない場合、手動指定した旅行の中心座標、またはアプリ内の主要国内エリアのおおよその中心を表示します。未対応のエリアは日本全体が初期表示となるため、「旅行を編集 → 地図の中心を設定」から緯度・経度を入力してください。海外も座標指定に対応します。
- **住所・GoogleマップURLの自動ジオコーディングは行いません。** 短縮URLの展開も行いません。座標は手動入力できます。
- Googleマップは登録済みURLを優先し、未設定なら「予定名 + エリア」で検索します。HTTPSかつ正規ホスト・パスのみ許可します。`google.com/maps`、`google.co.jp/maps`、`maps.google.com`、`maps.google.co.jp`、`maps.app.goo.gl`、`goo.gl/maps/...` に対応し、認証情報付きURLや類似ドメインを拒否します。別の国別Googleドメインは必要に応じて許可リストへ追加できます。
- 地図タイル取得時はOpenStreetMapにIPアドレスと表示範囲が、Googleマップを開くと検索語や地点がそれぞれのサービスへ送信されます。予定・メモ全体をサーバーに送る仕組みはありません。

通信制限のある開発環境では `tile.openstreetmap.org` を許可してください。Playwrightブラウザ取得には `cdn.playwright.dev` や `playwright.download.prss.microsoft.com` 等へのアクセスが必要です。

## 保存・バックアップの注意点

- データは**端末・ブラウザ・オリジン単位**のIndexedDBに保存します。アカウントやクラウド同期はありません。
- SafariのWebサイトデータ削除、自動的なストレージ整理、端末故障・機種変更、ブラウザ変更、プライベートモード終了などでデータが消える可能性があります。永続性はブラウザの管理に依存します。
- 開発サーバーとGitHub Pages、別ドメインは別の保存先です。移行する場合はJSONを書き出して新しい環境で復元してください。同一オリジンのほかのアプリとデータを共有する設計ではありません。
- バックアップには予約番号やメモなどの個人情報も入ります。JSONは暗号化されません。安全な場所に保管し、公開リポジトリへ入れないでください。
- 復元は**全件置換**です。ファイルサイズ（10MBまで）、バージョン、型、IDの一意性、日付・時間・座標・URL、旅行とスポットへの参照を検証します。DB更新は1つのトランザクションで実行し、途中で失敗しても元のデータを保持します。
- サイト全体のオフライン起動は保証しません。地図の表示には通信が必要です。アプリを開いた後の編集・保存はIndexedDBで処理します。

## 構成と今後の拡張

```text
src/
  App.tsx                  旅行一覧としおり、画面状態
  components/
    TripForm.tsx           旅行作成・編集
    ScheduleForm.tsx       共通の予定追加・編集フォーム
    Timeline.tsx           並び替え、スワイプ、予定カード
    TripMap.tsx            Leaflet地図（遅延読み込み）
    BackupDialog.tsx       書き出し・復元UI
    Dialog.tsx             モーダルと未保存ガード
  lib/
    models.ts              型・スキーマ
    db.ts                  DBと原子的な保存操作
    backup.ts              バージョン付きJSON・検証・復元
    dates.ts / schedule.ts  日付・時間・並び順・重複の純粋関数
    maps.ts                Google URL検証、エリア中心
    sample.ts              任意のサンプルデータ
  styles.css               テーマ変数・レスポンシブ・セーフエリア
```

DBは `trips` / `schedules` / `spots` の3テーブルです。`schedules.tripId` と任意の `spotId` が関連を表し、スポット情報を予定内に複製しません。将来の旅ログ・コレクションは独立したテーブルに追加し、既存の旅行・スポットIDを参照できます。DB変更時はDexieのバージョンを上げて移行し、バックアップ形式にも明示的なバージョン移行を追加してください。

今回、本格的なスポット一覧、訪問チェック、旅ログ、写真、コレクション、経路検索、現在時刻での強調、予定複製、アカウント、同期は実装していません。

## iPhone Safariの手動確認項目

実機で以下を確認してから継続利用してください。

- 開始・終了・発車時刻のネイティブ入力、キーボード表示時のフォームスクロール
- 画面下の保存ボタンとセーフエリア（縦向き・横向き）
- ハンドルのタッチドラッグ、カードの左スワイプと通常の縦スクロール
- 地図のパン・ズーム・ピン、Googleマップを開いた後の復帰
- 再読み込みやSafari再起動後のデータ保持
- 「ファイル」へのJSON保存と、ファイル選択からの復元

テストの実行結果や環境の制限は、開発作業の完了報告とあわせて確認してください。
