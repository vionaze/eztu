"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  SquaresFour,
  Package,
  Tag,
  ShoppingCart,
  Article,
  Gear,
  SignOut,
  CaretLeft,
  List,
  Users,
} from "@phosphor-icons/react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const sidebarLinks = [
  { label: "Dashboard", href: "/admin/dashboard", icon: SquaresFour },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Categories", href: "/admin/categories", icon: Tag },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Members", href: "/admin/members", icon: Users },
  { label: "Blog", href: "/admin/blog", icon: Article },
  { label: "Logs", href: "/admin/logs", icon: List },
  { label: "Settings", href: "/admin/settings", icon: Gear },
];

function SidebarContent({
  collapsed,
  isActive,
  onNavigate,
  onToggleCollapsed,
}: {
  collapsed: boolean;
  isActive: (href: string) => boolean;
  onNavigate: () => void;
  onToggleCollapsed: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border/80">
        <Link
          href="/admin/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2 min-w-0"
        >
          {!collapsed ? (
            <div className="relative h-7 w-[128px] shrink-0">
              <Image
                src="/logo.png"
                alt="EZTopUp"
                fill
                className="object-contain object-left"
                sizes="128px"
                priority
              />
            </div>
          ) : (
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md">
              <Image
                src="/logo.png"
                alt="EZTopUp"
                fill
                className="object-cover object-left"
                sizes="28px"
                priority
              />
            </div>
          )}
        </Link>
        {!collapsed && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
            Admin
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2.5 py-3 space-y-0.5">
        {sidebarLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors",
                active
                  ? "bg-accent/10 text-accent border border-accent/20"
                  : "text-text-secondary hover:text-text-primary hover:bg-white/[0.04] border border-transparent"
              )}
            >
              <link.icon
                size={18}
                weight={active ? "fill" : "regular"}
                className="flex-shrink-0"
              />
              {!collapsed && <span>{link.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Actions */}
      <div className="px-2.5 py-3 border-t border-border/80 space-y-0.5">
        <button
          onClick={onToggleCollapsed}
          className="hidden md:flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-[13px] font-medium text-text-muted hover:text-text-primary hover:bg-white/[0.04] transition-colors cursor-pointer"
        >
          <CaretLeft
            size={18}
            className={cn(
              "flex-shrink-0 transition-transform",
              collapsed && "rotate-180"
            )}
          />
          {!collapsed && <span>Collapse</span>}
        </button>

        <Link
          href="/"
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium text-text-muted hover:text-text-primary hover:bg-white/[0.04] transition-colors"
        >
          <SignOut size={18} className="flex-shrink-0" />
          {!collapsed && <span>Back to Store</span>}
        </Link>
      </div>
    </div>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col fixed top-0 left-0 bottom-0 z-40 bg-bg-secondary/95 border-r border-border/80 transition-all duration-300",
          collapsed ? "w-[64px]" : "w-[232px]"
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          isActive={isActive}
          onNavigate={() => setMobileOpen(false)}
          onToggleCollapsed={() => setCollapsed((value) => !value)}
        />
      </aside>

      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-bg-secondary/95 border-b border-border/80 flex items-center px-3 gap-2.5">
        <button
          onClick={() => setMobileOpen(true)}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <List size={20} />
        </button>
        <div className="relative h-7 w-28">
          <Image
            src="/logo.png"
            alt="EZTopUp"
            fill
            className="object-contain object-left"
            sizes="112px"
          />
        </div>
      </div>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-[232px] bg-bg-secondary border-r border-border/80"
            >
              <SidebarContent
                collapsed={false}
                isActive={isActive}
                onNavigate={() => setMobileOpen(false)}
                onToggleCollapsed={() => setCollapsed((value) => !value)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
