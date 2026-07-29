# 易考通 Enriched Explanations 生產日誌

## 2026-07-27 11:00 時段（深度工作 #11）

### 目標
啟動 Enriched 題解擴產（60 → 500+ 題），優先藥理學集群

### 任務 1：Dry-Run 結果
**指令**: batch_enrich_pharmacology.py --dry-run (模擬 → 因 cron 環境無 API key 改為獨立分析腳本)

**狀態**: ✅ 完成

**分析結果**:
| 量測項目 | 數值 |
|---|---|
| questions.json 總題數 | 7,704 |
| concept_clusters 集群 | 22 |
| 藥理學集群（C012-C018, C101-C104） | 409 題 |
| 藥理學相關題目（keyword + subject 匹配） | 1,046 題 |
| 已 enriched（全部） | 61 題 (⏫ +1) |
| 已 enriched（藥理學） | ~22 題 |
| 待 enriched（藥理學） | ~1,024 題 |
| 首批 Batch（50題）可覆蓋 | 1 批 |

**集群細項**:
- C012 止痛與麻醉: 80 題
- C013 抗生素與抗菌藥物: 46 題
- C014 中樞神經藥物: 29 題
- C015 藥物計算與給藥: 88 題
- C016 心血管藥物: 53 題
- C017 內分泌與代謝藥物: 86 題
- C018 化療與免疫藥物: 19 題
- C101-C104 藥物計算: 8 題

### 任務 2：第一波生產
**指令**: --batch-size 50

**狀態**: ⚠️ 部分完成
- 已更新 batch_enrich_pharmacology.py：generate_enriched_for_question() 從 skeleton 改為 LLM API 調用
- 已測試 delegate_task 生產流程（1 題成功）
- 新增 enriched: `111030_s0301_q49`（Dobutamine β1 受體作用機轉, C012 止痛與麻醉）
- 版本更新: 2026-07-27
- 備份留存: enriched_explanations_backup_20260727.json

**阻礙**: cron shell 環境無 OPENCODE_GO_API_KEY 環境變數
- 已確認：API key 透過 Hermes 內部管理，未 export 至 shell
- batch_enrich_pharmacology.py 無法直接從 cron 呼叫 LLM
- **解決方案**: 使用 `delegate_task` 子代理生成（每題 ~150s, 成本較高）；或將 API key 設為 shell env var

### 任務 3：生產日誌建立
**指令**: 已完成 qid 列表、預計產能、完成時間

**已完成 enriched qids（61 題）**:

**藥理學相關（~22 題）**:
- C012 止痛與麻醉: 111030_s0301_q49, 111030_s0301_q50, 111030_s0302_q13, 111030_s0302_q17, 111030_s0303_q38
- C013 抗生素/基礎醫學: 112030_s0101_q31, 112030_s0101_q32, 112030_s0101_q33, 112030_s0101_q36, 112030_s0101_q37, 112160_s0101_q33, 112160_s0101_q35, 112160_s0101_q36, 112160_s0101_q37, 112160_s0101_q39, 112030_s0101_q01, 113160_s0101_q03, 114160_s0101_q01, 115030_s0101_q01, 110030_s0301_q01
- C014/015/016: 混雜於基本護理學、內外科護理學中

**非藥理學（~39 題）**:
C001(C01)-C011 系列 + C017(C02)-C021 系列

### 產能預估
- 目前 enriched 產能: 1 題 / 150s（via delegate_task）
- 預估批量 50 題: ~125 min（若使用 delegate_task）
- 建議優化方向: 1) 將 API key 設為 cron 環境變數 2) 改用 batch_enrich_pharmacology.py 直接調用

### 下一步
1. **繼續擴產**: 若需加速，需將 OPENCODE_GO_API_KEY 加入 cron shell profile
2. **可用選項**: 在 ~/.hermes/config.yaml 設定 `approvals.cron_mode: approve` 以啟用 script 執行
3. **今日產出**: 60 → 61 (+1 enriched)
4. **其他 pending**: untracked 清理、sitemap lastmod 刷新（35 條過期）、LINE Bot Day 61

### 資料檔案
- `data/enriched_explanations.json` — 61 entries, v2026-07-27
- `data/enriched_explanations_backup_20260727.json` — v2026-07-02 原始備份
- `scripts/batch_enrich_pharmacology.py` — 已更新 API 調用，待環境就緒後啟用
- `scripts/cron_ee_dry_run.py` — dry-run 分析腳本
