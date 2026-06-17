import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Table,
  Button,
  Space,
  Tag,
  Popconfirm,
  message,
  DatePicker,
  Select,
  Input,
  Row,
  Col,
  Drawer,
  Descriptions,
  Statistic,
  Divider,
  List,
  Card,
  Empty,
  Typography,
  Progress
} from 'antd';
import { PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { promotionApi } from '../api';
import type { Promotion, PromotionStatus, PromotionType, ConflictStrategy, ScopeType, Product, Order, FlashSaleConfig } from '../types';

const typeLabels: Record<PromotionType, string> = {
  FULL_REDUCTION: '满额减',
  DISCOUNT: '折扣',
  BUY_GIFT: '买赠',
  FLASH_SALE: '限时秒杀'
};

const typeColors: Record<PromotionType, string> = {
  FULL_REDUCTION: 'blue',
  DISCOUNT: 'green',
  BUY_GIFT: 'purple',
  FLASH_SALE: 'red'
};

const statusLabels: Record<PromotionStatus, string> = {
  DRAFT: '草稿',
  ONLINE: '已上线',
  OFFLINE: '已下线'
};

const statusColors: Record<PromotionStatus, string> = {
  DRAFT: 'default',
  ONLINE: 'green',
  OFFLINE: 'red'
};

const scopeLabels: Record<ScopeType, string> = {
  ALL: '全部商品',
  CATEGORY: '指定分类',
  PRODUCT: '指定商品'
};

const conflictLabels: Record<ConflictStrategy, string> = {
  STACK: '可叠加',
  EXCLUSIVE: '互斥'
};

interface PurchaseRecord {
  id: number;
  userId: string;
  promotionId: string;
  quantity: number;
  createdAt: string;
}

interface PromotionDetail {
  promotion: Promotion;
  applicableProducts: Product[];
  relatedOrders: Order[];
  purchaseRecords: PurchaseRecord[];
}

export default function PromotionList() {
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{
    name?: string;
    type?: PromotionType;
    status?: PromotionStatus;
  }>({});
  const [detailVisible, setDetailVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentDetail, setCurrentDetail] = useState<PromotionDetail | null>(null);

  const loadData = () => {
    setLoading(true);
    promotionApi.list().then(data => {
      let filtered = data;
      if (filters.name) {
        filtered = filtered.filter(p => p.name.includes(filters.name!));
      }
      if (filters.type) {
        filtered = filtered.filter(p => p.type === filters.type);
      }
      if (filters.status) {
        filtered = filtered.filter(p => p.status === filters.status);
      }
      setPromotions(filtered);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  const handleOnline = async (id: string) => {
    try {
      await promotionApi.online(id);
      message.success('活动已上线');
      loadData();
    } catch (e) {
      message.error('上线失败');
    }
  };

  const handleOffline = async (id: string) => {
    try {
      await promotionApi.offline(id);
      message.success('活动已下线');
      loadData();
    } catch (e) {
      message.error('下线失败');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await promotionApi.delete(id);
      message.success('删除成功');
      loadData();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleViewDetail = async (id: string) => {
    setDetailLoading(true);
    setDetailVisible(true);
    try {
      const detail = await promotionApi.getDetail(id);
      setCurrentDetail(detail);
    } catch (e) {
      message.error('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const getConfigDisplay = (promo: Promotion): string => {
    switch (promo.type) {
      case 'FULL_REDUCTION':
        return `满${(promo.config as any).threshold}减${(promo.config as any).reduction}`;
      case 'DISCOUNT':
        return `${((promo.config as any).rate * 10).toFixed(1)}折`;
      case 'BUY_GIFT':
        return `买${(promo.config as any).buyQuantity}件送${(promo.config as any).giftQuantity}件`;
      case 'FLASH_SALE':
        return `特价¥${(promo.config as any).salePrice}，库存${promo.flashSaleStock?.availableStock || 0}/${promo.flashSaleStock?.totalStock || 0}`;
      default:
        return '';
    }
  };

  const columns = [
    { title: '活动名称', dataIndex: 'name', key: 'name', width: 200 },
    {
      title: '活动类型',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type: PromotionType) => <Tag color={typeColors[type]}>{typeLabels[type]}</Tag>
    },
    { title: '活动规则', key: 'config', width: 180, render: (_: any, r: Promotion) => getConfigDisplay(r) },
    {
      title: '适用范围',
      key: 'scope',
      width: 120,
      render: (_: any, r: Promotion) => scopeLabels[r.scope.type]
    },
    { title: '优先级', dataIndex: 'priority', key: 'priority', width: 80, sorter: (a: Promotion, b: Promotion) => a.priority - b.priority },
    {
      title: '叠加策略',
      dataIndex: 'conflictStrategy',
      key: 'conflict',
      width: 100,
      render: (s: ConflictStrategy) => conflictLabels[s]
    },
    {
      title: '活动时间',
      key: 'time',
      width: 280,
      render: (_: any, r: Promotion) => (
        <span>
          {dayjs(r.startTime).format('YYYY-MM-DD HH:mm')}
          <br />
          ~ {dayjs(r.endTime).format('YYYY-MM-DD HH:mm')}
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s: PromotionStatus) => <Tag color={statusColors[s]}>{statusLabels[s]}</Tag>
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      fixed: 'right' as const,
      render: (_: any, r: Promotion) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(r.id)}>
            详情
          </Button>
          {r.status !== 'ONLINE' && (
            <Button type="link" icon={<PlayCircleOutlined />} onClick={() => handleOnline(r.id)}>
              上线
            </Button>
          )}
          {r.status === 'ONLINE' && (
            <Button type="link" danger icon={<PauseCircleOutlined />} onClick={() => handleOffline(r.id)}>
              下线
            </Button>
          )}
          <Popconfirm title="确认删除此活动？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Row style={{ marginBottom: 16 }} justify="space-between" align="middle">
        <Col>
          <Space>
            <Input.Search
              placeholder="搜索活动名称"
              allowClear
              style={{ width: 240 }}
              onSearch={v => setFilters(f => ({ ...f, name: v }))}
            />
            <Select
              placeholder="活动类型"
              allowClear
              style={{ width: 140 }}
              onChange={v => setFilters(f => ({ ...f, type: v }))}
              options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))}
            />
            <Select
              placeholder="状态"
              allowClear
              style={{ width: 140 }}
              onChange={v => setFilters(f => ({ ...f, status: v }))}
              options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
            />
          </Space>
        </Col>
        <Col>
          <Link to="/promotions/create">
            <Button type="primary" icon={<PlusOutlined />}>
              创建活动
            </Button>
          </Link>
        </Col>
      </Row>

      <Table
        loading={loading}
        columns={columns}
        dataSource={promotions}
        rowKey="id"
        scroll={{ x: 1400 }}
      />

      <Drawer
        title="活动详情"
        width={800}
        open={detailVisible}
        onClose={() => setDetailVisible(false)}
        loading={detailLoading}
      >
        {currentDetail && (
          <div>
            <Descriptions
              title="基本信息"
              bordered
              column={2}
              size="small"
              style={{ marginBottom: 24 }}
            >
              <Descriptions.Item label="活动名称">{currentDetail.promotion.name}</Descriptions.Item>
              <Descriptions.Item label="活动类型">
                <Tag color={typeColors[currentDetail.promotion.type]}>
                  {typeLabels[currentDetail.promotion.type]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="活动状态">
                <Tag color={statusColors[currentDetail.promotion.status]}>
                  {statusLabels[currentDetail.promotion.status]}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="优先级">{currentDetail.promotion.priority}</Descriptions.Item>
              <Descriptions.Item label="叠加策略">
                {conflictLabels[currentDetail.promotion.conflictStrategy]}
              </Descriptions.Item>
              <Descriptions.Item label="适用范围">
                {scopeLabels[currentDetail.promotion.scope.type]}
              </Descriptions.Item>
              <Descriptions.Item label="开始时间" span={2}>
                {dayjs(currentDetail.promotion.startTime).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间" span={2}>
                {dayjs(currentDetail.promotion.endTime).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
              {currentDetail.promotion.type === 'FLASH_SALE' && currentDetail.promotion.flashSaleStock && (
                <>
                  <Descriptions.Item label="秒杀价">
                    ¥{(currentDetail.promotion.config as FlashSaleConfig).salePrice}
                  </Descriptions.Item>
                  <Descriptions.Item label="每人限购">
                    {(currentDetail.promotion.config as FlashSaleConfig).perUserLimit} 件
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>

            {currentDetail.promotion.type === 'FLASH_SALE' && currentDetail.promotion.flashSaleStock && (
              <>
                <Divider orientation="left">库存情况</Divider>
                <Row gutter={16} style={{ marginBottom: 24 }}>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic
                        title="总库存"
                        value={currentDetail.promotion.flashSaleStock.totalStock}
                        suffix="件"
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic
                        title="已售"
                        value={currentDetail.promotion.flashSaleStock.soldCount || 0}
                        suffix="件"
                        valueStyle={{ color: '#f5222d' }}
                      />
                    </Card>
                  </Col>
                  <Col span={8}>
                    <Card size="small">
                      <Statistic
                        title="剩余库存"
                        value={currentDetail.promotion.flashSaleStock.availableStock}
                        suffix="件"
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Card>
                  </Col>
                </Row>
                <div style={{ marginBottom: 24 }}>
                  <Typography.Text type="secondary" style={{ marginBottom: 8, display: 'block' }}>
                    销售进度：{currentDetail.promotion.flashSaleStock.totalStock > 0
                      ? ((currentDetail.promotion.flashSaleStock.soldCount || 0) / currentDetail.promotion.flashSaleStock.totalStock * 100).toFixed(1)
                      : 0}%
                  </Typography.Text>
                  <Progress
                    percent={currentDetail.promotion.flashSaleStock.totalStock > 0
                      ? Math.round((currentDetail.promotion.flashSaleStock.soldCount || 0) / currentDetail.promotion.flashSaleStock.totalStock * 100)
                      : 0}
                    strokeColor={{
                      '0%': '#108ee9',
                      '100%': '#f5222d',
                    }}
                  />
                </div>
              </>
            )}

            <Divider orientation="left">适用商品 ({currentDetail.applicableProducts.length} 件)</Divider>
            {currentDetail.applicableProducts.length > 0 ? (
              <List
                size="small"
                dataSource={currentDetail.applicableProducts}
                style={{ marginBottom: 24 }}
                renderItem={p => (
                  <List.Item>
                    <List.Item.Meta
                      title={p.name}
                      description={
                        <Space>
                          <Tag>{p.categoryName}</Tag>
                          <span>原价：¥{p.price}</span>
                          <span>常规库存：{p.stock} 件</span>
                          {currentDetail.promotion.type === 'FLASH_SALE' && currentDetail.promotion.flashSaleStock && (
                            <Tag color="red">
                              秒杀价：¥{(currentDetail.promotion.config as FlashSaleConfig).salePrice}
                            </Tag>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Empty description="无适用商品" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}

            <Divider orientation="left">参与订单 ({currentDetail.relatedOrders.length} 笔)</Divider>
            {currentDetail.relatedOrders.length > 0 ? (
              <Table
                size="small"
                dataSource={currentDetail.relatedOrders}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                columns={[
                  { title: '订单号', dataIndex: 'id', key: 'id', width: 200 },
                  { title: '用户', dataIndex: 'userId', key: 'userId', width: 100 },
                  {
                    title: '商品数量',
                    key: 'count',
                    render: (_: any, r: Order) => r.items.reduce((s, i) => s + i.quantity, 0) + ' 件'
                  },
                  {
                    title: '原价',
                    key: 'orig',
                    render: (_: any, r: Order) => `¥${r.originalTotal.toFixed(2)}`
                  },
                  {
                    title: '优惠',
                    key: 'discount',
                    render: (_: any, r: Order) => (
                      <span style={{ color: '#f5222d' }}>-¥{r.totalDiscount.toFixed(2)}</span>
                    )
                  },
                  {
                    title: '实付',
                    key: 'final',
                    render: (_: any, r: Order) => (
                      <span style={{ color: '#52c41a', fontWeight: 600 }}>¥{r.finalTotal.toFixed(2)}</span>
                    )
                  },
                  {
                    title: '下单时间',
                    key: 'time',
                    render: (_: any, r: Order) => dayjs(r.createdAt).format('MM-DD HH:mm:ss')
                  }
                ]}
                style={{ marginBottom: 24 }}
              />
            ) : (
              <Empty description="暂无订单" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}

            {currentDetail.promotion.type === 'FLASH_SALE' && (
              <>
                <Divider orientation="left">最近抢购记录 ({currentDetail.purchaseRecords.length} 条)</Divider>
                {currentDetail.purchaseRecords.length > 0 ? (
                  <List
                    size="small"
                    dataSource={currentDetail.purchaseRecords}
                    renderItem={record => (
                      <List.Item>
                        <Space>
                          <Tag color="green">抢购成功</Tag>
                          <span>用户 <strong>{record.userId}</strong></span>
                          <span>购买 <strong>{record.quantity}</strong> 件</span>
                          <Typography.Text type="secondary">
                            {dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                          </Typography.Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty description="暂无抢购记录" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
