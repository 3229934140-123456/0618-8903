import { useEffect, useState } from 'react';
import { Table, Card, Tag, Input } from 'antd';
import { productApi } from '../api';
import type { Product } from '../types';

export default function ProductList() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    productApi.list().then(data => {
      setProducts(data);
      setLoading(false);
    });
  }, []);

  const filtered = products.filter(p =>
    p.name.includes(search) || p.categoryName.includes(search)
  );

  const columns = [
    { title: '商品名称', dataIndex: 'name', key: 'name', width: 250 },
    { title: '分类', dataIndex: 'categoryName', key: 'category', width: 150,
      render: (name: string) => <Tag color="blue">{name}</Tag>
    },
    { title: '价格', dataIndex: 'price', key: 'price', width: 120,
      render: (p: number) => <span style={{ color: '#f5222d', fontWeight: 600 }}>¥{p}</span>
    },
    { title: '常规库存', dataIndex: 'stock', key: 'stock', width: 120 }
  ];

  return (
    <Card>
      <Input.Search
        placeholder="搜索商品名称或分类"
        allowClear
        style={{ width: 300, marginBottom: 16 }}
        onSearch={v => setSearch(v)}
        onChange={e => setSearch(e.target.value)}
      />
      <Table
        loading={loading}
        columns={columns}
        dataSource={filtered}
        rowKey="id"
        pagination={{ pageSize: 20 }}
      />
    </Card>
  );
}
