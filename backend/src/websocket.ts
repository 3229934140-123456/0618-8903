import { WebSocketServer, WebSocket } from 'ws';
import { OrderRepository, FlashSaleStockRepository, PromotionRepository } from './repositories';
import { PromotionType } from './types';
import { Server } from 'http';

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  const clients = new Set<WebSocket>();

  wss.on('connection', (ws) => {
    clients.add(ws);

    ws.on('close', () => {
      clients.delete(ws);
    });

    ws.on('error', () => {
      clients.delete(ws);
    });
  });

  const broadcast = (data: any) => {
    const message = JSON.stringify(data);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  };

  setInterval(() => {
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const endTime = now.toISOString();
      const stats = OrderRepository.getSalesStats(startTime, endTime);

      const promotions = PromotionRepository.findAll();
      const flashSaleStocks: any[] = [];
      for (const p of promotions) {
        if (p.type === PromotionType.FLASH_SALE) {
          const stock = FlashSaleStockRepository.findById(p.id);
          if (stock) {
            flashSaleStocks.push({
              ...stock,
              promotionName: p.name
            });
          }
        }
      }

      broadcast({
        type: 'stats_update',
        data: {
          sales: stats,
          flashSaleStocks,
          timestamp: now.toISOString()
        }
      });
    } catch (error) {
      console.error('广播统计数据失败:', error);
    }
  }, 2000);

  return wss;
}
