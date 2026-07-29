export const TERMS_VERSION = "1.0-draft";
export const PRIVACY_VERSION = "1.0-draft";
export const MINIMUM_ACCOUNT_AGE = 13;
export const WAGERING_MINIMUM_AGE = 18;

type LegalAccount = {
  dateOfBirth: Date | null;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
  privacyAcceptedAt: Date | null;
  privacyVersion: string | null;
};

export function parseDateOfBirth(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

export function isAtLeastAge(dateOfBirth: Date, minimumAge: number, now = new Date()) {
  const cutoff = new Date(Date.UTC(
    now.getUTCFullYear() - minimumAge,
    now.getUTCMonth(),
    now.getUTCDate(),
  ));
  return dateOfBirth <= cutoff;
}

export function hasCurrentLegalConsent(account: LegalAccount) {
  return Boolean(
    account.dateOfBirth &&
    account.termsAcceptedAt &&
    account.termsVersion === TERMS_VERSION &&
    account.privacyAcceptedAt &&
    account.privacyVersion === PRIVACY_VERSION
  );
}

export function canUseWagering(account: LegalAccount, now = new Date()) {
  return hasCurrentLegalConsent(account) &&
    Boolean(account.dateOfBirth && isAtLeastAge(account.dateOfBirth, WAGERING_MINIMUM_AGE, now));
}
