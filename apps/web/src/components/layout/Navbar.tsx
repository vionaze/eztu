"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SignOutButton, UserButton, useAuth } from "@clerk/nextjs";
import {
  List,
  X,
  MagnifyingGlass,
  ShoppingCart,
  User,
  Receipt,
  SquaresFour,
  SignOut,
} from "@phosphor-icons/react";
import CountrySelector from "@/components/ui/CountrySelector";

const navLinks = [
  { label: "Vouchers", href: "/vouchers" },
  { label: "Products", href: "/products" },
  { label: "Blog", href: "/blog" },
];

function AccountUserButton({ isAdmin }: { isAdmin: boolean }) {
  return (
    <UserButton>
      <UserButton.MenuItems>
        <UserButton.Link
          href="/account/purchases"
          label="Purchase history"
          labelIcon={<Receipt size={16} weight="bold" />}
        />
        {isAdmin ? (
          <UserButton.Link
            href="/admin/dashboard"
            label="Admin panel"
            labelIcon={<SquaresFour size={16} weight="bold" />}
          />
        ) : null}
      </UserButton.MenuItems>
    </UserButton>
  );
}

export default function Navbar() {
  const { isLoaded, isSignedIn } = useAuth();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Always hide drawer after navigation (covers Link, browser back, etc.)
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Escape + body scroll lock while open
  useEffect(() => {
    if (!mobileOpen) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  // Resolve DB role (ADMIN / SUPERADMIN) for navbar Admin link
  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;

    fetch("/api/account/me", { credentials: "same-origin" })
      .then(async (res) => {
        if (!res.ok) return { isAdmin: false };
        return res.json() as Promise<{ isAdmin?: boolean }>;
      })
      .then((data) => {
        if (!cancelled) setIsAdmin(Boolean(data.isAdmin));
      })
      .catch(() => {
        if (!cancelled) setIsAdmin(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out",
          // Same vertical padding top/bottom (1rem / md 1.25rem); safe-area only adds to top
          "pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] md:pb-5 md:pt-[calc(1.25rem+env(safe-area-inset-top,0px))]",
          scrolled
            ? "bg-bg-primary/95 border-b border-border md:border-0 md:liquid-glass-subtle"
            : "bg-transparent"
        )}
      >
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 flex items-center justify-between gap-3 sm:gap-4">
          {/* Logo — previous size × 1.25 (shared with footer) */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group min-w-0"
            id="nav-logo"
            onClick={closeMobile}
          >
            <div className="relative h-[35px] w-[120px] sm:h-10 sm:w-40 md:h-[45px] md:w-[200px] transition-transform duration-300 group-hover:scale-[1.03]">
              <Image
                src="/logo.png"
                alt="EZTopUp"
                fill
                className="object-contain object-left"
                sizes="(max-width: 640px) 120px, (max-width: 768px) 160px, 200px"
                priority
              />
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1" id="nav-desktop">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors rounded-lg hover:bg-white/5"
              >
                {link.label}
              </Link>
            ))}
            {isSignedIn && isAdmin ? (
              <Link
                href="/admin/dashboard"
                className="px-4 py-2 text-sm font-semibold text-accent hover:text-accent-hover transition-colors rounded-lg hover:bg-accent/10"
              >
                Admin
              </Link>
            ) : null}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Desktop country selector */}
            <div className="hidden md:block">
              <CountrySelector />
            </div>

            {/* Search */}
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer"
              id="nav-search-btn"
              aria-label="Search"
            >
              <MagnifyingGlass size={18} />
            </button>

            {/* Cart */}
            <button
              className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer relative"
              id="nav-cart-btn"
              aria-label="Cart"
            >
              <ShoppingCart size={18} />
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-bg-primary text-[10px] font-bold flex items-center justify-center">
                0
              </span>
            </button>

            {/* Auth — go to /login so Terms checkbox is always required */}
            <div className="hidden sm:flex items-center" id="nav-login-btn">
              {isSignedIn ? (
                <AccountUserButton isAdmin={isAdmin} />
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-bg-card border border-border text-sm font-medium text-text-primary hover:border-accent/30 transition-all"
                  aria-disabled={!isLoaded}
                >
                  <User size={16} />
                  Login
                </Link>
              )}
            </div>

            {/* Mobile: country next to burger (dropdown opens down into page, not clipped by drawer) */}
            <div className="md:hidden relative z-[70]">
              <CountrySelector compact />
            </div>

            {/* Mobile Menu Toggle */}
            <button
              className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer"
              onClick={() => setMobileOpen(!mobileOpen)}
              id="nav-mobile-toggle"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <List size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer: overlay + panel share one AnimatePresence for clean exit */}
      <AnimatePresence>
        {mobileOpen ? (
          <div
            key="mobile-nav-shell"
            className="fixed inset-0 z-[55] md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile navigation"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0 bg-black/70"
              onClick={closeMobile}
              aria-hidden
            />
            <motion.nav
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="absolute top-0 right-0 flex h-[100dvh] w-[min(18rem,100vw)] max-w-full flex-col gap-4 overflow-y-auto overscroll-contain border-l border-border bg-bg-secondary px-5 shadow-2xl"
              style={{
                paddingTop: "max(1.25rem, env(safe-area-inset-top))",
                paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))",
                paddingRight: "max(1.25rem, env(safe-area-inset-right))",
              }}
              id="nav-mobile-menu"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between shrink-0">
                <span className="text-lg font-bold text-text-primary">Menu</span>
                <button
                  type="button"
                  onClick={closeMobile}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-colors cursor-pointer"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={closeMobile}
                    className={cn(
                      "px-4 py-3.5 text-base font-medium rounded-xl transition-colors",
                      pathname === link.href || pathname.startsWith(`${link.href}/`)
                        ? "bg-white/8 text-text-primary"
                        : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
                {isSignedIn && isAdmin ? (
                  <Link
                    href="/admin/dashboard"
                    onClick={closeMobile}
                    className="px-4 py-3.5 text-base font-semibold text-accent hover:bg-accent/10 rounded-xl transition-colors"
                  >
                    Admin panel
                  </Link>
                ) : null}
              </div>

              <div className="mt-auto flex flex-col gap-2 pt-4 border-t border-border/80">
                {isSignedIn ? (
                  <>
                    <Link
                      href="/account/purchases"
                      onClick={closeMobile}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3.5 text-base font-medium rounded-xl transition-colors",
                        pathname.startsWith("/account")
                          ? "bg-white/8 text-text-primary"
                          : "text-text-secondary hover:text-text-primary hover:bg-white/5"
                      )}
                    >
                      <Receipt
                        size={20}
                        weight="bold"
                        className="shrink-0 text-text-muted"
                      />
                      Purchase history
                    </Link>
                    <SignOutButton>
                      <button
                        type="button"
                        onClick={closeMobile}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-base font-medium text-red-300/90 hover:text-red-200 hover:bg-red-500/10 rounded-xl transition-colors cursor-pointer text-left"
                      >
                        <SignOut size={20} weight="bold" className="shrink-0" />
                        Sign out
                      </button>
                    </SignOutButton>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={closeMobile}
                    className="flex items-center justify-center gap-2 h-11 rounded-xl bg-accent text-bg-primary font-medium text-sm transition-opacity active:opacity-90"
                  >
                    <User size={16} weight="bold" />
                    Login / Register
                  </Link>
                )}
              </div>
            </motion.nav>
          </div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
