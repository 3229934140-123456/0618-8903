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
  Col
} from 'antd';
import { PlusOutlined, PlayCircleOutlined, PauseCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { promotionApi } from '../api';
import type { Promotion, PromotionStatus, PromotionType, ConflictStrategy, ScopeType } from '../types';

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

export default function PromotionList() {
  const navigate = useNavigate();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<{
    name?: string;
    type?: PromotionType;
    status?: PromotionStatus;
  }>({});

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
    </div>
  );
}
