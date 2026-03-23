このZIPは、本番で使う正式ファイル名だけを残したフル一式です。

入っているファイル
- Code.gs
- Code_Core.gs
- admin.html
- admin.api.js
- admin.app.js
- admin.calendar.js
- admin.menu.js
- admin.ui.js
- index.html
- index.api.js
- index.booking.js
- index.calendar.js
- index.ui.js

除外したファイル
- admin.menu.full.fixed.js
- admin.menu.fixed.js
- index.booking.fixed.full.js
- index.booking.autoset.directfix.js
- index_calendar_patch.html
- index_form_patch.html
- README.txt
- README_FIX.txt
- README_URL_UPDATED.txt

今回の反映
- 管理画面の「移動方法」表示は admin.menu.full.fixed.js の内容を admin.menu.js に統合
- 予約フォームの move_type 自動セットは equipment / assistance / stair / round_trip に反映
- ストレッチャー選択時の「身体介助」自動セットを予約フォーム側で反映
- 料金計算に move_type の価格を加算
- 予約保存データに move_type / move_type_key を保存

手順
1. GitHub内の対象ファイルをいったん削除
2. このZIPの中の同名ファイルだけをアップ
3. GAS側は Code.gs / Code_Core.gs を保存
4. キャッシュ対策でブラウザは Ctrl + F5
