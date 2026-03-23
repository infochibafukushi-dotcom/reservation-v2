差し替え対象
- admin.menu.js
- admin.app.js
- index.booking.js
- Code_Core.gs

修正内容
1. 管理画面のメニューカード開閉修正
2. 管理画面で custom + MOVE_* を 移動方法 として表示
3. 予約フォームで移動方法の料金を合計へ加算
4. 新規予約保存時に move_type / move_type_key を保存
5. 予約一覧・詳細に移動方法を表示
6. GAS側の予約シートスキーマへ move_type / move_type_key を追加し、マスタ料金読込時に MOVE_* を move_type 扱い

手順
1. GitHub: admin.menu.js / admin.app.js / index.booking.js を同名で上書き
2. GAS: Code_Core.gs を同名で上書き保存
3. 必要なら新規デプロイ
4. 管理画面と予約フォームを Ctrl+F5
5. 新規予約を1件作って 予約一覧の移動方法列を確認
