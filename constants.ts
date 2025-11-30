import { StoreCompany, SupplierEntity, EntityType, InvoiceRecord, PaymentRecord, StoreTaxType } from './types';

export const QUARTERLY_LIMIT_THRESHOLD = 280000;

export const MOCK_SUPPLIERS: SupplierEntity[] = [
  {
    id: 's1',
    name: '安吉皓翔家具经营部',
    owner: '雷超',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's2',
    name: '安吉昊合家具厂',
    owner: '余永忠',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's3',
    name: '安吉嘉誉家具商行',
    owner: '周娜',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Full'
  },
  {
    id: 's4',
    name: '安吉瓦迪家具厂',
    owner: '赵国庆',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's5',
    name: '安吉辉望家具商行',
    owner: '陈增望',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's6',
    name: '安吉山川海福家具经营部',
    owner: '管盛军',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's7',
    name: '安吉孝丰华力家具厂',
    owner: '施云杰',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's8',
    name: '安吉忆顺家具配件厂',
    owner: '孙永涛',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 190000,
    status: 'Active'
  },
  {
    id: 's9',
    name: '安吉星造家具厂',
    owner: '付新海',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's10',
    name: '安吉云宏家具厂',
    owner: '张秋红',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's11',
    name: '安吉梓慕家具商行',
    owner: '程利',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's12',
    name: '安吉博恒家具厂',
    owner: '钟大奖',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's13',
    name: '安吉君霖家居经营部',
    owner: '鲍伟',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's14',        
    name: '安吉孝丰从谦家具厂',
    owner: '应凯',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's15',
    name: '安吉景沃家具厂',
    owner: '吴洪波',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's16',
    name: '安吉杭垓众艺家具厂',
    owner: '王林',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  },
  {
    id: 's17', 
    name: '安吉尘屿家具商行',
    owner: '杨凯',
    type: EntityType.INDIVIDUAL,
    quarterlyLimit: 280000,
    status: 'Active'
  }
];

export const MOCK_STORES: StoreCompany[] = [
  {
    id: 'c1',
    storeName: '达里奥',
    companyName: '杭州希木云品家居有限公司',
    quarterIncome: 3708948.79,
    quarterExpenses: 0,
    taxType: StoreTaxType.SMALL_SCALE,
    expenseBreakdown: {
      shipping: 0,
      promotion: 0,
      salaries: 0,
      rent: 0,
      office: 0,
      fuel: 0,
      other: 0
    }
  },
  {
    id: 'c2',
    storeName: '丹颜',
    companyName: '杭州北欧曼家具有限公司',
    quarterIncome: 1316294.79,
    quarterExpenses: 0,
    taxType: StoreTaxType.SMALL_SCALE
  },
  {
    id: 'c3',
    storeName: '安和木',
    companyName: '杭州达奇菲尔家居有限公司',
    quarterIncome: 1330225.58,
    quarterExpenses: 0,
    taxType: StoreTaxType.SMALL_SCALE
  },
  {
    id: 'c4',
    storeName: '摩登',
    companyName: '杭州维家漫家居有限公司',
    quarterIncome: 2832716.99,
    quarterExpenses: 0,
    taxType: StoreTaxType.SMALL_SCALE
  },
  {
    id: 'c5',
    storeName: '爱尚',
    companyName: '杭州元牧家居用品有限公司',
    quarterIncome: 1637686.11,
    quarterExpenses: 0,
    taxType: StoreTaxType.SMALL_SCALE
  },
  {
    id: 'c6',
    storeName: '苏艺匠',
    companyName: '杭州达雷尔沃家居有限公司',
    quarterIncome: 602530.6,
    quarterExpenses: 0,
    taxType: StoreTaxType.SMALL_SCALE
  },
  {
    id: 'c7',
    storeName: '牧席',
    companyName: '杭州元森启木家居用品有限公司',
    quarterIncome: 1262177.71,
    quarterExpenses: 0,
    taxType: StoreTaxType.SMALL_SCALE
  }
];

// Initial Invoices simulating the "invoicesReceived" from before
export const MOCK_INVOICES: InvoiceRecord[] = [];

// Initial Payments
export const MOCK_PAYMENTS: PaymentRecord[] = [];