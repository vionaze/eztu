import { notFound } from "next/navigation";
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
    if (
      error instanceof AuthenticationRequiredError ||
      error instanceof AuthorizationRequiredError
    ) {
      notFound();
    }

    throw error;
  }

  return <AdminShell>{children}</AdminShell>;
}
