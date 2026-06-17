import { useEffect, useState, useCallback } from 'react';
import { Card, List, Button, Input, Progress, Space, Tag, Alert, Divider, Statistic, Row, Col, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { promotionApi, flashSaleApi, productApi } from '../api';
import { PromotionType } from '../types';
import type { Promotion, Product, FlashSaleStock, FlashSaleConfig } from '../types';

export default function FlashSaleDemo() {
  const [flashSales, setFlashSales] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Record<string, FlashSaleStock>>({});
  const [userId, setUserId] = useState('test-user-001');
  const [purchaseResults, setPurchaseResults] = useState<{ time: string; msg: string; success: boolean }[]>([]);

  const loadData = useCallback(() => {
    promotionApi.list().then(allPromotions => {
      const fs = allPromotions.filter(p => p.type === PromotionType.FLASH_SALE && p.status === 'ONLINE');
      setFlashSales(fs);
      const stockMap: Record<string, FlashSaleStock> = {};
      fs.forEach(p => {
        if (p.flashSaleStock) {
          stockMap[p.id] = p.flashSaleStock;
        }
      });
      setStocks(stockMap);
    });
    productApi.list().then(setProducts);
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 3000);
    return () => clearInterval(timer);
  }, [loadData]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(`ws://${window.location.host}/ws`);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'stats_update' && data.data.flashSaleStocks) {
          const stockMap: Record<string, FlashSaleStock> = {};
          data.data.flashSaleStocks.forEach((s: any) => {
            stockMap[s.promotionId] = s;
          });
          setStocks(stockMap);
        }
      };
    } catch (e) {}
    return () => ws?.close();
  }, []);

  const getProduct = (productId: string) => products.find(p => p.id === productId);

  const handlePurchase = async (promotion: Promotion) => {
    if (!userId) {
      message.error('请输入用户ID');
      return;
    }

    const config = promotion.config as FlashSaleConfig;
    const stock = stocks[promotion.id];
    if (!stock || stock.availableStock <= 0) {
      addResult(false, `${promotion.name}: 已售罄`);
      return;
    }

    try {
      const result = await flashSaleApi.purchase({
        userId,
        promotionId: promotion.id,
        quantity: 1
      });
      addResult(result.success, `${promotion.name}: ${result.message}${result.orderId ? ` (订单: ${result.orderId.substring(0, 8)}...)` : ''}`);
      loadData();
    } catch (e) {
      addResult(false, `${promotion.name}: 抢购失败`);
    }
  };

  const addResult = (success: boolean, msg: string) => {
    setPurchaseResults(prev => [
      { time: new Date().toLocaleTimeString(), msg, success },
      ...prev.slice(0, 19)
    ]);
  };

  return (
    <Row gutter={[16, 16]}>
      <Col span={16}>
        <Card
          title={
            <Space>
              <ThunderboltOutlined style={{ color: '#eb2f96', fontSize: 20 }} />
              <span>限时秒杀活动</span>
            </Space>
          }
          extra={
            <Space>
              <span>模拟用户ID:</span>
              <Input value={userId} onChange={e => setUserId(e.target.value)} style={{ width: 200 }} />
            </Space>
          }
        >
          {flashSales.length === 0 ? (
            <Alert message="暂无进行中的秒杀活动" type="info" />
          ) : (
            <List
              dataSource={flashSales}
              renderItem={promotion => {
                const config = promotion.config as FlashSaleConfig;
                const stock = stocks[promotion.id];
                const product = stock ? getProduct(stock.productId) : null;
                const percent = stock && stock.totalStock > 0
                  ? Math.round((stock.soldCount / stock.totalStock) * 100)
                  : 0;
                const originalPrice = product?.price || 0;

                return (
                  <Card
                    size="small"
                    style={{ marginBottom: 16 }}
                    type="inner"
                    title={
                      <Space>
                        <Tag color="red">秒杀</Tag>
                        <span style={{ fontSize: 16 }}>{promotion.name}</span>
                      </Space>
                    }
                    extra={
                      <Button
                        type="primary"
                        danger
                        disabled={!stock || stock.availableStock <= 0}
                        onClick={() => handlePurchase(promotion)}
                      >
                        {stock?.availableStock ? '立即抢购' : '已售罄'}
                      </Button>
                    }
                  >
                    <Row align="middle" gutter={16}>
                      <Col flex="auto">
                        <Space direction="vertical">
                          <Space size="large">
                            <span>商品：<strong>{product?.name || '-'}</strong></span>
                            <span>限购：每人{config.perUserLimit}件</span>
                          </Space>
                          <Space size="large" align="baseline">
                            <span style={{ color: '#f5222d', fontSize: 28, fontWeight: 'bold' }}>
                              ¥{config.salePrice}
                            </span>
                            <span style={{ color: '#8c8c8c', textDecoration: 'line-through' }}>
                              ¥{originalPrice}
                            </span>
                            <Tag color="green">
                              省¥{(originalPrice - config.salePrice).toFixed(2)}
                            </Tag>
                          </Space>
                          {stock && (
                            <Progress
                              percent={percent}
                              status={stock.availableStock === 0 ? 'exception' : 'active'}
                              strokeColor="#eb2f96"
                              format={() => `已抢 ${stock.soldCount}/${stock.totalStock} 件，剩余 ${stock.availableStock} 件`}
                            />
                          )}
                        </Space>
                      </Col>
                    </Row>
                  </Card>
                );
              }}
            />
          )}
        </Card>
      </Col>

      <Col span={8}>
        <Card title="抢购日志" style={{ marginBottom: 16 }}>
          {purchaseResults.length === 0 ? (
            <span style={{ color: '#8c8c8c' }}>点击"立即抢购"开始模拟秒杀</span>
          ) : (
            <List
              size="small"
              dataSource={purchaseResults}
              locale={{ emptyText: '暂无记录' }}
              renderItem={r => (
                <List.Item>
                  <Space>
                    <span style={{ color: '#8c8c8c' }}>[{r.time}]</span>
                    <Tag color={r.success ? 'green' : 'red'}>
                      {r.success ? '成功' : '失败'}
                    </Tag>
                    <span>{r.msg}</span>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>

        <Card title="防超卖机制说明">
          <Space direction="vertical">
            <Alert type="info" showIcon message="秒杀抢购通过队列串行处理" description="每个秒杀活动都有独立的请求队列，请求按顺序处理，避免并发导致超卖。" />
            <Alert type="info" showIcon message="独立活动库存" description="秒杀库存与商品常规库存分离，在数据库层面使用原子操作扣减库存（UPDATE ... WHERE available_stock >= ?）。" />
            <Alert type="info" showIcon message="用户限购" description="记录每个用户在每个活动中的购买数量，超过 perUserLimit 自动拒绝。" />
            <Alert type="info" showIcon message="异常回滚" description="下单失败时自动回补库存，避免库存异常。" />
          </Space>
        </Card>
      </Col>
    </Row>
  );
}
