import { StoreCompany, SupplierEntity, InvoiceRecord, PaymentRecord } from '../types';

// 定义存储键名
const STORAGE_KEYS = {
  STORES: 'stores',
  SUPPLIERS: 'suppliers',
  INVOICES: 'invoices',
  PAYMENTS: 'payments',
  QUARTER_DATA: 'quarterData',
  AVAILABLE_QUARTERS: 'availableQuarters',
  CURRENT_QUARTER: 'currentQuarter',
  FACTORY_OWNERS: 'factoryOwners'
};

// 通用的localStorage操作函数
const getItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error getting ${key} from localStorage:`, error);
    return defaultValue;
  }
};

const setItem = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error setting ${key} to localStorage:`, error);
  }
};

// 店铺数据相关操作
export const fetchStores = async (): Promise<StoreCompany[]> => {
  return getItem<StoreCompany[]>(STORAGE_KEYS.STORES, []);
};

export const saveStores = async (stores: StoreCompany[]): Promise<boolean> => {
  setItem<StoreCompany[]>(STORAGE_KEYS.STORES, stores);
  return true;
};

// 供应商数据相关操作
export const fetchSuppliers = async (): Promise<SupplierEntity[]> => {
  return getItem<SupplierEntity[]>(STORAGE_KEYS.SUPPLIERS, []);
};

export const saveSuppliers = async (suppliers: SupplierEntity[]): Promise<boolean> => {
  setItem<SupplierEntity[]>(STORAGE_KEYS.SUPPLIERS, suppliers);
  return true;
};

// 发票数据相关操作
export const fetchInvoices = async (): Promise<InvoiceRecord[]> => {
  return getItem<InvoiceRecord[]>(STORAGE_KEYS.INVOICES, []);
};

export const saveInvoices = async (invoices: InvoiceRecord[]): Promise<boolean> => {
  setItem<InvoiceRecord[]>(STORAGE_KEYS.INVOICES, invoices);
  return true;
};

// 付款数据相关操作
export const fetchPayments = async (): Promise<PaymentRecord[]> => {
  return getItem<PaymentRecord[]>(STORAGE_KEYS.PAYMENTS, []);
};

export const savePayments = async (payments: PaymentRecord[]): Promise<boolean> => {
  setItem<PaymentRecord[]>(STORAGE_KEYS.PAYMENTS, payments);
  return true;
};

// 季度数据相关操作
export const fetchQuarterData = async (): Promise<Record<string, any>> => {
  return getItem<Record<string, any>>(STORAGE_KEYS.QUARTER_DATA, {});
};

export const saveQuarterData = async (quarterData: Record<string, any>): Promise<boolean> => {
  setItem<Record<string, any>>(STORAGE_KEYS.QUARTER_DATA, quarterData);
  return true;
};

// 可用季度列表相关操作
export const fetchAvailableQuarters = async (): Promise<string[]> => {
  return getItem<string[]>(STORAGE_KEYS.AVAILABLE_QUARTERS, []);
};

export const saveAvailableQuarters = async (quarters: string[]): Promise<boolean> => {
  setItem<string[]>(STORAGE_KEYS.AVAILABLE_QUARTERS, quarters);
  return true;
};

// 当前季度相关操作
export const fetchCurrentQuarter = async (): Promise<string> => {
  return getItem<string>(STORAGE_KEYS.CURRENT_QUARTER, '2025Q3');
};

export const saveCurrentQuarter = async (quarter: string): Promise<boolean> => {
  setItem<string>(STORAGE_KEYS.CURRENT_QUARTER, quarter);
  return true;
};

// 工厂所有者相关操作
export const fetchFactoryOwners = async (): Promise<string[]> => {
  return getItem<string[]>(STORAGE_KEYS.FACTORY_OWNERS, []);
};

export const saveFactoryOwners = async (owners: string[]): Promise<boolean> => {
  setItem<string[]>(STORAGE_KEYS.FACTORY_OWNERS, owners);
  return true;
};

// 检查localStorage是否已有数据
export const hasDataInLocalStorage = async (): Promise<boolean> => {
  const stores = getItem<StoreCompany[]>(STORAGE_KEYS.STORES, []);
  const suppliers = getItem<SupplierEntity[]>(STORAGE_KEYS.SUPPLIERS, []);
  const invoices = getItem<InvoiceRecord[]>(STORAGE_KEYS.INVOICES, []);
  const availableQuarters = getItem<string[]>(STORAGE_KEYS.AVAILABLE_QUARTERS, []);
  
  return stores.length > 0 || suppliers.length > 0 || invoices.length > 0 || availableQuarters.length > 0;
};

// 从localStorage迁移数据到localStorage（保持接口一致）
export const migrateDataFromLocalStorage = async (): Promise<boolean> => {
  // 由于已经使用localStorage，这个函数实际上不需要做任何事情
  // 只是为了保持与supabaseService.ts相同的接口
  return true;
};

// 检查是否有数据（保持接口一致）
export const hasDataInSupabase = async (): Promise<boolean> => {
  // 由于已经使用localStorage，这里实际上是检查localStorage
  return hasDataInLocalStorage();
};
