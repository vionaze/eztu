export const RESELLER_MFA_MAX_AGE_MINUTES = 10;

export function evaluateResellerMfa(totpEnabled: boolean, factorVerificationAge: unknown) {
  const valid = Array.isArray(factorVerificationAge) && factorVerificationAge.length === 2 &&
    factorVerificationAge.every((value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= -1);
  const secondFactorAge = valid ? factorVerificationAge[1] as number : -1;
  return {
    enrolled: totpEnabled,
    verifiedRecently: totpEnabled && secondFactorAge >= 0 && secondFactorAge < RESELLER_MFA_MAX_AGE_MINUTES,
  };
}
