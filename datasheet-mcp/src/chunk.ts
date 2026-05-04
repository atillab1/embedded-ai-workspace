/**
 * Chunking: data/raw-pages.json -> data/chunks.json
 * Splits the manual on numbered headings. Page numbers are preserved.
 * Run with: npm run chunk
 */

import { readFile, writeFile } from "node:fs/promises";
import { config } from "./config.js";

interface RawPage { pageNum: number; text: string; }

interface Chunk {
  id: string;
  section: string;
  title: string;
  page: number;
  text: string;
}

function splitLongChunk(chunk: Chunk): Chunk[] {
  if (chunk.text.length <= config.maxChunkChars) return [chunk];
  const parts: Chunk[] = [];
  let offset = 0;
  let part = 0;
  while (offset < chunk.text.length) {
    parts.push({
      ...chunk,
      id: `${chunk.id}#${part}`,
      text: chunk.text.slice(offset, offset + config.maxChunkChars),
    });
    offset += config.maxChunkChars;
    part++;
  }
  return parts;
}

async function main() {
  console.log(`Reading ${config.rawPagesPath}...`);
  const raw = JSON.parse(await readFile(config.rawPagesPath, "utf8")) as RawPage[];
  console.log(`Loaded ${raw.length} pages.`);

  const PAGE_MARK = " PAGE ";
  const fullText = raw.map((p) => `${PAGE_MARK}${p.pageNum}${PAGE_MARK}\n${p.text}`).join("\n");

  const matches: { section: string; title: string; index: number }[] = [];
  for (const m of fullText.matchAll(config.headingRegex)) {
    const section = m[1];
    const title = m[2].trim();
    if (!section.includes(".")) continue;
    if (!/[A-Za-z]/.test(title)) continue;
    matches.push({ section, title, index: m.index! });
  }
  console.log(`Found ${matches.length} heading candidates.`);

  const chunks: Chunk[] = [];
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const nextIndex = i + 1 < matches.length ? matches[i + 1].index : fullText.length;
    let body = fullText.slice(cur.index, nextIndex);

    const before = fullText.slice(0, cur.index);
    const pageMatches = [...before.matchAll(/ PAGE (\d+) PAGE /g)];
    const page = pageMatches.length > 0 ? Number(pageMatches[pageMatches.length - 1][1]) : 0;

    body = body.replace(/ PAGE \d+ PAGE \n?/g, "").trim();
    if (body.length < 80) continue;

    const head = body.slice(0, 400);
    const headDotRatio = (head.match(/\./g)?.length ?? 0) / head.length;
    if (headDotRatio > 0.10) continue;
    const indexSignals = body.match(/[A-Z]{3,}_[A-Z0-9]+/g)?.length ?? 0;
    if (indexSignals > 20) continue;
    const tocLines = body.match(/\.\s+\d+\s*\n/g)?.length ?? 0;
    if (tocLines > 5) continue;

    chunks.push({
      id: `s${cur.section.replace(/\./g, "_")}`,
      section: cur.section,
      title: cur.title,
      page,
      text: body,
    });
  }

  const finalChunks = chunks.flatMap(splitLongChunk);
  await writeFile(config.chunksPath, JSON.stringify(finalChunks, null, 2));

  const totalChars = finalChunks.reduce((s, c) => s + c.text.length, 0);
  const avgChars = Math.round(totalChars / finalChunks.length);
  console.log(`\nDone. Wrote ${finalChunks.length} chunks (${totalChars.toLocaleString()} chars, avg ${avgChars}/chunk)`);
  console.log(`Output: ${config.chunksPath}`);
}

main().catch((err) => { console.error("Chunking failed:", err); process.exit(1); });
