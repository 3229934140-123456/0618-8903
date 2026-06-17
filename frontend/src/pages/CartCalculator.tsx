import { useEffect, useState } from 'react';
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
  message
} from 'antd';
import { MinusOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { productApi, calculationApi, promotionApi } from '../api';
import type { Product, CartItem, CalculationResult, Promotion, PromotionType } from '../types';

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

export default function CartCalculator() {
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [cart, setCart] = useState<CartState>({});
  const [result, setResult] = useState<CalculationResult | null>(null);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    productApi.list().then(setProducts);
    promotionApi.listActive().then(setPromotions);
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
      if (r.appliedPromotions.length === 0) {
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
    return { product, quantity };
  });

  const cartColumns = [
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

  return (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <Card title="商品列表" extra={`共${products.length}件商品`}>
          <List
            dataSource={products}
            pagination={{ pageSize: 6 }}
            renderItem={p => (
              <List.Item
                actions={[
                  <Button type="primary" size="small" onClick={() => addToCart(p.id)}>
                    加入购物车
                  </Button>
                ]}
              >
                <List.Item.Meta
                  title={p.name}
                  description={
                    <Space>
                      <Tag>{p.categoryName}</Tag>
                      <span style={{ color: '#f5222d', fontWeight: 600 }}>¥{p.price}</span>
                    </Space>
                  }
                />
              </List.Item>
            )}
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
              <Table
                dataSource={cartItems}
                rowKey={r => r.product.id}
                columns={cartColumns}
                pagination={false}
                size="small"
              />
              <Divider />
              <Space style={{ float: 'right' }}>
                <span>商品合计：</span>
                <span style={{ fontSize: 16, fontWeight: 600 }}>
                  ¥{cartItems.reduce((s, r) => s + r.product.price * r.quantity, 0).toFixed(2)}
                </span>
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
            {result.flashSaleItems && result.flashSaleItems.length > 0 && (
              <Alert
                type="info"
                showIcon
                message="购物车中包含秒杀商品"
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
              <Empty description="未命中任何活动" image={Empty.PRESENTED_IMAGE_SIMPLE} />
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
            dataSource={promotions}
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
