"use client";

import AdminSidebar from "@/components/layout/AdminSidebar";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/admin/dashboard": "Dashboard",
  "/admin/products": "Products",
  "/admin/categories": "Categories",
  "/admin/orders": "Orders",
  "/admin/blog": "Blog",
  "/admin/logs": "Activity Logs",
  "/admin/settings": "Settings",
};

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

  return (
    <div className="min-h-[100dvh] bg-bg-primary">
      <AdminSidebar />

      <div className="mt-14 md:mt-0 md:ml-[240px] transition-all duration-300">
        <header className="sticky top-14 md:top-0 z-30 bg-bg-primary/80 backdrop-blur-lg border-b border-border">
          <div className="px-6 md:px-8 h-14 md:h-16 flex items-center">
            <h1 className="text-lg font-semibold text-text-primary">{title}</h1>
          </div>
        </header>

        <main className="p-6 md:p-8">{children}</main>
      </div>
    </div>
  );
}
