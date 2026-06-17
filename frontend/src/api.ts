import axios from 'axios';
import type {
  Promotion,
  PromotionStatus,
  Product,
  CartItem,
  CalculationResult,
  Order,
  SalesStats,
  FlashSaleStock
} from './types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000
});

export const productApi = {
  list: () => api.get<Product[]>('/products').then(r => r.data),
  get: (id: string) => api.get<Product>(`/products/${id}`).then(r => r.data)
};

export const promotionApi = {
  list: () => api.get<Promotion[]>('/promotions').then(r => r.data),
  listActive: () => api.get<Promotion[]>('/promotions/active').then(r => r.data),
  get: (id: string) => api.get<Promotion>(`/promotions/${id}`).then(r => r.data),
  create: (data: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<Promotion>('/promotions', data).then(r => r.data),
  update: (id: string, data: Partial<Promotion>) =>
    api.put<Promotion>(`/promotions/${id}`, data).then(r => r.data),
  online: (id: string) =>
    api.post<Promotion>(`/promotions/${id}/online`).then(r => r.data),
  offline: (id: string) =>
    api.post<Promotion>(`/promotions/${id}/offline`).then(r => r.data),
  delete: (id: string) =>
    api.delete(`/promotions/${id}`).then(r => r.data)
};

export const orderApi = {
  list: (limit: number = 100) => api.get<Order[]>('/orders', { params: { limit } }).then(r => r.data),
  get: (id: string) => api.get<Order>(`/orders/${id}`).then(r => r.data),
  create: (data: { userId: string; items: CartItem[] }) =>
    api.post<Order & { calculation: CalculationResult }>('/orders', data).then(r => r.data)
};

export const calculationApi = {
  calculate: (items: CartItem[]) =>
    api.post<CalculationResult>('/calculate', { items }).then(r => r.data)
};

export const flashSaleApi = {
  purchase: (data: { userId: string; promotionId: string; quantity: number }) =>
    api.post<{ success: boolean; message: string; orderId?: string; result?: CalculationResult }>(
      '/flash-sale',
      data
    ).then(r => r.data),
  getStock: (promotionId: string) =>
    api.get<FlashSaleStock>(`/flash-sale/${promotionId}/stock`).then(r => r.data)
};

export const statsApi = {
  getSales: (startTime?: string, endTime?: string) =>
    api.get<SalesStats>('/stats/sales', { params: { startTime, endTime } }).then(r => r.data)
};
