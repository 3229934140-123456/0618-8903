import {
  Promotion,
  PromotionType,
  Product,
  CartItem,
  AppliedPromotion,
  CalculationResult,
  ScopeType,
  Scope,
  FullReductionConfig,
  DiscountConfig,
  BuyGiftConfig,
  FlashSaleConfig,
  ConflictStrategy
} from './types';

interface ItemWithProduct extends CartItem {
  product: Product;
}

export function isPromotionInScope(promotion: Promotion, product: Product): boolean {
  const scope: Scope = promotion.scope;
  switch (scope.type) {
    case ScopeType.ALL:
      return true;
    case ScopeType.CATEGORY:
      return !!scope.categoryIds?.includes(product.categoryId);
    case ScopeType.PRODUCT:
      return !!scope.productIds?.includes(product.id);
    default:
      return false;
  }
}

export function getItemsInScope(promotion: Promotion, items: ItemWithProduct[]): ItemWithProduct[] {
  return items.filter(item => isPromotionInScope(promotion, item.product));
}

export function calculateItemsTotal(items: ItemWithProduct[]): number {
  return items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

interface SingleRuleResult {
  promotion: Promotion;
  discountAmount: number;
  appliedItemIds: string[];
  gifts?: { productId: string; quantity: number }[];
  perItemDiscount?: Record<string, number>;
}

function evaluateFullReduction(
  promotion: Promotion,
  items: ItemWithProduct[]
): SingleRuleResult | null {
  const config = promotion.config as FullReductionConfig;
  const scopedItems = getItemsInScope(promotion, items);
  if (scopedItems.length === 0) return null;

  const scopedTotal = calculateItemsTotal(scopedItems);
  if (scopedTotal < config.threshold) return null;

  const times = Math.floor(scopedTotal / config.threshold);
  const discountAmount = times * config.reduction;

  const perItemDiscount: Record<string, number> = {};
  let remainingDiscount = discountAmount;
  for (let i = 0; i < scopedItems.length && remainingDiscount > 0; i++) {
    const item = scopedItems[i];
    const itemTotal = item.unitPrice * item.quantity;
    const proportion = itemTotal / scopedTotal;
    const itemDiscount = Math.min(Math.round(discountAmount * proportion * 100) / 100, remainingDiscount);
    perItemDiscount[item.productId] = itemDiscount;
    remainingDiscount = Math.round((remainingDiscount - itemDiscount) * 100) / 100;
  }
  if (remainingDiscount > 0 && scopedItems.length > 0) {
    const lastItem = scopedItems[scopedItems.length - 1];
    perItemDiscount[lastItem.productId] = Math.round(
      ((perItemDiscount[lastItem.productId] || 0) + remainingDiscount) * 100
    ) / 100;
  }

  return {
    promotion,
    discountAmount,
    appliedItemIds: scopedItems.map(i => i.productId),
    perItemDiscount
  };
}

function evaluateDiscount(
  promotion: Promotion,
  items: ItemWithProduct[]
): SingleRuleResult | null {
  const config = promotion.config as DiscountConfig;
  const scopedItems = getItemsInScope(promotion, items);
  if (scopedItems.length === 0) return null;

  const perItemDiscount: Record<string, number> = {};
  let discountAmount = 0;

  for (const item of scopedItems) {
    const originalTotal = item.unitPrice * item.quantity;
    const discountedTotal = originalTotal * config.rate;
    const itemDiscount = Math.round((originalTotal - discountedTotal) * 100) / 100;
    perItemDiscount[item.productId] = itemDiscount;
    discountAmount += itemDiscount;
  }

  discountAmount = Math.round(discountAmount * 100) / 100;
  if (discountAmount <= 0) return null;

  return {
    promotion,
    discountAmount,
    appliedItemIds: scopedItems.map(i => i.productId),
    perItemDiscount
  };
}

function evaluateBuyGift(
  promotion: Promotion,
  items: ItemWithProduct[]
): SingleRuleResult | null {
  const config = promotion.config as BuyGiftConfig;
  const buyItem = items.find(i => i.productId === config.buyProductId && i.quantity >= config.buyQuantity);
  if (!buyItem) return null;

  const giftSets = Math.floor(buyItem.quantity / config.buyQuantity);
  const gifts = [{ productId: config.giftProductId, quantity: giftSets * config.giftQuantity }];

  return {
    promotion,
    discountAmount: 0,
    appliedItemIds: [buyItem.productId],
    gifts
  };
}

function evaluateFlashSale(
  promotion: Promotion,
  items: ItemWithProduct[]
): SingleRuleResult | null {
  const config = promotion.config as FlashSaleConfig;
  const scopedItems = getItemsInScope(promotion, items);
  if (scopedItems.length === 0) return null;

  const perItemDiscount: Record<string, number> = {};
  let discountAmount = 0;

  for (const item of scopedItems) {
    if (item.unitPrice <= config.salePrice) continue;
    const perUnitDiscount = item.unitPrice - config.salePrice;
    const itemDiscount = Math.round(perUnitDiscount * item.quantity * 100) / 100;
    perItemDiscount[item.productId] = itemDiscount;
    discountAmount += itemDiscount;
  }

  discountAmount = Math.round(discountAmount * 100) / 100;
  if (discountAmount <= 0) return null;

  return {
    promotion,
    discountAmount,
    appliedItemIds: scopedItems.map(i => i.productId),
    perItemDiscount
  };
}

export function evaluateSinglePromotion(
  promotion: Promotion,
  items: ItemWithProduct[]
): SingleRuleResult | null {
  switch (promotion.type) {
    case PromotionType.FULL_REDUCTION:
      return evaluateFullReduction(promotion, items);
    case PromotionType.DISCOUNT:
      return evaluateDiscount(promotion, items);
    case PromotionType.BUY_GIFT:
      return evaluateBuyGift(promotion, items);
    case PromotionType.FLASH_SALE:
      return evaluateFlashSale(promotion, items);
    default:
      return null;
  }
}

function canPromotionsCoexist(
  p1: Promotion,
  p2: Promotion
): boolean {
  if (p1.conflictStrategy === ConflictStrategy.EXCLUSIVE ||
      p2.conflictStrategy === ConflictStrategy.EXCLUSIVE) {
    return false;
  }
  if (p1.mutuallyExclusiveWith?.includes(p2.id) ||
      p2.mutuallyExclusiveWith?.includes(p1.id)) {
    return false;
  }
  return true;
}

function pickBestPromotionSet(
  candidates: SingleRuleResult[],
  promotions: Promotion[]
): SingleRuleResult[] {
  if (candidates.length === 0) return [];

  const promoMap = new Map<string, Promotion>();
  promotions.forEach(p => promoMap.set(p.id, p));

  const n = candidates.length;
  let bestSet: SingleRuleResult[] = [];
  let bestDiscount = -1;

  function backtrack(start: number, current: SingleRuleResult[], currentDiscount: number) {
    if (currentDiscount > bestDiscount) {
      bestDiscount = currentDiscount;
      bestSet = [...current];
    }

    for (let i = start; i < n; i++) {
      const candidate = candidates[i];
      const candidatePromo = promoMap.get(candidate.promotion.id)!;

      let canAdd = true;
      for (const selected of current) {
        const selectedPromo = promoMap.get(selected.promotion.id)!;
        if (!canPromotionsCoexist(candidatePromo, selectedPromo)) {
          canAdd = false;
          break;
        }
      }

      if (canAdd) {
        current.push(candidate);
        backtrack(i + 1, current, currentDiscount + candidate.discountAmount);
        current.pop();
      }
    }
  }

  backtrack(0, [], 0);
  return bestSet;
}

export function calculateCart(
  cartItems: CartItem[],
  products: Product[],
  promotions: Promotion[],
  flashSalePromotions?: Promotion[]
): CalculationResult {
  const productMap = new Map<string, Product>();
  products.forEach(p => productMap.set(p.id, p));

  const itemsWithProduct: ItemWithProduct[] = cartItems.map(item => ({
    ...item,
    product: productMap.get(item.productId)!
  })).filter(item => item.product);

  const originalTotal = calculateItemsTotal(itemsWithProduct);

  const allFlashSalePromos = flashSalePromotions || promotions.filter(p => p.type === PromotionType.FLASH_SALE);
  const flashSaleProductIds = new Set<string>();
  for (const fp of allFlashSalePromos) {
    if (fp.scope.productIds) {
      fp.scope.productIds.forEach(id => flashSaleProductIds.add(id));
    }
  }

  const normalItems = itemsWithProduct.filter(item => !flashSaleProductIds.has(item.productId));
  const flashItems = itemsWithProduct.filter(item => flashSaleProductIds.has(item.productId));

  const nonFlashPromotions = promotions.filter(p => p.type !== PromotionType.FLASH_SALE);

  const candidates: SingleRuleResult[] = [];
  for (const promotion of nonFlashPromotions) {
    const result = evaluateSinglePromotion(promotion, normalItems);
    if (result) {
      candidates.push(result);
    }
  }

  candidates.sort((a, b) => {
    const priorityDiff = b.promotion.priority - a.promotion.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return b.discountAmount - a.discountAmount;
  });

  const bestSet = pickBestPromotionSet(candidates, promotions);

  const itemDiscountMap: Record<string, number> = {};
  const itemPromoMap: Record<string, string[]> = {};
  let totalDiscount = 0;
  const giftItems: CartItem[] = [];
  const appliedPromotions: AppliedPromotion[] = [];

  for (const result of bestSet) {
    totalDiscount += result.discountAmount;

    if (result.perItemDiscount) {
      for (const [productId, discount] of Object.entries(result.perItemDiscount)) {
        itemDiscountMap[productId] = (itemDiscountMap[productId] || 0) + discount;
        if (!itemPromoMap[productId]) itemPromoMap[productId] = [];
        itemPromoMap[productId].push(result.promotion.id);
      }
    } else {
      for (const productId of result.appliedItemIds) {
        if (!itemPromoMap[productId]) itemPromoMap[productId] = [];
        itemPromoMap[productId].push(result.promotion.id);
      }
    }

    if (result.gifts && result.gifts.length > 0) {
      for (const gift of result.gifts) {
        const existingGift = giftItems.find(g => g.productId === gift.productId);
        if (existingGift) {
          existingGift.quantity += gift.quantity;
        } else {
          const giftProduct = productMap.get(gift.productId);
          giftItems.push({
            productId: gift.productId,
            quantity: gift.quantity,
            unitPrice: giftProduct ? 0 : 0
          });
        }
      }
    }

    appliedPromotions.push({
      promotionId: result.promotion.id,
      promotionName: result.promotion.name,
      promotionType: result.promotion.type,
      discountAmount: result.discountAmount,
      gifts: result.gifts,
      appliedItems: result.appliedItemIds
    });
  }

  totalDiscount = Math.round(totalDiscount * 100) / 100;
  const finalTotal = Math.round((originalTotal - totalDiscount) * 100) / 100;

  const resultItems = itemsWithProduct.map(item => {
    const isFlashSale = flashSaleProductIds.has(item.productId);
    const itemDiscount = isFlashSale ? 0 : Math.round((itemDiscountMap[item.productId] || 0) * 100) / 100;
    const itemTotal = item.unitPrice * item.quantity;
    const finalPrice = Math.round((itemTotal - itemDiscount) * 100) / 100;
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      finalPrice,
      appliedPromotions: isFlashSale ? [] : (itemPromoMap[item.productId] || [])
    };
  });

  const flashSaleItems = flashItems.map(item => item.productId);

  return {
    originalTotal,
    finalTotal,
    totalDiscount,
    appliedPromotions,
    giftItems,
    items: resultItems,
    flashSaleItems
  };
}
