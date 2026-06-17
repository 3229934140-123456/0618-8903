import { ProductRepository, PromotionRepository, FlashSaleStockRepository } from './repositories';
import {
  PromotionType,
  ScopeType,
  ConflictStrategy,
  PromotionStatus,
  FullReductionConfig,
  DiscountConfig,
  BuyGiftConfig,
  FlashSaleConfig
} from './types';

export function seedData() {
  const existingProducts = ProductRepository.findAll();
  if (existingProducts.length > 0) {
    return;
  }

  const categories = [
    { id: 'cat-electronics', name: '电子产品' },
    { id: 'cat-clothing', name: '服装服饰' },
    { id: 'cat-food', name: '食品饮料' },
    { id: 'cat-books', name: '图书音像' }
  ];

  const productsData = [
    { name: '智能手机 Pro', categoryId: 'cat-electronics', categoryName: '电子产品', price: 3999, stock: 500 },
    { name: '无线蓝牙耳机', categoryId: 'cat-electronics', categoryName: '电子产品', price: 599, stock: 1000 },
    { name: '智能手表', categoryId: 'cat-electronics', categoryName: '电子产品', price: 1299, stock: 300 },
    { name: '平板电脑', categoryId: 'cat-electronics', categoryName: '电子产品', price: 2499, stock: 200 },
    { name: '男士商务衬衫', categoryId: 'cat-clothing', categoryName: '服装服饰', price: 299, stock: 800 },
    { name: '女士连衣裙', categoryId: 'cat-clothing', categoryName: '服装服饰', price: 459, stock: 600 },
    { name: '运动休闲鞋', categoryId: 'cat-clothing', categoryName: '服装服饰', price: 389, stock: 900 },
    { name: '有机坚果礼盒', categoryId: 'cat-food', categoryName: '食品饮料', price: 168, stock: 400 },
    { name: '精品茶叶套装', categoryId: 'cat-food', categoryName: '食品饮料', price: 258, stock: 350 },
    { name: '畅销小说合集', categoryId: 'cat-books', categoryName: '图书音像', price: 128, stock: 700 },
    { name: '技术编程书籍', categoryId: 'cat-books', categoryName: '图书音像', price: 99, stock: 600 }
  ];

  const createdProducts: { id: string; name: string; price: number }[] = [];
  for (const p of productsData) {
    const product = ProductRepository.create(p);
    createdProducts.push({ id: product.id, name: product.name, price: product.price });
  }

  const now = new Date();
  const oneMonthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const oneWeekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const fullReductionConfig: FullReductionConfig = { threshold: 200, reduction: 30 };
  PromotionRepository.create({
    name: '满200减30',
    type: PromotionType.FULL_REDUCTION,
    status: PromotionStatus.ONLINE,
    scope: { type: ScopeType.ALL },
    config: fullReductionConfig,
    priority: 10,
    conflictStrategy: ConflictStrategy.STACK,
    startTime: oneWeekAgo.toISOString(),
    endTime: oneMonthLater.toISOString()
  });

  const discountConfig: DiscountConfig = { rate: 0.9 };
  PromotionRepository.create({
    name: '电子产品9折',
    type: PromotionType.DISCOUNT,
    status: PromotionStatus.ONLINE,
    scope: { type: ScopeType.CATEGORY, categoryIds: ['cat-electronics'] },
    config: discountConfig,
    priority: 20,
    conflictStrategy: ConflictStrategy.STACK,
    startTime: oneWeekAgo.toISOString(),
    endTime: oneWeekLater.toISOString()
  });

  const phoneProduct = createdProducts.find(p => p.name === '智能手机 Pro')!;
  const earphoneProduct = createdProducts.find(p => p.name === '无线蓝牙耳机')!;

  const buyGiftConfig: BuyGiftConfig = {
    buyProductId: phoneProduct.id,
    buyQuantity: 1,
    giftProductId: earphoneProduct.id,
    giftQuantity: 1
  };
  const buyGiftPromo = PromotionRepository.create({
    name: '买手机送耳机',
    type: PromotionType.BUY_GIFT,
    status: PromotionStatus.ONLINE,
    scope: { type: ScopeType.PRODUCT, productIds: [phoneProduct.id] },
    config: buyGiftConfig,
    priority: 30,
    conflictStrategy: ConflictStrategy.EXCLUSIVE,
    mutuallyExclusiveWith: [],
    startTime: oneWeekAgo.toISOString(),
    endTime: oneMonthLater.toISOString()
  });

  const watchProduct = createdProducts.find(p => p.name === '智能手表')!;
  const flashSaleConfig: FlashSaleConfig = {
    salePrice: 899,
    stock: 50,
    perUserLimit: 1
  };
  const flashSalePromo = PromotionRepository.create({
    name: '智能手表限时秒杀',
    type: PromotionType.FLASH_SALE,
    status: PromotionStatus.ONLINE,
    scope: { type: ScopeType.PRODUCT, productIds: [watchProduct.id] },
    config: flashSaleConfig,
    priority: 100,
    conflictStrategy: ConflictStrategy.EXCLUSIVE,
    mutuallyExclusiveWith: [],
    startTime: oneWeekAgo.toISOString(),
    endTime: oneWeekLater.toISOString()
  });
  FlashSaleStockRepository.create({
    promotionId: flashSalePromo.id,
    productId: watchProduct.id,
    totalStock: flashSaleConfig.stock,
    availableStock: flashSaleConfig.stock
  });
}
