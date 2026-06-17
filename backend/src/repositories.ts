import { db } from './db';
import type { UserFlashPurchaseRecord } from './db';
import {
  Promotion,
  PromotionStatus,
  Product,
  CartItem,
  Order,
  FlashSaleStock,
  SalesStats
} from './types';
import { v4 as uuidv4 } from 'uuid';

function rowToPromotion(p: any): Promotion {
  return p as Promotion;
}

function rowToProduct(p: any): Product {
  return p as Product;
}

function rowToOrder(o: any): Order {
  return o as Order;
}

export const PromotionRepository = {
  create(data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promotion {
    const id = uuidv4();
    const now = new Date().toISOString();
    const promotion: Promotion = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now
    };
    db.promotions.push(promotion);
    db.save();
    return promotion;
  },

  findById(id: string): Promotion | null {
    const p = db.promotions.find(p => p.id === id);
    return p ? rowToPromotion(p) : null;
  },

  findAll(): Promotion[] {
    return [...db.promotions]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(rowToPromotion);
  },

  findActive(now: string): Promotion[] {
    return db.promotions
      .filter(p =>
        p.status === PromotionStatus.ONLINE &&
        p.startTime <= now &&
        p.endTime >= now
      )
      .sort((a, b) => b.priority - a.priority)
      .map(rowToPromotion);
  },

  update(id: string, data: Partial<Promotion>): Promotion | null {
    const idx = db.promotions.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const now = new Date().toISOString();
    db.promotions[idx] = {
      ...db.promotions[idx],
      ...data,
      id,
      updatedAt: now
    } as Promotion;
    db.save();
    return this.findById(id);
  },

  updateStatus(id: string, status: PromotionStatus): Promotion | null {
    return this.update(id, { status });
  },

  delete(id: string): boolean {
    const before = db.promotions.length;
    const pIdx = db.promotions.findIndex(p => p.id === id);
    if (pIdx !== -1) db.promotions.splice(pIdx, 1);
    const sIdx = db.flashSaleStocks.findIndex(s => s.promotionId === id);
    if (sIdx !== -1) db.flashSaleStocks.splice(sIdx, 1);
    if (db.promotions.length < before) {
      db.save();
      return true;
    }
    return false;
  }
};

export const ProductRepository = {
  create(data: Omit<Product, 'id'>): Product {
    const id = uuidv4();
    const product: Product = { ...data, id };
    db.products.push(product);
    db.save();
    return product;
  },

  findById(id: string): Product | null {
    const p = db.products.find(p => p.id === id);
    return p ? rowToProduct(p) : null;
  },

  findAll(): Product[] {
    return [...db.products].sort((a, b) => a.name.localeCompare(b.name)).map(rowToProduct);
  },

  findByIds(ids: string[]): Product[] {
    if (ids.length === 0) return [];
    return db.products.filter(p => ids.includes(p.id)).map(rowToProduct);
  },

  findByCategory(categoryId: string): Product[] {
    return db.products
      .filter(p => p.categoryId === categoryId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(rowToProduct);
  }
};

export const FlashSaleStockRepository = {
  create(data: Omit<FlashSaleStock, 'soldCount'>): FlashSaleStock {
    const stock: FlashSaleStock = {
      ...data,
      soldCount: 0
    };
    db.flashSaleStocks.push(stock);
    db.save();
    return stock;
  },

  findById(promotionId: string): FlashSaleStock | null {
    const s = db.flashSaleStocks.find(s => s.promotionId === promotionId);
    return s || null;
  },

  decrementStock(promotionId: string, quantity: number): boolean {
    const idx = db.flashSaleStocks.findIndex(s => s.promotionId === promotionId);
    if (idx === -1) return false;
    if (db.flashSaleStocks[idx].availableStock < quantity) return false;

    db.flashSaleStocks[idx].availableStock -= quantity;
    db.flashSaleStocks[idx].soldCount += quantity;
    db.save();
    return true;
  },

  incrementStock(promotionId: string, quantity: number): void {
    const idx = db.flashSaleStocks.findIndex(s => s.promotionId === promotionId);
    if (idx !== -1) {
      db.flashSaleStocks[idx].availableStock += quantity;
      db.flashSaleStocks[idx].soldCount = Math.max(0, db.flashSaleStocks[idx].soldCount - quantity);
      db.save();
    }
  },

  getUserPurchasedCount(userId: string, promotionId: string): number {
    const records = db.userFlashPurchases as unknown as UserFlashPurchaseRecord[];
    return records
      .filter(r => r.userId === userId && r.promotionId === promotionId)
      .reduce((sum, r) => sum + r.quantity, 0);
  },

  recordUserPurchase(userId: string, promotionId: string, quantity: number): void {
    const records = db.userFlashPurchases as unknown as UserFlashPurchaseRecord[];
    const existing = records.find(r => r.userId === userId && r.promotionId === promotionId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      records.push({
        id: db.getNextId(),
        userId,
        promotionId,
        quantity,
        createdAt: new Date().toISOString()
      });
    }
    db.save();
  }
};

export const OrderRepository = {
  create(data: Omit<Order, 'id' | 'createdAt'>): Order {
    const id = uuidv4();
    const now = new Date().toISOString();
    const order: Order = {
      ...data,
      id,
      createdAt: now
    };
    db.orders.push(order);
    db.save();
    return order;
  },

  findById(id: string): Order | null {
    const o = db.orders.find(o => o.id === id);
    return o ? rowToOrder(o) : null;
  },

  findAll(limit: number = 100): Order[] {
    return [...db.orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit)
      .map(rowToOrder);
  },

  getSalesStats(startTime: string, endTime: string): SalesStats {
    const orders = db.orders.filter(o =>
      o.status !== 'CANCELLED' &&
      o.createdAt >= startTime &&
      o.createdAt <= endTime
    );

    const stats: SalesStats = {
      totalOrders: orders.length,
      totalRevenue: 0,
      totalDiscount: 0,
      ordersByPromotion: {},
      hourlyOrders: {}
    };

    const promotionNames: Record<string, string> = {};
    db.promotions.forEach(p => { promotionNames[p.id] = p.name; });

    for (const order of orders) {
      stats.totalRevenue += order.finalTotal;
      stats.totalDiscount += order.totalDiscount;

      const hour = order.createdAt.substring(0, 13) + ':00';
      stats.hourlyOrders[hour] = (stats.hourlyOrders[hour] || 0) + 1;

      for (const ap of order.appliedPromotions) {
        if (!stats.ordersByPromotion[ap.promotionId]) {
          stats.ordersByPromotion[ap.promotionId] = {
            name: promotionNames[ap.promotionId] || ap.promotionName,
            count: 0,
            revenue: 0,
            discount: 0
          };
        }
        stats.ordersByPromotion[ap.promotionId].count += 1;
        stats.ordersByPromotion[ap.promotionId].discount += ap.discountAmount;
      }
    }

    return stats;
  }
};
