/**
 * search_datasheet tool: vector search over the LanceDB table.
 */
import { existsSync } from "node:fs";
import * as lancedb from "@lancedb/lancedb";
import { embed } from "../embedder.js";
import { config } from "../config.js";

const DB_PATH = config.dbPath;
const TABLE_NAME = config.tableName;

let tablePromise: Promise<lancedb.Table> | null = null;

async function getTable(): Promise<lancedb.Table> {
  if (!tablePromise) {
    if (!existsSync(DB_PATH)) {
      throw new Error(
        `LanceDB not found at ${DB_PATH}. Run \`npm run embed\` first.`
      );
    }
    tablePromise = (async () => {
      const db = await lancedb.connect(DB_PATH);
      return db.openTable(TABLE_NAME);
    })();
  }
  return tablePromise;
}

export interface SearchHit {
  section: string;
  title: string;
  page: number;
  text: string;
  score: number;
}

export async function searchDatasheet(query: string, k: number = 5): Promise<SearchHit[]> {
  const queryVector = await embed(query);
  const table = await getTable();

  const results = await table
    .search(queryVector)
    .limit(k)
    .toArray();

  return results.map((r: any) => ({
    section: r.section,
    title: r.title,
    page: r.page,
    text: r.text,
    // LanceDB returns _distance; convert to similarity-ish score
    score: typeof r._distance === "number" ? 1 - r._distance : 0,
  }));
}

export function formatSearchHits(hits: SearchHit[]): string {
  if (hits.length === 0) return "No relevant sections found.";
  return hits
    .map((h, i) => {
      const snippet = h.text.length > 800 ? h.text.slice(0, 800) + " [...]" : h.text;
      return `### Result ${i + 1} — Section ${h.section}: ${h.title}\n` +
        `Page: ${h.page}  |  Score: ${h.score.toFixed(3)}\n\n${snippet}`;
    })
    .join("\n\n---\n\n");
}
