import { describe, expect, it } from "vitest";
import { makeCitation } from "./ingestion";

describe("UDIE ingestion citations", () => {
  it("creates stable markdown citation metadata", () => {
    const citation = makeCitation("https://example.com/brief", "Example brief", "chunk-123");
    expect(citation.label).toBe("Example brief");
    expect(citation.source).toBe("https://example.com/brief");
    expect(citation.markdown).toBe("[Example brief](https://example.com/brief)");
    expect(citation.locator).toBe("chunk-123");
  });
});
