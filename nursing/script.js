/* ===== Calculator Logic ===== */

// ---- 1. Drip Rate Calculator ----
function calcDripRate() {
  const vol = parseFloat(document.getElementById('drp-volume').value);
  const time = parseFloat(document.getElementById('drp-time').value);
  const factor = parseFloat(document.getElementById('drp-factor').value);
  const timeUnit = document.getElementById('drp-time-unit').value;
  const result = document.getElementById('drp-result');
  const exam = document.getElementById('drp-exam');

  if (!vol || !time || !factor || vol <= 0 || time <= 0 || factor <= 0) {
    result.className = 'result-box info show';
    result.innerHTML = '⚠️ 請輸入所有欄位的有效數值';
    exam.className = 'exam-sample';
    return;
  }

  const minutes = timeUnit === 'h' ? time * 60 : time;
  const rate = (vol * factor) / minutes;
  const rounded = Math.round(rate * 10) / 10;

  result.className = 'result-box success show';
  result.innerHTML = `
    <div style="font-size:0.85rem;opacity:0.7;">點滴滴速</div>
    <div class="big-number">${rounded} <span style="font-size:1rem;font-weight:400;">gtt/min</span></div>
    <div class="formula">公式：(${vol} mL × ${factor} gtt/mL) ÷ ${minutes} 分鐘 = ${rounded} gtt/min</div>
  `;

  exam.className = 'exam-sample show';
  exam.innerHTML = `
    <span class="tag">📝 國考範例題</span>
    <div class="q">醫師開立 Normal Saline 500 mL 以 8 小時滴完，輸液套的滴數係數為 15 gtt/mL，請問每分鐘滴速應為多少？</div>
    <div class="answer">✅ 答案：(${500} × 15) ÷ (8 × 60) = ${Math.round(500*15/480)} gtt/min</div>
  `;
}

// ---- 2. Drug Dilution Calculator ----
function calcDilution() {
  const stock = parseFloat(document.getElementById('dil-stock').value);
  const target = parseFloat(document.getElementById('dil-target').value);
  const finalVol = parseFloat(document.getElementById('dil-vol').value);
  const unit = document.getElementById('dil-unit').value;
  const result = document.getElementById('dil-result');
  const exam = document.getElementById('dil-exam');

  if (!stock || !target || !finalVol || stock <= 0 || target <= 0 || finalVol <= 0) {
    result.className = 'result-box info show';
    result.innerHTML = '⚠️ 請輸入所有欄位的有效數值';
    exam.className = 'exam-sample';
    return;
  }
  if (target > stock) {
    result.className = 'result-box info show';
    result.innerHTML = '⚠️ 目標濃度不能高於原濃度';
    exam.className = 'exam-sample';
    return;
  }

  const volNeeded = (target * finalVol) / stock;
  const diluent = finalVol - volNeeded;

  result.className = 'result-box success show';
  result.innerHTML = `
    <div style="font-size:0.85rem;opacity:0.7;">稀釋計算結果</div>
    <div style="margin-top:10px;">
      <div>取原液：<strong>${volNeeded.toFixed(2)}</strong> ${unit}</div>
      <div>加稀釋液：<strong>${diluent.toFixed(2)}</strong> ${unit}</div>
      <div>最終體積：<strong>${finalVol}</strong> ${unit}</div>
    </div>
    <div class="formula">公式：(${target} × ${finalVol}) ÷ ${stock} = ${volNeeded.toFixed(2)} ${unit}</div>
  `;

  exam.className = 'exam-sample show';
  exam.innerHTML = `
    <span class="tag">📝 國考範例題</span>
    <div class="q">醫師開立 Gentamicin 80 mg 加入 100 mL NS 中靜脈輸注。藥品為 Gentamicin 40 mg/mL，請問需取藥液多少 mL？</div>
    <div class="answer">✅ 答案：80 mg ÷ 40 mg/mL = 2 mL</div>
  `;
}

// ---- 3. Unit Converter ----
function doConvert() {
  const val = parseFloat(document.getElementById('conv-val').value);
  const from = document.getElementById('conv-from').value;
  const to = document.getElementById('conv-to').value;
  const result = document.getElementById('conv-result');

  if (!val || val <= 0) {
    result.className = 'result-box info show';
    result.innerHTML = '⚠️ 請輸入有效數值';
    return;
  }

  const conversions = {
    'g-mg': val * 1000,
    'g-mcg': val * 1000000,
    'mg-g': val / 1000,
    'mg-mcg': val * 1000,
    'mcg-mg': val / 1000,
    'mcg-g': val / 1000000,
    'L-mL': val * 1000,
    'mL-L': val / 1000,
    'mg-mL': val,  // 1:1 for water-based solutions
  };

  const key = `${from}-${to}`;
  const converted = conversions[key];
  if (converted === undefined) {
    result.className = 'result-box info show';
    result.innerHTML = '⚠️ 不支援的換算組合';
    return;
  }

  const unitLabels = { 'g': '公克 (g)', 'mg': '毫克 (mg)', 'mcg': '微克 (mcg)', 'L': '公升 (L)', 'mL': '毫升 (mL)' };

  result.className = 'result-box success show';
  result.innerHTML = `
    <div style="font-size:0.85rem;opacity:0.7;">單位換算結果</div>
    <div class="big-number">${converted.toLocaleString('zh-TW', {maximumFractionDigits: 4})} <span style="font-size:1rem;font-weight:400;">${unitLabels[to]}</span></div>
    <div class="formula">${val} ${unitLabels[from]} = ${converted.toLocaleString('zh-TW', {maximumFractionDigits: 4})} ${unitLabels[to]}</div>
  `;
}

// ---- 4. Safe Dosage Range ----
function calcSafeDose() {
  const weight = parseFloat(document.getElementById('safe-weight').value);
  const minPerKg = parseFloat(document.getElementById('safe-min').value);
  const maxPerKg = parseFloat(document.getElementById('safe-max').value);
  const result = document.getElementById('safe-result');
  const exam = document.getElementById('safe-exam');

  if (!weight || !minPerKg || !maxPerKg || weight <= 0 || minPerKg <= 0 || maxPerKg <= 0) {
    result.className = 'result-box info show';
    result.innerHTML = '⚠️ 請輸入所有欄位的有效數值';
    exam.className = 'exam-sample';
    return;
  }

  if (minPerKg > maxPerKg) {
    result.className = 'result-box info show';
    result.innerHTML = '⚠️ 最低劑量不能高於最高劑量';
    exam.className = 'exam-sample';
    return;
  }

  const safeMin = weight * minPerKg;
  const safeMax = weight * maxPerKg;

  result.className = 'result-box success show';
  result.innerHTML = `
    <div style="font-size:0.85rem;opacity:0.7;">安全劑量範圍</div>
    <div class="big-number">${safeMin.toFixed(1)} — ${safeMax.toFixed(1)} <span style="font-size:1rem;font-weight:400;">mg</span></div>
    <div style="margin-top:6px;font-size:0.9rem;">
      ｜${weight} kg × ${minPerKg} mg/kg = ${safeMin.toFixed(1)} mg（最小）<br>
      ｜${weight} kg × ${maxPerKg} mg/kg = ${safeMax.toFixed(1)} mg（最大）
    </div>
    <div class="formula">安全範圍 = ${safeMin.toFixed(1)} — ${safeMax.toFixed(1)} mg/次</div>
  `;

  exam.className = 'exam-sample show';
  exam.innerHTML = `
    <span class="tag">📝 國考範例題</span>
    <div class="q">體重 20 kg 的兒童，醫師開立 Amoxicillin 懸浮液，建議劑量為 20-40 mg/kg/天，分 3 次服用。請問每次安全劑量範圍為何？</div>
    <div class="answer">✅ 每日：${20*20}-${20*40} mg → 每次：${Math.round(20*20/3)}-${Math.round(20*40/3)} mg</div>
  `;
}

// ---- 5. FAQ Toggle ----
function toggleFaq(id) {
  const el = document.getElementById(id);
  el.classList.toggle('open');
}

// ---- 6. Smooth Scroll ----
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute('href'));
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
