export function ranksEligible(requesterRank: number, opponentRank: number, range: number) {
  return Number.isInteger(requesterRank) && Number.isInteger(opponentRank) && requesterRank > 0 && opponentRank > 0 && requesterRank !== opponentRank && Math.abs(requesterRank - opponentRank) <= range;
}
