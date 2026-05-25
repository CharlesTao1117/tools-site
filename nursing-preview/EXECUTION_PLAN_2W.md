# EXAM-AI MVP 2 週執行計畫

> 路線 A：LINE Bot Free Plan + Cloudflare Workers + 概念集群 drill
> 起點：2026-05-23 | 目標：可推送每日一題 + 錯題 drill

---

## 前置條件

| 項目 | 狀態 | 備註 |
|:-----|:----:|:------|
| LINE Developers 帳號 | ❌ 需註冊 | https://developers.line.biz/console/ |
| LINE Messaging API Channel | ❌ 需建立 | Free plan，500 好友上限 |
| Cloudflare 帳號 | ✅ 已有 | tools-site 已在 Pages |
| 題庫資料 (questions.json) | ✅ 已有 | 2,271 題 |
| 概念集群 (concept_clusters.json) | ✅ 已完成 | 22 集群 / 73 題 |
| 引流頁話術整合 | ✅ 已完成 | 04-nursing-exam-drug-calc.html |

---

## Week 1：LINE Bot 通道 + Workers 後端

### Day 1-2：LINE Bot 註冊與設定

| 步驟 | 操作 | 預估時間 |
|:-----|:-----|:--------:|
| 1 | 登入 LINE Developers Console → 建立 Provider | 5 min |
| 2 | 建立 Messaging API Channel（選擇 Free plan） | 15 min |
| 3 | 取得 Channel Secret + Channel Access Token | 5 min |
| 4 | 設定 Webhook URL（指向 Workers） | 5 min |
| 5 | 關閉 Auto-reply messages（避免干擾） | 2 min |
| 6 | 設定 LINE Official Account 基本資料（大頭貼、簡介） | 15 min |

**產出：** LINE Bot 可用（可接收 webhook 發回覆）

> ⚠️ LINE Free plan 限制：500 好友上限、不可群發 push（但可針對 individual user push by user ID）

### Day 3-4：Cloudflare Workers 專案初始化

```
nursing-line-bot/
├── src/
│   ├── index.js          # Webhook handler
│   ├── questions.js      # 題庫載入（import concept_clusters.json）
│   ├── user-store.js     # KV 操作封裝
│   └── reply.js          # LINE reply message builder
├── cron/
│   └── daily-push.js     # Cron Trigger 每日推送
├── wrangler.toml         # Workers 設定
├── package.json
└── concept_clusters.json # 已存在 nursing-preview/
```

| 步驟 | 操作 | 預估時間 |
|:-----|:-----|:--------:|
| 1 | `npm create cloudflare` 初始化專案 | 10 min |
| 2 | 安裝 `@line/bot-sdk`（或手動驗證 signature） | 5 min |
| 3 | 設定 `wrangler.toml`（KV namespace binding） | 10 min |
| 4 | 部署空專案確認環境正常 | 5 min |

### Day 5：Webhook 核心 — 接收作答 + 回覆

| 步驟 | 操作 | 預估時間 |
|:-----|:-----|:--------:|
| 1 | 實作 `index.js`：驗證 LINE signature | 30 min |
| 2 | 解析使用者訊息（文字回覆 "A"/"B"/"C"/"D"） | 30 min |
| 3 | 查詢當日題目 → 比對答案 → 回覆對錯 + 解析 | 1 hr |
| 4 | 答錯時寫入 KV 記錄：`user:{id}:weak_clusters` | 30 min |
| 5 | LINE Flex Message 排版（漂亮選項卡片） | 1 hr |

**關鍵邏輯：**

```
POST /webhook
  → 驗證 signature
  → 解析 events[0]
    → 如果是「加入好友」: 回覆歡迎訊息
    → 如果是「文字訊息」:
      → 內容是 A/B/C/D:
        → 查 KV 當日題目
        → 比對答案
        → 答對: 回覆 ✅ + 解析
        → 答錯: 回覆 ❌ + 解析 + "這個概念區塊你錯了，接下來幫你 drill"
          → KV 記錄 `weak_clusters` += 本題所屬 cluster_id
      → 內容是其他: 回覆說明操作方式
```

**產出：** LINE Bot 可以互動 — 使用者傳訊息，Bot 回覆

### Day 6-7：KV 使用者狀態管理

**KV Schema（MVP 版本）：**

```
user:{userId}:profile
  → { "joined": "2026-05-25", "push_enabled": true, "current_cluster": null }

user:{userId}:stats
  → { "total_correct": 3, "total_wrong": 2, "streak_days": 1, "last_answer": "2026-05-25" }

user:{userId}:weak_clusters
  → [ "C001", "C013", "C101" ]  # 答錯過的 cluster ID 列表（去重）

daily:{date}:question
  → { "cluster_id": "C001", "question_idx": 0, "pushed_at": "08:00" }
```

| 步驟 | 操作 | 預估時間 |
|:-----|:-----|:--------:|
| 1 | KV namespace 建立（wrangler CLI） | 5 min |
| 2 | 實作 user-store.js（get/set 封裝） | 30 min |
| 3 | 整合進 webhook handler | 30 min |
| 4 | 寫測試：答錯 → KV 記錄 → 查詢正確 | 30 min |

---

## Week 2：出題邏輯 + 部署上線

### Day 8-9：Cron Trigger 每日推送

| 步驟 | 操作 | 預估時間 |
|:-----|:-----|:--------:|
| 1 | 實作選題邏輯：先選弱點 cluster，無弱點則選高頻題 | 1 hr |
| 2 | 實作 cron/daily-push.js（每天 08:00 觸發） | 1 hr |
| 3 | 推送 LINE Push Message（含選項按鈕） | 30 min |
| 4 | 記錄 `daily:{date}:question` 到 KV | 15 min |

**選題邏輯（最重要的演算法）：**

```
getDailyQuestion(user):
  # 1. 優先從使用者答錯過的 cluster 出題
  weak = KV.get(user, 'weak_clusters')
  if weak is not empty:
    # 選還沒答完的 cluster
    for cluster_id in weak:
      cluster = clusters[cluster_id]
      answered = KV.get(user, 'cluster:{cluster_id}:answered') or []
      unanswered = [q for q in cluster.questions if q.qid not in answered]
      if unanswered:
        return (cluster, unanswered[0])
  
  # 2. 無弱點記錄 → 從高頻題隨機抽
  high_freq = clusters.filter(difficulty='high')
  return random.choice(high_freq)
```

**產出：** 每天早上 08:00，使用者自動收到 1 題推送

### Day 10：概念集群 drill 流程整合

| 步驟 | 操作 | 預估時間 |
|:-----|:-----|:--------:|
| 1 | 答錯時回覆中標記「接下來 X 天 drill 同概念」| 30 min |
| 2 | 實作 cluster 進度追蹤：`cluster:{id}:answered` 記錄 | 30 min |
| 3 | 一個 cluster 內所有題目答完 → 通知「已強化完成！」| 30 min |
| 4 | 答對 2 次同 cluster → 提前釋放，換新 cluster | 15 min |

### Day 11：歡迎訊息 + 選單

```
使用者加入好友 → 收到 Flex Message：

┌─────────────────────────┐
│ 🎯 AI 國考助教            │
│                          │
│ 每天 1 題，AI 幫你抓弱點   │
│                          │
│ ✅ 每日一題推送            │
│ ✅ 錯題概念集中 drill      │
│ ✅ 答題統計               │
│                          │
│ 準備好了嗎？明天 08:00     │
│ 第一題準時送達 👊          │
│                          │
│ [開始練習] [查看統計]      │
└─────────────────────────┘
```

| 步驟 | 操作 | 預估時間 |
|:-----|:-----|:--------:|
| 1 | 設計歡迎 Flex Message | 30 min |
| 2 | 設計 Rich Menu（查看統計、說明、分享） | 30 min |
| 3 | 整合 follow event handler | 15 min |

### Day 12：引流頁連動（CTA 串接）

| 步驟 | 操作 | 預估時間 |
|:-----|:-----|:--------:|
| 1 | 建立 LINE Add Friend 連結（`line://oa/{botId}`） | 5 min |
| 2 | 更新 04-nursing-exam-drug-calc.html 的 CTA 連結 | 5 min |
| 3 | 更新 nursing-preview 其他 3 個工具頁的 CTA | 15 min |
| 4 | 埋 LINE 好友數統計（方便追蹤轉換）| 15 min |

### Day 13：QA 測試

| 測試項目 | 方法 |
|:---------|:-----|
| Webhook 連通性 | ngrok → LINE Developer Webhook test |
| 答題正確 → 回覆 ✅ | 手動回覆正確答案 |
| 答題錯誤 → 回覆 ❌ + 攔截 | 手動回覆錯誤答案 |
| 答錯後次日推同一 cluster 不同題 | 等 Cron 或手動觸發 |
| 加入好友 → 歡迎訊息 | 另開 LINE 掃 QR Code |
| KV 資料一致性 | 檢查 answer count 正確 |
| Cron Trigger 排程 | 驗證 wrangler cron 配置 |
| 推播到達 | LINE 官方帳號顯示送達數 |

### Day 14：上線 + 種子用戶

| 步驟 | 操作 | 預估時間 |
|:-----|:-----|:--------:|
| 1 | 部署 Workers 正式環境 | 15 min |
| 2 | LINE Webhook URL 切到正式 | 5 min |
| 3 | 設定 LINE QR Code 在引流頁顯示 | 10 min |
| 4 | 自推：你加 LINE Bot 測試完整流程 | 15 min |
| 5 | 可選：分享到 LINE 國考群組 / Dcard | 30 min |

---

## 總人力預估

| 項目 | 天數 | 主要工作 |
|:-----|:----:|:---------|
| LINE 通道設定 | 2 天 | 註冊、API key、Webhook 設定 |
| Workers 初始化 | 2 天 | 專案架構、KV、部署 |
| Webhook 核心 | 1 天 | 接收作答、回覆對錯、記錄狀態 |
| KV 使用者管理 | 1 天 | Schema 設計、讀寫封裝 |
| Cron 每日推送 | 2 天 | 選題邏輯、推送、記錄 |
| Cluster drill 流程 | 1 天 | 答錯追蹤、cluster 進度、釋放條件 |
| 歡迎 + 選單 | 1 天 | Flex Message、Rich Menu |
| CTA 連動 | 1 天 | 引流頁 QR Code、連結 |
| QA + 上線 | 2 天 | 測試、部署、上線 |
| **合計** | **13 天** | |

---

## 風險與緩解

| 風險 | 影響 | 緩解方案 |
|:-----|:-----|:---------|
| LINE Free plan 500 好友限制 | MVP 驗證期約 1-2 個月 | 確認 PMF 後升 Light Plan (NT$1,600/mo) |
| KV 讀取延遲 200-600ms | 使用者體驗略慢 | LINE 回覆可延遲到 5 秒內都算正常 |
| Cron Trigger 未觸發 | 使用者沒收到題目 | Workers logs 可查，寫 retry 機制 |
| 使用者答非所問（非 A/B/C/D） | Bot 不知道怎麼回 | 一律回覆「請回覆 A/B/C/D 選擇答案」|
| Workers 免費額度 10 萬 req/day | 500 人 × 每天 2-3 次互動 = 1500 req/day | 遠低於限制，不必擔心 |

---

## 相關檔案

- 策略文件 → `nursing-preview/覆盤總結_EXAM_AI_完整策略.md`
- 概念集群 → `nursing-preview/concept_clusters.json` (22 clusters / 73 questions)
- 引流頁面 → `nursing-preview/04-nursing-exam-drug-calc.html`（已含話術整合）
- 題庫源 → `EXAM-AI-ASSISTANT/site/data/questions.json` (2,271 題)
- 高頻分析 → `EXAM-AI-ASSISTANT/site/data/high_frequency.json`

---

## 一句話總結

> **Day 0-7: 讓 LINE Bot 能接收訊息回覆答案 → Day 8-14: 讓它每天自動推送 + 幫使用者的弱點 cluster drill → 上線。**
