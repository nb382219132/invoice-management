export enum EntityType {
  INDIVIDUAL = '个体工商户',
  COMPANY = '小规模纳税人',
  GENERAL = '一般纳税人'
}

export enum StoreTaxType {
  SMALL_SCALE = '小规模纳税人',
  GENERAL = '一般纳税人'
}

export interface SupplierEntity {
  id: string;
  name: string; // The business name (e.g., Anji Xinchang Trading)
  owner: string; // The person (e.g., Lei Zhen)
  type: EntityType;
  quarterlyLimit: number; // usually 300,000 for Getihu
  status: 'Active' | 'Full' | 'Suspended';
}

export interface ExpenseBreakdown {
  shipping: number;
  promotion: number;
  salaries: number;
  rent: number;
  office: number;
  fuel: number;
  other: number;
}

export interface StoreCompany {
  id: string;
  storeName: string; // e.g., Dali Ao
  companyName: string; // e.g., Hangzhou Ximu
  quarterIncome: number;
  quarterExpenses: number; // Real expenses (rent, ads, etc.)
  expenseBreakdown?: ExpenseBreakdown;
  taxType: StoreTaxType;
}

export interface InvoiceRecord {
  id: string;
  storeId: string;
  supplierId: string;
  amount: number;
  date: string;
  status?: 'pending' | 'verified' | 'rejected';
  verificationResult?: {
    isValid: boolean;
    issues?: string[];
    factoryName?: string;
    companyName?: string;
    amount?: number;
  };
}

export interface PaymentRecord {
  id: string;
  storeId: string;
  supplierId: string;
  factoryOwner?: string;
  amount: number;
  date: string;
}

export interface AnalysisResult {
  suggestion: string;
  priorityScore: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}