#!/usr/bin/env python3
"""
EXAM-AI Cluster Drill Engine
=============================
Core logic: user answers wrong → find cluster → push different-form question from same cluster.
Can run as CLI prototype or be imported by LINE Bot backend.
"""
import json, random
from datetime import datetime
from pathlib import Path

DATA_DIR = Path("/Users/calmestao/Desktop/tools-site/nursing-preview")
CLUSTERS_FILE = DATA_DIR / "concept_clusters.json"

# ── In-memory user state (KV-compatible structure) ──
class UserState:
    """Simulates KV store. In production, swap for Cloudflare KV."""
    def __init__(self, filepath: Path = None):
        self.filepath = filepath or DATA_DIR / "drill_state.json"
        self.data = {}
        if self.filepath.exists():
            with open(self.filepath) as f:
                self.data = json.load(f)

    def save(self):
        with open(self.filepath, "w") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    def get_weak_clusters(self, user_id: str) -> list:
        return self.data.get(user_id, {}).get("weak_clusters", [])

    def add_weak_cluster(self, user_id: str, cluster_id: str):
        if user_id not in self.data:
            self.data[user_id] = {"weak_clusters": [], "drill_history": []}
        weak = self.data[user_id]["weak_clusters"]
        if cluster_id not in weak:
            weak.append(cluster_id)

    def record_drill(self, user_id: str, cluster_id: str, question_id: str, correct: bool):
        if user_id not in self.data:
            self.data[user_id] = {"weak_clusters": [], "drill_history": []}
        self.data[user_id]["drill_history"].append({
            "cluster_id": cluster_id,
            "qid": question_id,
            "correct": correct,
            "timestamp": datetime.now().isoformat()
        })
        if correct:
            # If answered correctly 3+ times in a row for this cluster, remove from weak
            recent = [d for d in self.data[user_id]["drill_history"][-10:]
                      if d["cluster_id"] == cluster_id]
            correct_streak = 0
            for d in reversed(recent):
                if d["correct"]:
                    correct_streak += 1
                else:
                    break
            if correct_streak >= 3:
                weak = self.data[user_id]["weak_clusters"]
                if cluster_id in weak:
                    weak.remove(cluster_id)

    def get_recent_drills(self, user_id: str, cluster_id: str, limit: int = 10) -> list:
        return [d for d in self.data.get(user_id, {}).get("drill_history", [])
                if d["cluster_id"] == cluster_id][-limit:]


# ── Cluster engine ──
class ClusterDrillEngine:
    def __init__(self, clusters_file: Path = CLUSTERS_FILE):
        with open(clusters_file) as f:
            self.data = json.load(f)
        self.clusters = {c["cluster_id"]: c for c in self.data["clusters"]}

    def find_cluster_by_qid(self, qid: str) -> str | None:
        """Find which cluster a question belongs to."""
        for cid, c in self.clusters.items():
            for q in c["questions"]:
                if q["qid"] == qid:
                    return cid
        return None

    def get_next_drill_question(self, cluster_id: str, exclude_qids: list[str] = None) -> dict | None:
        """Get a different-form question from the same cluster, excluding already-seen ones."""
        if cluster_id not in self.clusters:
            return None
        exclude = set(exclude_qids or [])
        available = [q for q in self.clusters[cluster_id]["questions"]
                     if q["qid"] not in exclude]
        if not available:
            return None
        chosen = random.choice(available)
        return {
            "cluster": self.clusters[cluster_id]["concept"],
            "cluster_id": cluster_id,
            "subject": self.clusters[cluster_id]["subject"],
            "question": chosen,
            "total_in_cluster": len(self.clusters[cluster_id]["questions"]),
            "remaining": len(available) - 1,
        }

    def check_answer(self, qid: str, user_answer: str) -> tuple[bool, str]:
        """Check answer. Returns (correct, correct_answer)."""
        for c in self.clusters.values():
            for q in c["questions"]:
                if q["qid"] == qid:
                    return user_answer.upper() == q["answer"].upper(), q["answer"]
        return False, "?"

    def format_question_card(self, q: dict) -> str:
        """Format question for LINE display."""
        text = q["question"]["text"]
        opts = q["question"]["options"]
        lines = [
            f"📚 {q['subject']} / {q['cluster']}",
            f"",
            text,
            "",
        ]
        for letter in ["A", "B", "C", "D"]:
            if letter in opts:
                lines.append(f"  {letter}. {opts[letter]}")
        lines.append("")
        lines.append(f"💡 該集群尚有 {q['remaining']} 題未練習")
        return "\n".join(lines)


# ── CLI demo ──
def cli_demo():
    print("🧪 EXAM-AI Cluster Drill Engine — CLI Demo")
    print("=" * 50)

    engine = ClusterDrillEngine()
    state = UserState()
    user = "demo_user"

    print(f"\n題庫: {len(engine.clusters)} 集群, "
          f"{sum(len(c['questions']) for c in engine.clusters.values())} 題")
    print()

    # Simulate user answering a question wrong
    demo_cluster_id = "C012"  # 止痛與麻醉
    first_q = engine.clusters[demo_cluster_id]["questions"][0]

    print(f"❌ 情境：使用者答錯了 {first_q['qid']}")
    print(f"   題目: {first_q['text'][:50]}...")
    print(f"   所屬集群: {engine.clusters[demo_cluster_id]['concept']}")
    print()

    # Record weak cluster
    state.add_weak_cluster(user, demo_cluster_id)
    state.record_drill(user, demo_cluster_id, first_q["qid"], correct=False)

    # Get next drill question from same cluster
    drill = engine.get_next_drill_question(demo_cluster_id, exclude_qids=[first_q["qid"]])
    if drill:
        print("🎯 Cluster Drill：推同集群不同題目")
        print("-" * 50)
        print(engine.format_question_card(drill))
        print("-" * 50)
        print(f"\n   共 {drill['total_in_cluster']} 題，剩 {drill['remaining']} 題可練習")

    # Simulate answering correctly 3 times → weak cluster cleared
    print("\n🔄 模擬正確回答 3 次後弱點清除...")
    for i in range(3):
        drill_q = engine.get_next_drill_question(demo_cluster_id, exclude_qids=[first_q["qid"]])
        state.record_drill(user, demo_cluster_id, drill_q["question"]["qid"], correct=True)

    after = state.get_weak_clusters(user)
    print(f"  弱點集群: {after if after else '✅ 已全部清除'}")
    print()

    # Summary
    print("📊 使用者狀態摘要")
    profile = state.data.get(user, {})
    print(f"   弱點集群: {len(profile.get('weak_clusters', []))} 個")
    print(f"   練習紀錄: {len(profile.get('drill_history', []))} 次")
    print(f"   狀態已儲存至: {state.filepath}")

    state.save()


if __name__ == "__main__":
    cli_demo()
