修正内容
1. admin.menu.js
- 管理画面でも custom + MOVE_ を move_type として扱う
- old menu_group 値 move / roundtrip / stairs / equip / assist を正規化
- getAllKnownMenuGroups / buildMenuAutoApplyOptions / adminNormalizeMenuRows / getMenuItemsByGroup / buildSaveMenuPayload を補強
- アコーディオン開閉ボタンの参照ズレを修正

2. Code_Core.gs
- マスタ_料金シート読み込み時に key / key_jp / label を見て menu_group を補正
- _normalizeMenuItem_ 保存正規化でも同じ補正を適用
- custom に入っている MOVE_* を move_type として統一

入れ替え対象
- admin.menu.js
- Code_Core.gs
