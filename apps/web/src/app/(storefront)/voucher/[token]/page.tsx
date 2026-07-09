import { notFound } from "next/navigation";
import { Card } from "@kupon/ui";
import CopyVoucherButton from "@/app/(storefront)/account/purchases/CopyVoucherButton";
import { getVoucherDeliveryByToken } from "@/lib/voucher-delivery";

export const metadata = {
  title: "Voucher | EZTopUp",
  robots: {
    index: false,
    follow: false,
  },
};

type VoucherPageProps = {
  params: Promise<{ token: string }>;
};

function getVoucherCodes(value: string | null | undefined) {
  return (value || "")
    .split(/\r?\n/)
    .map((code) => code.trim())
    .filter(Boolean);
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function VoucherPage({ params }: VoucherPageProps) {
  const { token } = await params;
  const deliveryLink = await getVoucherDeliveryByToken(token);

  if (!deliveryLink) {
    notFound();
  }

  const order = deliveryLink.order;
  const item = order.items[0];
  const supplierOrder = order.supplierOrder;
  const voucherCodes = getVoucherCodes(supplierOrder?.voucherCode);

  if (!item || !supplierOrder || supplierOrder.status !== "FULFILLED") {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-accent">
          EZTopUp voucher
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-text-primary">
          Your voucher is ready
        </h1>
        <p className="mt-3 text-sm text-text-secondary">
          Order {order.orderNumber} for {order.email}
        </p>
      </div>

      <Card className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
              Product
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {item.product.name}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
              Variant
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {item.variant.name}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
              Quantity
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {item.quantity}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
              Delivered
            </p>
            <p className="mt-1 text-sm font-medium text-text-primary">
              {formatDate(supplierOrder.fulfilledAt)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
            Voucher code{voucherCodes.length > 1 ? "s" : ""}
          </p>
          {voucherCodes.map((code, index) => (
            <div
              key={`${code}-${index}`}
              className="flex flex-col gap-3 rounded-lg border border-border bg-bg-elevated p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <code className="break-all font-[family-name:var(--font-geist-mono)] text-sm text-text-primary">
                {code}
              </code>
              <CopyVoucherButton value={code} ariaLabel="Copy voucher code" />
            </div>
          ))}
          {supplierOrder.voucherPin && (
            <div className="rounded-lg border border-border bg-bg-elevated p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-text-muted">
                PIN
              </p>
              <code className="mt-2 block break-all font-[family-name:var(--font-geist-mono)] text-sm text-text-primary">
                {supplierOrder.voucherPin}
              </code>
            </div>
          )}
        </div>
      </Card>
    </main>
  );
}
