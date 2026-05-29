import { cn } from "./utils";

interface SkeletonProps {
  className?: string;
  variant?: "text" | "circular" | "rectangular";
}

export default function Skeleton({ className, variant = "rectangular" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "skeleton-shimmer",
        variant === "text" && "h-4 rounded-md",
        variant === "circular" && "rounded-full",
        variant === "rectangular" && "rounded-2xl",
        className
      )}
      aria-hidden="true"
    />
  );
}

/**
 * Product card skeleton for loading states
 */
export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl bg-bg-card border border-white/[0.08] overflow-hidden">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-1/2 h-3" />
        <Skeleton variant="text" className="w-1/3 h-5" />
      </div>
    </div>
  );
}
