import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PUBMED_SEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_FETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi";

const SEARCH_QUERIES = [
  `("Voyeurism"[Mesh] OR voyeurism[tiab] OR voyeuristic[tiab] OR "voyeuristic disorder"[tiab] OR "paraphilic voyeurism"[tiab] OR "Peeping Tom"[tiab])`,
  `("Paraphilic Disorders"[Mesh] OR paraphilia*[tiab] OR "paraphilic disorder*"[tiab]) AND (voyeurism[tiab] OR voyeuristic[tiab] OR "voyeuristic disorder"[tiab] OR exhibitionism[tiab] OR frotteurism[tiab] OR "sexual sadism"[tiab])`,
  `(cybervoyeurism[tiab] OR "digital voyeurism"[tiab] OR upskirting[tiab] OR downblousing[tiab] OR spycam[tiab] OR "hidden camera"[tiab] OR "covert recording"[tiab] OR "image-based sexual abuse"[tiab] OR "technology-facilitated sexual violence"[tiab] OR "non-consensual recording"[tiab])`,
  `(voyeurism[tiab] OR voyeuristic[tiab] OR "Peeping Tom"[tiab]) AND ("Forensic Psychiatry"[Mesh] OR forensic[tiab] OR "sex offender*"[tiab] OR "sexual offender*"[tiab] OR "sexual offending"[tiab] OR recidivism[tiab] OR "risk assessment"[tiab] OR "risk management"[tiab])`,
  `("Voyeurism"[Mesh] OR voyeurism[tiab] OR voyeuristic[tiab] OR "voyeuristic disorder"[tiab] OR "Paraphilic Disorders"[Mesh]) AND (treatment[tiab] OR therapy[tiab] OR psychotherapy[tiab] OR "cognitive behavioral therapy"[tiab] OR CBT[tiab] OR "relapse prevention"[tiab] OR SSRI[tiab] OR antiandrogen*[tiab] OR "GnRH agonist"[tiab] OR naltrexone[tiab])`,
  `("Voyeurism"[Mesh] OR voyeurism[tiab] OR "paraphilic disorder*"[tiab]) AND (neurobiology[tiab] OR neuroscience[tiab] OR fMRI[tiab] OR "functional MRI"[tiab] OR "functional connectivity"[tiab] OR "reward circuitry"[tiab] OR amygdala[tiab] OR "prefrontal cortex"[tiab] OR "inhibitory control"[tiab] OR impulsivity[tiab] OR compulsivity[tiab] OR testosterone[tiab])`,
  `("compulsive sexual behavior"[tiab] OR hypersexuality[tiab] OR "sexual addiction"[tiab]) AND (voyeurism[tiab] OR voyeuristic[tiab] OR "paraphilic disorder*"[tiab])`,
];

const HEADERS = { "User-Agent": "ParaphilicDisorderBot/1.0 (research aggregator)" };

function getTaipeiDate() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Taipei" });
}

function buildDateFilter(days = 7) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const lookback = d.toISOString().slice(0, 10).replace(/-/g, "/");
  return `"${lookback}"[Date - Publication] : "3000"[Date - Publication]`;
}

async function searchPapers(query, retmax = 50) {
  const url = new URL(PUBMED_SEARCH);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("term", query);
  url.searchParams.set("retmax", String(retmax));
  url.searchParams.set("sort", "date");
  url.searchParams.set("retmode", "json");
  try {
    const resp = await fetch(url.toString(), { headers: HEADERS, signal: AbortSignal.timeout(30000) });
    const data = await resp.json();
    return data?.esearchresult?.idlist ?? [];
  } catch (e) {
    console.error(`[ERROR] PubMed search failed: ${e.message}`);
    return [];
  }
}

function extractTagText(xml, tag) {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  return m ? m[1].trim() : "";
}

function extractAllTagTexts(xml, tag) {
  const results = [];
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "g");
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1].trim());
  }
  return results;
}

function extractAbstract(xml) {
  const parts = [];
  const re = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const labelMatch = m[0].match(/Label="([^"]*)"/);
    const label = labelMatch ? labelMatch[1] : "";
    const text = m[1].replace(/<[^>]+>/g, "").trim();
    if (text) {
      parts.push(label ? `${label}: ${text}` : text);
    }
  }
  return parts.join(" ").slice(0, 2000);
}

function extractKeywords(medlineXml) {
  const kws = [];
  const re = /<Keyword>([\s\S]*?)<\/Keyword>/g;
  let m;
  while ((m = re.exec(medlineXml)) !== null) {
    if (m[1].trim()) kws.push(m[1].trim());
  }
  return kws;
}

function extractPapersFromXml(xml) {
  const papers = [];
  const articleRe = /<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g;
  let articleMatch;
  while ((articleMatch = articleRe.exec(xml)) !== null) {
    const block = articleMatch[1];
    const titleEl = block.match(/<ArticleTitle[^>]*>([\s\S]*?)<\/ArticleTitle>/);
    const title = titleEl ? titleEl[1].replace(/<[^>]+>/g, "").trim() : "";
    if (!title) continue;

    const abstract = extractAbstract(block);
    const journalEl = block.match(/<Title>([\s\S]*?)<\/Title>/);
    const journal = journalEl ? journalEl[1].trim() : "";

    const year = extractTagText(block, "Year");
    const month = extractTagText(block, "Month");
    const day = extractTagText(block, "Day");
    const dateParts = [year, month, day].filter(Boolean);
    const dateStr = dateParts.join(" ");

    const pmid = extractTagText(block, "PMID");
    const url = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "";
    const keywords = extractKeywords(block);

    papers.push({ pmid, title, journal, date: dateStr, abstract, url, keywords });
  }
  return papers;
}

async function fetchDetails(pmids) {
  if (!pmids.length) return [];
  const url = new URL(PUBMED_FETCH);
  url.searchParams.set("db", "pubmed");
  url.searchParams.set("id", pmids.join(","));
  url.searchParams.set("retmode", "xml");
  try {
    const resp = await fetch(url.toString(), { headers: HEADERS, signal: AbortSignal.timeout(60000) });
    const xml = await resp.text();
    return extractPapersFromXml(xml);
  } catch (e) {
    console.error(`[ERROR] PubMed fetch failed: ${e.message}`);
    return [];
  }
}

function loadDedup() {
  const dedupPath = resolve(ROOT, "docs", ".dedup.json");
  if (existsSync(dedupPath)) {
    try {
      return JSON.parse(readFileSync(dedupPath, "utf-8"));
    } catch {
      return { pmids: {} };
    }
  }
  return { pmids: {} };
}

function saveDedup(dedup) {
  const dedupPath = resolve(ROOT, "docs", ".dedup.json");
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const [pmid, date] of Object.entries(dedup.pmids)) {
    if (date < cutoffStr) delete dedup.pmids[pmid];
  }
  writeFileSync(dedupPath, JSON.stringify(dedup, null, 2), "utf-8");
}

async function main() {
  const targetDate = process.env.TARGET_DATE || getTaipeiDate();
  const dateFilter = buildDateFilter(7);

  console.error(`[INFO] Target date: ${targetDate}`);
  console.error(`[INFO] Date filter: ${dateFilter}`);

  const allPmids = new Set();
  for (const query of SEARCH_QUERIES) {
    const fullQuery = `${query} AND ${dateFilter}`;
    console.error(`[INFO] Searching: ${query.slice(0, 80)}...`);
    const pmids = await searchPapers(fullQuery, 30);
    for (const id of pmids) allPmids.add(id);
    await new Promise((r) => setTimeout(r, 400));
  }

  console.error(`[INFO] Unique PMIDs found: ${allPmids.size}`);

  const dedup = loadDedup();
  const newPmids = [...allPmids].filter((id) => !dedup.pmids[id]);
  console.error(`[INFO] After dedup: ${newPmids.length} new papers`);

  if (!newPmids.length) {
    console.error("[INFO] No new papers found");
    const output = { date: targetDate, count: 0, papers: [] };
    writeFileSync(resolve(ROOT, "papers.json"), JSON.stringify(output, null, 2), "utf-8");
    return;
  }

  const papers = await fetchDetails(newPmids);
  console.error(`[INFO] Fetched details for ${papers.length} papers`);

  const output = { date: targetDate, count: papers.length, papers };
  writeFileSync(resolve(ROOT, "papers.json"), JSON.stringify(output, null, 2), "utf-8");

  for (const p of papers) {
    if (p.pmid) dedup.pmids[p.pmid] = targetDate;
  }
  saveDedup(dedup);
  console.error(`[INFO] Saved papers.json (${papers.length} papers)`);
}

main().catch((e) => {
  console.error(`[FATAL] ${e.message}`);
  process.exit(1);
});
