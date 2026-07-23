export type ProductFulfillmentType = "TOP_UP" | "VOUCHER";

export interface Category {
  id: string;
  name: string;
  slug: string;
  image?: string;
  productCount?: number;
}

export interface ProductVariant {
  id: string;
  name: string;
  priceIDR: number;
  priceUSD: number;
  supplierCostIDR?: number | null;
  supplierSku?: string | null;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  image: string;
  categoryId: string;
  category?: Category;
  variants: ProductVariant[];
  featured: boolean;
  published: boolean;
  /** TOP_UP = account fields; VOUCHER = code only */
  fulfillmentType: ProductFulfillmentType;
  requiresServerId: boolean;
  gameIdLabel: string;
  serverIdLabel: string;
  createdAt: string;
}
