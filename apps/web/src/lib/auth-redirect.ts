export function getSafeRedirectUrl(value: string | string[] | undefined) {
  const redirectUrl = Array.isArray(value) ? value[0] : value;
  if (!redirectUrl || !redirectUrl.startsWith("/") || redirectUrl.startsWith("//") || redirectUrl.includes("\\")) {
    return "/";
  }
  return redirectUrl;
}
