export const MARKETPLACE_FEE_BPS = 0;

export function sellerProceeds(price: number, feeBps = MARKETPLACE_FEE_BPS) {
  if (!Number.isInteger(price) || price <= 0) throw new Error("Price must be a positive integer.");
  const fee = Math.floor(price * feeBps / 10_000);
  return { fee, proceeds: price - fee };
}
