import { describe, expect, it, vi } from "vitest";
import { generateWithGateway } from "./gateways";

describe("OpenRouter gateway integration contract", () => {
  it("uses the explicit openrouter provider and returns streamed content", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"cloud "}}]}\n\n'));
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"response"}}]}\n\n'));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    const tokens: string[] = [];
    const result = await generateWithGateway({ mode: "cloud", provider: "openrouter", apiKey: "sk-or-v1-test", messages: [{ role: "user", content: "test" }], temperature: 0.1, topP: 0.9, onToken: token => tokens.push(token) });
    expect(result.provider).toBe("openrouter");
    expect(result.content).toBe("cloud response");
    expect(tokens).toEqual(["cloud ", "response"]);
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("openrouter.ai/api/v1/chat/completions"), expect.objectContaining({ body: expect.stringContaining('"stream":true'), headers: expect.objectContaining({ authorization: "Bearer sk-or-v1-test" }) }));
    vi.unstubAllGlobals();
  });
});
