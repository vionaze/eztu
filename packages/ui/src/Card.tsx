"use client";

import { cn } from "./utils";
import { type HTMLAttributes, forwardRef } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "interactive";
  padding?: "none" | "sm" | "md" | "lg";
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "default", padding = "md", children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-2xl transition-all duration-[var(--duration-normal)] ease-[var(--ease-spring)]",
          variant === "default" && "bg-bg-card border border-white/[0.08] shadow-[var(--shadow-card)]",
          variant === "glass" && "liquid-glass",
          variant === "interactive" &&
            "bg-bg-card border border-white/[0.08] shadow-[var(--shadow-card)] hover:border-accent/30 hover:shadow-[var(--shadow-glow)] cursor-pointer hover:-translate-y-1",
          padding === "none" && "",
          padding === "sm" && "p-3",
          padding === "md" && "p-5",
          padding === "lg" && "p-8",
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = "Card";
export default Card;
