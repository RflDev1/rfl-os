# PlayRFL Responsible Play Policy

Effective date: July 29, 2026  
Version: 1.0-draft

This Policy applies to Match Betting, Blackjack, Coin Flip, and High-Low.

## 1. Gameplay Only

These features use Crowns only. Crowns cannot currently be bought for money, have no cash value, and cannot be redeemed or withdrawn. RFL does not operate real-money gambling.

Do not arrange cash bets, sell Crown balances, or use RFL outcomes to settle outside wagers.

## 2. Age and Location

You must be at least 18 and the age of legal majority where you live. Do not participate where prohibited.

The Service collects a self-reported birth date and technically blocks accounts reporting an age under 18 from Wagering Features. It does not independently verify age, government identification, or location.

## 3. Current Games

### 3.1. Coin Flip

Choose heads or tails and stake Crowns within configured limits. The server uses Node.js cryptographic random-number generation. A correct choice receives the configured payout; an incorrect choice loses the stake.

### 3.2. Blackjack

The server shuffles a standard deck using Node.js cryptographic randomness. You may hit, stand, or double when eligible. The dealer draws below 17 and stands on 17 or more. Pushes, natural Blackjack, and ordinary wins use the implemented, configurable payout rules.

### 3.3. High-Low

Predict whether the next rank is higher or lower. Ace is high and suits do not affect rank. A tie loses the run. After one correct guess, you may cash out; reaching the configured maximum steps also settles. Displayed next returns reflect the current card, direction, and configured target return.

### 3.4. Match Betting

Stake Crowns on an open market before it closes. Accepted odds are stored with the bet. Administrators can lock, settle, or void a market. Match status becoming live also closes betting. A void returns the recorded stake.

## 4. Chance and Risk

No strategy guarantees a profit. Past results do not make an independent outcome due. Displayed probabilities and returns are not financial advice or money.

RFL configures wager ranges, payouts, target returns, and rate limits through environment settings and may change them prospectively.

## 5. Healthy Play

- Set a Crown and time limit before playing.
- Stop at the limit and do not chase losses.
- Do not use alternate accounts to bypass limits.
- Take breaks if play causes stress, secrecy, lost sleep, or conflict.
- Never borrow, pay cash, or trade outside RFL to obtain Crowns.

## 6. Current Controls

The Service enforces configured wager ranges and per-minute rate limits. It does not provide self-exclusion, cooling-off periods, personal loss limits, time reminders, age/location verification, or a responsible-play dashboard.

Request a manual restriction or suspension at **PlayRflHelp@gmail.com**. RFL must establish a documented handling process before launch.

## 7. Errors and Integrity

Do not exploit stale markets, duplicate submissions, incorrect payouts, known results, or defects. RFL may pause, void, reverse, or correct activity affected by error, abuse, manipulation, or invalid results.

## 8. Support

If play is no longer enjoyable or feels difficult to control, stop and seek support from a trusted person or qualified local service. RFL does not provide medical, financial, or treatment advice.
