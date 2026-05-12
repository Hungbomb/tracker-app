# 每日控制台 — 打卡 & 運動追蹤

個人用的打卡計時器 + 運動天數紀錄,深色霓虹風格,手機友善。

## 功能

### 打卡計算
- 一鍵打卡,自動算出 4 小時後可離開的時間
- 即時倒數計時
- 補打卡功能(忘記打卡時可手動補登日期/時間)
- 編輯今天的打卡時間
- 本月出勤目標進度條(預設 12 天/月)
- 最近 10 筆打卡紀錄,可單筆刪除

### 運動計算
- 一鍵登記今日有運動
- 成就徽章:10、50、100、150、200、250、300、365 天
- 下個成就進度條
- 補登任何日期
- 在月曆上點綠色方格刪除錯誤紀錄

### 通用
- 設定面板可匯出 / 匯入 JSON 備份
- 資料用 `localStorage` 儲存在這個瀏覽器
- iOS Safari「加到主畫面」後體驗接近原生 App

## 內建資料

第一次開啟會自動載入既有的紀錄:
- **運動 50 天**(2026/01 ~ 2026/05)
- **打卡 3 天**(5/6、5/7、5/11)

如果之後想清空重來,在瀏覽器 DevTools console 執行:
```js
localStorage.clear();
location.reload();
```

## 本機跑起來

```bash
npm install
npm run dev
```

開啟 http://localhost:5173

## 打包正式版

```bash
npm run build
```

產物在 `dist/` 資料夾。任何靜態網站主機(Vercel、Netlify、Cloudflare Pages、GitHub Pages)都可以放。

## 部署到 Vercel(推薦,免費)

1. 把這個專案推到 GitHub
2. 去 [vercel.com](https://vercel.com),用 GitHub 帳號登入
3. New Project → Import → 選這個 repo
4. Framework Preset 應該會自動偵測為 **Vite**,按 Deploy 即可
5. 1~2 分鐘後給你一個 `xxx.vercel.app` 網址
6. 手機 Safari 開網址 → 分享 → 加到主畫面

## 未來想做的事

### 換成雲端同步(換手機也能用)
目前資料只存在當下瀏覽器。如果想跨裝置同步,有幾條路:

**方案 A:Supabase**(推薦,免費額度大)
- 把 `src/App.jsx` 開頭的 `storage` 物件改成 Supabase client
- 加上一個密碼欄或 magic link 登入
- 建立 `tracker_data` 表(欄位:`key`、`value JSONB`、`user_id`)

**方案 B:Cloudflare Workers + KV**
- 用免費的 Cloudflare KV 當後端
- 速度快、設定簡單

**方案 C:Firebase**
- Google 帳號登入直接用
- 比 Supabase 稍微容易

需要這部分可以叫 Claude Code 幫忙加。

## 專案結構

```
tracker-app/
├── index.html              # HTML 入口
├── package.json            # 套件清單
├── vite.config.js          # Vite 設定
├── tailwind.config.js      # Tailwind 設定
├── postcss.config.js       # PostCSS 設定
├── public/
│   └── favicon.svg         # 網站圖示
└── src/
    ├── main.jsx            # React 入口
    ├── index.css           # 全域 CSS
    └── App.jsx             # 主程式(所有邏輯都在這)
```

## 主要技術
- React 18
- Vite 5
- Tailwind CSS 3
- lucide-react(圖示)

## 給 Claude Code 的提示

如果你接手要改東西,主要編輯點:

| 想改什麼 | 改哪 |
|---------|------|
| 每天工作時數 | `App.jsx` 的 `WORK_HOURS_MS` |
| 每月打卡目標天數 | `App.jsx` 的 `MONTHLY_TARGET` |
| 成就里程碑 | `App.jsx` 的 `MILESTONES` |
| 初始預載資料 | `App.jsx` 的 `INITIAL_EXERCISE` / `INITIAL_PUNCH` |
| 整體配色 | `App.jsx` 的 className 主色 `lime-400` |
| Storage 後端 | `App.jsx` 的 `storage` 物件 |
