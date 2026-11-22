# 弱點頁視覺化 — 資料欄位盤點（2026-11-22）

任務：report.html 加「概念集群掌握度雷達」+「學習時數分佈圖」。

## 當時缺欄（本機 localStorage）

| 缺欄 | 影響 | 狀態 |
|---|---|---|
| 每集群作答總數（attempts per cluster） | 無法算真實掌握度（(答對)/(總作答)），只能用答錯集中度替代 | ✅ 已補：quiz.html `showResults()` 新增 `exam_ai_cluster_attempts`（累計 {attempts, wrong} per clusterId） |
| 每次測驗作答時長（seconds per session） | 無法算每日學習時數，只能用題數替代 | ✅ 已補：quiz.html 新增 `exam_ai_attempts`（每回合 {date, total, correct, wrong, seconds, subject}） |
| 逐題時間戳 / 逐題耗時 | 無法精確計算每題秒數（目前以回合起訖時間差近似） | ❌ 仍未補：`answerLog` 無時間欄位，待未來需求再加大 |
| bekao_stats.total_answered / total_correct | quiz 流程從未寫入 bekao_stats（只有 diagnosis.html 寫預設值），報告頁關鍵數字恆為 0 | ❌ 仍未補：report.html 關鍵數字仍讀 bekao_stats，與本文件的圖表資料源（exam_ai_attempts）不同步，待統一 |

## 降級顯示策略（不硬編造）

- 雷達圖：有 attempts → 顯示真實掌握度（藍色多邊形）；無 attempts → 顯示「答錯集中度」（紅色多邊形），note 明確標註缺欄位。無任何資料 → 顯示空狀態提示。
- 時數分佈：有 seconds → 顯示每日分鐘數；無 → 顯示每日題數並標註缺欄位。無資料 → 空狀態提示。

## 一併修復的既有 bug

- quiz.html 主腳本自 2026-06-14（commit 36e5a84，品牌更名那次）就有一行重複的 `]);`（Promise.all 收尾），造成整個刷題頁 JS SyntaxError（線上 quiz 頁實際上是壞的）。本次已刪除該行，全部 nursing 頁面 inline script 已通過 `node --check`。

## 相關 localStorage keys

- `exam_ai_attempts`（上限 500 筆，超出裁舊）
- `exam_ai_cluster_attempts`（累計，無上限）
- 已加入 settings.html 的重置清單與匯出清單。
