import { describe, expect, it } from "vitest";
import { CardImageUploadError, uploadCardImage } from "./card-image-storage";

describe("card image upload validation", () => {
  it("rejects files larger than the documented 5 MB application limit", async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "oversized.png", { type: "image/png" });
    await expect(uploadCardImage(file)).rejects.toThrow(CardImageUploadError);
    await expect(uploadCardImage(file)).rejects.toThrow("smaller than 5 MB");
  });

  it("rejects unsupported image formats before storage", async () => {
    const file = new File(["not an image"], "card.svg", { type: "image/svg+xml" });
    await expect(uploadCardImage(file)).rejects.toThrow("JPG, PNG, or WebP");
  });
});
