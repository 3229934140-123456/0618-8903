import { FlashSaleStockRepository, PromotionRepository, OrderRepository } from './repositories';
import {
  Promotion,
  PromotionStatus,
  PromotionType,
  FlashSaleConfig,
  CartItem,
  AppliedPromotion,
  CalculationResult,
  Product
} from './types';
import { ProductRepository } from './repositories';

export interface FlashSaleRequest {
  id: string;
  userId: string;
  promotionId: string;
  quantity: number;
  timestamp: number;
  resolve: (value: FlashSaleResult) => void;
}

export interface FlashSaleResult {
  success: boolean;
  message: string;
  orderId?: string;
  result?: CalculationResult;
}

class FlashSaleQueue {
  private queues: Map<string, FlashSaleRequest[]> = new Map();
  private processing: Map<string, boolean> = new Map();
  private requestIdCounter: number = 0;

  enqueue(userId: string, promotionId: string, quantity: number): Promise<FlashSaleResult> {
    return new Promise((resolve) => {
      const request: FlashSaleRequest = {
        id: `${Date.now()}-${this.requestIdCounter++}`,
        userId,
        promotionId,
        quantity,
        timestamp: Date.now(),
        resolve
      };

      if (!this.queues.has(promotionId)) {
        this.queues.set(promotionId, []);
      }
      this.queues.get(promotionId)!.push(request);

      this.processQueue(promotionId);
    });
  }

  private async processQueue(promotionId: string) {
    if (this.processing.get(promotionId)) return;
    this.processing.set(promotionId, true);

    const queue = this.queues.get(promotionId) || [];

    while (queue.length > 0) {
      const request = queue.shift()!;
      try {
        const result = this.processRequest(request);
        request.resolve(result);
      } catch (error) {
        request.resolve({
          success: false,
          message: error instanceof Error ? error.message : '处理失败'
        });
      }
    }

    this.processing.set(promotionId, false);
  }

  private processRequest(request: FlashSaleRequest): FlashSaleResult {
    const promotion = PromotionRepository.findById(request.promotionId);
    if (!promotion) {
      return { success: false, message: '活动不存在' };
    }

    if (promotion.type !== PromotionType.FLASH_SALE) {
      return { success: false, message: '非秒杀活动' };
    }

    if (promotion.status !== PromotionStatus.ONLINE) {
      return { success: false, message: '活动未上线' };
    }

    const now = new Date().toISOString();
    if (now < promotion.startTime) {
      return { success: false, message: '活动尚未开始' };
    }
    if (now > promotion.endTime) {
      return { success: false, message: '活动已结束' };
    }

    const config = promotion.config as FlashSaleConfig;

    if (request.quantity > config.perUserLimit) {
      return { success: false, message: `每人限购${config.perUserLimit}件` };
    }

    const purchased = FlashSaleStockRepository.getUserPurchasedCount(request.userId, request.promotionId);
    if (purchased + request.quantity > config.perUserLimit) {
      return { success: false, message: `超出限购数量，您已购买${purchased}件` };
    }

    const stockReduced = FlashSaleStockRepository.decrementStock(request.promotionId, request.quantity);
    if (!stockReduced) {
      return { success: false, message: '库存不足' };
    }

    try {
      FlashSaleStockRepository.recordUserPurchase(request.userId, request.promotionId, request.quantity);

      const stockInfo = FlashSaleStockRepository.findById(request.promotionId);
      if (!stockInfo) {
        throw new Error('库存信息不存在');
      }

      const product = ProductRepository.findById(stockInfo.productId);
      if (!product) {
        throw new Error('商品不存在');
      }

      const { orderId, result } = this.createFlashSaleOrder(request, promotion, product, config);

      return {
        success: true,
        message: '抢购成功',
        orderId,
        result
      };
    } catch (error) {
      FlashSaleStockRepository.incrementStock(request.promotionId, request.quantity);
      return {
        success: false,
        message: error instanceof Error ? error.message : '下单失败'
      };
    }
  }

  private createFlashSaleOrder(
    request: FlashSaleRequest,
    promotion: Promotion,
    product: Product,
    config: FlashSaleConfig
  ): { orderId: string; result: CalculationResult } {
    const originalTotal = product.price * request.quantity;
    const finalTotal = config.salePrice * request.quantity;
    const totalDiscount = originalTotal - finalTotal;

    const appliedPromotion: AppliedPromotion = {
      promotionId: promotion.id,
      promotionName: promotion.name,
      promotionType: promotion.type,
      discountAmount: totalDiscount,
      appliedItems: [product.id]
    };

    const cartItem: CartItem = {
      productId: product.id,
      quantity: request.quantity,
      unitPrice: product.price
    };

    const result: CalculationResult = {
      originalTotal,
      finalTotal,
      totalDiscount,
      appliedPromotions: [appliedPromotion],
      giftItems: [],
      items: [{
        productId: product.id,
        quantity: request.quantity,
        unitPrice: product.price,
        finalPrice: finalTotal,
        appliedPromotions: [promotion.id]
      }]
    };

    const order = OrderRepository.create({
      userId: request.userId,
      items: [cartItem],
      giftItems: [],
      originalTotal,
      finalTotal,
      totalDiscount,
      appliedPromotions: [appliedPromotion],
      status: 'PAID'
    });

    return { orderId: order.id, result };
  }

  getQueueLength(promotionId: string): number {
    return this.queues.get(promotionId)?.length || 0;
  }
}

export const flashSaleQueue = new FlashSaleQueue();
