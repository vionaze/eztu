import Link from "next/link";
import { redirect } from "next/navigation";
import { UserProfile } from "@clerk/nextjs";
import { AuthenticationRequiredError, requireClerkUser } from "@/lib/clerk";
import { getCurrentResellerContext } from "@/lib/reseller-auth";

export const dynamic = "force-dynamic";

export default async function ResellerSecurityPage() {
  try {
    await requireClerkUser();
    const { memberships } = await getCurrentResellerContext();
    if (!memberships.some(({ organization }) => organization.status === "ACTIVE")) {
      redirect("/reseller");
    }
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) redirect("/login?redirect_url=/reseller/security");
    throw error;
  }

  return (
    <main className="min-h-[100dvh] bg-bg-primary px-4 py-10 text-text-primary sm:py-16">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">Security</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Protect your reseller account</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-text-secondary">
              Set up an authenticator app and keep your recovery codes offline. Financial actions require a recent second-factor verification; email-only login or passkey enrollment alone will not unlock them.
            </p>
          </div>
          <Link href="/" className="shrink-0 text-sm text-accent hover:underline">Back home</Link>
        </div>
        <div className="rounded-2xl border border-border bg-bg-card p-3 sm:p-5">
          <UserProfile routing="hash" />
        </div>
      </div>
    </main>
  );
}
