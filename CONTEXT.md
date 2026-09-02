# CONTEXT.md — tools-site 共享語言

Project: CharlesTao1117/tools-site (Cloudflare Pages, auto-deploy from main).
Audience: AI agents working in this repo. Use these terms exactly as defined; when coining a new term, add it here in the same commit.

## 站台結構

- **Tool Site（工具網站）**: 本 repo 的英文主站，首頁 `index.html`。所有通用工具目錄 = 一個 tool（`age-calculator/`, `bmi-calculator/`, `qr-code-generator/` 等）。
- **Nursing（護理工具站）**: `nursing/` 目錄，獨立的護理師國考產品（tools-nurse.tw），有自己的部署流程（`nursing/DEPLOY.md`）。**English-only 規則適用於 Tool Site；Nursing 介面以 zh-TW 為主。**
- **Tool（工具頁）**: 一個自包含目錄，含 `index.html` + 專屬 CSS/JS。新 tool 頁必須複製 `templates/article_tool_template.html` 起步。
- **Philippine Translation（菲國文件翻譯）**: `philippine-document-chinese-translation/`，含 Cloudflare Worker API（`api/`，有獨立 node_modules）。不要把它的 node_modules 納入主站任何掃描/部署範圍。

## 設計系統

- **premium.css**: `common/premium.css`，全站唯一設計系統（v2，Linear/Vercel/Stripe 風格）。CSS variables 以 `--bg-*` `--text-*` `--border-*` 命名。新頁面**必須** link 它，禁止引入新的設計框架或自造變數。
- **Design consistency（設計一致性）**: 最高優先級規則。任何新頁面動工前先讀 2-3 個現有頁面（`age-calculator/`、`nursing/index.html`）對齊 nav 結構與 `page-wrap` 版面。不參考 handytools.xyz 或 tools-nurse.tw 以外的設計。
- **nav / page-wrap**: 全站共用導覽列與內容容器 class，定義在 premium.css；新頁直接沿用。
- **i18n.js**: `common/i18n.js` 雙語引擎。`data-i18n` 屬性 + `i18n.register({key: {en, zh}})`。預設 English；`localStorage('lang')` 覆蓋。

## Nursing 資料模型

- **Question（題目）**: `nursing/data/questions.json`（7704+ 題）。欄位：`id`（格式 `{session_code}_{subject_code}_q{NN}`）、`number`、`text`、`options`（A-D）、`correct_answer`、`year`、`exam_round`（第一次/第二次）、`subject_id`。
- **qid**: 題目的全域唯一 ID，即上式 `id`。所有解題資料以 qid 為鍵。
- **Enriched Explanation（富解題）**: `nursing/data/enriched_explanations.json`，`by_qid` 映射。欄位固定為 `explanation_simple`（比喻式白話解題）、`why_wrong`（{A,B,C,D} 各選項錯因）、`clinical_case`（情境案例）、`difficulty`（1-3）、`topic`、`cluster`。目標 500+ 題（`enriched_count`）。
- **Concept Cluster（概念簇）**: `nursing/data/concept_clusters.json`，22 簇，`cluster_id` 格式 `C001`-`C022`。核心產品差異化：答錯 → 同簇異形式題目再練。簇名格式 `C012 止痛與麻醉`（ID+空格+中文名）。
- **Subject（科目）**: 五科：基礎醫學(`basic_medical`)、基本護理學、內外科護理學、產兒科護理學、精神科與社區衛生護理學。`subject_code` 如 `s0101`。
- **Session Code（考次代碼）**: 如 `112030` = 民國112年第030次（`session_code` + `exam_round` 共同決定一場考試）。
- **Data backups（資料備份）**: `questions_backup_*.json` / `enriched_explanations_backup_*.json` 為時間點快照，**只增不刪**；修改正式檔前必須先新增 backup。

## 部署與發佈

- **CF Pages deploy**: push 到 `main` → Cloudflare Pages 自動部署。本地不用 build。
- **CF token 限制**: 現有 token **沒有** Pages 權限；需要 Pages 操作時明確告知使用者手動執行。
- **sitemap.xml / robots.txt / ads.txt**: 根目錄層級，新增 tool 頁後要同步更新 sitemap。

## 工作流詞彙

- **EXAM-AI**: 易考通（前身 備考通）專案 lane，Nursing 產品的開發代號。
- **TOOL-WEBSITE**: 工具站 lane。
- **trust pages**: `about/`、`contact/`、`privacy-policy/`、`terms/` 四頁，AdSense 審查用的信任頁面組合。
- **P0/P1/P2**: Kanban 優先級。P0 = 阻塞上線或收入的。
- **review.html**: `nursing/review.html`，錯題複習頁（SM-2 間隔重複 + 錯因圖表）。
- **high-yield.html**: 高頻考點頁。
