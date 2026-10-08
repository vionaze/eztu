import "server-only";

import { auth, currentUser } from "@clerk/nextjs/server";
import { AuthenticationRequiredError, AuthorizationRequiredError } from "@/lib/clerk";
import { evaluateResellerMfa } from "@/lib/reseller-mfa-policy";
import { requireActiveReseller } from "@/lib/reseller-pricing-service";

export type ResellerMfaStatus = {
  required: true;
  enrolled: boolean;
  verifiedRecently: boolean;
  setupUrl: string;
};

export async function getResellerMfaStatus(): Promise<ResellerMfaStatus> {
  const session = await auth();
  if (!session.userId) throw new AuthenticationRequiredError();
  const user = await currentUser();
  if (!user || user.id !== session.userId) throw new AuthenticationRequiredError();
  return {
    required: true,
    ...evaluateResellerMfa(user.totpEnabled, session.factorVerificationAge),
    setupUrl: "/reseller/security",
  };
}

export async function requireResellerMfa(organizationId: string) {
  const context = await requireActiveReseller(organizationId);
  const status = await getResellerMfaStatus();
  if (!status.enrolled || !status.verifiedRecently) {
    throw new AuthorizationRequiredError("A recently verified authenticator factor is required for this action.");
  }
  return { ...context, mfa: status };
}
