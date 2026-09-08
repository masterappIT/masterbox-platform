# Landing Page 開發文件

## 規格來源
- Figma 首頁節點：`11528:39586`
- Figma 專人聯繫節點：
  - 桌面：`11528:42616`
  - 行動 640：`11528:46672`
  - 行動 480：`11528:41899`
  - 行動 375：`11528:47662`
- 設計檔：EC-Travel（跨境打車）
- 視覺規格：`design/tokens.css`
- 圖片與圖示：`assets/`

## 開發規則
本專案只還原設計稿，不自行調整顏色、字體、字號、間距、圓角、陰影、順序或互動。所有視覺值必須對應 `design/tokens.css`；缺少規格時先停止並確認。

「專人聯繫」為獨立 `/contact` 路由，沿用四個 Figma 斷點。表單第一版只做前端必要欄位驗證與成功提示，不串接後端；設計稿未提供的欄位文案與流程不得自行擴充。

## 本地指令
```bash
cd landing-page
flutter pub get
flutter run -d chrome --web-port 3001
flutter analyze
flutter build web
```

## 驗收
交付前使用 Playwright 以 1920px viewport 截圖，與 Figma 匯出圖透過 pixelmatch 比對。位置與尺寸差異上限 2px，色差 ΔE 上限 2；結果與結論存於 `docs/visual-regression.md`。
