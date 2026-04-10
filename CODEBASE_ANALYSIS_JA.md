# 現状コード徹底解析レポート（reservation-v2）

最終更新: 2026-04-10

## 1. 全体像（アーキテクチャ）

本リポジトリは **Google Apps Script (GAS) + 静的HTML/JS** で構成された予約システムです。

- 公開画面: `index.html` + `index.*.js`
- 管理画面: `admin.html` + `admin.*.js`
- API/永続化: `Code.gs` / `Code_Core.gs`（Google Spreadsheet を実質DBとして利用）

フロントは GAS Web App (`doGet`/`doPost`) に対して JSON/JSONP で通信し、
予約情報・ブロック情報・設定情報・メニューマスタを取得/更新する構成です。

## 2. ファイル責務と依存関係

### 2.1 バックエンド（GAS）

- `Code.gs`
  - APIエントリポイント（`doGet`, `doPost`）
  - 設定初期値 (`DEFAULT_CONFIG`)
  - 予約作成/更新、管理者認証、ロゴアップロード、各種公開API
- `Code_Core.gs`
  - シートI/Oの共通処理、ヘッダーマッピング、バリデーション
  - ブロックスロット計算、キャッシュ、GitHub連携ヘルパ

### 2.2 公開画面

- `index.html`
  - 公開予約UIのマークアップ
  - 読み込み順: `index.api.js` → `index.calendar.js` → `index.booking.js`
- `index.api.js`
  - 通信層（GET/POST, JSONP fallback, リトライ, localStorage cache）
  - 公開データのbootstrap/差分取得
- `index.calendar.js`
  - カレンダー描画、セル状態パッチ、先読み
- `index.booking.js`
  - 予約フォーム、料金計算、自動選択ルール、初期化
  - 下部に「最終fix」の monkey patch 群があり、可読性と追跡性を悪化させている

### 2.3 管理画面

- `admin.html`
  - 管理UI（認証、予約一覧、メニュー設定、ロゴ設定、当日予約設定）
  - 読み込み順: `admin.api.js` → `admin.calendar.js` → `admin.menu.js` → `admin.app.js`
- `admin.api.js`
  - 管理向け通信ヘルパ、共通ユーティリティ
- `admin.calendar.js`
  - 管理カレンダー描画・枠ブロック制御
- `admin.menu.js`
  - メニューグループ/項目編集ロジック
- `admin.app.js`
  - 画面統合、イベントバインド、初期化

## 3. データモデル（実質）

スプレッドシート名は `SHEETS` 定数で管理され、主に以下を利用:

- `設定`
- `予約内容`
- `ブロック`
- `AdminLog`
- `マスタ_料金`

`_headerMap` + 列名揺れ吸収（`slot_key`/`key`/`block_key` など）により、
シート列順変更への耐性を持たせています。

## 4. 良い設計ポイント

1. **段階的キャッシュ戦略**
   - サーバ側（CacheService）とクライアント側（localStorage）を併用し、初期表示を高速化。

2. **APIの薄い責務分離**
   - `Code.gs` がルーティング、`Code_Core.gs` が低レイヤ処理という役割分担。

3. **可用性重視の通信実装**
   - 公開画面で GET失敗時に JSONP fallback + retry があり、GASの不安定さに対処。

4. **運用を意識した管理機能**
   - 日単位/時間帯単位ブロック、ロゴ更新、文言管理、メニュー管理が揃っている。

## 5. 主要な技術的リスク

1. **認証/秘密情報の扱いが弱い（最優先）**
   - `DEFAULT_CONFIG` に管理パスワード既定値が平文で存在。
   - `github_token` も設定シート上の平文管理前提。
   - パスワード照合は平文比較。

2. **JSONP許容による攻撃面の拡大**
   - callback付きレスポンスを返す設計は運用ミス時のリスクが高い。

3. **フロントの責務過多と重複**
   - `index.booking.js` が巨大で、初期化/UI/計算/補正パッチが混在。
   - `index.ui.js` / `admin.ui.js` は現行HTMLから直接読み込まれておらず、死蔵・分岐源の懸念。

4. **グローバル関数依存が強い**
   - スクリプト順序に強く依存し、リファクタ時の副作用範囲が読みづらい。

5. **API粒度と責務境界の曖昧化**
   - `getPublicBootstrap`/`getPublicBootstrapLite`/`getPublicInitLite` など取得経路が多く、
     不整合時のデバッグコストが高い。

## 6. 可読性・保守性のボトルネック

- 公開/管理ともに「巨大ファイル + 直接DOM操作 + グローバル状態」構成。
- `index.booking.js` 末尾の上書き型パッチ（関数差し替え）が、
  バグ再現時の原因追跡を難化。
- 命名と実装の世代混在（旧ロジック残置と新ロジック追加）が進行中。

## 7. パフォーマンス観点

- 初期描画最適化（lite bootstrap + 背景更新）は方向性として良い。
- 一方でファイルサイズは大きく、初回 parse/execute コストは高め。
- calendar/booking 双方に再描画トリガが多く、将来的に状態管理の一本化が必要。

## 8. 推奨リファクタ順（実行優先度付き）

### P0（先にやる）
1. 管理パスワードのハッシュ化（平文比較廃止）
2. GitHub token の保管方式見直し（最低限、運用上の露出低減）
3. JSONP経路の縮小（段階的廃止）

### P1（次にやる）
1. `index.booking.js` を責務分割（料金計算/フォーム制御/初期化）
2. dead/legacy ファイル（`index.ui.js`, `admin.ui.js`）の整理方針確定
3. APIレスポンス型の明文化（JSDocまたは schema）

### P2（中期）
1. 共通ユーティリティのモジュール化（format/date/menu helpers）
2. 最低限の自動テスト導入（価格計算・自動選択ルール・スロットブロック）
3. 管理画面イベントバインドのコンポーネント化

## 9. 直近での現実的改善提案（小さく始める）

- Step 1: `index.booking.js` の「authoritative final booking fix」区画を専用ファイルへ分離。
- Step 2: 予約価格計算ロジックを pure function 化し、ユニットテスト対象にする。
- Step 3: admin認証フローの I/O を統一（token入出力位置を一本化）。
- Step 4: API一覧と payload 仕様を `docs/api-contract.md` として明文化。

## 10. 総評

業務要件に対する実装量は十分で、運用現場で必要な機能（予約・枠管理・文言管理・メニュー管理）を
**実用優先で積み上げた強いコードベース**です。

その一方、現在は「機能追加の速度」を優先した結果として、
- セキュリティ
- 構造的一貫性
- 変更容易性

の3点で技術的負債が顕在化しています。

**次フェーズは新機能追加より“整理と防御”を優先**すると、
障害率と改修コストを同時に下げられる段階に入っています。
