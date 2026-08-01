/**
 * Contract boundary for the future RFL API. The local adapter deliberately does
 * no networking; replacing it cannot affect match rules or state management.
 */
export class MatchReporter {
  async reportMatch(result) { throw new Error("MatchReporter.reportMatch must be implemented"); }
}

export class LocalMatchReporter extends MatchReporter {
  constructor() { super(); this.results = []; }
  async reportMatch(result) {
    this.results.push(result);
    console.warn(`[RFL][LOCAL_RESULT] ${JSON.stringify(result)}`);
    return { accepted: true, externalId: undefined };
  }
}
