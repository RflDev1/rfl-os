export function betPayout(stake: number, oddsBps: number) {
  if (!Number.isInteger(stake) || stake <= 0) throw new Error("Stake must be a positive integer.");
  if (!Number.isInteger(oddsBps) || oddsBps < 10_000) throw new Error("Odds must be at least 1.00.");
  return Math.floor(stake * oddsBps / 10_000);
}

export function oddsLabel(oddsBps: number) {
  return (oddsBps / 10_000).toFixed(2);
}
