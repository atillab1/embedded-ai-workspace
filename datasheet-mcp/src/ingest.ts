/**
 * PDF ingestion: <pdfPath> -> data/raw-pages.json
 * Run with: npm run ingest
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { config } from "./config.js";

interface RawPage {
  pageNum: number;
  text: string;
}

async function extractPageText(page: any): Promise<string> {
  const content = await page.getTextContent();
  const parts: string[] = [];
  let lastY: number | null = null;
  for (const item of content.items) {
    const str = (item as { str: string }).str;
    const y = (item as { transform: number[] }).transform[5];
    if (lastY !== null && Math.abs(lastY - y) > 2) parts.push("\n");
    parts.push(str);
    lastY = y;
  }
  return parts.join("").replace(/[ \t]+/g, " ").trim();
}

async function main() {
  console.log(`Reading ${config.pdfPath}...`);
  const data = await readFile(config.pdfPath);

  console.log("Loading PDF...");
  const doc = await getDocument({
    data: new Uint8Array(data),
    verbosity: 0,
  }).promise;

  const numPages = doc.numPages;
  console.log(`PDF has ${numPages} pages. Extracting...`);

  const pages: RawPage[] = [];
  const start = Date.now();

  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const text = await extractPageText(page);
    pages.push({ pageNum: i, text });

    if (i % 50 === 0 || i === numPages) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  page ${i}/${numPages}  (${elapsed}s)`);
    }
  }

  await mkdir(dirname(config.rawPagesPath), { recursive: true });
  await writeFile(config.rawPagesPath, JSON.stringify(pages, null, 2));

  const totalChars = pages.reduce((s, p) => s + p.text.length, 0);
  console.log(`\nDone. Wrote ${pages.length} pages, ${totalChars.toLocaleString()} chars total`);
  console.log(`Output: ${config.rawPagesPath}`);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
