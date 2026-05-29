export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  productName: string;
  variantName: string;
  gameId?: string;
  serverId?: string;
  amount: number;
  currency: string;
  status: OrderStatus;
  paymentProvider?: string;
  paymentProviderPaymentId?: string;
  paymentProviderInvoiceId?: string;
  paymentUrl?: string;
  paidAt?: string;
  createdAt: string;
}
