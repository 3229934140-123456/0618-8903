import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Steps,
  Form,
  Input,
  InputNumber,
  Select,
  DatePicker,
  Radio,
  Button,
  Space,
  Card,
  message,
  Row,
  Col,
  Checkbox,
  Divider,
  Typography,
  Alert
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { promotionApi, productApi } from '../api';
import { PromotionStatus } from '../types';
import type {
  PromotionType,
  ScopeType,
  ConflictStrategy,
  Product,
  FullReductionConfig,
  DiscountConfig,
  BuyGiftConfig,
  FlashSaleConfig
} from '../types';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

interface FormData {
  name: string;
  type: PromotionType;
  scopeType: ScopeType;
  categoryIds: string[];
  productIds: string[];
  fullReductionThreshold: number;
  fullReductionReduction: number;
  discountRate: number;
  buyGiftBuyProductId: string;
  buyGiftBuyQuantity: number;
  buyGiftGiftProductId: string;
  buyGiftGiftQuantity: number;
  flashSalePrice: number;
  flashSaleStock: number;
  flashSalePerUserLimit: number;
  priority: number;
  conflictStrategy: ConflictStrategy;
  mutuallyExclusiveWith: string[];
  timeRange: [dayjs.Dayjs, dayjs.Dayjs];
}

export default function PromotionCreate() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(0);
  const [form] = Form.useForm<FormData>();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    productApi.list().then(ps => {
      setProducts(ps);
      const cats = new Map<string, string>();
      ps.forEach(p => cats.set(p.categoryId, p.categoryName));
      setCategories(Array.from(cats.entries()).map(([value, label]) => ({ value, label })));
    });
  }, []);

  const promotionType = Form.useWatch('type', form);
  const scopeType = Form.useWatch('scopeType', form);

  const steps = [
    { title: '基本信息' },
    { title: '适用范围' },
    { title: '活动规则' },
    { title: '高级设置' }
  ];

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (values.type === 'FLASH_SALE' && values.scopeType !== 'PRODUCT') {
        message.error('限时秒杀活动必须选择指定商品（单个商品）');
        return;
      }

      if (values.type === 'FLASH_SALE' && (!values.productIds || values.productIds.length !== 1)) {
        message.error('限时秒杀活动必须选择且仅选择一个商品');
        return;
      }

      let config: any;
      switch (values.type) {
        case 'FULL_REDUCTION':
          config = { threshold: values.fullReductionThreshold, reduction: values.fullReductionReduction };
          break;
        case 'DISCOUNT':
          config = { rate: values.discountRate };
          break;
        case 'BUY_GIFT':
          config = {
            buyProductId: values.buyGiftBuyProductId,
            buyQuantity: values.buyGiftBuyQuantity,
            giftProductId: values.buyGiftGiftProductId,
            giftQuantity: values.buyGiftGiftQuantity
          };
          break;
        case 'FLASH_SALE':
          config = {
            salePrice: values.flashSalePrice,
            stock: values.flashSaleStock,
            perUserLimit: values.flashSalePerUserLimit
          };
          break;
      }

      const scope: any = { type: values.scopeType };
      if (values.scopeType === 'CATEGORY') {
        scope.categoryIds = values.categoryIds;
      } else if (values.scopeType === 'PRODUCT') {
        scope.productIds = values.productIds;
      }

      if (values.type === 'FLASH_SALE') {
        const product = products.find(p => p.id === values.productIds?.[0]);
        if (product && values.flashSalePrice >= product.price) {
          message.error('秒杀价格必须低于商品原价');
          return;
        }
      }

      await promotionApi.create({
        name: values.name,
        type: values.type,
        status: PromotionStatus.DRAFT,
        scope,
        config,
        priority: values.priority,
        conflictStrategy: values.conflictStrategy,
        mutuallyExclusiveWith: values.mutuallyExclusiveWith,
        startTime: values.timeRange[0].toISOString(),
        endTime: values.timeRange[1].toISOString()
      });

      message.success('活动创建成功');
      navigate('/promotions');
    } catch (e: any) {
      if (e?.errorFields) return;
      message.error('创建失败');
    }
  };

  const next = async () => {
    try {
      if (current === 0) {
        await form.validateFields(['name', 'type', 'timeRange']);
        if (form.getFieldValue('type') === 'FLASH_SALE') {
          form.setFieldValue('scopeType', 'PRODUCT');
        }
      } else if (current === 1) {
        await form.validateFields(['scopeType']);
        if (form.getFieldValue('scopeType') === 'CATEGORY') {
          await form.validateFields(['categoryIds']);
        } else if (form.getFieldValue('scopeType') === 'PRODUCT') {
          await form.validateFields(['productIds']);
          if (form.getFieldValue('type') === 'FLASH_SALE') {
            const pids = form.getFieldValue('productIds');
            if (!pids || pids.length !== 1) {
              message.error('限时秒杀活动必须选择且仅选择一个商品');
              return;
            }
          }
        }
      } else if (current === 2) {
        const type = form.getFieldValue('type');
        if (type === 'FULL_REDUCTION') {
          await form.validateFields(['fullReductionThreshold', 'fullReductionReduction']);
        } else if (type === 'DISCOUNT') {
          await form.validateFields(['discountRate']);
        } else if (type === 'BUY_GIFT') {
          await form.validateFields([
            'buyGiftBuyProductId',
            'buyGiftBuyQuantity',
            'buyGiftGiftProductId',
            'buyGiftGiftQuantity'
          ]);
        } else if (type === 'FLASH_SALE') {
          await form.validateFields(['flashSalePrice', 'flashSaleStock', 'flashSalePerUserLimit']);
        }
      }
      setCurrent(current + 1);
    } catch {}
  };

  const prev = () => setCurrent(current - 1);

  const step0 = (
    <Form form={form} layout="vertical" initialValues={{ priority: 0, conflictStrategy: 'EXCLUSIVE' }}>
      <Form.Item
        name="name"
        label="活动名称"
        rules={[{ required: true, message: '请输入活动名称' }]}
      >
        <Input placeholder="如：满200减30" maxLength={50} />
      </Form.Item>

      <Form.Item
        name="type"
        label="活动类型"
        rules={[{ required: true, message: '请选择活动类型' }]}
      >
        <Radio.Group>
          <Radio.Button value="FULL_REDUCTION">满额减</Radio.Button>
          <Radio.Button value="DISCOUNT">折扣</Radio.Button>
          <Radio.Button value="BUY_GIFT">买赠</Radio.Button>
          <Radio.Button value="FLASH_SALE">限时秒杀</Radio.Button>
        </Radio.Group>
      </Form.Item>

      <Form.Item
        name="timeRange"
        label="活动时间"
        rules={[{ required: true, message: '请选择活动时间' }]}
      >
        <RangePicker showTime style={{ width: '100%' }} />
      </Form.Item>
    </Form>
  );

  const step1 = (
    <Form form={form} layout="vertical">
      <Form.Item
        name="scopeType"
        label="适用范围"
        rules={[{ required: true, message: '请选择适用范围' }]}
      >
        <Radio.Group disabled={promotionType === 'FLASH_SALE'}>
          <Radio.Button value="ALL" disabled={promotionType === 'FLASH_SALE'}>全部商品</Radio.Button>
          <Radio.Button value="CATEGORY" disabled={promotionType === 'FLASH_SALE'}>指定分类</Radio.Button>
          <Radio.Button value="PRODUCT">指定商品</Radio.Button>
        </Radio.Group>
      </Form.Item>

      {promotionType === 'FLASH_SALE' && (
        <Alert
          type="warning"
          showIcon
          message="限时秒杀活动必须绑定单个商品，适用范围已锁定为「指定商品」"
          style={{ marginBottom: 16 }}
        />
      )}

      {scopeType === 'CATEGORY' && promotionType !== 'FLASH_SALE' && (
        <Form.Item
          name="categoryIds"
          label="选择分类"
          rules={[{ required: true, message: '请选择分类' }]}
        >
          <Checkbox.Group
            options={categories.map(c => ({ label: c.label, value: c.value }))}
          />
        </Form.Item>
      )}

      {scopeType === 'PRODUCT' && (
        <Form.Item
          name="productIds"
          label="选择商品"
          rules={[{ required: true, message: '请选择商品' }]}
          extra={promotionType === 'FLASH_SALE' ? '秒杀活动仅支持选择一个商品' : undefined}
        >
          <Select
            mode={promotionType === 'FLASH_SALE' ? undefined : 'multiple'}
            placeholder={promotionType === 'FLASH_SALE' ? '请选择一个商品' : '搜索并选择商品'}
            showSearch
            optionFilterProp="label"
            style={{ width: '100%' }}
            maxTagCount={10}
            options={products.map(p => ({
              value: p.id,
              label: `${p.name} - ¥${p.price}`
            }))}
          />
        </Form.Item>
      )}

      {promotionType === 'FLASH_SALE' && scopeType !== 'PRODUCT' && (
        <div style={{ color: '#faad14' }}>提示：秒杀活动必须选择单个指定商品</div>
      )}
    </Form>
  );

  const step2 = (
    <Form form={form} layout="vertical">
      {promotionType === 'FULL_REDUCTION' && (
        <>
          <Title level={5}>满额减规则</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="fullReductionThreshold"
                label="满额门槛（元）"
                rules={[{ required: true, type: 'number', min: 1, message: '请输入有效金额' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} placeholder="如：200" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="fullReductionReduction"
                label="减免金额（元）"
                rules={[{ required: true, type: 'number', min: 1, message: '请输入有效金额' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} placeholder="如：30" />
              </Form.Item>
            </Col>
          </Row>
        </>
      )}

      {promotionType === 'DISCOUNT' && (
        <>
          <Title level={5}>折扣规则</Title>
          <Form.Item
            name="discountRate"
            label="折扣率（0~1之间）"
            rules={[{ required: true, type: 'number', min: 0.01, max: 0.99, message: '请输入0到1之间的折扣率' }]}
            extra="例如：0.9 表示9折，0.85 表示8.5折"
          >
            <InputNumber style={{ width: 200 }} min={0.01} max={0.99} step={0.05} placeholder="如：0.9" />
          </Form.Item>
        </>
      )}

      {promotionType === 'BUY_GIFT' && (
        <>
          <Title level={5}>买赠规则</Title>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="buyGiftBuyProductId"
                label="购买商品"
                rules={[{ required: true, message: '请选择购买商品' }]}
              >
                <Select
                  placeholder="选择商品"
                  showSearch
                  optionFilterProp="label"
                  options={products.map(p => ({ value: p.id, label: p.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="buyGiftBuyQuantity"
                label="购买数量"
                rules={[{ required: true, type: 'number', min: 1, message: '请输入数量' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="buyGiftGiftProductId"
                label="赠送商品"
                rules={[{ required: true, message: '请选择赠送商品' }]}
              >
                <Select
                  placeholder="选择商品"
                  showSearch
                  optionFilterProp="label"
                  options={products.map(p => ({ value: p.id, label: p.name }))}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="buyGiftGiftQuantity"
                label="赠送数量"
                rules={[{ required: true, type: 'number', min: 1, message: '请输入数量' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
          </Row>
        </>
      )}

      {promotionType === 'FLASH_SALE' && (
        <>
          <Title level={5}>秒杀规则</Title>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="flashSalePrice"
                label="秒杀价格（元）"
                rules={[{ required: true, type: 'number', min: 0.01, message: '请输入有效价格' }]}
              >
                <InputNumber style={{ width: '100%' }} min={0.01} step={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="flashSaleStock"
                label="秒杀库存"
                rules={[{ required: true, type: 'number', min: 1, message: '请输入库存数量' }]}
                extra="独立于商品常规库存"
              >
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="flashSalePerUserLimit"
                label="每人限购"
                rules={[{ required: true, type: 'number', min: 1, message: '请输入限购数量' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} />
              </Form.Item>
            </Col>
          </Row>
        </>
      )}
    </Form>
  );

  const step3 = (
    <Form form={form} layout="vertical">
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="priority" label="优先级（数字越大优先级越高）">
            <InputNumber style={{ width: '100%' }} min={0} max={999} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="conflictStrategy" label="叠加策略">
            <Radio.Group>
              <Radio.Button value="STACK">可叠加</Radio.Button>
              <Radio.Button value="EXCLUSIVE">互斥</Radio.Button>
            </Radio.Group>
          </Form.Item>
        </Col>
      </Row>

      <Divider orientation="left">规则预览</Divider>
      <Card size="small" style={{ background: '#fafafa' }}>
        <p><Text strong>活动名称：</Text>{form.getFieldValue('name')}</p>
        <p><Text strong>活动类型：</Text>{promotionType}</p>
        <p><Text strong>活动时间：</Text>
          {form.getFieldValue('timeRange')?.[0]?.format('YYYY-MM-DD HH:mm')} ~
          {form.getFieldValue('timeRange')?.[1]?.format('YYYY-MM-DD HH:mm')}
        </p>
        <p><Text strong>适用范围：</Text>{scopeType}</p>
        <p><Text strong>优先级：</Text>{form.getFieldValue('priority') || 0}</p>
        <p><Text strong>叠加策略：</Text>{form.getFieldValue('conflictStrategy') || '互斥'}</p>
      </Card>
    </Form>
  );

  const content = [step0, step1, step2, step3];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/promotions')}>
          返回列表
        </Button>
        <span style={{ fontSize: 18, fontWeight: 600 }}>创建促销活动</span>
      </Space>

      <Card>
        <Steps current={current} items={steps} style={{ marginBottom: 32 }} />
        {content[current]}
        <div style={{ marginTop: 32, textAlign: 'center' }}>
          {current > 0 && (
            <Button style={{ margin: '0 8px' }} onClick={prev}>
              上一步
            </Button>
          )}
          {current < steps.length - 1 && (
            <Button type="primary" onClick={next}>
              下一步
            </Button>
          )}
          {current === steps.length - 1 && (
            <Button type="primary" onClick={handleSubmit}>
              创建活动
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
