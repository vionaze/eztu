"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { SignIn, useAuth } from "@clerk/nextjs";

export default function LoginPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      router.replace("/");
    }
  }, [isLoaded, isSignedIn, router]);

  return (
    <div className="min-h-[70dvh] pt-28 pb-16 flex items-center justify-center px-4">
      <SignIn routing="hash" />
    </div>
  );
}
