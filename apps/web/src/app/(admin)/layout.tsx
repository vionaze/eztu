import { notFound, redirect } from "next/navigation";
import AdminShell from "@/components/layout/AdminShell";
import {
  AuthenticationRequiredError,
  AuthorizationRequiredError,
  isAdminEmail,
  requireAdminUser,
} from "@/lib/clerk";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    const admin = await requireAdminUser();

    const viaAllowlist =
      admin.role !== "ADMIN" &&
      admin.role !== "SUPERADMIN" &&
      isAdminEmail(admin.email);

    const displayRole =
      admin.role === "SUPERADMIN"
        ? "SUPERADMIN"
        : admin.role === "ADMIN"
          ? "ADMIN"
          : viaAllowlist
            ? "SUPERADMIN"
            : "ADMIN";

    return (
      <AdminShell
        adminEmail={admin.email}
        adminRole={displayRole}
        dbRole={admin.role}
        viaAllowlist={viaAllowlist}
      >
        {children}
      </AdminShell>
    );
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect("/login?redirect_url=/admin/dashboard");
    }

    if (error instanceof AuthorizationRequiredError) {
      notFound();
    }

    throw error;
  }
}
