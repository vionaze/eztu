import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/layout/AdminShell";
import {
  AuthenticationRequiredError,
  AuthorizationRequiredError,
  requireAdminUser,
} from "@/lib/clerk";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await requireAdminUser();
  } catch (error) {
    // Not signed in → login (middleware usually handles this first)
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login?redirect_url=/admin/dashboard");
    }

    // Signed in but not ADMIN/SUPERADMIN → still 404 (do not leak admin existence)
    if (error instanceof AuthorizationRequiredError) {
      notFound();
    }

    throw error;
  }

  return <AdminShell>{children}</AdminShell>;
}
