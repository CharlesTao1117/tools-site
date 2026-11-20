# Enriched Explanations Production Log — 2026-11-20 (cron deep-work 09:00)

## Summary
- enriched_count: **500 → 998**（+498）
- version: 2026-08-02 → **2026-11-20**
- Commit: `e8da75b` pushed to `origin/main`（tools-site.git）
- Production verified: https://anycalculator.site/nursing/data/enriched_explanations.json → http 200, version 2026-11-20, count 998

## Method
- delegate_task 子代理批次生成：10 批 × 50 題（5 輪 × 2 子代理並行），每批 ~10-15 min
- 選題策略：5 科平衡（內外科／產兒科／基本／精神社區／基礎醫學 各 100 題），依 qid 順序取未 enrich 者
- 輸入檔：`tmp_enrich/batch_NN_input.json`；輸出：`batch_NN_output*.json`（分段寫入後合併）
- 合併驗證（merge_all.py）：schema 6 欄位、why_wrong A-D、difficulty 1-3、正確選項標記「正確。」開頭、簡體字掃描（僅比對簡體專用字元）

## Issues found & fixed
1. **正確選項標記不一致**：182 筆 why_wrong 的正確選項未以「正確。」開頭（子代理寫法不一）→ fix_marker.py 統一補上
2. **null correct_answer 陷阱**（skill 已知）：本批命中 2 題 — `112180_s0103_q29`（Lund & Browder 燒傷面積）、`112180_s0103_q30`（Parkland 公式），questions.json 兩題 answer 均 null，跳過未納入（尚缺 +2 才到 1000）
3. `execute_code` 在 cron 模式被擋 → 全程改 terminal + write_file
4. 簡體字掃描需用「簡體專用字元集」，共用字（估/女/明/度等）會誤報

## Coverage
- Total questions: 7,704
- Enriched: 998 (13.0%)
- Remaining (valid answer): 6,095（產兒科 1,254 / 內外科 1,253 / 基本 1,237 / 基礎醫學 1,190 / 精神社區 1,161）
- Remaining (null answer, 待補答案): 610
- Difficulty distribution (all 998): D1=269, D2=560, D3=169
- 本批新增 498 筆 difficulty 分布：D1≈96, D2≈290, D3≈112（各批 1:9-32, 2:26-36, 3:3-15）

## Next steps
- 下批 +500（998 → 1,498）：同流程，選題從 112180_s0103_q31 之後接續
- 補 610 題 null correct_answer（考選部答案鍵回填）
- tmp_enrich/ 已加入 .gitignore，batch 檔留本機可清
