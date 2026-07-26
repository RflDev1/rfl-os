import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cardDefinitionId: string }> },
) {
  const { cardDefinitionId } = await params;
  const image = await prisma.cardImage.findUnique({
    where: { cardDefinitionId },
    select: { data: true, contentType: true, byteSize: true, checksum: true },
  });
  if (!image) return new Response("Card image not found.", { status: 404 });

  const etag = `"${image.checksum}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  return new Response(Uint8Array.from(image.data), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(image.byteSize),
      "Content-Type": image.contentType,
      ETag: etag,
    },
  });
}
