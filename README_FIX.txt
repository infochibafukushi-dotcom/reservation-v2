修正対象
- admin.menu.js
- admin.app.js
- admin.html
- index.booking.js
- Code_Core.gs

修正内容
1. 管理画面の「移動方法」グループで、custom + MOVE_* の旧データも表示対象に修正
2. 予約作成時に move_type / move_type_key を保存
3. 予約一覧・詳細に「移動方法」を表示
4. 予約シートのスキーマに move_type / move_type_key を追加

手順
1. GitHub: admin.menu.js / admin.app.js / admin.html / index.booking.js を中身ごと上書き
2. GAS: Code_Core.gs を中身ごと上書きして保存
3. ブラウザを Ctrl + F5

注意
- 既に保存済みの古い予約データは、当時 move_type を保存していなければ空のままです
- これ以降の新規予約から「移動方法」が保存・表示されます
