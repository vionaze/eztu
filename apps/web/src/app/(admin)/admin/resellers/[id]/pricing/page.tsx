import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@kupon/db";
import { requirePlatformAdminForResellers } from "@/lib/reseller-auth";
import PricingEditor from "./PricingEditor";

export const dynamic = "force-dynamic";

export default async function ResellerPricingPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePlatformAdminForResellers();
  const { id } = await params;
  const organization = await prisma.resellerOrganization.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  if (!organization) notFound();

  return (
    <div className="space-y-5 text-text-primary">
      <Link href="/admin/resellers" className="text-sm text-accent hover:underline focus-visible:outline-2 focus-visible:outline-accent">Back to resellers</Link>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">B2B pricing</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{organization.name}</h1>
        <p className="mt-2 text-sm text-text-secondary">Manage SKU-level pricing overrides. Changes stay in drafts until you save each row.</p>
      </div>
      <PricingEditor orgId={organization.id} />
    </div>
  );
}
