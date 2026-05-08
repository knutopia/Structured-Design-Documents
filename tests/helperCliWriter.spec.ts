import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { writeAllSync, type SyncFdWriter } from "../src/cli/writeAllSync.js";

describe("writeAllSync", () => {
  it("continues writing until the full UTF-8 payload is emitted", () => {
    const content = `alpha\nbravo\nsnowman: \u2603\nemoji: \u{1F680}\n`;
    const chunks: Buffer[] = [];
    const writer: SyncFdWriter = (_fd, buffer, offset, length) => {
      const bytesToWrite = Math.min(length, 3);
      chunks.push(Buffer.from(buffer.subarray(offset, offset + bytesToWrite)));
      return bytesToWrite;
    };

    writeAllSync(1, content, writer);

    expect(Buffer.concat(chunks).toString("utf8")).toBe(content);
  });

  it("throws when a writer reports no progress", () => {
    expect(() => writeAllSync(1, "payload", () => 0)).toThrow(
      "writeSync made no progress while writing 7 bytes."
    );
  });

  it("retries nonblocking pipe backpressure errors", () => {
    const chunks: Buffer[] = [];
    let calls = 0;
    const writer: SyncFdWriter = (_fd, buffer, offset, length) => {
      calls += 1;
      if (calls === 2) {
        throw Object.assign(new Error("try again"), { code: "EAGAIN" });
      }
      const bytesToWrite = Math.min(length, 4);
      chunks.push(Buffer.from(buffer.subarray(offset, offset + bytesToWrite)));
      return bytesToWrite;
    };

    writeAllSync(1, "partial pipe payload", writer);

    expect(Buffer.concat(chunks).toString("utf8")).toBe("partial pipe payload");
    expect(calls).toBeGreaterThan(2);
  });
});
