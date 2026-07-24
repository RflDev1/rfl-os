export function utcRewardDate(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function nextUtcReward(now = new Date()) {
  const next = utcRewardDate(now);
  next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

