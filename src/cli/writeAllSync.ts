import { Buffer } from "node:buffer";
import { writeSync } from "node:fs";

export type SyncFdWriter = (fd: number, buffer: Buffer, offset: number, length: number) => number;

function isRetryableWriteError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    ((error as NodeJS.ErrnoException).code === "EAGAIN" ||
      (error as NodeJS.ErrnoException).code === "EWOULDBLOCK")
  );
}

export function writeAllSync(
  fd: number,
  content: string,
  writer: SyncFdWriter = writeSync
): void {
  const buffer = Buffer.from(content, "utf8");
  let offset = 0;

  while (offset < buffer.length) {
    let bytesWritten: number;
    try {
      bytesWritten = writer(fd, buffer, offset, buffer.length - offset);
    } catch (error) {
      if (isRetryableWriteError(error)) {
        continue;
      }
      throw error;
    }
    if (bytesWritten <= 0) {
      throw new Error(`writeSync made no progress while writing ${buffer.length} bytes.`);
    }
    offset += bytesWritten;
  }
}
