# 題源追溯驗證報告（Next#4）

**日期**: 2026-11-25
**執行者**: HM（cron deep work 09:00，Next#4 題源追溯驗證狀態完整化）
**驗證對象**: `tools-site-work/nursing/data/`（母本 working copy）＋ live `anycalculator.site/nursing/`
**治理文件**: `AI-Business-OS/04_Playbooks/projects/EXAM-AI/07_Inbox_Now_Next.md`

---

## 0. 重要修正：上線規模基準

- 計畫文字「7,704 母本 → 3,384 上線題」**已過時**。3,384 = source_registry.md（2026-06-03 版）僅記載 2022–2026 共 12 場次的舊快照。
- 實況：母本 7,704 題、23 場次（2017–2026第一次）；**live `questions.json` 與 working copy 逐題 JSON 完全一致（7,704 = 7,704，diff = 0）**，PWA manifest 亦標示 7,704 題。
- 結論：上線規模 = 7,704 題，非 3,384。registry JSON（meta）與 live 一致，registry **md 落後**（僅 12 場次）。

## 1. 出處標記完整性（逐題核對 7,704）

必要出處欄位：`id / session_code / year / exam_round / subject_code / subject_id / subject_name / number`

| 檢核項 | 結果 |
|---|---|
| ID 格式（`{session}_{subject}_q{NN}`） | 7,704/7,704 合格（0 異常） |
| ID ↔ 欄位一致性（session/subject/number 與 id 互核） | 0 不符 |
| 8 個出處欄位缺漏 | 7,702/7,704 完整；**2 題缺 `options`**（見 §3） |
| 場次題數 vs registry JSON `questions` | 23/23 場次完全相符（含 108020=320 特例） |

## 2. 答案追溯（驗證狀態核心）

- `correct_answer` 缺漏：**616 題（92.01% 覆蓋，7,088/7,704）**。
- 逐場次缺漏數與 `source_registry.json` 各場次 `missing_answers` **完全一致（23/23）** → 所有缺漏皆已註冊、可追溯，非未知缺口。
- 缺漏成因（registry known_issues）：106–110 年 grid parser 座標偏差 ~10%、108020 精神科 PDF 損壞、111110 精神科答案 PDF 缺失、111030/111110 缺口 ~20%。
- 2023 年起（112030/112160 完整；112180 起僅零星 1–4 題）答案覆蓋近乎全滿。

## 3. 發現的資料缺陷（registry 未登記，需補）

| QID | 缺失 | 內容 |
|---|---|---|
| `113030_s0105_q48` | `options`（2024第一次 精神科） | 長照十年計畫題，答案 A 但無選項 |
| `110030_s0303_q74` | `options`（2021第一次 內外科） | 血液透析高血鉀題，答案 C 但無選項 |

- 影響：live quiz 對這 2 題會渲染出無選項題目（用戶不可作答）→ **P1 資料修復項**（從考選部/5138 原始 PDF 回填選項）。
- registry `known_issues` 未列入 → 本次驗證新發現。

## 4. Enriched / Cluster 連結

- `enriched_explanations.json`：1,500 題（version 2026-11-21），live 與 working copy 一致；by_qid **0 孤兒**（全部可回指母本 id）。
- 年度分布：2023=868、2024=539 為主力；2019–2022 合計僅 77 題、2025–2026 僅 17 題 → 近一年新題幾乎無解析，enriched 覆蓋呈「2023–2024 峰值」。
- `concept_clusters.json`：22 clusters / 433 題，live 與 working copy 一致（2026-05-23 版）。

## 5. 驗證結論

1. **題源追溯狀態：完整且自洽** — 每題均有可回推至「考選部官方平台 → 5138 鏡像 → Google Drive PDF → pymupdf 解析」的場次級出處鏈（session/year/round/subject），23 場次題數與缺漏數 100% 對帳相符。
2. **上線一致**：questions / enriched / clusters 三檔 live == working copy，題源即上線、上線即題源。
3. **殘餘缺口（已量化、已註冊）**：616 題缺答案（92.01% 覆蓋）+ 2 題缺選項（本次新發現，待登記）。
4. **文件債**：`source_registry.md` 停在 12 場次/3,384（2026-06-03 版），與 JSON/live 脫鉤 — 已在 md 頂部加註指向 JSON 為準。

## 6. 建議後續（不阻塞）

- 補 2 題 options（P1，官方 PDF 回填）。
- registry `known_issues` 增補上列 2 題。
- enriched 補題優先 2025–2026 新考次（僅 23 題有解析）。
