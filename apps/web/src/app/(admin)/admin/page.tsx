import { redirect } from "next/navigation";

/** /admin has no content — send admins to the dashboard. */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
