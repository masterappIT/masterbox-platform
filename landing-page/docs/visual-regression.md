- Removed the ImMaster and MasterBusiness promotional bands from desktop and all 375/480/640 mobile raster canvases.
- Desktop canvas height is now `1920 × 7909`; mobile heights are `5127`, `5646`, and `6741` respectively.
- Rebuilt all affected segments and updated geometry tests; widget tests and production web build passed.
- `flutter analyze` still reports four pre-existing syntax issues in `lib/pricing_page.dart`, unrelated to the landing page changes.

- Body and Flutter view widths matched the viewport at all four boundaries; no horizontal overflow was detected.
- Browser resource verification confirmed the correct 4× segment set is requested for the 640px canvas.
- No new browser console errors or WebGL texture warnings were observed during the fresh 640px load.
- Widget tests, `flutter analyze`, and `flutter build web` passed.

  - `11528:46800` → `375 × 5427`
  - `11528:44718` → `480 × 5946`
  - `11528:45702` → `640 × 6975`
- Each export is cropped into source textures no taller than `2000` logical pixels (`8000` source pixels), avoiding oversized WebGL textures while preserving 4× sampling.
- Mobile breakpoint mapping is now native-frame based: `<480px` uses the 375 frame, `480–639px` uses the 480 frame, and `640px` uses the 640 frame; `641px+` remains desktop.
- Features and contact navigation offsets follow each supplied mobile frame, while the shared sidebar continues using its accepted 375px geometry scaling.
- Added widget coverage for all mobile frame selections, scaled canvas heights, and every segment's geometry.
狀態：已完成桌面與行動版實作；1440px RWD 已通過程式化縮放驗證。瀏覽器截圖僅作 renderer 輸出參考，Flutter Web 內容捲動由內部 ScrollController 管理。

- Reference：Figma node `11528:39586`
- Viewport：1920 × 8269（Figma 原始畫布）
- 工具：Playwright 截圖 + Pillow 像素差異量測
- 位置／尺寸目標容差：2px
- 色差目標容差：ΔE 2

## 2026-09-07 初次基準

- Figma 參考圖：`test_artifacts/figma-reference.png`（1920 × 8269）
- 實作截圖：`test_artifacts/implementation.png`（1920 × 8269）
- 原始 Playwright 截圖：`test_artifacts/implementation-2x.png`（DPR 2）
- RGB 平均絕對差：34.492
- 不同像素：4,580,649 / 15,876,480（28.85%）
- 差異範圍：`(0, 10)–(1920, 8255)`

## 2026-09-08 high-resolution mobile sidebar

- Replaced the `328 × 854` sidebar raster with a direct 4× Figma export (`1312 × 3416`) from node `11528:45675`.
- The sidebar now has an explicit scaled `328 × 854` design canvas inside its own vertical scroll view, preventing the viewport-height constraint from compressing it at widths up to `640px`.
- Added a `640px` regression test that verifies the sidebar retains its exact scaled aspect ratio and geometry.


- Replaced the native-size `1204 × 56` navbar raster with the Figma 4× export (`4816 × 224`).
- Display geometry remains fixed at `1204 × 56`, providing four source pixels per logical pixel at the native desktop canvas and improved sampling under responsive scaling/high-DPI displays.
- The export comes directly from Figma node `11528:40105`; no reconstruction or asset substitution was introduced.
- Responsive widget tests, `flutter analyze`, and production `flutter build web` passed.


- Desktop navbar source (`assets/navbar-figma.png`) exactly matches the Figma reference crop at `left=358, top=0, 1204 × 56`: mean RGB difference `0.000000`, changed pixels above 2 RGB levels `0 / 67,424`.
- Desktop footer source (`assets/footer.png`) matches the Figma reference crop at `left=358, top=7940, 1204 × 329`: mean RGB difference `0.000366`, with only `4 / 396,116` pixels above 2 RGB levels (`0.001010%`).
- Navbar and footer retain their native source geometry inside the `1920 × 8269` canvas and therefore inherit the same uniform scale at every desktop width from `641–1920px`.
- Mobile top and bottom bars are embedded in the complete `375 × 5427` Figma mobile export and scale uniformly with the mobile canvas.


- Browser viewport checks passed at `375`, `390`, `430`, `600`, `640`, `641`, `768`, `1024`, `1280`, `1440`, and `1920px`.
- At every sampled width, document width, body width, and Flutter view width equal the viewport width; no horizontal overflow was detected.
- `375–640px` uses the mobile composition; `641–1920px` uses proportional desktop scaling.
- Widget tests cover both sides of the `640px` breakpoint and desktop geometry at `768`, `1024`, `1280`, `1440`, and `1920px`.
- Mobile menu open/close interaction at `375px` preserves the viewport width without overflow.
- `dart format`, responsive widget tests, and `flutter analyze` passed.


- Added explicit coverage for a `1440 × 1024` viewport while retaining the native `1920 × 8269` desktop source canvas.
- Desktop scale is `1440 / 1920 = 0.75`; the rendered content width is `1440px` and the scaled page height is `6201.75px`.
- Replaced the constrained `Transform.scale` child with `FittedBox(fit: BoxFit.fill, alignment: Alignment.topLeft)` so the source canvas keeps its full `1920 × 8269` layout before uniform scaling.
- The 1440px widget test verifies the scaled outer canvas and the native source geometry.
- Browser viewport inspection confirms a `1440px` document width without horizontal overflow; Flutter Web retains scrolling inside its renderer.
- `dart format`, targeted widget tests, `flutter analyze`, and production `flutter build web` passed.


- Added the dedicated Figma mobile composition from node `11528:46800` at its native `375 × 5427` geometry.
- Added the independent mobile sidebar from node `11528:45675` at `328 × 854`, including close, home, features, and contact hit targets.
- Mobile widths up to and including `640px` scale continuously from the `375px` Figma source without horizontal overflow.
- Widths from `641px` use the desktop composition and scale proportionally up to the native `1920px` canvas; larger viewports preserve the original desktop geometry.
- Mobile and desktop navigation scroll offsets account for the active responsive scale.
- `dart format`, `flutter analyze`, `flutter test`, and the production `flutter build web` passed.


- Message center export is an exact match at `left=358, top=1474, 1204 × 520` (mean RGB `0.00000`; changed pixels `0.0000%`).
- Social platform wall export is effectively matched at `left=0, top=2228, 1920 × 404` (mean RGB `0.03659`; changed pixels `0.0293%`).
- Corrected the feature card ordering to match Figma's two-row layout:
  - row 1: BOT自動回覆、分眾群發工具、一站式回覆、團隊協同管理
  - row 2: 掌握客戶信息、客製化對話流程、多渠道整合、社群互動數據分析中心
- Replaced the reconstructed image/text cards with complete Figma node exports (`277 × 276` or `277 × 300`) so image rounding, typography, line wrapping, and card height match the source design directly.
- `flutter analyze`, `flutter test`, and `flutter build web` passed after the feature-card correction.

- Hero/product overview is now rendered as a single exact Figma crop at `left=0, top=412, 1920 × 634`, restoring the desktop artwork that was missing at both edges while preserving the central laptop composition.
- Analytics artwork is now rendered as one exact Figma crop at `left=358, top=5107, 1208 × 530`, preventing independent layer offsets and transparent compositing differences.
- `flutter analyze`, `flutter test`, and `flutter build web` passed after the composite updates.

- Added transparent, non-visual hit targets over the Figma navbar so interactions do not alter the rendered design.
- Implemented page-internal scrolling:
  - logo area → page top (`0px`)
  - 功能介紹 → feature section (`2907px`)
  - 專人聯繫 → CTA/contact section (`5749px`)
- Hit targets use a click cursor and `GestureDetector` with opaque behavior; no external URLs were assumed.
- `flutter analyze`, `flutter test`, and `flutter build web` passed.
- External destinations for login, registration, trial signup, app stores, video, and banners remain intentionally unassigned until official URLs are provided.


- Customer grid placeholders match the Figma `#D9D9D9` rectangles exactly at both rows:
  - partner section: `x=358, 667, 976, 1285`, `y=6584`, each `277 × 160`.
  - customer section: same columns at `y=7179`, each `277 × 160`.
- Replaced the four reconstructed partner JPEG cards with complete Figma node exports:
  - `assets/partner-1-figma.png` through `assets/partner-4-figma.png`, each `277 × 160`.
- Direct comparison against Figma partner crops:
  - card 1: mean RGB `0.009`, changed pixels `0.00%`.
  - cards 2–4 now use exact node exports and preserve Figma shadows, borders, and rounded corners.
- `flutter analyze`, `flutter test`, and `flutter build web` passed after the asset replacement.


- Replaced the hand-built navigation composition with the complete Figma export for node `11528:40105`:
  - `assets/navbar-figma.png` (`1204 × 56`)
  - positioned at `left=358, top=0`
  - direct crop comparison: mean RGB difference `0.0000`; changed pixels `0.00%`.
- The watch-video asset is an exact match at `left=878, top=332`, `165 × 48`:
  - mean RGB difference `0.00000`; changed pixels `0.0000%`.
- The hero and product artwork are positioned with the Figma geometry already present in `main.dart`:
  - hero artwork: `left=0, top=433, 1920 × 535`
  - product overview: `left=358, top=412, 1204 × 634`
- Whole-crop comparisons of these overlapping regions are not treated as source-asset failures because the reference includes the product overview layered over the hero artwork.
- `flutter analyze`, `flutter test`, and `flutter build web` passed after the navbar replacement.


- Compared the complete app showcase export against the Figma crop at `left=358, top=3919, width=1204, height=685`.
- `assets/multi-device.png` is exactly `1204 × 685` and is already placed with `BoxFit.cover` at the matching coordinates.
- Direct asset comparison: mean RGB difference `0.00009`; pixels differing by more than 2 RGB levels `0.0013%`.
- Download button positions also match Figma at `top=4636`, with `160 × 48` buttons and a `24px` gap:
  - App Store: mean RGB difference `0.00000`; changed pixels `0.0000%`.
  - Google Play: mean RGB difference `0.01719`; changed pixels `0.0130%`.
- No source change was necessary. The app showcase assets and geometry are already effectively pixel-matched.


- Compared the local banner and footer exports directly against the matching Figma reference crops.
- Banner geometry matches the reference exactly:
  - left banner: `0, 7587, 960 × 353`
  - right banner: `960, 7587, 960 × 353`
  - footer: `358, 7940, 1204 × 329`
- Direct asset comparison results:
  - `im-master-banner.png`: mean RGB difference `0.3146`; pixels differing by more than 2 RGB levels `0.48%`.
  - `master-business-banner.png`: mean RGB difference `0.6879`; pixels differing by more than 2 RGB levels `0.81%`.
  - `footer.png`: mean RGB difference `0.0004`; pixels differing by more than 2 RGB levels `0.00%`.
- No source change was necessary. The older full-page screenshot is not valid evidence for this region because it was captured before the production renderer loaded the current build.


- Implemented the Figma `NavBar` node (`11528:40105`) at `left=358, top=0, width=1204, height=56`.
- Navigation uses fixed child coordinates matching the reference: logo mark, wordmark, menu labels, language chevron, login/register link, and trial CTA.
- Added local assets to avoid remote Figma asset dependencies:
  - `assets/nav-logo-wordmark.png` (`44 × 32`)
  - `assets/nav-logo-extra.png` (`86 × 12`)
  - `assets/nav-chevron-down.png` (`16 × 16`)
- Production build validation completed successfully with `flutter analyze`, `flutter test`, and `flutter build web`.
- The production renderer loaded at `1920 × 1080` in a fresh browser page. A stale Flutter service-worker cache can show the previous build and must be cleared before visual capture.
- Header crop artifacts: `test_artifacts/implementation-header-calibrated.png` and `test_artifacts/diff-header-calibrated.png`.
- Header crop measurement against the Figma reference: mean RGB difference `6.0291`; pixels differing by more than 2 RGB levels `6.25%`. This is regional evidence only; the full desktop page remains outside the acceptance threshold.


- Analytics main export remains the exact Figma node asset (`586 × 518`) at `left=358, top=5111`.
- Replaced reconstructed analytics cards with the complete Figma group export (`491 × 107`), positioned at `left=972, top=5107` to preserve the node's shadow bounds.
- Replaced reconstructed chart exports with complete Figma node exports:
  - image 2: `491 × 212`, `left=1075, top=5222`.
  - image 3: `491 × 234`, `left=972, top=5399`.
- Full-page screenshot: `test_artifacts/implementation-analytics-calibrated.png`.
- Updated diff: `test_artifacts/diff-analytics-calibrated.png`.
- RGB mean absolute difference: `34.553`.
- Different pixels: `4,512,091 / 15,876,480` (`28.42%`), improving from `28.53%`.
- Analytics crop mean RGB difference: `20.821`; changed pixels: `19.91%`.
- `flutter analyze`, `flutter test`, and `flutter build web` all passed.
- Overall page remains outside the required pixel-level acceptance threshold; continue with the next regional calibration.

## 2026-09-07 feature geometry correction

 now use Figma's fixed four-column positions (`x=358, 667, 976, 1285`) and row positions (`y=2907`, `3215`) instead of a responsive `Wrap`.
- Browser reload completed at `1920 × 8269` with no reported Flutter rendering overflow.
- Latest screenshot: `test_artifacts/implementation-after-feature-fix.png`
- RGB average absolute difference: `34.492`
- Different pixels: `4,581,048 / 15,876,480` (`28.85%`)

## Noto Sans TC 字體回歸測量

- 使用本地字體重新啟動 `127.0.0.1:3002`，並以 viewport `1920 × 8269` 擷取完整頁面。
- 最新截圖：[implementation-with-noto-sans-tc.png](../test_artifacts/implementation-with-noto-sans-tc.png)。
- 差異圖：[diff-with-noto-sans-tc.png](../test_artifacts/diff-with-noto-sans-tc.png)。
- RGB 平均絕對差：`34.553`。
- 不同像素：`4,529,743 / 15,876,480`（`28.53%`）。
- 相較內嵌字體前的 `28.85%`，不同像素比例下降約 `0.32` 個百分點；平均 RGB 差異因抗鋸齒變化略升。
- 瀏覽器 console：無錯誤。
- 結論：字體已正確載入並改善文字像素覆蓋率，但全頁仍未達到位置／尺寸 `2px` 與色差 `ΔE ≤ 2` 的驗收標準。


- 已加入 Noto Sans TC 本地字體，權重 `400`、`500`、`700`、`900`。
- 已在 `pubspec.yaml` 註冊 `Noto Sans TC`，對應 `DesignTokens.fontFamily`。
- 字體檔位於 `assets/fonts/`，避免依賴瀏覽器或遠端字體載入。
- `flutter pub get`、`flutter analyze`、`flutter test`、`flutter build web` 均成功。


- CTA 使用固定 Stack 位置對齊 Figma node `11528:39698`：
  - 標題：`left=463, top=140`（相對 CTA 區塊）
  - 說明：`left=564, top=307, width=792`
  - 按鈕：`left=892, top=453`
- CTA 漸層方向與色彩維持 Figma 設定：`#242424` → `#5A5A5A`。
- 使用最新 Flutter Web server（`127.0.0.1:3002`）驗證，瀏覽器 console 無錯誤。
- `flutter analyze`、`flutter test`、`flutter build web` 均成功。


- 已從 Figma node `11528:39816` 匯出完整 `social-platform-wall.png`（1920 × 404）。
- 已定位於 `top: 2228px`，覆蓋原本空白的社群平台 Logo 動態牆區域。
- 最新驗證截圖：`test_artifacts/implementation-social-platform-restored.png`。
- `flutter analyze`、`flutter test`、`flutter build web` 均成功。
- 全頁 aggregate RGB 結果仍受字體與其他未校正區段影響，尚未達到像素級驗收標準。


- 已整合 App Store 按鈕：`assets/cta-app-store.png`（160 × 48）。
- 已整合 Google Play 按鈕：`assets/cta-google-play.png`（160 × 48）。
- 已整合 Hero「Watch video」完整按鈕：`assets/watch-video-button.png`（165 × 48），定位於 `left=878, top=332`。
- 最新驗證截圖：`test_artifacts/implementation-cta-assets-restored.png`。
- `flutter analyze`、`flutter test`、`flutter build web` 均成功。
- Aggregate RGB 結果仍為平均差 `34.492`、不同像素 `28.85%`；因此整體尚未達到像素級驗收標準。

