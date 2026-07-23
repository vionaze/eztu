"use client";

import AdminSidebar from "@/components/layout/AdminSidebar";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const pageTitles: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/products": "Products",
  "/admin/categories": "Categories",
  "/admin/orders": "Orders",
  "/admin/blog": "Blog",
  "/admin/logs": "Activity Logs",
  "/admin/settings": "Settings",
};

const widePages = ["/admin/orders", "/admin/logs", "/admin/dashboard"];

export default function AdminShell({
  children,
  adminEmail,
  adminRole,
  dbRole,
  viaAllowlist,
}: {
  children: React.ReactNode;
  adminEmail?: string | null;
  adminRole?: string;
  dbRole?: string;
  viaAllowlist?: boolean;
}) {
  const pathname = usePathname();

  let title = "Admin";
  if (pathname.startsWith("/admin/products/new")) title = "New Product";
  else if (pathname.match(/^\/admin\/products\/[^/]+/)) title = "Edit Product";
  else if (pathname.startsWith("/admin/blog/new")) title = "New Post";
  else if (pathname.match(/^\/admin\/blog\/[^/]+/)) title = "Edit Post";
  else {
    title =
      Object.entries(pageTitles).find(([key]) =>
        pathname.startsWith(key)
      )?.[1] || "Admin";
  }

  const isWide = widePages.some((p) => pathname.startsWith(p));

  const roleBadge =
    adminRole === "SUPERADMIN"
      ? "border-violet-400/35 bg-violet-400/15 text-violet-200"
      : "border-orange-400/35 bg-orange-400/15 text-orange-200";

  return (
    <div className="admin-scope min-h-[100dvh] bg-bg-primary">
      <AdminSidebar />

      <div className="mt-14 md:mt-0 md:ml-[232px] transition-[margin] duration-300">
        <header className="sticky top-14 md:top-0 z-30 border-b border-border/80 bg-bg-primary/90 backdrop-blur-md">
          <div className="mx-auto flex h-11 md:h-12 max-w-[80rem] items-center justify-between gap-3 px-3 sm:px-4 lg:px-5">
            <h1 className="text-sm font-semibold tracking-tight text-text-primary">
              {title}
            </h1>

            <div className="flex items-center gap-2 min-w-0">
              {adminRole ? (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    roleBadge
                  )}
                  title={
                    viaAllowlist
                      ? `DB role: ${dbRole || "USER"} · access via ADMIN_EMAILS`
                      : `DB role: ${dbRole || adminRole}`
                  }
                >
                  {adminRole}
                  {viaAllowlist ? " · allowlist" : ""}
                </span>
              ) : null}
              {adminEmail ? (
                <span className="hidden sm:inline truncate text-[11px] text-text-muted max-w-[200px]">
                  {adminEmail}
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <main className="px-3 py-3 sm:px-4 sm:py-3.5 lg:px-5 lg:py-4">
          <div className={cn("admin-page", isWide && "admin-page-wide")}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
