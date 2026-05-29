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
  createdAt: string;
}
