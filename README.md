# Paraphilic Disorder Research Daily Report

🔬 **性偏差疾患研究文獻日報** — 每日自動更新

本專案使用 GitHub Actions 每日自動從 PubMed 抓取性偏差疾患（Paraphilic Disorders）相關最新研究文獻，透過 Zhipu AI 進行繁體中文摘要與分類，生成結構化日報並部署至 GitHub Pages。

## 架構

- **資料來源**: PubMed E-utilities API
- **AI 分析**: Zhipu GLM-5-Turbo（fallback: GLM-4.7 → GLM-4.7-Flash）
- **前端**: 純 HTML/CSS（ Psychiatry-brain 同款暖色系設計）
- **部署**: GitHub Pages
- **排程**: 每日 22:30 (台北時間)

## 涵蓋主題

- 窺視症（Voyeurism）與窺視症疾患
- 性偏差疾患（Paraphilic Disorders）
- 網路窺視、偷拍、裙底偷拍
- 非接觸性性犯罪
- 法醫風險評估與再犯率
- 治療方法（CBT、藥物治療）
- 神經科學相關研究

## 本地開發

```bash
# 設定環境變數
export ZHIPU_API_KEY="your-api-key"

# 抓取文獻
node scripts/fetch_papers.mjs

# 生成報告
node scripts/generate_report.mjs

# 生成索引頁
node scripts/generate_index.mjs
```

## 授權

學術研究用途。本工具不得用於助長窺視行為、監控、騷擾、隱私侵害或逃避偵查。
