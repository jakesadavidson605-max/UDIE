import { describe, expect, it } from "vitest";
import { bm25Score, chunkText, compressContext, tokenize } from "./memory";

describe("UDIE memory pipeline", () => {
  it("tokenizes useful terms while removing punctuation and stop words", () => {
    expect(tokenize("The hybrid retrieval pipeline is useful!")).toEqual(["hybrid", "retrieval", "pipeline", "useful"]);
  });

  it("chunks long text with bounded overlap", () => {
    const chunks = chunkText("alpha ".repeat(600), 240, 30);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every(chunk => chunk.length <= 240)).toBe(true);
  });

  it("ranks matching documents above unrelated documents", () => {
    expect(bm25Score("knowledge graph", "knowledge graph entity links", 10)).toBeGreaterThan(bm25Score("knowledge graph", "weather forecast tomorrow", 10));
  });

  it("compresses oversized context while preserving blocks", () => {
    const blocks = ["important CLAIM ".repeat(250), "second IMPORTANT block ".repeat(250)];
    const compressed = compressContext(blocks, 80);
    expect(compressed).toHaveLength(2);
    expect(compressed.join(" ").split(/\s+/).length).toBeLessThan(blocks.join(" ").split(/\s+/).length);
  });
});
