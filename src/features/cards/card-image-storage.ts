import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "@/lib/env";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);
const maximumBytes = 5 * 1024 * 1024;

export class CardImageUploadError extends Error {}

function sha256(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: Buffer | string, value: string) {
  return createHmac("sha256", key).update(value).digest();
}

export async function uploadCardImage(file: File) {
  const extension = allowedTypes.get(file.type);
  if (!extension) throw new CardImageUploadError("Use a JPG, PNG, or WebP image.");
  if (file.size < 1 || file.size > maximumBytes) throw new CardImageUploadError("Card images must be smaller than 5 MB.");
  const env = getEnv();
  if (!env.CARD_IMAGE_STORAGE_ENDPOINT || !env.CARD_IMAGE_STORAGE_REGION || !env.CARD_IMAGE_STORAGE_BUCKET || !env.CARD_IMAGE_STORAGE_ACCESS_KEY || !env.CARD_IMAGE_STORAGE_SECRET_KEY || !env.CARD_IMAGE_PUBLIC_BASE_URL) {
    if (env.NODE_ENV === "development") {
      const filename = `${randomUUID()}.${extension}`;
      const uploadDirectory = path.join(process.cwd(), "public", "uploads", "cards");
      await mkdir(uploadDirectory, { recursive: true });
      await writeFile(path.join(uploadDirectory, filename), Buffer.from(await file.arrayBuffer()), { flag: "wx" });
      return `/uploads/cards/${filename}`;
    }
    throw new CardImageUploadError("Card image storage is not configured yet.");
  }
  const key = `cards/${new Date().getUTCFullYear()}/${randomUUID()}.${extension}`;
  const body = Buffer.from(await file.arrayBuffer());
  const endpoint = new URL(env.CARD_IMAGE_STORAGE_ENDPOINT);
  endpoint.pathname = `${endpoint.pathname.replace(/\/$/, "")}/${env.CARD_IMAGE_STORAGE_BUCKET}/${key}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const cacheControl = "public, max-age=31536000, immutable";
  const canonicalHeaders = `cache-control:${cacheControl}\ncontent-type:${file.type}\nhost:${endpoint.host}\nx-amz-acl:public-read\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "cache-control;content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date";
  const canonicalUri = endpoint.pathname.split("/").map(encodeURIComponent).join("/");
  const canonicalRequest = `PUT\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const scope = `${date}/${env.CARD_IMAGE_STORAGE_REGION}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
  const dateKey = hmac(`AWS4${env.CARD_IMAGE_STORAGE_SECRET_KEY}`, date);
  const regionKey = hmac(dateKey, env.CARD_IMAGE_STORAGE_REGION);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${env.CARD_IMAGE_STORAGE_ACCESS_KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const response = await fetch(endpoint, {
    method: "PUT",
    body,
    headers: {
      Authorization: authorization,
      "Cache-Control": cacheControl,
      "Content-Type": file.type,
      "x-amz-acl": "public-read",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
  });
  if (!response.ok) throw new CardImageUploadError("The card image could not be stored. Check the Spaces credentials and bucket permissions.");
  return `${env.CARD_IMAGE_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}
