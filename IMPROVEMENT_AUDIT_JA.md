# reservation-v2 改善余地監査（機能・デザイン維持前提）

最終更新: 2026-04-10

## 目的

本メモは、**現行の機能とデザインを変更せず**、品質（速度・保守性・安定性）を上げるための改善余地を整理したものです。

---

## 1) 現状アーキテクチャ要約

- フロント（公開）: `index.html` + `index.api.js` + `index.calendar.js` + `index.booking.js`
- フロント（管理）: `admin.html` + `admin.api.js` + `admin.calendar.js` + `admin.menu.js` + `admin.app.js`
- バックエンド: Google Apps Script (`Code.gs`, `Code_Core.gs`)
- データ層: Google Spreadsheet（設定 / 予約内容 / ブロック / 料金マスタ / AdminLog）

---

## 2) ボトルネック観点（優先順）

### P0: 初回表示～ブロック反映まで

1. **初期表示経路が複数あり、状態遷移が複雑**
   - 早期描画 / prefetch / refresh / patch の経路が重なっており、
     タイミング競合で「見た目とクリック可否」がずれるリスクがある。

2. **スロット更新が“差分前提”で、例外時に取り残しやすい**
   - `slot-loading` のような中間クラスが残ると操作不可が継続する。

### P1: GASシートI/O

3. **ブロック更新処理が行単位 setValues になりやすい**
   - `_setDayBlockedBySlots_` で更新対象行ごとに書き込みが発生。
   - 更新件数が多い日に Apps Script 実行時間を圧迫しやすい。

4. **APIルーティングが長い if 連鎖で保守コストが高い**
   - `doGet`/`doPost` のアクション増加時に回帰リスクが増える。

### P2: 保守性

5. **公開側 `index.booking.js` が巨大で責務密結合**
   - 表示制御、価格計算、バリデーション、初期化が同居。

6. **運用設定と認証情報の扱い改善余地**
   - 管理パスワード/トークン運用は将来的に強化余地がある。

---

## 3) 改善提案（機能・デザイン維持）

### A. 初回表示の状態機械を1本化（最優先）

- `BOOT_STAGE = "cache" | "loading" | "ready" | "degraded"` のような単一状態を導入し、
  カレンダー描画・クリック可否・凡例表示をこの状態だけで決める。
- 目的: レースコンディション低減、再発防止。

### B. スロット描画の確定化パスを標準化

- `finalizeSlotsFromLiveData()` を1関数化し、
  - クラス正規化（loading除去）
  - クリック可否解放
  - 追加パッチ
  を同一箇所で行う。
- 目的: 「色は変わらない/クリック不可」の再発防止。

### C. GASブロック更新のバッチ化

- `_setDayBlockedBySlots_` の更新を可能な範囲で連続レンジ書き込みに寄せる。
- 目的: シートI/O回数削減、ピーク時の安定性向上。

### D. ルーティングテーブル化

- `const getHandlers = { getConfig: api_getConfig, ... }` 形式へ段階移行。
- 目的: 変更差分を縮小し、将来拡張時の回帰を減らす。

### E. フロントの責務分離（段階移行）

- `index.booking.js` を
  - `booking.form.js`
  - `booking.price.js`
  - `booking.init.js`
  に段階分割（importなしでも IIFE 分割で可）。
- 目的: 変更影響範囲の可視化。

---

## 4) 安全に着手できる短期タスク（低リスク）

1. クリック解放条件を単一関数 `isCalendarInteractive()` に統合。
2. `slot-loading`/`slot-available`/`slot-unavailable` の遷移テストケース（手動チェック表）を作成。
3. `refreshAllData` 成功/失敗/キャッシュ復旧のログ計測（`console.debug` ガード付き）を追加。
4. `_setDayBlockedBySlots_` の処理時間ログ（開始/終了/件数）を `AdminLog` に残す。

---

## 5) 期待効果

- 初回表示の不整合（表示/クリック可否のズレ）再発率低下
- Apps Script 実行時間の平準化
- 改修時の影響範囲縮小（障害混入率低下）

---

## 6) 補足

本提案はすべて **機能仕様・画面デザインを維持**したまま実施可能な改善に限定しています。
