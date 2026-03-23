今回の修正対象
- admin.api.js
- admin.app.js
- admin.menu.js
- admin.html
- index.api.js

修正内容
1. 管理画面と公開画面のGAS URLを統一
2. admin.api.js に getReservationsRange / getBlocksRange / getAdminBootstrap を追加
3. 管理画面初期化を bootstrap + visible window 優先に修正
4. admin.menu.js の開閉トグル参照先を修正
5. 旧 MOVE_* を move_type として扱う既存補正を維持
