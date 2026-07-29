#!/usr/bin/env python3
"""
易考通 — Enriched Explanations 批次生成腳本 (Pharmacology)

目標：從 60 → 500+ 題 enriched explanations，專注藥理學主題。
批次處理，支援中斷續傳，自動跳過已完成題目。

用法:
  python3 scripts/batch_enrich_pharmacology.py                # 預設批次（50題）
  python3 scripts/batch_enrich_pharmacology.py --dry-run      # 僅統計不生成
  python3 scripts/batch_enrich_pharmacology.py --batch-size 100
  python3 scripts/batch_enrich_pharmacology.py --clusters C012 C013
  python3 scripts/batch_enrich_pharmacology.py --resume       # 從上次中斷處續跑

Schema (enriched_explanations.json):
  {
    "by_qid": {
      "<qid>": {
        "explanation_simple": "通俗類比解釋（國中生能懂）",
        "why_wrong": { "A": "為何A錯", "B": "為何B錯", ... },
        "clinical_case": "臨床案例（含病人背景、情境、護理措施、結果）",
        "difficulty": 1-5,
        "topic": "主題名稱",
        "cluster": "CXXX 概念集群名稱"
      }
    }
  }
"""

import json
import os
import sys
import time
import argparse
from datetime import datetime
from collections import OrderedDict

# ── Paths ──
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")
QUESTIONS_PATH = os.path.join(DATA_DIR, "questions.json")
ENRICHED_PATH = os.path.join(DATA_DIR, "enriched_explanations.json")
CLUSTERS_PATH = os.path.join(DATA_DIR, "concept_clusters.json")

# ── Pharmacology clusters (from concept_clusters.json) ──
PHARMACOLOGY_CLUSTERS = {
    "C012": "止痛與麻醉",
    "C013": "抗生素與抗菌藥物",
    "C014": "中樞神經藥物",
    "C015": "藥物計算與給藥",
    "C016": "心血管藥物",
    "C017": "內分泌與代謝藥物",
    "C018": "化療與免疫藥物",
    "C101": "點滴滴速計算",
    "C102": "藥物劑量計算",
    "C103": "藥物稀釋計算",
    "C104": "安全劑量範圍",
}

# ── Enriched schema field descriptions (for generator reference) ──
FIELD_GUIDE = {
    "explanation_simple": "通俗類比解釋，用生活化比喻讓國中生能理解該題核心概念。約 80-150 字。",
    "why_wrong": "每個選項的錯誤分析。正確選項也需說明為何正確。約 30-80 字/選項。",
    "clinical_case": "臨床情境案例：含病人背景（年齡、性別、診斷）、具體情境、護理措施、結果。約 80-150 字。",
    "difficulty": "難度 1（簡單）～ 5（困難），基於正確率或題目複雜度判斷。",
    "topic": "該題所屬的主題名稱，例如「Aspirin 藥理與禁忌」、「胰島素種類比較」。",
    "cluster": "對應的 cluster_id + 名稱，例如 'C012 止痛與麻醉'。",
}


def load_questions():
    """Load questions.json (list of dicts)."""
    with open(QUESTIONS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def load_enriched():
    """Load existing enriched explanations."""
    try:
        with open(ENRICHED_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"_comment": "EXAM-AI Private QA — Enriched Explanations", "version": None, "enriched_count": 0, "by_qid": {}}


def load_clusters():
    """Load concept_clusters.json for cluster definitions."""
    try:
        with open(CLUSTERS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def save_enriched(data, is_backup=False):
    """Save enriched explanations with atomic write."""
    tmp_path = ENRICHED_PATH + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp_path, ENRICHED_PATH)

    if is_backup:
        backup_path = ENRICHED_PATH.replace(".json", f"_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"  💾 Backup saved: {os.path.basename(backup_path)}")


def get_pharmacology_questions(questions, clusters_data=None):
    """
    Filter pharmacology-related questions using:
    1. concept_clusters.json cluster membership (primary)
    2. Keyword/pharmacology heuristics on unmatched questions (fallback)
    """
    pharm_qids = set()
    pharm_by_cluster = {}

    # Method 1: Use concept_clusters.json
    if clusters_data:
        for cluster in clusters_data.get("clusters", []):
            cid = cluster.get("cluster_id", "")
            if cid in PHARMACOLOGY_CLUSTERS:
                for q in cluster.get("questions", []):
                    qid = q.get("qid", "")
                    if qid:
                        pharm_qids.add(qid)
                        pharm_by_cluster.setdefault(cid, []).append(qid)

    # Method 2: Keyword fallback for questions not in clusters
    pharm_keywords = [
        "藥", "藥物", "劑量", "給藥", "注射", "口服", "靜脈", "肌肉", "皮下",
        "Morphine", "Aspirin", "Fentanyl", "insulin", "胰島素", "抗生素",
        "止痛", "麻醉", "鎮靜", "利尿", "降壓", "強心", "類固醇", "化療",
        "抗癌", "抗凝血", "肝素", "Heparin", "Warfarin", "抗心律", "毛地黃",
        "Digoxin", "Atropine", "Epinephrine", "Naloxone", "維生素K",
        "降血糖", "降血脂", "支氣管擴張", "抗組織胺", "疫苗", "免疫",
    ]

    unmatched = []
    for q in questions:
        qid = q.get("id", "")
        if qid and qid not in pharm_qids:
            text = q.get("text", "")
            if any(kw in text for kw in pharm_keywords):
                pharm_qids.add(qid)
                unmatched.append(qid)

    print(f"  Cluster-matched: {sum(len(v) for v in pharm_by_cluster.values())} questions")
    print(f"  Keyword fallback: {len(unmatched)} questions")
    print(f"  Total pharmacology: {len(pharm_qids)} questions")
    return pharm_qids, pharm_by_cluster


def generate_enriched_for_question(question, cluster_id=None, cluster_name=None):
    """
    Generate enriched explanation for a single question via LLM API.

    Question dict shape:
      {
        "id": "112030_s0101_q01",
        "text": "題目文字...",
        "options": { "A": "選項A", "B": "選項B", ... },
        "correct_answer": "C",
        "subject_name": "基礎醫學",
        "session_code": "112030",
        "year": 2023,
        ...
      }

    Returns: dict with keys: explanation_simple, why_wrong, clinical_case, difficulty, topic, cluster
             or None on failure.
    """
    import requests
    import os

    qid = question.get("id", "unknown")
    
    # Try multiple sources for the API key
    api_key = os.environ.get("OPENCODE_GO_API_KEY")
    if not api_key:
        # Fallback: try from HERMES config or other env vars
        api_key = os.environ.get("HERMES_OPENCODE_GO_API_KEY", "")
    if not api_key:
        print(f"    ❌ qid={qid}: No API key available (OPENCODE_GO_API_KEY not set)")
        return None

    system_prompt = BUILD_SYSTEM_PROMPT(question, cluster_id, cluster_name)
    user_prompt = BUILD_USER_PROMPT(question)
    
    payload = {
        "model": "deepseek-v4-flash",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 1500,
    }
    
    try:
        resp = requests.post(
            "https://opencode.ai/zen/go/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=120,
        )
        if resp.status_code != 200:
            print(f"    ❌ qid={qid}: API error {resp.status_code}: {resp.text[:200]}")
            return None
        
        result = resp.json()
        content = result["choices"][0]["message"]["content"]
        return parse_llm_response(content)
    
    except Exception as e:
        print(f"    ❌ qid={qid}: Exception: {e}")
        return None


def BUILD_SYSTEM_PROMPT(question, cluster_id=None, cluster_name=None):
    """
    Build system prompt for the LLM to generate enriched explanation.

    Use this as your prompt template.
    """
    return f"""你是台灣護理國考的資深家教，擅長用生活比喻教懂藥理學概念。

請為這題藥理學考題生成「豐富化解釋」(enriched explanation)：

## 輸出格式（JSON）
{json.dumps({
    "explanation_simple": "用生活化的比喻講解這題的核心概念，讓國中生也能懂。約 80-150 字。",
    "why_wrong": {
        "A": "如果A是正確選項，說明為何正確。如果A是錯誤選項，說明錯在哪裡以及正確答案是什麼。30-80字。",
        "B": "同上格式",
        "C": "同上格式",
        "D": "同上格式"
    },
    "clinical_case": "一個真實的臨床案例故事。包含：病人背景、情境、醫療團隊做了什麼、結果如何。約80-150字。",
    "difficulty": 3,
    "topic": "這題的主題名稱，例如「Aspirin 藥理作用與禁忌」",
    "cluster": f"{cluster_id} {cluster_name}" if cluster_id and cluster_name else "藥理學"
}, ensure_ascii=False, indent=2)}

## 答題原則
- explanation_simple：一定要有生活化比喻，不要只是課本解釋
- why_wrong：每個選項獨立分析，正確選項也要說明「為何正確」
- clinical_case：要有人物、情境、行動、結果，不要只是理論
- difficulty：1=簡單～5=困難
- topic：具體主題名稱（不要只寫「藥理學」）"""


def BUILD_USER_PROMPT(question):
    """Build user prompt with the actual question."""
    text = question.get("text", "")
    options = question.get("options", {})
    correct = question.get("correct_answer", "?")
    subject = question.get("subject_name", "")
    year = question.get("year", "")
    
    options_str = "\n".join([f"{k}. {v}" for k, v in options.items()])
    
    return f"""## 題目
{text}

## 選項
{options_str}

## 正確答案
{correct}

## 背景
科目：{subject}
年度：{year}"""


def parse_llm_response(response_text):
    """
    Parse LLM JSON response into enriched dict.
    Handles markdown-wrapped JSON and partial responses.
    """
    # Remove markdown code fences if present
    text = response_text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first and last fence lines
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines)

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        # Try to find JSON object
        import re
        match = re.search(r'\{.*\}', text, re.DOTALL)
        if match:
            try:
                data = json.loads(match.group())
            except json.JSONDecodeError:
                return None
        else:
            return None

    # Validate required fields
    required = ["explanation_simple", "why_wrong", "clinical_case", "difficulty", "topic", "cluster"]
    for field in required:
        if field not in data:
            print(f"    ⚠️  Missing field: {field}")
            return None

    return data


def run_batch(questions, enriched_data, pharm_qids, cluster_map, batch_size=50, resume=False):
    """
    Run batch generation.
    
    Args:
        questions: Full list of question dicts
        enriched_data: Existing enriched data
        pharm_qids: Set of pharmacology qids to process
        cluster_map: dict of {cid: [qid, ...]} from concept_clusters
        batch_size: Questions per batch
        resume: Skip already-enriched qids
    
    Returns: Updated enriched_data
    """
    by_qid = enriched_data.get("by_qid", {})
    already_done = set(by_qid.keys())
    
    if resume:
        print(f"  Resume mode: {len(already_done)} already enriched — skipping")
    
    # Build lookup: qid → question
    q_lookup = {}
    for q in questions:
        qid = q.get("id", "")
        if qid:
            q_lookup[qid] = q

    # Build cluster mapping: qid → (cluster_id, cluster_name)
    qid_to_cluster = {}
    for cid, qids in cluster_map.items():
        cname = PHARMACOLOGY_CLUSTERS.get(cid, "藥理學")
        for qid in qids:
            qid_to_cluster[qid] = (cid, cname)

    # Filter and sort pharmacology questions
    to_process = []
    for qid in pharm_qids:
        if resume and qid in already_done:
            continue
        if qid in q_lookup:
            to_process.append(q_lookup[qid])

    total = len(to_process)
    print(f"\n  Questions to process: {total}")
    
    if total == 0:
        print("  ✅ Nothing to process.")
        return enriched_data

    # Process in batches
    batch_start = 0
    while batch_start < total:
        batch_end = min(batch_start + batch_size, total)
        batch = to_process[batch_start:batch_end]
        
        print(f"\n{'='*60}")
        print(f"  Batch {batch_start//batch_size + 1}/{(total + batch_size - 1)//batch_size}")
        print(f"  Questions {batch_start+1}–{batch_end}/{total}")
        print(f"{'='*60}")

        for i, question in enumerate(batch):
            qid = question.get("id", "")
            idx = batch_start + i + 1
            print(f"\n  [{idx}/{total}] qid={qid} ...", end=" ")
            
            cid, cname = qid_to_cluster.get(qid, (None, "藥理學"))
            
            try:
                result = generate_enriched_for_question(question, cid, cname)
            except Exception as e:
                print(f"❌ Error: {e}")
                continue

            if result is None:
                print("⏭️  skipped (skeleton)")
                continue

            # Ensure cluster field is set
            if not result.get("cluster") and cid:
                result["cluster"] = f"{cid} {cname}"

            by_qid[qid] = result
            enriched_data["enriched_count"] = len(by_qid)
            print(f"✅ (total={enriched_data['enriched_count']})")

            # Save every 10 questions (incremental)
            if (idx) % 10 == 0:
                enriched_data["version"] = datetime.now().strftime("%Y-%m-%d")
                save_enriched(enriched_data)
                print(f"  💾 Auto-saved at {idx}/{total}")

            # Rate limiting - avoid API throttling
            # time.sleep(1)

        batch_start = batch_end

        # Save after each batch
        enriched_data["version"] = datetime.now().strftime("%Y-%m-%d")
        save_enriched(enriched_data, is_backup=(batch_start >= total))
        print(f"\n  💾 Batch saved. Total enriched: {len(by_qid)}")

    return enriched_data


def dry_run(questions, enriched_data, pharm_qids, cluster_map, clusters_data):
    """Report what would be generated without running."""
    by_qid = enriched_data.get("by_qid", {})
    already_done = set(by_qid.keys())

    q_lookup = {q.get("id", ""): q for q in questions}
    
    candidates = [qid for qid in pharm_qids if qid in q_lookup]
    new_candidates = [qid for qid in candidates if qid not in already_done]

    # Per-cluster breakdown
    print("\n  📊 Cluster breakdown (new / total in cluster):")
    for cid in sorted(cluster_map.keys()):
        cname = PHARMACOLOGY_CLUSTERS.get(cid, "?")
        qids_here = cluster_map[cid]
        total = len(qids_here)
        new_count = sum(1 for qid in qids_here if qid in new_candidates)
        done_count = total - new_count
        bar = "█" * (new_count * 40 // max(total, 1)) if total > 0 else ""
        print(f"    {cid} {cname}: {new_count} new / {total} total  {bar}")

    print(f"\n  ✅ Already enriched: {len(already_done)}")
    print(f"  🆕 New to generate:  {len(new_candidates)}")
    print(f"  📈 Target total:     {len(already_done) + len(new_candidates)}")
    print(f"  📋 Batches of 50:    {(len(new_candidates) + 49)//50}")

    # Sample new questions
    if new_candidates:
        print(f"\n  📝 Sample new questions (first 5):")
        for qid in new_candidates[:5]:
            q = q_lookup.get(qid, {})
            text = q.get("text", "")[:80]
            print(f"    {qid}: {text}...")


def main():
    parser = argparse.ArgumentParser(description="易考通 Pharmacology Enriched Explanations Batch Generator")
    parser.add_argument("--dry-run", action="store_true", help="Only count/stats, no generation")
    parser.add_argument("--batch-size", type=int, default=50, help="Questions per batch (default: 50)")
    parser.add_argument("--clusters", nargs="+", help="Specific cluster IDs to process (e.g., C012 C013)")
    parser.add_argument("--resume", action="store_true", help="Skip already-enriched qids")
    args = parser.parse_args()

    print(f"🧬 易考通 — Enriched Explanations Batch Generator (Pharmacology)")
    print(f"   Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"   Batch size: {args.batch_size}")
    print()

    # 1. Load data
    print("📂 Loading data...")
    questions = load_questions()
    print(f"   questions.json: {len(questions)} questions")

    enriched_data = load_enriched()
    print(f"   enriched_explanations.json: {enriched_data.get('enriched_count', 0)} enriched ({len(enriched_data.get('by_qid', {}))} entries)")

    clusters_data = load_clusters()
    if clusters_data:
        print(f"   concept_clusters.json: {clusters_data.get('meta', {}).get('total_clusters', '?')} clusters")
    else:
        print("   concept_clusters.json: not found (keyword-only fallback will be used)")

    # 2. Filter pharmacology questions
    print("\n🔬 Filtering pharmacology questions...")
    pharm_qids, cluster_map = get_pharmacology_questions(questions, clusters_data)

    # Filter by specific clusters if requested
    if args.clusters:
        filtered_qids = set()
        filtered_map = {}
        for cid in args.clusters:
            if cid in cluster_map:
                filtered_qids.update(cluster_map[cid])
                filtered_map[cid] = cluster_map[cid]
        pharm_qids = filtered_qids
        cluster_map = filtered_map
        print(f"\n   Filtered to clusters: {', '.join(args.clusters)}")
        print(f"   Questions in selected clusters: {len(pharm_qids)}")

    # 3. Dry-run or execute
    if args.dry_run:
        print("\n📋 DRY RUN — no generation will occur")
        dry_run(questions, enriched_data, pharm_qids, cluster_map, clusters_data)
    else:
        print("\n⚙️  Starting batch generation...")
        enriched_data = run_batch(
            questions=questions,
            enriched_data=enriched_data,
            pharm_qids=pharm_qids,
            cluster_map=cluster_map,
            batch_size=args.batch_size,
            resume=args.resume,
        )
        print(f"\n{'='*60}")
        print(f"✅ Generation complete!")
        print(f"   Total enriched: {enriched_data.get('enriched_count', 0)}")
        print(f"   Saved to: {ENRICHED_PATH}")
        print(f"{'='*60}")

    print(f"\n🏁 Finished: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
