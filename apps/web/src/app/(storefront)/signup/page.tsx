import LoginClient from "../login/LoginClient";
import { getSafeRedirectUrl } from "@/lib/auth-redirect";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string | string[] }>;
}) {
  const { redirect_url } = await searchParams;
  return <LoginClient mode="signup" redirectUrl={getSafeRedirectUrl(redirect_url)} />;
}
