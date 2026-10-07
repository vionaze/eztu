import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthenticationRequiredError } from "@/lib/clerk";
import { getCurrentResellerContext } from "@/lib/reseller-auth";
import { resellerDisplayStatus } from "@/lib/reseller-utils";
import ResellerLogoutButton from "./ResellerLogoutButton";
import ResellerSignupForm from "./ResellerSignupForm";
import ResellerCatalog from "./ResellerCatalog";

export const dynamic = "force-dynamic";

export default async function ResellerPage() {
  let authenticatedUser;
  let memberships;
  try {
    ({ authenticatedUser, memberships } = await getCurrentResellerContext());
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login?redirect_url=/");
    }
    throw error;
  }

  const membership = memberships[0];

  if (!membership) {
    return <ResellerApplication />;
  }

  const { organization } = membership;
  const isActive = organization.status === "ACTIVE";

  return (
    <main className="min-h-[100dvh] bg-bg-primary px-4 py-20 text-text-primary">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">EZTopUp Reseller</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">{organization.name}</h1>
          </div>
          <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
            {resellerDisplayStatus(organization.status)}
          </span>
        </div>

        <section className="mt-6 rounded-2xl border border-border bg-bg-card p-5">
          <p className="text-xs uppercase tracking-wide text-text-muted">Account email</p>
          <p className="mt-2 break-all text-sm font-medium">{authenticatedUser.email || "—"}</p>
        </section>

        {!isActive ? (
          <section className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-5 text-sm leading-relaxed text-amber-100/90">
            Your application is not active yet. We will notify you after the review is complete.
            {organization.rejectionReason ? ` Note: ${organization.rejectionReason}` : ""}
          </section>
        ) : (
          <ResellerCatalog orgId={organization.id} />
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/" className="text-sm text-accent hover:underline">
            Back to home
          </Link>
          <ResellerLogoutButton />
        </div>
      </div>
    </main>
  );
}

function ResellerApplication() {
  return (
    <main className="min-h-[100dvh] bg-bg-primary px-4 py-20 text-text-primary">
      <div className="mx-auto max-w-xl rounded-2xl border border-border bg-bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">EZTopUp Reseller</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">Apply for reseller access</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">
          Submit your business name. Our team will review your application and assign your reseller tier.
        </p>
        <ResellerSignupForm />
        <div className="mt-4 text-center">
          <ResellerLogoutButton />
        </div>
      </div>
    </main>
  );
}
