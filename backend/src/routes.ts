import { Router, Request, Response } from 'express';
import { PromotionRepository, ProductRepository, FlashSaleStockRepository, OrderRepository } from './repositories';
import { calculateCart } from './promotion-engine';
import { flashSaleQueue } from './flash-sale-queue';
import { Promotion, PromotionType, PromotionStatus, CartItem, FlashSaleConfig } from './types';

export const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/products', (_req: Request, res: Response) => {
  const products = ProductRepository.findAll();
  res.json(products);
});

router.get('/products/:id', (req: Request, res: Response) => {
  const product = ProductRepository.findById(req.params.id);
  if (!product) return res.status(404).json({ error: '商品不存在' });
  res.json(product);
});

router.get('/promotions', (_req: Request, res: Response) => {
  const promotions = PromotionRepository.findAll();
  const result = promotions.map(p => {
    let stock = null;
    if (p.type === PromotionType.FLASH_SALE) {
      stock = FlashSaleStockRepository.findById(p.id);
    }
    return { ...p, flashSaleStock: stock };
  });
  res.json(result);
});

router.get('/promotions/active', (_req: Request, res: Response) => {
  const now = new Date().toISOString();
  const promotions = PromotionRepository.findActive(now);
  res.json(promotions);
});

router.get('/promotions/:id', (req: Request, res: Response) => {
  const promotion = PromotionRepository.findById(req.params.id);
  if (!promotion) return res.status(404).json({ error: '活动不存在' });

  let stock = null;
  if (promotion.type === PromotionType.FLASH_SALE) {
    stock = FlashSaleStockRepository.findById(promotion.id);
  }

  res.json({ ...promotion, flashSaleStock: stock });
});

router.post('/promotions', (req: Request, res: Response) => {
  try {
    const body = req.body as Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>;

    if (!body.name || !body.type || !body.startTime || !body.endTime || !body.config || !body.scope) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    if (body.type === PromotionType.FLASH_SALE) {
      if (body.scope.type !== 'PRODUCT' || !body.scope.productIds || body.scope.productIds.length !== 1) {
        return res.status(400).json({ error: '限时秒杀活动必须选择且仅选择一个商品' });
      }
      const config = body.config as FlashSaleConfig;
      if (!config.salePrice || !config.stock || !config.perUserLimit) {
        return res.status(400).json({ error: '秒杀活动必须填写秒杀价格、库存和限购数量' });
      }
    }

    const promotion = PromotionRepository.create(body);

    if (body.type === PromotionType.FLASH_SALE) {
      const config = body.config as FlashSaleConfig;
      const productIds = body.scope.productIds!;
      FlashSaleStockRepository.create({
        promotionId: promotion.id,
        productId: productIds[0],
        totalStock: config.stock,
        availableStock: config.stock
      });
    }

    const stock = body.type === PromotionType.FLASH_SALE
      ? FlashSaleStockRepository.findById(promotion.id)
      : null;

    res.status(201).json({ ...promotion, flashSaleStock: stock });
  } catch (error) {
    console.error('创建活动失败:', error);
    res.status(500).json({ error: '创建活动失败' });
  }
});

router.put('/promotions/:id', (req: Request, res: Response) => {
  try {
    const promotion = PromotionRepository.update(req.params.id, req.body);
    if (!promotion) return res.status(404).json({ error: '活动不存在' });
    res.json(promotion);
  } catch (error) {
    console.error('更新活动失败:', error);
    res.status(500).json({ error: '更新活动失败' });
  }
});

router.post('/promotions/:id/online', (req: Request, res: Response) => {
  const promotion = PromotionRepository.updateStatus(req.params.id, PromotionStatus.ONLINE);
  if (!promotion) return res.status(404).json({ error: '活动不存在' });
  res.json(promotion);
});

router.post('/promotions/:id/offline', (req: Request, res: Response) => {
  const promotion = PromotionRepository.updateStatus(req.params.id, PromotionStatus.OFFLINE);
  if (!promotion) return res.status(404).json({ error: '活动不存在' });
  res.json(promotion);
});

router.delete('/promotions/:id', (req: Request, res: Response) => {
  const deleted = PromotionRepository.delete(req.params.id);
  if (!deleted) return res.status(404).json({ error: '活动不存在' });
  res.json({ success: true });
});

router.post('/calculate', (req: Request, res: Response) => {
  try {
    const { items } = req.body as { items: CartItem[] };
    if (!items || items.length === 0) {
      return res.status(400).json({ error: '购物车为空' });
    }

    const productIds = items.map(i => i.productId);
    const products = ProductRepository.findByIds(productIds);
    if (products.length === 0) {
      return res.status(400).json({ error: '商品不存在' });
    }

    const now = new Date().toISOString();
    const promotions = PromotionRepository.findActive(now);

    const result = calculateCart(items, products, promotions);

    const warnings: string[] = [];
    if (result.flashSaleItems.length > 0) {
      const flashProductNames = result.flashSaleItems.map(id => {
        const p = products.find(pp => pp.id === id);
        return p ? p.name : id;
      });
      warnings.push(
        `购物车中包含秒杀商品【${flashProductNames.join('、')}】，这些商品不享受普通优惠，请通过秒杀抢购流程以秒杀价购买。当前按常规价格计算。`
      );
    }

    res.json({ ...result, warnings });
  } catch (error) {
    console.error('计算失败:', error);
    res.status(500).json({ error: '计算失败' });
  }
});

router.post('/orders', (req: Request, res: Response) => {
  try {
    const { userId, items } = req.body as { userId: string; items: CartItem[] };
    if (!userId || !items || items.length === 0) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const productIds = items.map(i => i.productId);
    const products = ProductRepository.findByIds(productIds);

    const now = new Date().toISOString();
    const promotions = PromotionRepository.findActive(now);

    const calcResult = calculateCart(items, products, promotions);

    const order = OrderRepository.create({
      userId,
      items,
      giftItems: calcResult.giftItems,
      originalTotal: calcResult.originalTotal,
      finalTotal: calcResult.finalTotal,
      totalDiscount: calcResult.totalDiscount,
      appliedPromotions: calcResult.appliedPromotions,
      status: 'PAID'
    });

    const warnings: string[] = [];
    if (calcResult.flashSaleItems.length > 0) {
      const flashProductNames = calcResult.flashSaleItems.map(id => {
        const p = products.find(pp => pp.id === id);
        return p ? p.name : id;
      });
      warnings.push(
        `订单中包含秒杀商品【${flashProductNames.join('、')}】，这些商品按常规价格结算。如需秒杀价请通过秒杀抢购流程购买。`
      );
    }

    res.status(201).json({ ...order, calculation: calcResult, warnings });
  } catch (error) {
    console.error('创建订单失败:', error);
    res.status(500).json({ error: '创建订单失败' });
  }
});

router.get('/orders', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const orders = OrderRepository.findAll(limit);
  res.json(orders);
});

router.get('/orders/:id', (req: Request, res: Response) => {
  const order = OrderRepository.findById(req.params.id);
  if (!order) return res.status(404).json({ error: '订单不存在' });
  res.json(order);
});

router.post('/flash-sale', async (req: Request, res: Response) => {
  try {
    const { userId, promotionId, quantity } = req.body as {
      userId: string;
      promotionId: string;
      quantity: number;
    };

    if (!userId || !promotionId || !quantity) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    const result = await flashSaleQueue.enqueue(userId, promotionId, quantity);
    res.json(result);
  } catch (error) {
    console.error('秒杀失败:', error);
    res.status(500).json({ error: '秒杀失败' });
  }
});

router.get('/flash-sale/:promotionId/stock', (req: Request, res: Response) => {
  const stock = FlashSaleStockRepository.findById(req.params.promotionId);
  if (!stock) return res.status(404).json({ error: '库存信息不存在' });
  res.json(stock);
});

router.get('/stats/sales', (req: Request, res: Response) => {
  const now = new Date();
  let startTime: string;
  let endTime: string = now.toISOString();

  if (req.query.startTime && req.query.endTime) {
    startTime = req.query.startTime as string;
    endTime = req.query.endTime as string;
  } else {
    startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }

  const stats = OrderRepository.getSalesStats(startTime, endTime);
  res.json(stats);
});
