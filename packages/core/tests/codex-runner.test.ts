import { describe, expect, it } from "vitest";
import { parseCodexJsonl } from "../src/ai-review/codex-runner.js";

describe("codex-runner", () => {
  it("parseCodexJsonl extracts assistant message and token usage", () => {
    const jsonl = [
      '{"type":"turn.completed","usage":{"input_tokens":10,"output_tokens":5}}',
      '{"type":"item.completed","item":{"item_type":"assistant_message","text":"{\\"score\\":98,\\"verdict\\":\\"ACCEPT\\",\\"deductions\\":[]}"}}',
    ].join("\n");
    const parsed = parseCodexJsonl(jsonl);
    expect(parsed.inputTokens).toBe(10);
    expect(parsed.outputTokens).toBe(5);
    expect(parsed.resultText).toContain('"score":98');
  });
});
