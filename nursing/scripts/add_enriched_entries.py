#!/usr/bin/env python3
"""Add enriched entries to enriched_explanations.json and update version."""
import json, sys
from datetime import date

PATH = 'data/enriched_explanations.json'
BACKUP = f'data/enriched_explanations_backup_{date.today().strftime("%Y%m%d")}.json'

# New entries (from delegate_task batch 1)
new_entries = {
    "111030_s0301_q57": {
        "explanation_simple": "阿斯匹靈像一個多功能工具箱，不同劑量能做不同的事。劑量最低時（75-150mg）就能防止血小板凝固（抗凝血）；稍高一點（325-500mg）可止痛；但要有效退燒，需要最高劑量（650-1000mg），因為退燒必須讓藥物穿過血腦屏障，到達大腦的體溫調節中樞，這道屏障需要更高的藥物濃度才能突破，就像需要更強的鑰匙才能打開更難開的鎖。",
        "why_wrong": {
            "A": "抗發炎作用所需單次劑量約600-1200mg，但抗發炎效果需連續服藥、累積至每日3-5克才顯效，單次給藥無法立即達到抗發炎效果。而退燒只需單次650mg即可見效，就單次有效劑量而言，退燒所需劑量高於抗發炎之單次起始劑量。",
            "B": "止痛所需有效劑量為325-650mg，低於退燒的650-1000mg。因為止痛主要透過抑制周邊組織的前列腺素合成，藥物不需進入中樞神經系統即可發揮作用，故所需劑量較退燒為低。",
            "C": "抗凝血（抗血小板）是阿斯匹靈所有作用中所需劑量最低的，每日僅需75-150mg即可不可逆地抑制血小板COX-1酵素，完全阻斷血栓素A2的生成。此劑量遠低於退燒所需的650mg以上，故選項C明顯錯誤。"
        },
        "clinical_case": "王女士，62歲，類風濕性關節炎病史，因感冒發燒至39.2°C，自述平時服用阿斯匹靈325mg即可緩解關節疼痛，但此次服用相同劑量後體溫僅降至38.5°C。護理師評估後，依醫囑給予阿斯匹靈650mg，並衛教退燒需較止痛更高之劑量。服藥後1小時體溫降至37.3°C，王女士表示了解不同作用所需劑量差異。",
        "difficulty": 3,
        "topic": "Aspirin 作用劑量",
        "cluster": "C012 止痛與麻醉"
    },
    "111030_s0304_q12": {
        "explanation_simple": "想像止痛藥就像消防隊來滅火。Meperidine 這隊消防員滅火很有效，但可能會讓呼吸變慢（就像水壓不足），也可能讓寶寶的心跳變化減少。Fentanyl 是另一隊更專業的消防員，它也會讓呼吸變慢，但它有個優點：不太會影響血壓，就像滅火時不會把水管弄破。所以題目說 Fentanyl 會造成低血壓是錯的，它其實對血壓很穩定。",
        "why_wrong": {
            "A": "此敘述正確。Marcaine（bupivacaine）是脊髓麻醉常用藥物，術後不需平躺6-8小時（與傳統腰椎穿刺不同），因為現代細針技術大幅降低腦脊髓液滲漏風險。",
            "B": "此敘述正確。Meperidine（Demerol）常用於第一產程活動期止痛，屬鴉片類藥物，naloxone（Narcan）為其專一性解毒劑，可逆轉呼吸抑制等副作用。",
            "C": "此敘述正確。Meperidine 作為鴉片類藥物，確實具有呼吸抑制的副作用，且會通過胎盤影響胎兒，造成胎兒心跳變異性減低（decreased fetal heart rate variability），這是產科用藥的重要考量。",
            "D": "此敘述錯誤，故為答案。Fentanyl 確實具有呼吸抑制的副作用，naloxone 亦為其解毒劑；但 fentanyl 對血壓影響極小，具良好的血流動力學穩定性（hemodynamic stability），與 morphine 不同，不會造成顯著低血壓。題目將低血壓列為其副作用是錯誤的。"
        },
        "clinical_case": "李女士，32歲，G1P0，妊娠39週，第一產程活動期子宮頸擴張5公分，主訴劇烈宮縮痛。醫師開立meperidine 50mg肌肉注射止痛。注射後30分鐘，胎兒監測器顯示胎兒心跳變異性由中度降至輕度，產婦呼吸速率由18降至12次/分。護理師立即備妥naloxone於床邊，持續監測產婦血氧濃度及胎心率，並衛教若呼吸速率低於10次/分需立即通報。兩小時後產婦順利進入第二產程，新生兒出生Apgar分數8-9分，無呼吸抑制現象。",
        "difficulty": 3,
        "topic": "分娩鎮痛與麻醉藥物",
        "cluster": "C012 止痛與麻醉"
    },
    "112180_s0101_q35": {
        "explanation_simple": "想像前列腺素是身體的「警報器」，受傷或發炎時會拉響警報，造成疼痛、發燒和紅腫。COX酵素就像製造警報器的工廠，NSAIDs藥物的作用就是關掉這間工廠的電源，讓身體不再大量生產前列腺素，警報自然解除——燒退了、痛也減輕了。",
        "why_wrong": {
            "A": "cyclooxygenase（環氧合酶）是正確答案，NSAIDs正是透過抑制COX-1和/或COX-2來阻斷前列腺素的合成。",
            "B": "angiotensin converting enzyme（血管張力素轉化酶，ACE）是血壓調控路徑的關鍵酵素，抑制它的是ACEI類降血壓藥（如Captopril），與NSAIDs無關。",
            "C": "HMG CoA reductase（HMG-CoA還原酶）是肝臟合成膽固醇的速率限制酵素，抑制它的是Statin類降血脂藥（如Atorvastatin），並非NSAIDs的標靶。",
            "D": "xanthine oxidase（黃嘌呤氧化酶）參與尿酸生成，抑制它的是Allopurinol等降尿酸藥物，用於痛風治療，與NSAIDs的作用機轉不同。"
        },
        "clinical_case": "45歲女性因右膝關節炎就診，主訴關節腫痛、晨間僵硬。醫師開立Ibuprofen 400mg TID，一週後回診疼痛明顯改善，腫脹消退。此藥透過抑制COX酵素減少關節內前列腺素生成，達到抗發炎與止痛效果。",
        "difficulty": 2,
        "topic": "NSAIDs 作用機轉 — COX 抑制",
        "cluster": "C012 止痛與麻醉"
    }
}

# Load and update
with open(PATH, 'r') as f:
    data = json.load(f)

# Check duplicates
count_before = data['enriched_count']
for qid, entry in new_entries.items():
    if qid in data['by_qid']:
        print(f'ERROR: {qid} already exists!')
        sys.exit(1)
    data['by_qid'][qid] = entry

data['enriched_count'] = len(data['by_qid'])
data['version'] = '2026-07-29'

# Backup
import shutil
shutil.copy2(PATH, BACKUP)
print(f'Backup saved: {BACKUP}')

# Write
with open(PATH, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f'Updated: {count_before} → {data["enriched_count"]}')
print(f'New qids: {list(new_entries.keys())}')
print(f'Version: {data["version"]}')
