const DEFAULT_PAYMENT_INVOICE_EXPIRY_MINUTES = 60;

export function getPaymentInvoiceExpiryMinutes() {
  const parsed = Number(process.env.PAYMENT_INVOICE_EXPIRY_MINUTES || "");

  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return DEFAULT_PAYMENT_INVOICE_EXPIRY_MINUTES;
}

export function resolvePaymentExpiresAt({
  explicitExpiresAt,
  createdAt,
}: {
  explicitExpiresAt?: Date | null;
  createdAt: Date;
}) {
  if (explicitExpiresAt) {
    return explicitExpiresAt;
  }

  const expiryMs = getPaymentInvoiceExpiryMinutes() * 60 * 1000;
  return new Date(createdAt.getTime() + expiryMs);
}
