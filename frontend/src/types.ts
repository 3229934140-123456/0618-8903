export enum PromotionType {
  FULL_REDUCTION = 'FULL_REDUCTION',
  DISCOUNT = 'DISCOUNT',
  BUY_GIFT = 'BUY_GIFT',
  FLASH_SALE = 'FLASH_SALE'
}

export enum ScopeType {
  ALL = 'ALL',
  CATEGORY = 'CATEGORY',
  PRODUCT = 'PRODUCT'
}

export enum ConflictStrategy {
  STACK = 'STACK',
  EXCLUSIVE = 'EXCLUSIVE'
}

export enum PromotionStatus {
  DRAFT = 'DRAFT',
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE'
}

export interface Scope {
  type: ScopeType;
  categoryIds?: string[];
  productIds?: string[];
}

export interface FullReductionConfig {
  threshold: number;
  reduction: number;
}

export interface DiscountConfig {
  rate: number;
}

export interface BuyGiftConfig {
  buyProductId: string;
  buyQuantity: number;
  giftProductId: string;
  giftQuantity: number;
}

export interface FlashSaleConfig {
  salePrice: number;
  stock: number;
  perUserLimit: number;
}

export type PromotionConfig =
  | FullReductionConfig
  | DiscountConfig
  | BuyGiftConfig
  | FlashSaleConfig;

export interface Promotion {
  id: string;
  name: string;
  type: PromotionType;
  status: PromotionStatus;
  scope: Scope;
  config: PromotionConfig;
  priority: number;
  conflictStrategy: ConflictStrategy;
  mutuallyExclusiveWith?: string[];
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
  flashSaleStock?: FlashSaleStock;
}

export interface FlashSaleStock {
  promotionId: string;
  productId: string;
  totalStock: number;
  availableStock: number;
  soldCount: number;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  price: number;
  stock: number;
  imageUrl?: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export interface AppliedPromotion {
  promotionId: string;
  promotionName: string;
  promotionType: PromotionType;
  discountAmount: number;
  gifts?: { productId: string; quantity: number }[];
  appliedItems: string[];
}

export interface CalculationResult {
  originalTotal: number;
  finalTotal: number;
  totalDiscount: number;
  appliedPromotions: AppliedPromotion[];
  giftItems: CartItem[];
  items: (CartItem & { productId: string; finalPrice: number; appliedPromotions: string[] })[];
  flashSaleItems: string[];
  warnings?: string[];
}

export interface Order {
  id: string;
  userId: string;
  items: CartItem[];
  giftItems: CartItem[];
  originalTotal: number;
  finalTotal: number;
  totalDiscount: number;
  appliedPromotions: AppliedPromotion[];
  status: 'PENDING' | 'PAID' | 'CANCELLED';
  createdAt: string;
}

export interface SalesStats {
  totalOrders: number;
  totalRevenue: number;
  totalDiscount: number;
  ordersByPromotion: Record<string, { name: string; count: number; revenue: number; discount: number }>;
  hourlyOrders: Record<string, number>;
}
