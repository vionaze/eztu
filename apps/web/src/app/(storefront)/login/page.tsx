import LoginClient from "./LoginClient";
import { getSafeRedirectUrl } from "@/lib/auth-redirect";

interface LoginPageProps {
  searchParams: Promise<{
    redirect_url?: string | string[];
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectUrl = getSafeRedirectUrl(params.redirect_url);

  return <LoginClient redirectUrl={redirectUrl} />;
}
