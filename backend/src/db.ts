import * as fs from 'fs';
import * as path from 'path';
import {
  Promotion,
  Product,
  FlashSaleStock,
  Order
} from './types';

const dbDir = path.join(__dirname, '..', 'data');
const dbFile = path.join(dbDir, 'db.json');

export interface UserFlashPurchaseRecord {
  id: number;
  userId: string;
  promotionId: string;
  quantity: number;
  createdAt: string;
}

interface DatabaseSchema {
  products: Product[];
  promotions: Promotion[];
  flashSaleStocks: FlashSaleStock[];
  orders: Order[];
  userFlashPurchases: UserFlashPurchaseRecord[];
}

const initialData: DatabaseSchema = {
  products: [],
  promotions: [],
  flashSaleStocks: [],
  orders: [],
  userFlashPurchases: []
};

class JsonDatabase {
  private data: DatabaseSchema;
  private filePath: string;
  private nextId: number = 1;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.data = this.load();
  }

  private load(): DatabaseSchema {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(content);
        this.nextId = (parsed.userFlashPurchases || []).reduce(
          (max: number, r: UserFlashPurchaseRecord) => Math.max(max, r.id),
          0
        ) + 1;
        return {
          products: parsed.products || [],
          promotions: parsed.promotions || [],
          flashSaleStocks: parsed.flashSaleStocks || [],
          orders: parsed.orders || [],
          userFlashPurchases: parsed.userFlashPurchases || []
        };
      }
    } catch (e) {
      console.warn('加载数据库文件失败，使用空数据库:', e);
    }
    return { ...initialData };
  }

  save(): void {
    try {
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('保存数据库失败:', e);
    }
  }

  get products(): Product[] {
    return this.data.products;
  }

  get promotions(): Promotion[] {
    return this.data.promotions;
  }

  get flashSaleStocks(): FlashSaleStock[] {
    return this.data.flashSaleStocks;
  }

  get orders(): Order[] {
    return this.data.orders;
  }

  get userFlashPurchases(): UserFlashPurchaseRecord[] {
    return this.data.userFlashPurchases;
  }

  getNextId(): number {
    return this.nextId++;
  }
}

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new JsonDatabase(dbFile);

export function initDatabase(): void {
  db.save();
}
