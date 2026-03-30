# 速度改善の実施内容

- Tailwind CDN を廃止し、`tailwind-lite.css` をローカル読込へ変更
- Google Fonts を `Noto Sans JP` のみに整理
- ロゴ既定URLを軽量な WebP (`https://raw.githubusercontent.com/infochibafukushi-dotcom/chiba-care-taxi-assets/main/logo/logo.webp`) に統一
- 公開画面のロゴ preload / 画像 src を WebP に変更
- 管理画面の初期化を二重実行から単一実行へ整理
- 管理画面の初回ロードを `adminRefreshBootstrapData()` + `adminRefreshVisibleWindow()` に変更
- 管理カレンダー操作後の全件再取得を、表示範囲のみ再取得へ変更
