export function coinFlipPayout(wager: number, payoutBasisPoints: number) {
  if (!Number.isInteger(wager) || wager <= 0) throw new Error("Wager must be a positive integer.");
  if (!Number.isInteger(payoutBasisPoints) || payoutBasisPoints < 10_000) throw new Error("Payout basis points are invalid.");
  return Math.floor((wager * payoutBasisPoints) / 10_000);
}

export function payoutLabel(payoutBasisPoints: number) {
  const multiplier = payoutBasisPoints / 10_000;
  return `${Number.isInteger(multiplier) ? multiplier.toFixed(0) : multiplier.toFixed(2)}×`;
}

