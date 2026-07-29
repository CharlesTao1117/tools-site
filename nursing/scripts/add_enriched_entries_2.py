#!/usr/bin/env python3
"""Add 2 more enriched entries from delegate_task batch 2."""
import json, shutil

PATH = 'data/enriched_explanations.json'
BACKUP = 'data/enriched_explanations_backup_20260729.json'

new_entries = {
    "114030_s0101_q33": {
        "explanation_simple": "局部麻醉劑就像油漆，擦在傷口上可以止痛，但很快就會被身體吸收沖走，效果很短。腎上腺素就像在油漆裡加了膠水，能讓局部血管縮起來、血流變慢，麻醉藥就不會那麼快被沖走，可以停留在局部更久，止痛效果也更持久。簡單說：合用是為了「讓血管收縮，減慢吸收，延長麻醉時間」！",
        "why_wrong": {
            "A": "此為正確答案，腎上腺素確實使局部血管收縮。",
            "B": "腎上腺素的作用是「減少」而非「增加」局部麻醉劑的吸收。血管收縮會減緩麻醉劑進入全身循環，與選項所述相反。",
            "C": "腎上腺素在此是局部血管收縮劑，作用於注射部位周邊血管，與中樞神經系統的正腎上腺素止痛機制無關，並非透過中樞路徑產生止痛效果。",
            "D": "腎上腺素並無抗過敏或抗組織胺作用，無法減少局部過敏反應。其角色純粹是血管收縮劑，與過敏機轉無關。"
        },
        "clinical_case": "王先生，45歲，因右手背脂肪瘤至門診手術室接受切除術。醫師於手術部位注射含腎上腺素之Lidocaine進行局部麻醉。護理師術前評估病人無高血壓、心律不整病史，並監測生命徵象。術中傷口出血量少，麻醉效果持續約2小時，病人術後無不適，觀察30分鐘後平安返家。",
        "difficulty": 3,
        "topic": "局部麻醉劑與腎上腺素合用的目的",
        "cluster": "C012 止痛與麻醉"
    },
    "114160_s0101_q33": {
        "explanation_simple": "嗎啡就像一把專屬鑰匙，主要打開大腦的「μ受體」鎖。鎖一開，疼痛訊號的傳遞就被阻斷，所以能有效止痛。δ和κ受體雖然也是「鎖」，但嗎啡對它們的配對沒那麼緊密。NMDA則是不同材質的鎖（麩胺酸受體），嗎啡根本打不開。",
        "why_wrong": {
            "A": "A為正確答案。嗎啡為μ受體之完全致效劑（full agonist），活化μ受體後產生強效止痛、欣快感及呼吸抑制等典型作用。",
            "B": "δ受體雖屬類鴉片受體且活化後可產生止痛效果，但嗎啡對δ受體的親和力遠低於μ受體，並非其主要作用目標。",
            "C": "κ受體活化亦可產生止痛作用，但非嗎啡主要機轉；且κ活化常引起煩躁不安（dysphoria）而非嗎啡典型的欣快感，臨床表現不符。",
            "D": "NMDA受體為麩胺酸（glutamate）的離子型受體，不屬於類鴉片受體家族。它與疼痛慢性化、中樞敏感化及嗎啡耐受性有關，但嗎啡並不直接作用於NMDA受體。"
        },
        "clinical_case": "王先生，65歲肺癌末期，胸痛劇烈（NRS 8/10）。醫囑靜脈注射morphine 5mg，30分鐘後疼痛降至NRS 2/10。護理師監測呼吸、意識，衛教家屬注意嗜睡警訊。病人夜間安眠，疼痛控制良好。",
        "difficulty": 2,
        "topic": "Morphine 止痛作用機轉 — μ受體活化",
        "cluster": "C012 止痛與麻醉"
    }
}

with open(PATH, 'r') as f:
    data = json.load(f)

count_before = data['enriched_count']
for qid, entry in new_entries.items():
    if qid in data['by_qid']:
        print(f'WARNING: {qid} already exists! Skipping.')
        continue
    data['by_qid'][qid] = entry
    print(f'Added: {qid}')

data['enriched_count'] = len(data['by_qid'])
data['version'] = '2026-07-29'

with open(PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Updated: {count_before} → {data["enriched_count"]} entries')
print(f'Version: {data["version"]}')
