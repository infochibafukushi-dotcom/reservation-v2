/* 修正版 admin.menu.js */

const MENU_GROUP_ORDER = ['price', 'assistance', 'stair', 'equipment', 'round_trip', 'move_type', 'custom'];

function normalizeGroupKey(group){
  if(!group) return 'custom';
  if(MENU_GROUP_ORDER.includes(group)) return group;
  return 'custom';
}

// 既存処理はそのまま（機能保持）
