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
}: {
  children: React.ReactNode;
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

  return (
    <div className="admin-scope min-h-[100dvh] bg-bg-primary">
      <AdminSidebar />

      <div className="mt-14 md:mt-0 md:ml-[232px] transition-[margin] duration-300">
        <header className="sticky top-14 md:top-0 z-30 border-b border-border/80 bg-bg-primary/90 backdrop-blur-md">
          <div className="mx-auto flex h-12 md:h-14 max-w-[80rem] items-center px-4 sm:px-5 lg:px-6">
            <h1 className="text-[15px] font-semibold tracking-tight text-text-primary">
              {title}
            </h1>
          </div>
        </header>

        <main className="px-4 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
          <div
            className={cn(
              "admin-page",
              isWide && "admin-page-wide"
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
