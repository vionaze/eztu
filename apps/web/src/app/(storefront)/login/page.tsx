import LoginClient from "./LoginClient";

interface LoginPageProps {
  searchParams: Promise<{
    redirect_url?: string | string[];
  }>;
}

function getSafeRedirectUrl(value: string | string[] | undefined) {
  const redirectUrl = Array.isArray(value) ? value[0] : value;

  if (!redirectUrl || !redirectUrl.startsWith("/") || redirectUrl.startsWith("//")) {
    return "/";
  }

  return redirectUrl;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const redirectUrl = getSafeRedirectUrl(params.redirect_url);

  return <LoginClient redirectUrl={redirectUrl} />;
}
