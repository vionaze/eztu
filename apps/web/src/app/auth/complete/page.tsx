import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { requireClerkUser } from "@/lib/clerk";
import { getSafeRedirectUrl } from "@/lib/auth-redirect";

export const dynamic = "force-dynamic";

export default async function CompleteAuthPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const { redirect_url } = await searchParams;
  const redirectUrl = getSafeRedirectUrl(redirect_url);
  const user = await currentUser();
  if (!user) {
    redirect(`/login?redirect_url=${encodeURIComponent(redirectUrl)}`);
  }
  if (user.primaryEmailAddress?.verification?.status !== "verified") {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center px-4">
        <p>Please verify your email in Clerk before completing sign in.</p>
      </main>
    );
  }
  await requireClerkUser();
  redirect(redirectUrl);
}
