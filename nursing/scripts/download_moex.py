#!/usr/bin/env python3
"""
易考通 — 考選部考題下載腳本
下載所有考試類別 × 近10年考古題 PDF
"""

import requests
import re
import os
import time
import json
from bs4 import BeautifulSoup
from urllib.parse import urljoin

BASE_URL = "http://wwwq.moex.gov.tw"
SEARCH_URL = urljoin(BASE_URL, "/exam/wFrmExamQandASearch.aspx")
DOWNLOAD_DIR = os.path.join(os.path.dirname(__file__), "data", "raw_pdf")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Content-Type": "application/x-www-form-urlencoded"
}

# ROC year → Gregorian year
def roc_to_gregorian(roc_year):
    return int(roc_year) + 1911

def session_to_roc(session_code):
    """Extract ROC year from session code like '115010'"""
    return int(str(session_code)[:3])

# 所有要下載的年份（民國年，近10年 = 105-115）
YEARS = list(range(105, 116))

def main():
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    session = requests.Session()
    
    # Step 1: Get the page to obtain __VIEWSTATE and other form fields
    print("[1/3] 獲取表單初始狀態...")
    r = session.get(SEARCH_URL, headers=HEADERS, timeout=60)
    r.encoding = 'utf-8'
    
    soup = BeautifulSoup(r.text, 'html.parser')
    
    def get_field(name):
        el = soup.find('input', {'name': name})
        return el.get('value', '') if el else ''
    
    viewstate = get_field('__VIEWSTATE')
    viewstate_gen = get_field('__VIEWSTATEGENERATOR')
    event_validation = get_field('__EVENTVALIDATION')
    
    if not viewstate:
        print("❌ 無法取得 __VIEWSTATE，網站可能有變")
        return
    
    print(f"✅ 取得 VIEWSTATE: {len(viewstate)} chars")
    
    # Step 2: Get all exam codes for each year
    all_exams = {}  # exam_code → first_seen_name
    
    for year in YEARS:
        print(f"\n[2/3] 查詢 {year} 年 (民國) 的考試列表...")
        
        data = {
            '__VIEWSTATE': viewstate,
            '__VIEWSTATEGENERATOR': viewstate_gen,
            '__EVENTVALIDATION': event_validation,
            'ctl00$holderContent$wUctlExamYearStart$ddlExamYear': str(year),
            'ctl00$holderContent$btnYear': '查詢',  # Year query button
        }
        
        r2 = session.post(SEARCH_URL, data=data, headers=HEADERS, timeout=60)
        r2.encoding = 'utf-8'
        
        # Update viewstate for next request
        soup2 = BeautifulSoup(r2.text, 'html.parser')
        viewstate = get_field('__VIEWSTATE')
        viewstate_gen = get_field('__VIEWSTATEGENERATOR')
        event_validation = get_field('__EVENTVALIDATION')
        
        # Find all exam options
        select = soup2.find('select', {'id': 'ctl00_holderContent_ddlExamCode'})
        if select:
            options = select.find_all('option')
            for opt in options:
                val = opt.get('value', '')
                if val and val.strip():
                    code = val.strip()
                    name = opt.get_text(strip=True)
                    if code not in all_exams:
                        all_exams[code] = name
                        print(f"  📌 {code}: {name[:60]}")
    
    print(f"\n✅ 共找到 {len(all_exams)} 個考試類別")
    
    # Step 3: Download each exam's PDFs
    total = len(all_exams)
    for idx, (code, name) in enumerate(sorted(all_exams.items()), 1):
        roc_year = session_to_roc(code)
        year_dir = os.path.join(DOWNLOAD_DIR, str(roc_year))
        os.makedirs(year_dir, exist_ok=True)
        
        print(f"\n[3/3] [{idx}/{total}] 下載 {code}: {name[:50]}...")
        
        data = {
            '__VIEWSTATE': viewstate,
            '__VIEWSTATEGENERATOR': viewstate_gen,
            '__EVENTVALIDATION': event_validation,
            'ctl00$holderContent$wUctlExamYearStart$ddlExamYear': str(roc_year),
            'ctl00$holderContent$ddlExamCode': code,
            'ctl00$holderContent$btnSearch': '查詢',
        }
        
        try:
            r3 = session.post(SEARCH_URL, data=data, headers=HEADERS, timeout=60)
            r3.encoding = 'utf-8'
            
            # Update viewstate
            soup3 = BeautifulSoup(r3.text, 'html.parser')
            
            # Look for PDF download links
            pdf_links = []
            for a in soup3.find_all('a', href=True):
                href = a['href']
                if '.pdf' in href.lower() and 'exam' in href.lower():
                    full_url = urljoin(BASE_URL, href)
                    pdf_name = os.path.basename(href.split('?')[0])
                    pdf_links.append((full_url, pdf_name))
            
            if pdf_links:
                for url, fname in pdf_links:
                    filepath = os.path.join(year_dir, f"{code}_{fname}")
                    try:
                        r4 = session.get(url, headers=HEADERS, timeout=60)
                        with open(filepath, 'wb') as f:
                            f.write(r4.content)
                        print(f"  ✅ 下載: {fname} ({len(r4.content)//1024} KB)")
                    except Exception as e:
                        print(f"  ❌ 下載失敗: {fname} - {e}")
            else:
                print(f"  ⏭️ 無 PDF 連結")
                
        except Exception as e:
            print(f"  ❌ 查詢失敗: {e}")
        
        # Small delay to avoid overwhelming the server
        time.sleep(1.5)
    
    print(f"\n{'='*50}")
    print(f"下載完成！PDF 存放於: {DOWNLOAD_DIR}")
    print(f"總計考試類別: {total}")

if __name__ == '__main__':
    main()
