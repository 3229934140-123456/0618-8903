import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Row,
  Col,
  Card,
  List,
  Button,
  InputNumber,
  Space,
  Table,
  Tag,
  Statistic,
  Divider,
  Empty,
  Alert,
  message,
  Typography,
  Badge
} from 'antd';
import { MinusOutlined, PlusOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { productApi, calculationApi, promotionApi } from '../api';
import { PromotionType } from '../types';
import type { Product, CartItem, CalculationResult, Promotion, FlashSaleConfig } from '../types';

const { Title, Text } = Typography;

const typeLabels: Record<PromotionType, string> = {
  FULL_REDUCTION: '满额减',
  DISCOUNT: '折扣',
  BUY_GIFT: '买赠',
  FLASH_SALE: '秒杀'
};

const typeColors: Record<PromotionType, string> = {
  FULL_REDUCTION: 'blue',
  DISCOUNT: 'green',
  BUY_GIFT: 'purple',
  FLASH_SALE: 'red'
};

interface CartState {
  [productId: string]: number;
}

interface FlashSaleInfo {
  promotionId: string;
  promotionName: string;
  salePrice: number;
  stock: number;
  perUserLimit: number;
}

export default function CartCalculator() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [cart, setCart] = useState<CartState>({});
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  const flashSaleMap = useMemo(() => {
    const map: Record<string, FlashSaleInfo> = {};
    promotions.forEach(p => {
      if (p.type === PromotionType.FLASH_SALE && p.status === 'ONLINE' && p.scope.productIds) {
        const config = p.config as FlashSaleConfig;
        const stock = p.flashSaleStock?.availableStock || 0;
        p.scope.productIds.forEach(pid => {
          map[pid] = {
            promotionId: p.id,
            promotionName: p.name,
            salePrice: config.salePrice,
            stock,
            perUserLimit: config.perUserLimit
          };
        });
      }
    });
    return map;
  }, [promotions]);

  useEffect(() => {
    productApi.list().then(setProducts);
    promotionApi.list().then(setPromotions);
  }, []);

  const addToCart = (productId: string) => {
    setCart(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const next = { ...prev };
      if (next[productId] > 1) {
        next[productId]--;
      } else {
        delete next[productId];
      }
      return next;
    });
  };

  const deleteFromCart = (productId: string) => {
    setCart(prev => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  };

  const updateQuantity = (productId: string, qty: number | null) => {
    if (!qty || qty <= 0) {
      deleteFromCart(productId);
    } else {
      setCart(prev => ({ ...prev, [productId]: qty }));
    }
  };

  const calculate = async () => {
    const entries = Object.entries(cart);
    if (entries.length === 0) {
      message.warning('请先添加商品到购物车');
      return;
    }

    const items: CartItem[] = entries.map(([productId, quantity]) => {
      const product = products.find(p => p.id === productId)!;
      return { productId, quantity, unitPrice: product.price };
    });

    setCalculating(true);
    try {
      const r = await calculationApi.calculate(items);
      setResult(r);
      if (r.appliedPromotions.length === 0 && (!r.flashSaleItems || r.flashSaleItems.length === 0)) {
        message.info('当前购物车未命中任何促销活动');
      }
    } catch (e) {
      message.error('计算失败');
    } finally {
      setCalculating(false);
    }
  };

  const cartItems = Object.entries(cart).map(([productId, quantity]) => {
    const product = products.find(p => p.id === productId)!;
    const isFlashSale = !!flashSaleMap[productId];
    const flashInfo = flashSaleMap[productId];
    return { product, quantity, isFlashSale, flashInfo };
  });

  const normalCartItems = cartItems.filter(i => !i.isFlashSale);
  const flashSaleCartItems = cartItems.filter(i => i.isFlashSale);

  const normalTotal = normalCartItems.reduce((s, r) => s + r.product.price * r.quantity, 0);
  const flashTotal = flashSaleCartItems.reduce((s, r) => s + r.product.price * r.quantity, 0);

  const normalCartColumns = [
    { title: '商品', dataIndex: ['product', 'name'], key: 'name' },
    { title: '单价', key: 'price',
      render: (_: any, r: any) => `¥${r.product.price}`
    },
    { title: '数量', key: 'qty',
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<MinusOutlined />} onClick={() => removeFromCart(r.product.id)} />
          <InputNumber
            size="small"
            min={1}
            value={r.quantity}
            onChange={v => updateQuantity(r.product.id, v)}
            style={{ width: 70 }}
          />
          <Button size="small" icon={<PlusOutlined />} onClick={() => addToCart(r.product.id)} />
        </Space>
      )
    },
    { title: '小计', key: 'subtotal',
      render: (_: any, r: any) => `¥${(r.product.price * r.quantity).toFixed(2)}`
    },
    { title: '操作', key: 'action',
      render: (_: any, r: any) => (
        <Button type="text" danger icon={<DeleteOutlined />} onClick={() => deleteFromCart(r.product.id)} />
      )
    }
  ];

  const flashCartColumns = [
    { title: '商品', dataIndex: ['product', 'name'], key: 'name',
      render: (name: string, r: any) => (
        <Space>
          {name}
          <Tag color="red">秒杀商品</Tag>
        </Space>
      )
    },
    { title: '常规单价', key: 'price',
      render: (_: any, r: any) => (
        <span style={{ textDecoration: 'line-through', color: '#8c8c8c' }}>¥{r.product.price}</span>
      )
    },
    { title: '秒杀价', key: 'flashPrice',
      render: (_: any, r: any) => (
        <span style={{ color: '#f5222d', fontWeight: 600 }}>¥{r.flashInfo?.salePrice}</span>
      )
    },
    { title: '数量', key: 'qty',
      render: (_: any, r: any) => (
        <Space>
          <Button size="small" icon={<MinusOutlined />} onClick={() => removeFromCart(r.product.id)} />
          <InputNumber
            size="small"
            min={1}
            value={r.quantity}
            onChange={v => updateQuantity(r.product.id, v)}
            style={{ width: 70 }}
          />
          <Button size="small" icon={<PlusOutlined />} onClick={() => addToCart(r.product.id)} />
        </Space>
      )
    },
    { title: '操作', key: 'action',
      render: (_: any, r: any) => (
        <Space>
          <Button type="link" size="small" onClick={() => navigate('/flash-sale')}>
            去抢购
          </Button>
          <Button type="text" danger icon={<DeleteOutlined />} onClick={() => deleteFromCart(r.product.id)} />
        </Space>
      )
    }
  ];

  const promoColumns = [
    { title: '活动名称', dataIndex: 'promotionName', key: 'name' },
    { title: '类型', dataIndex: 'promotionType', key: 'type',
      render: (t: PromotionType) => <Tag color={typeColors[t]}>{typeLabels[t]}</Tag>
    },
    { title: '优惠金额', dataIndex: 'discountAmount', key: 'discount',
      render: (d: number) => <span style={{ color: '#f5222d' }}>-¥{d.toFixed(2)}</span>
    },
    { title: '赠品', key: 'gifts',
      render: (_: any, r: any) =>
        r.gifts?.map((g: any) => {
          const product = products.find(p => p.id === g.productId);
          return <Tag key={g.productId} color="purple">{product?.name || g.productId} x{g.quantity}</Tag>;
        }) || '-'
    }
  ];

  const normalResultItems = useMemo(() => {
    if (!result) return [];
    const flashSet = new Set(result.flashSaleItems || []);
    return result.items.filter(i => !flashSet.has(i.productId));
  }, [result]);

  const flashResultItems = useMemo(() => {
    if (!result) return [];
    const flashSet = new Set(result.flashSaleItems || []);
    return result.items.filter(i => flashSet.has(i.productId));
  }, [result]);

  return (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <Card
          title="商品列表"
          extra={<Space><Tag color="red">{Object.keys(flashSaleMap).length}个秒杀中</Tag><span>共{products.length}件商品</span></Space>}
        >
          <List
            dataSource={products}
            pagination={{ pageSize: 6 }}
            renderItem={p => {
              const isFlashSale = !!flashSaleMap[p.id];
              const flashInfo = flashSaleMap[p.id];

              return (
                <List.Item
                  style={isFlashSale ? { background: '#fff7f7', borderLeft: '3px solid #f5222d', paddingLeft: 12 } : undefined}
                  actions={[
                    isFlashSale ? (
                      <Space>
                        <Button type="primary" danger size="small" icon={<ThunderboltOutlined />} onClick={() => navigate('/flash-sale')}>
                          去抢秒杀
                        </Button>
                        <Button size="small" onClick={() => addToCart(p.id)}>
                          加购物车
                        </Button>
                      </Space>
                    ) : (
                      <Button type="primary" size="small" onClick={() => addToCart(p.id)}>
                        加入购物车
                      </Button>
                    )
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Space>
                        {p.name}
                        {isFlashSale && (
                          <Badge.Ribbon text="秒杀中" color="red">
                            <span />
                          </Badge.Ribbon>
                        )}
                      </Space>
                    }
                    description={
                      <Space direction="vertical" size={4}>
                        <Space>
                          <Tag>{p.categoryName}</Tag>
                          {isFlashSale ? (
                            <Space>
                              <span style={{ color: '#8c8c8c', textDecoration: 'line-through' }}>¥{p.price}</span>
                              <span style={{ color: '#f5222d', fontWeight: 'bold', fontSize: 16 }}>¥{flashInfo.salePrice}</span>
                              <Tag color="green">省¥{(p.price - flashInfo.salePrice).toFixed(2)}</Tag>
                              <Text type="secondary">库存: {flashInfo.stock}</Text>
                            </Space>
                          ) : (
                            <span style={{ color: '#f5222d', fontWeight: 600 }}>¥{p.price}</span>
                          )}
                        </Space>
                        {isFlashSale && (
                          <Text type="danger" style={{ fontSize: 12 }}>
                            ⚠ 此商品正在秒杀中，请通过秒杀抢购流程购买以享受秒杀价。加购物车将按常规价格结算。
                          </Text>
                        )}
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Card>
      </Col>

      <Col span={12}>
        <Card
          title="购物车"
          extra={
            <Button type="primary" loading={calculating} onClick={calculate}>
              计算优惠
            </Button>
          }
        >
          {cartItems.length === 0 ? (
            <Empty description="购物车为空，请在左侧添加商品" />
          ) : (
            <>
              {normalCartItems.length > 0 && (
                <>
                  <Divider orientation="left" plain>
                    <Space>
                      <Tag color="blue">普通商品</Tag>
                      <span>共{normalCartItems.reduce((s, r) => s + r.quantity, 0)}件</span>
                    </Space>
                  </Divider>
                  <Table
                    dataSource={normalCartItems}
                    rowKey={r => r.product.id}
                    columns={normalCartColumns}
                    pagination={false}
                    size="small"
                  />
                </>
              )}

              {flashSaleCartItems.length > 0 && (
                <>
                  <Divider orientation="left" plain>
                    <Space>
                      <Tag color="red">秒杀商品</Tag>
                      <span>共{flashSaleCartItems.reduce((s, r) => s + r.quantity, 0)}件</span>
                      <Text type="warning" style={{ fontSize: 12 }}>按常规价格结算，需抢购请去秒杀页</Text>
                    </Space>
                  </Divider>
                  <Alert
                    type="warning"
                    showIcon
                    message="购物车包含秒杀商品"
                    description="以下商品正在进行秒杀活动，但在购物车中按常规价格计算。如需享受秒杀价，请点击「去抢购」按钮通过秒杀流程购买。"
                    style={{ marginBottom: 12 }}
                  />
                  <Table
                    dataSource={flashSaleCartItems}
                    rowKey={r => r.product.id}
                    columns={flashCartColumns}
                    pagination={false}
                    size="small"
                  />
                </>
              )}

              <Divider />
              <Space direction="vertical" style={{ width: '100%' }} align="end">
                {normalTotal > 0 && (
                  <Space>
                    <Text type="secondary">普通商品合计:</Text>
                    <Text strong style={{ fontSize: 14 }}>¥{normalTotal.toFixed(2)}</Text>
                  </Space>
                )}
                {flashTotal > 0 && (
                  <Space>
                    <Text type="secondary">秒杀商品(常规价)合计:</Text>
                    <Text strong style={{ fontSize: 14 }}>¥{flashTotal.toFixed(2)}</Text>
                  </Space>
                )}
                <Space>
                  <span style={{ fontSize: 16 }}>商品总计：</span>
                  <span style={{ fontSize: 20, fontWeight: 'bold' }}>
                    ¥{(normalTotal + flashTotal).toFixed(2)}
                  </span>
                </Space>
              </Space>
            </>
          )}
        </Card>

        {result && (
          <Card title="优惠计算结果" style={{ marginTop: 16 }}>
            {result.warnings && result.warnings.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                {result.warnings.map((w, i) => (
                  <Alert key={i} type="warning" showIcon message={w} style={{ marginBottom: 8 }} />
                ))}
              </div>
            )}

            {flashResultItems.length > 0 && (
              <Alert
                type="info"
                showIcon
                message={`购物车中包含 ${flashResultItems.length} 件秒杀商品`}
                description="这些商品不享受普通优惠，按常规价格计算。如需秒杀价请前往「秒杀演示」页面通过抢购流程购买。"
                style={{ marginBottom: 16 }}
              />
            )}

            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={8}>
                <Statistic title="原价合计" value={result.originalTotal} precision={2} prefix="¥" />
              </Col>
              <Col span={8}>
                <Statistic
                  title="优惠金额"
                  value={result.totalDiscount}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#f5222d' }}
                />
              </Col>
              <Col span={8}>
                <Statistic
                  title="应付金额"
                  value={result.finalTotal}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ color: '#52c41a' }}
                />
              </Col>
            </Row>

            {normalResultItems.length > 0 && (
              <>
                <Divider orientation="left">普通商品优惠明细</Divider>
                <Table
                  size="small"
                  dataSource={normalResultItems}
                  rowKey="productId"
                  columns={[
                    { title: '商品', key: 'name',
                      render: (_: any, r: any) => {
                        const p = products.find(pp => pp.id === r.productId);
                        return p?.name || r.productId;
                      }
                    },
                    { title: '数量', dataIndex: 'quantity', key: 'qty' },
                    { title: '原价', key: 'orig',
                      render: (_: any, r: any) => `¥${(r.unitPrice * r.quantity).toFixed(2)}`
                    },
                    { title: '优惠后', dataIndex: 'finalPrice', key: 'final',
                      render: (v: number) => <span style={{ color: '#52c41a' }}>¥{v.toFixed(2)}</span>
                    }
                  ]}
                  pagination={false}
                />
              </>
            )}

            {flashResultItems.length > 0 && (
              <>
                <Divider orientation="left">秒杀商品(按常规价)</Divider>
                <Table
                  size="small"
                  dataSource={flashResultItems}
                  rowKey="productId"
                  columns={[
                    { title: '商品', key: 'name',
                      render: (_: any, r: any) => {
                        const p = products.find(pp => pp.id === r.productId);
                        const flashInfo = flashSaleMap[r.productId];
                        return (
                          <Space>
                            {p?.name || r.productId}
                            <Tag color="red">秒杀商品</Tag>
                            {flashInfo && (
                              <Tag color="green">
                                去抢购可省¥{((r.unitPrice - flashInfo.salePrice) * r.quantity).toFixed(2)}
                              </Tag>
                            )}
                          </Space>
                        );
                      }
                    },
                    { title: '数量', dataIndex: 'quantity', key: 'qty' },
                    { title: '常规价小计', dataIndex: 'finalPrice', key: 'final',
                      render: (v: number) => `¥${v.toFixed(2)}`
                    },
                    { title: '操作', key: 'action',
                      render: (_: any, r: any) => (
                        <Button type="link" size="small" onClick={() => navigate('/flash-sale')}>
                          去抢秒杀价
                        </Button>
                      )
                    }
                  ]}
                  pagination={false}
                />
              </>
            )}

            <Divider orientation="left">命中的促销活动</Divider>
            {result.appliedPromotions.length > 0 ? (
              <Table
                dataSource={result.appliedPromotions}
                rowKey="promotionId"
                columns={promoColumns}
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="普通商品未命中任何活动" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}

            {result.giftItems.length > 0 && (
              <>
                <Divider orientation="left">赠品列表</Divider>
                <List
                  size="small"
                  dataSource={result.giftItems}
                  renderItem={g => {
                    const product = products.find(p => p.id === g.productId);
                    return <List.Item>{product?.name || g.productId} x{g.quantity}</List.Item>;
                  }}
                />
              </>
            )}
          </Card>
        )}

        <Card title="当前可用促销活动" style={{ marginTop: 16 }}>
          <List
            size="small"
            dataSource={promotions.filter(p => p.status === 'ONLINE')}
            locale={{ emptyText: '暂无进行中的活动' }}
            renderItem={p => (
              <List.Item>
                <Space>
                  <Tag color={typeColors[p.type]}>{typeLabels[p.type]}</Tag>
                  <span style={{ fontWeight: 600 }}>{p.name}</span>
                  <span style={{ color: '#8c8c8c' }}>优先级: {p.priority}</span>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Col>
    </Row>
  );
}
