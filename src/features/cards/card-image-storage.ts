import { createHash } from "node:crypto";

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maximumBytes = 5 * 1024 * 1024;

export class CardImageUploadError extends Error {}

export async function prepareCardImage(file: File) {
  if (!allowedTypes.has(file.type)) {
    throw new CardImageUploadError("Use a JPG, PNG, or WebP image.");
  }
  if (file.size < 1 || file.size > maximumBytes) {
    throw new CardImageUploadError("Card images must be 5 MB or smaller.");
  }

  const data = Buffer.from(await file.arrayBuffer());
  return {
    data,
    contentType: file.type,
    byteSize: data.byteLength,
    checksum: createHash("sha256").update(data).digest("hex"),
  };
}
