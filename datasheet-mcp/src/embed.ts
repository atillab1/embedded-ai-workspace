/**
 * Embedding: data/chunks.json -> data/lance-db/
 * Local embedding via @huggingface/transformers. No API key.
 * Run with: npm run embed
 */

import { readFile } from "node:fs/promises";
import * as lancedb from "@lancedb/lancedb";
import { getExtractor } from "./embedder.js";
import { config } from "./config.js";

const BATCH_SIZE = 32;

interface Chunk {
  id: string;
  section: string;
  title: string;
  page: number;
  text: string;
}

interface Row extends Chunk {
  vector: number[];
}

async function main() {
  console.log(`Reading ${config.chunksPath}...`);
  const chunks = JSON.parse(await readFile(config.chunksPath, "utf8")) as Chunk[];
  console.log(`Loaded ${chunks.length} chunks.`);

  console.log(`Loading model ${config.embeddingModel} (first run downloads model)...`);
  const extractor = await getExtractor();

  const rows: Row[] = [];
  const start = Date.now();

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const inputs = batch.map((c) => `${c.title}\n${c.text}`);
    const output = await extractor(inputs, { pooling: "mean", normalize: true });
    const vectors: number[][] = output.tolist();

    for (let j = 0; j < batch.length; j++) {
      rows.push({ ...batch[j], vector: vectors[j] });
    }

    const done = Math.min(i + BATCH_SIZE, chunks.length);
    if (done % 100 === 0 || done === chunks.length) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`  embedded ${done}/${chunks.length}  (${elapsed}s)`);
    }
  }

  console.log(`\nWriting LanceDB table at ${config.dbPath}...`);
  const db = await lancedb.connect(config.dbPath);
  const existing = await db.tableNames();
  if (existing.includes(config.tableName)) {
    await db.dropTable(config.tableName);
  }
  await db.createTable(config.tableName, rows as unknown as Record<string, unknown>[]);

  console.log(`Done. ${rows.length} rows written to table "${config.tableName}".`);
}

main().catch((err) => { console.error("Embedding failed:", err); process.exit(1); });
