import Link from "next/link";
import { Button } from "@kupon/ui";
import { FadeUp } from "@/components/motion/StaggerReveal";
import { House } from "@phosphor-icons/react/dist/ssr";

export default function NotFound() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-4">
      <FadeUp>
        <div className="text-center space-y-6 max-w-md">
          <div className="text-8xl font-bold tracking-tighter gradient-text">
            404
          </div>
          <h1 className="text-2xl font-bold text-text-primary">
            Page not found
          </h1>
          <p className="text-sm text-text-secondary leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved. Let&apos;s get you back on track.
          </p>
          <Link href="/">
            <Button size="lg">
              <House size={16} weight="bold" />
              Back to Home
            </Button>
          </Link>
        </div>
      </FadeUp>
    </div>
  );
}
