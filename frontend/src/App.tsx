import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  TagOutlined,
  ShoppingOutlined,
  CalculatorOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import PromotionList from './pages/PromotionList';
import PromotionCreate from './pages/PromotionCreate';
import ProductList from './pages/ProductList';
import CartCalculator from './pages/CartCalculator';
import FlashSaleDemo from './pages/FlashSaleDemo';

const { Header, Sider, Content } = Layout;

export default function App() {
  const location = useLocation();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: <Link to="/">数据看板</Link> },
    { key: '/promotions', icon: <TagOutlined />, label: <Link to="/promotions">活动管理</Link> },
    { key: '/products', icon: <ShoppingOutlined />, label: <Link to="/products">商品列表</Link> },
    { key: '/calculator', icon: <CalculatorOutlined />, label: <Link to="/calculator">优惠计算</Link> },
    { key: '/flash-sale', icon: <ThunderboltOutlined />, label: <Link to="/flash-sale">秒杀演示</Link> }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" width={220}>
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 18,
          fontWeight: 'bold',
          borderBottom: '1px solid rgba(255,255,255,0.1)'
        }}>
          促销规则引擎
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 20, fontWeight: 600 }}>电商促销活动规则引擎管理系统</span>
        </Header>
        <Content style={{ margin: 24 }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/promotions" element={<PromotionList />} />
            <Route path="/promotions/create" element={<PromotionCreate />} />
            <Route path="/products" element={<ProductList />} />
            <Route path="/calculator" element={<CartCalculator />} />
            <Route path="/flash-sale" element={<FlashSaleDemo />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  );
}
