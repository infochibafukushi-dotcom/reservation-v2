// === FIX: move_type group alias対応 ===
// 既存機能は保持しつつ、MOVE_* を move_type として扱う

function getItemsByGroup(group, items){
  return items.filter(item => {
    if(item.menu_group === group) return true;

    // 追加修正：move_type のとき custom + MOVE_* を拾う
    if(group === 'move_type'){
      if(item.menu_group === 'custom' && item.key && item.key.startsWith('MOVE_')){
        return true;
      }
    }

    return false;
  });
}
