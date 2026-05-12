# Claude Code 指引

這個檔案是給 Claude Code 看的,讓 AI 接手時知道專案脈絡。

## 專案概要

個人用的每日追蹤 PWA。功能:
1. **打卡計算**:記錄上班時間,自動算 4 小時後可離開
2. **運動天數**:登記每日運動,有里程碑成就系統

## 技術棧
- **框架**:Vite + React 18
- **樣式**:Tailwind CSS(深色霓虹風,主色 lime-400)
- **儲存**:目前用 `localStorage`,未來計畫換成 Supabase 等雲端
- **字型**:Bricolage Grotesque(顯示)+ JetBrains Mono(等寬)+ Noto Sans TC(中文)

## 程式碼結構

整個 app 都在 `src/App.jsx` 一個檔案裡,主要區塊用註解分隔:
- 初始資料常數
- Storage 抽象層(`storage` 物件)
- `<App />` 主元件
- `<SettingsModal />` 設定/匯出/匯入
- `<PunchView />` 打卡分頁
- `<ExerciseView />` 運動分頁
- `<MonthCalendar />` 月曆元件

## 重要邏輯

### 打卡資料格式
```js
{
  "2026-05-12": "2026-05-12T01:30:00.000Z",  // 日期 -> ISO 時間
  ...
}
```

### 運動資料格式
```js
["2026-01-16", "2026-01-18", ...]  // 日期字串陣列
```

### Storage Key
- `tracker:punch-data` — 打卡資料
- `tracker:exercise-data` — 運動資料
- `tracker:initialized-v1` — 是否已注入初始資料

## 常見任務

### 「幫我加上 Supabase 雲端同步」
1. `npm install @supabase/supabase-js`
2. 建 `.env`,加上 `VITE_SUPABASE_URL`、`VITE_SUPABASE_KEY`
3. 在 `App.jsx` 上方建立 supabase client
4. 修改 `storage` 物件改用 supabase
5. 加上簡單 magic link 登入或密碼保護
6. Supabase 那邊建一個 `tracker_data` 表,欄位 `key text unique`、`value jsonb`、`user_id uuid`、`updated_at timestamptz`
7. 開啟 RLS,加 policy 限制 user 只能讀寫自己的 row

### 「部署到 Vercel」
專案是標準 Vite 結構,Vercel 會自動偵測。只要:
```bash
git init && git add . && git commit -m "init"
# 推到 GitHub,然後到 vercel.com import
```

### 「資料消失了怎麼辦」
`localStorage` 的資料會在以下情況消失:
- 換瀏覽器
- 用無痕模式
- 清除瀏覽器資料
- iOS Safari 一段時間不用會清掉「網站資料」

解決方法是換到雲端 storage(見上方)。短期內可叫使用者定期匯出 JSON 備份。

### 「想加新功能,例如冥想/喝水追蹤」
複製 `<ExerciseView />` 的結構,改成新的 tab 即可。資料 schema 跟運動完全一樣(日期字串陣列)。

## 風格慣例
- 主色 `lime-400` 用於正面動作和成功狀態
- `amber-400` 用於警告和「下個目標」
- `red-400`/`red-500` 用於危險動作(刪除)
- `zinc-*` 是中性色階,950 是底,800 是邊框
- 等寬字體 `font-mono` 用於數字、時間、日期等規律性資訊
- 標題用 `font-display`
- 動畫 `slide-down`、`fade-in`、`pulse-glow`、`shimmer-text` 已定義在 FONT_CSS

## 不要做的事
- 不要把 App.jsx 拆成太多檔案,使用者偏好單檔好維護
- 不要加入需要登入流程的功能,除非使用者要求(目前是個人單機使用)
- 不要把 localStorage key 改名(會丟資料),要改的話必須有 migration
