import { describe, expect, it } from "vitest";
import { CardImageUploadError, prepareCardImage } from "./card-image-storage";

describe("card image upload validation", () => {
  it("rejects files larger than the documented 5 MB application limit", async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "oversized.png", { type: "image/png" });
    await expect(prepareCardImage(file)).rejects.toThrow(CardImageUploadError);
    await expect(prepareCardImage(file)).rejects.toThrow("5 MB or smaller");
  });

  it("rejects unsupported image formats before storage", async () => {
    const file = new File(["not an image"], "card.svg", { type: "image/svg+xml" });
    await expect(prepareCardImage(file)).rejects.toThrow("JPG, PNG, or WebP");
  });

  it("prepares valid artwork for database storage", async () => {
    const file = new File(["card art"], "card.webp", { type: "image/webp" });
    const image = await prepareCardImage(file);
    expect(image.contentType).toBe("image/webp");
    expect(image.byteSize).toBe(8);
    expect(image.checksum).toHaveLength(64);
  });
});
