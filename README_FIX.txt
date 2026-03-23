今回の修正
1. admin.menu.js
- すべてのメニューカードが開かない不具合を修正
- toggleMenuGroup() の参照先を data-action="toggleMenuGroup" data-group="..." に統一

2. admin.app.js
- 予約一覧テーブルに「移動方法」列を反映
- 予約詳細にも「移動方法」を反映

3. index.booking.js
- 新規予約保存時に move_type / move_type_key を保存
- これ以降の新規予約から予約一覧に移動方法が出ます

注意
- 既存の古い予約は、保存時点で move_type が無ければ空のままです
- 反映確認は新規予約を1件作成して確認してください
