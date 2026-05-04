/**
 * Singleton embedder. Loads the model once on first call.
 */
import { pipeline } from "@huggingface/transformers";
import { config } from "./config.js";

let extractorPromise: Promise<any> | null = null;

export function getExtractor(): Promise<any> {
  if (!extractorPromise) {
    extractorPromise = pipeline("feature-extraction", config.embeddingModel);
  }
  return extractorPromise;
}

export async function embed(text: string): Promise<number[]> {
  const extractor = await getExtractor();
  const output = await extractor(text, { pooling: "mean", normalize: true });
  return output.tolist()[0];
}
