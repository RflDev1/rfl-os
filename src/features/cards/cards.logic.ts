import { randomInt } from "node:crypto";
import type { CardRarity } from "@/generated/prisma/client";

export type DropWeights = Record<CardRarity, number>;

export function rarityRates(weights: DropWeights) {
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0);
  if (total <= 0) throw new Error("Drop weights must total more than zero.");
  return Object.fromEntries(Object.entries(weights).map(([rarity, weight]) => [rarity, weight / total])) as Record<CardRarity, number>;
}

export function pickRarity(weights: DropWeights, nextInt: (maximum: number) => number = randomInt): CardRarity {
  const entries = Object.entries(weights).filter(([, weight]) => weight > 0) as Array<[CardRarity, number]>;
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total <= 0) throw new Error("No cards are available in this drop table.");
  let roll = nextInt(total);
  for (const [rarity, weight] of entries) {
    if (roll < weight) return rarity;
    roll -= weight;
  }
  return entries[entries.length - 1]![0];
}
