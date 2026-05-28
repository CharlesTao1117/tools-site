# tools-nurse.tw 部署檢查清單

## Step 1: 註冊 domain
- 註冊商：Gandi / Namecheap / 遠振
- Domain: tools-nurse.tw
- 預估費用：NT$400-600/年

## Step 2: Cloudflare Pages 部署 nursing 靜態站
```bash
# 在 nursing 目錄執行
cd /Users/calmestao/Desktop/tools-site/nursing

# 建立 Pages project
npx wrangler pages project create tools-nurse

# 部署
npx wrangler pages deploy . --project-name tools-nurse --branch main

# 綁定 custom domain
# 到 Cloudflare Dashboard → tools-nurse Pages project → Custom domains
# 加入 tools-nurse.tw
```

## Step 3: Google Search Console
1. 到 https://search.google.com/search-console
2. 加入資源 tools-nurse.tw（網域驗證，透過 Cloudflare DNS TXT record）
3. 提交 sitemap: https://tools-nurse.tw/sitemap.xml（需先生成）

## Step 4: 確認 analytics.js 在部署後能正常載入
- GA4 ID: G-JL08H6FMN6
- 已在所有 nursing/*.html 引用 analytics.js
