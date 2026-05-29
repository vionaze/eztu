import { cn } from "./utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "accent" | "muted";
  className?: string;
}

export default function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variant === "default" && "bg-bg-elevated text-text-secondary",
        variant === "accent" && "bg-accent-muted text-accent",
        variant === "muted" && "bg-bg-card text-text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}
