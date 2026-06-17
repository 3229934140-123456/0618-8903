import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  List,
  Button,
  Input,
  Progress,
  Space,
  Tag,
  Alert,
  Divider,
  Statistic,
  Row,
  Col,
  InputNumber,
  Table,
  Modal,
  message,
  Typography
} from 'antd';
import { ThunderboltOutlined, LineChartOutlined } from '@ant-design/icons';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { promotionApi, flashSaleApi, productApi } from '../api';
import { PromotionType } from '../types';
import type { Promotion, Product, FlashSaleStock, FlashSaleConfig } from '../types';

interface PressureTestConfig {
  userCount: number;
  attemptsPerUser: number;
}

interface PressureTestResult {
  success: number;
  failures: Record<string, number>;
  orders: Array<{ userId: string; orderId?: string; success: boolean; message: string }>;
  durationMs: number;
  initialStock: number;
  finalStock: number;
}

const { Title, Text } = Typography;

const COLORS = ['#52c41a', '#f5222d', '#faad14', '#1890ff', '#722ed1', '#13c2c2'];

export default function FlashSaleDemo() {
  const [flashSales, setFlashSales] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stocks, setStocks] = useState<Record<string, FlashSaleStock>>({});
  const [purchaseResults, setPurchaseResults] = useState<{ time: string; msg: string; success: boolean }[]>([]);

  const [selectedPromoId, setSelectedPromoId] = useState<string>('');
  const [pressureModalOpen, setPressureModalOpen] = useState(false);
  const [pressureConfig, setPressureConfig] = useState<PressureTestConfig>({ userCount: 50, attemptsPerUser: 3 });
  const [pressureRunning, setPressureRunning] = useState(false);
  const [pressureResult, setPressureResult] = useState<PressureTestResult | null>(null);
  const [pressureProgress, setPressureProgress] = useState(0);

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
      if (!selectedPromoId && fs.length > 0) {
        setSelectedPromoId(fs[0].id);
      }
    });
    productApi.list().then(setProducts);
  }, [selectedPromoId]);

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

  const handlePurchase = async (promotion: Promotion, userIdOverride?: string) => {
    const userId = userIdOverride || 'test-user-001';
    const config = promotion.config as FlashSaleConfig;
    const stock = stocks[promotion.id];
    if (!stock || stock.availableStock <= 0) {
      addResult(false, `${promotion.name}: 已售罄`, userId);
      return { success: false, message: '已售罄' };
    }

    try {
      const result = await flashSaleApi.purchase({
        userId,
        promotionId: promotion.id,
        quantity: 1
      });
      addResult(result.success, `${promotion.name}: ${result.message}${result.orderId ? ` (订单: ${result.orderId.substring(0, 8)}...)` : ''}`, userId);
      loadData();
      return result;
    } catch (e) {
      addResult(false, `${promotion.name}: 抢购失败`, userId);
      return { success: false, message: '抢购失败' };
    }
  };

  const addResult = (success: boolean, msg: string, userId: string = 'test-user-001') => {
    setPurchaseResults(prev => [
      { time: new Date().toLocaleTimeString(), msg, success },
      ...prev.slice(0, 19)
    ]);
  };

  const runPressureTest = async () => {
    const promotion = flashSales.find(p => p.id === selectedPromoId);
    if (!promotion) {
      message.error('请先选择一个秒杀活动');
      return;
    }
    const stock = stocks[selectedPromoId];
    if (!stock) {
      message.error('没有库存信息');
      return;
    }

    setPressureRunning(true);
    setPressureProgress(0);
    setPressureResult(null);

    const startTime = Date.now();
    const initialStock = stock.availableStock;
    const failures: Record<string, number> = {};
    let success = 0;
    const orders: PressureTestResult['orders'] = [];
    const totalRequests = pressureConfig.userCount * pressureConfig.attemptsPerUser;
    let completed = 0;

    const requests: Promise<any>[] = [];

    for (let u = 0; u < pressureConfig.userCount; u++) {
      const userId = `pressure-user-${String(u).padStart(4, '0')}`;
      for (let a = 0; a < pressureConfig.attemptsPerUser; a++) {
        requests.push(
          handlePurchase(promotion, userId).then(result => {
            completed++;
            setPressureProgress(Math.round((completed / totalRequests) * 100));
            orders.push({
              userId,
              orderId: result.orderId,
              success: result.success,
              message: result.message
            });
            if (result.success) {
              success++;
            } else {
              failures[result.message] = (failures[result.message] || 0) + 1;
            }
          })
        );
      }
    }

    await Promise.all(requests);

    const durationMs = Date.now() - startTime;
    
    const finalStockInfo = await flashSaleApi.getStock(selectedPromoId);
    loadData();

    setPressureResult({
      success,
      failures,
      orders,
      durationMs,
      initialStock,
      finalStock: finalStockInfo?.availableStock || 0
    });
    setPressureRunning(false);
    message.success(`压测完成，耗时 ${durationMs}ms`);
  };

  const selectedPromo = flashSales.find(p => p.id === selectedPromoId);
  const selectedStock = selectedPromoId ? stocks[selectedPromoId] : null;
  const selectedProduct = selectedStock ? getProduct(selectedStock.productId) : null;

  const failureChartData = pressureResult
    ? Object.entries(pressureResult.failures).map(([name, value]) => ({ name, value }))
    : [];

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
              <Button
                type="primary"
                danger
                icon={<LineChartOutlined />}
                disabled={!selectedPromoId}
                onClick={() => setPressureModalOpen(true)}
              >
                压测模拟
              </Button>
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
                const isSelected = promotion.id === selectedPromoId;

                return (
                  <Card
                    size="small"
                    style={{ marginBottom: 16, border: isSelected ? '2px solid #eb2f96' : undefined }}
                    type="inner"
                    title={
                      <Space>
                        <Tag color="red">秒杀</Tag>
                        <span style={{ fontSize: 16 }}>{promotion.name}</span>
                        {isSelected && <Tag color="magenta">已选择</Tag>}
                      </Space>
                    }
                    extra={
                      <Space>
                        <Button size="small" onClick={() => setSelectedPromoId(promotion.id)}>
                          选择
                        </Button>
                        <Button
                          type="primary"
                          danger
                          disabled={!stock || stock.availableStock <= 0}
                          onClick={() => handlePurchase(promotion)}
                        >
                          {stock?.availableStock ? '立即抢购' : '已售罄'}
                        </Button>
                      </Space>
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

      <Modal
        title={
          <Space>
            <LineChartOutlined />
            <span>秒杀压测模拟</span>
          </Space>
        }
        open={pressureModalOpen}
        onCancel={() => !pressureRunning && setPressureModalOpen(false)}
        width={900}
        footer={null}
        destroyOnClose
      >
        {selectedPromo && (
          <>
            <Alert
              type="info"
              showIcon
              message={`当前活动：${selectedPromo.name}`}
              description={
                selectedStock && selectedProduct ? (
                  <Space>
                    <span>商品：{selectedProduct.name}</span>
                    <span>原价：¥{selectedProduct.price}</span>
                    <span style={{ color: '#f5222d' }}>秒杀价：¥{(selectedPromo.config as FlashSaleConfig).salePrice}</span>
                    <span>当前库存：{selectedStock.availableStock}/{selectedStock.totalStock}</span>
                  </Space>
                ) : undefined
              }
              style={{ marginBottom: 16 }}
            />

            <Card size="small" title="压测配置" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <label>模拟用户数量</label>
                    <InputNumber
                      min={1}
                      max={1000}
                      value={pressureConfig.userCount}
                      onChange={v => setPressureConfig(c => ({ ...c, userCount: v || 1 }))}
                      style={{ width: '100%' }}
                      disabled={pressureRunning}
                    />
                  </Space>
                </Col>
                <Col span={12}>
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <label>每人尝试次数</label>
                    <InputNumber
                      min={1}
                      max={10}
                      value={pressureConfig.attemptsPerUser}
                      onChange={v => setPressureConfig(c => ({ ...c, attemptsPerUser: v || 1 }))}
                      style={{ width: '100%' }}
                      disabled={pressureRunning}
                    />
                  </Space>
                </Col>
              </Row>
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Button
                  type="primary"
                  danger
                  loading={pressureRunning}
                  onClick={runPressureTest}
                  disabled={!selectedStock || selectedStock.availableStock === 0}
                >
                  {pressureRunning ? '压测中...' : '开始压测'}
                </Button>
              </div>
              {pressureRunning && (
                <Progress percent={pressureProgress} status="active" style={{ marginTop: 16 }} />
              )}
            </Card>

            {pressureResult && (
              <>
                <Divider orientation="left">压测结果</Divider>
                <Row gutter={[16, 16]}>
                  <Col span={6}>
                    <Statistic
                      title="总请求数"
                      value={pressureResult.orders.length}
                      valueStyle={{ color: '#1890ff' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="成功订单"
                      value={pressureResult.success}
                      valueStyle={{ color: '#52c41a' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="失败请求"
                      value={pressureResult.orders.length - pressureResult.success}
                      valueStyle={{ color: '#f5222d' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="耗时"
                      value={pressureResult.durationMs}
                      suffix="ms"
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Col>
                </Row>
                <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
                  <Col span={12}>
                    <Card size="small" title="初始库存 vs 最终库存">
                      <Row gutter={16}>
                        <Col span={12}>
                          <Statistic
                            title="压测前库存"
                            value={pressureResult.initialStock}
                            valueStyle={{ color: '#1890ff' }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="压测后库存"
                            value={pressureResult.finalStock}
                            valueStyle={{ color: '#f5222d' }}
                          />
                        </Col>
                      </Row>
                    </Card>
                  </Col>
                  <Col span={12}>
                    <Card size="small" title="失败原因分布">
                      {failureChartData.length === 0 ? (
                        <Text type="success">全部成功！无失败请求</Text>
                      ) : (
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={failureChartData}
                              dataKey="value"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={70}
                              label={({ name, value }) => `${name}: ${value}`}
                            >
                              {failureChartData.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      )}
                    </Card>
                  </Col>
                </Row>

                <Card size="small" title="成功订单列表" style={{ marginTop: 16 }}>
                  <Table
                    size="small"
                    dataSource={pressureResult.orders.filter(o => o.success)}
                    rowKey={o => `${o.userId}-${o.orderId}`}
                    columns={[
                      { title: '用户ID', dataIndex: 'userId', key: 'user' },
                      { title: '订单ID', dataIndex: 'orderId', key: 'order', render: (id: string) => id?.substring(0, 12) },
                      { title: '结果', key: 'result', render: () => <Tag color="green">成功</Tag> }
                    ]}
                    pagination={{ pageSize: 5 }}
                  />
                </Card>

                <Card size="small" title="失败订单列表" style={{ marginTop: 16 }}>
                  <Table
                    size="small"
                    dataSource={pressureResult.orders.filter(o => !o.success)}
                    rowKey={(r, i) => `${r.userId}-${i}`}
                    columns={[
                      { title: '用户ID', dataIndex: 'userId', key: 'user' },
                      { title: '失败原因', dataIndex: 'message', key: 'msg', render: (msg: string) => <Tag color="red">{msg}</Tag> }
                    ]}
                    pagination={{ pageSize: 5 }}
                  />
                </Card>
              </>
            )}
          </>
        )}
      </Modal>
    </Row>
  );
}
