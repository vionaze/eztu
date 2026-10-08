import { requireAdminUser } from "@/lib/clerk";
import ResellerOrdersManager from "./ResellerOrdersManager";

export const dynamic = "force-dynamic";

export default async function AdminResellerOrdersPage() {
  await requireAdminUser();
  return <ResellerOrdersManager />;
}
