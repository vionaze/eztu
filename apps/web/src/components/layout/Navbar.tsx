"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SignInButton, UserButton, useAuth } from "@clerk/nextjs";
import {
  List,
  X,
  MagnifyingGlass,
  ShoppingCart,
  User,
} from "@phosphor-icons/react";
import CountrySelector from "@/components/ui/CountrySelector";

const navLinks = [
  { label: "Vouchers", href: "/vouchers" },
  { label: "Products", href: "/products" },
  { label: "Blog", href: "/blog" },
];

export default function Navbar() {
  const { isLoaded, isSignedIn } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-[var(--ease-spring)]",
          scrolled
            ? "liquid-glass-subtle border-0 py-3"
            : "bg-transparent py-5"
        )}
      >
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2.5 group"
            id="nav-logo"
          >
            <div className="relative h-12 w-44 sm:w-52 md:h-14 md:w-60 transition-transform duration-300 group-hover:scale-[1.03]">
              <Image
                src="/logo.png"
                alt="EZTopUp"
                fill
                className="object-contain object-left"
                sizes="(max-width: 640px) 176px, 240px"
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
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Country/Currency Selector */}
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

            {/* Auth */}
            <div className="hidden sm:flex items-center" id="nav-login-btn">
              {isSignedIn ? (
                <UserButton />
              ) : (
                <SignInButton mode="modal">
                  <button
                    type="button"
                    disabled={!isLoaded}
                    className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-bg-card border border-border text-sm font-medium text-text-primary hover:border-accent/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <User size={16} />
                    Login
                  </button>
                </SignInButton>
              )}
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

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile Menu Panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 z-50 w-72 bg-bg-secondary border-l border-border p-6 flex flex-col gap-6 md:hidden"
            id="nav-mobile-menu"
          >
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-text-primary">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-white/5 transition-all cursor-pointer"
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
                  onClick={() => setMobileOpen(false)}
                  className="px-4 py-3 text-base font-medium text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-xl transition-all"
                >
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-3">
              {isSignedIn ? (
                <div className="flex items-center justify-between h-11 rounded-xl bg-bg-card border border-border px-4">
                  <span className="text-sm font-medium text-text-primary">Account</span>
                  <UserButton />
                </div>
              ) : (
                <SignInButton mode="modal">
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    disabled={!isLoaded}
                    className="flex items-center justify-center gap-2 h-11 rounded-xl bg-accent text-bg-primary font-medium text-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <User size={16} weight="bold" />
                    Login / Register
                  </button>
                </SignInButton>
              )}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </>
  );
}
