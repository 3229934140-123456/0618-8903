import { useEffect, useState } from 'react';
import { Card, Row, Col, Statistic, Table, Progress, Space, Tag } from 'antd';
import {
  DollarOutlined,
  ShoppingCartOutlined,
  TagOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { statsApi } from '../api';
import type { SalesStats, FlashSaleStock } from '../types';

interface WsData {
  sales: SalesStats;
  flashSaleStocks: FlashSaleStock[];
  timestamp: string;
}

const COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2'];

export default function Dashboard() {
  const [stats, setStats] = useState<SalesStats | null>(null);
  const [flashSaleStocks, setFlashSaleStocks] = useState<FlashSaleStock[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  useEffect(() => {
    statsApi.getSales().then(s => setStats(s));

    const ws = new WebSocket(`ws://${window.location.host}/ws`);
    ws.onmessage = (event) => {
      const data: WsData = JSON.parse(event.data);
      if (data.type === 'stats_update') {
        setStats(data.data.sales);
        setFlashSaleStocks(data.data.flashSaleStocks);
        setLastUpdate(data.data.timestamp);
      }
    };

    return () => ws.close();
  }, []);

  const hourlyData = stats?.hourlyOrders
    ? Object.entries(stats.hourlyOrders)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12)
        .map(([hour, count]) => ({ hour: hour.substring(11, 16), orders: count }))
    : [];

  const promoData = stats?.ordersByPromotion
    ? Object.entries(stats.ordersByPromotion).map(([id, info]) => ({
        name: info.name,
        订单数: info.count,
        优惠金额: Math.round(info.discount)
      }))
    : [];

  const promoPieData = stats?.ordersByPromotion
    ? Object.entries(stats.ordersByPromotion).map(([id, info]) => ({
        name: info.name,
        value: info.count
      }))
    : [];

  const flashSaleColumns = [
    { title: '活动名称', dataIndex: 'promotionName', key: 'name' },
    { title: '总库存', dataIndex: 'totalStock', key: 'total' },
    {
      title: '销售进度',
      key: 'progress',
      render: (_: any, record: FlashSaleStock) => {
        const percent = record.totalStock > 0
          ? Math.round((record.soldCount / record.totalStock) * 100)
          : 0;
        return (
          <Progress
            percent={percent}
            status={record.availableStock === 0 ? 'exception' : 'active'}
            format={() => `${record.soldCount}/${record.totalStock}`}
          />
        );
      }
    },
    {
      title: '状态',
      key: 'status',
      render: (_: any, record: FlashSaleStock) =>
        record.availableStock > 0 ? <Tag color="green">抢购中</Tag> : <Tag color="red">已售罄</Tag>
    }
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <span style={{ color: '#8c8c8c' }}>最后更新时间：{lastUpdate || new Date().toLocaleString()}</span>
      </Space>

      <Row gutter={[16, 16]}>
        <Col span={6}>
          <Card>
            <Statistic
              title="订单总数"
              value={stats?.totalOrders || 0}
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="销售总额"
              value={stats?.totalRevenue || 0}
              precision={2}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix="元"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="总优惠金额"
              value={stats?.totalDiscount || 0}
              precision={2}
              prefix={<TagOutlined />}
              valueStyle={{ color: '#faad14' }}
              suffix="元"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="进行中秒杀"
              value={flashSaleStocks.filter(s => s.availableStock > 0).length}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ color: '#eb2f96' }}
              suffix={`/${flashSaleStocks.length}场`}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="近12小时订单趋势">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#1677ff"
                  strokeWidth={2}
                  dot={{ fill: '#1677ff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="各活动订单分布">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={promoPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {promoPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="各活动订单与优惠金额">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={promoData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="订单数" fill="#1677ff" />
                <Bar dataKey="优惠金额" fill="#faad14" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="秒杀活动销售进度">
            <Table
              dataSource={flashSaleStocks}
              rowKey="promotionId"
              columns={flashSaleColumns}
              pagination={false}
              size="middle"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
