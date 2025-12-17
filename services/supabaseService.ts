import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { StoreCompany, SupplierEntity, InvoiceRecord, PaymentRecord } from '../types';

// 创建Supabase客户端
let supabase: SupabaseClient;

const getSupabaseClient = (): SupabaseClient => {
  if (!supabase) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL or Anon Key is missing from environment variables');
    }
    
    console.log('Creating Supabase client with URL:', supabaseUrl);
    supabase = createClient(supabaseUrl, supabaseKey);
  }
  return supabase;
};

// 实时订阅功能

// 订阅stores表的变化
export const subscribeToStores = (callback: (stores: StoreCompany[]) => void) => {
  const client = getSupabaseClient();
  
  // 首次获取数据
  fetchStores().then(callback);
  
  // 订阅变化
  return client
    .channel('stores-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stores' }, async () => {
      const stores = await fetchStores();
      callback(stores);
    })
    .subscribe();
};

// 订阅suppliers表的变化
export const subscribeToSuppliers = (callback: (suppliers: SupplierEntity[]) => void) => {
  const client = getSupabaseClient();
  
  // 首次获取数据
  fetchSuppliers().then(callback);
  
  // 订阅变化
  return client
    .channel('suppliers-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, async () => {
      const suppliers = await fetchSuppliers();
      callback(suppliers);
    })
    .subscribe();
};

// 订阅factory_owners表的变化
export const subscribeToFactoryOwners = (callback: (factoryOwners: string[]) => void) => {
  const client = getSupabaseClient();
  
  // 首次获取数据
  fetchFactoryOwners().then(callback);
  
  // 订阅变化
  return client
    .channel('factory-owners-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'factory_owners' }, async () => {
      const factoryOwners = await fetchFactoryOwners();
      callback(factoryOwners);
    })
    .subscribe();
};

// 订阅invoices表的变化
export const subscribeToInvoices = (callback: (invoices: InvoiceRecord[]) => void) => {
  const client = getSupabaseClient();
  
  // 首次获取数据
  fetchInvoices().then(callback);
  
  // 订阅变化
  return client
    .channel('invoices-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, async () => {
      const invoices = await fetchInvoices();
      callback(invoices);
    })
    .subscribe();
};

// 订阅payments表的变化
export const subscribeToPayments = (callback: (payments: PaymentRecord[]) => void) => {
  const client = getSupabaseClient();
  
  // 首次获取数据
  fetchPayments().then(callback);
  
  // 订阅变化
  return client
    .channel('payments-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, async () => {
      const payments = await fetchPayments();
      callback(payments);
    })
    .subscribe();
};

// 订阅季度相关数据的变化
export const subscribeToQuarterData = (callback: () => void) => {
  const client = getSupabaseClient();
  
  // 订阅所有季度相关表的变化
  return client
    .channel('quarter-channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'quarter_data' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'available_quarters' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'current_quarter' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'factory_owners' }, callback)
    .subscribe();
};

// SKU数据相关操作
export const fetchStores = async (): Promise<StoreCompany[]> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('stores')
    .select('*');
  
  if (error) {
    console.error('Error fetching stores:', error);
    return [];
  }
  
  return data as StoreCompany[];
};

export const saveStores = async (stores: StoreCompany[]): Promise<boolean> => {
  const client = getSupabaseClient();
  console.log('Saving stores to Supabase:', stores.length, 'records');
  
  if (stores.length > 0) {
    // 使用upsert方式保存数据，根据id字段更新或插入
    const { error: upsertError } = await client
      .from('stores')
      .upsert(stores, { onConflict: 'id' })
      .select();
    
    if (upsertError) {
      console.error('Error upserting stores:', upsertError);
      return false;
    }
  }
  
  return true;
};

// 供应商数据相关操作
export const fetchSuppliers = async (): Promise<SupplierEntity[]> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('suppliers')
    .select('*');
  
  if (error) {
    console.error('Error fetching suppliers:', error);
    return [];
  }
  
  return data as SupplierEntity[];
};

export const saveSuppliers = async (suppliers: SupplierEntity[]): Promise<boolean> => {
  const client = getSupabaseClient();
  
  if (suppliers.length > 0) {
    // 使用upsert方式保存数据，根据id字段更新或插入
    const { error: upsertError } = await client
      .from('suppliers')
      .upsert(suppliers, { onConflict: 'id' })
      .select();
    
    if (upsertError) {
      console.error('Error upserting suppliers:', upsertError);
      return false;
    }
  }
  
  return true;
};

// 发票数据相关操作
export const fetchInvoices = async (): Promise<InvoiceRecord[]> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('invoices')
    .select('*');
  
  if (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
  
  return data as InvoiceRecord[];
};

export const saveInvoices = async (invoices: InvoiceRecord[]): Promise<boolean> => {
  const client = getSupabaseClient();
  
  if (invoices.length > 0) {
    // 使用upsert方式保存数据，根据id字段更新或插入
    const { error: upsertError } = await client
      .from('invoices')
      .upsert(invoices, { onConflict: 'id' })
      .select();
    
    if (upsertError) {
      console.error('Error upserting invoices:', upsertError);
      return false;
    }
  }
  
  return true;
};

// 付款数据相关操作
export const fetchPayments = async (): Promise<PaymentRecord[]> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('payments')
    .select('*');
  
  if (error) {
    console.error('Error fetching payments:', error);
    return [];
  }
  
  return data as PaymentRecord[];
};

export const savePayments = async (payments: PaymentRecord[]): Promise<boolean> => {
  const client = getSupabaseClient();
  
  if (payments.length > 0) {
    // 使用upsert方式保存数据，根据id字段更新或插入
    const { error: upsertError } = await client
      .from('payments')
      .upsert(payments, { onConflict: 'id' })
      .select();
    
    if (upsertError) {
      console.error('Error upserting payments:', upsertError);
      return false;
    }
  }
  
  return true;
};

// 季度数据相关操作
export const fetchQuarterData = async (): Promise<Record<string, any>> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('quarter_data')
    .select('*');
  
  if (error) {
    console.error('Error fetching quarter data:', error);
    return {};
  }
  
  // 将数组转换为对象格式
  const quarterData: Record<string, any> = {};
  data.forEach(item => {
    if (item.quarter_name) {
      quarterData[item.quarter_name] = {
        stores: item.stores || [],
        suppliers: item.suppliers || [],
        invoices: item.invoices || [],
        payments: item.payments || []
      };
    }
  });
  
  return quarterData;
};

export const saveQuarterData = async (quarterData: Record<string, any>): Promise<boolean> => {
  const client = getSupabaseClient();
  
  // 准备upsert数据
  const upsertData = Object.entries(quarterData).map(([quarterName, data]) => ({
    quarter_name: quarterName,
    stores: data.stores || [],
    suppliers: data.suppliers || [],
    invoices: data.invoices || [],
    payments: data.payments || []
  }));
  
  // 使用upsert方式保存数据，根据quarter_name字段更新或插入
  if (upsertData.length > 0) {
    const { error: upsertError } = await client
      .from('quarter_data')
      .upsert(upsertData, { onConflict: 'quarter_name' })
      .select();
    
    if (upsertError) {
      console.error('Error upserting quarter data:', upsertError);
      return false;
    }
  }
  
  return true;
};

// 可用季度列表相关操作
export const fetchAvailableQuarters = async (): Promise<string[]> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('available_quarters')
    .select('quarter_name')
    .order('quarter_name', { ascending: true });
  
  if (error) {
    console.error('Error fetching available quarters:', error);
    return [];
  }
  
  return data.map(item => item.quarter_name);
};

export const saveAvailableQuarters = async (quarters: string[]): Promise<boolean> => {
  const client = getSupabaseClient();
  
  // 先获取现有季度列表
  const existingQuarters = await fetchAvailableQuarters();
  
  // 确定需要删除的季度
  const quartersToDelete = existingQuarters.filter(q => !quarters.includes(q));
  
  // 删除不存在的季度
  if (quartersToDelete.length > 0) {
    const { error: deleteError } = await client
      .from('available_quarters')
      .delete()
      .in('quarter_name', quartersToDelete);
    
    if (deleteError) {
      console.error('Error deleting available quarters:', deleteError);
      return false;
    }
  }
  
  // 准备插入或更新的数据
  const upsertData = quarters.map(quarter => ({
    quarter_name: quarter
  }));
  
  // 使用upsert方式保存数据，根据quarter_name字段更新或插入
  if (upsertData.length > 0) {
    const { error: upsertError } = await client
      .from('available_quarters')
      .upsert(upsertData, { onConflict: 'quarter_name' })
      .select();
    
    if (upsertError) {
      console.error('Error upserting available quarters:', upsertError);
      return false;
    }
  }
  
  return true;
};

// 当前季度相关操作
export const fetchCurrentQuarter = async (): Promise<string> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('current_quarter')
    .select('quarter_name')
    .limit(1);
  
  if (error) {
    console.error('Error fetching current quarter:', error);
    return '2025Q3'; // 默认值
  }
  
  return data.length > 0 ? data[0].quarter_name : '2025Q3';
};

export const saveCurrentQuarter = async (quarter: string): Promise<boolean> => {
  const client = getSupabaseClient();
  
  // 使用upsert方式保存数据，对于current_quarter表，我们只需要一条记录
  const { error: upsertError } = await client
    .from('current_quarter')
    .upsert({ quarter_name: quarter }, { onConflict: '' }) // 使用空字符串作为冲突目标，意味着总是更新或插入
    .select();
  
  if (upsertError) {
    console.error('Error upserting current quarter:', upsertError);
    return false;
  }
  
  return true;
};

// 工厂所有者相关操作
export const fetchFactoryOwners = async (): Promise<string[]> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('factory_owners')
    .select('owner_name')
    .order('owner_name', { ascending: true });
  
  if (error) {
    console.error('Error fetching factory owners:', error);
    return [];
  }
  
  return data.map(item => item.owner_name);
};

export const saveFactoryOwners = async (owners: string[]): Promise<boolean> => {
  const client = getSupabaseClient();
  
  // 先获取现有工厂所有者列表
  const existingOwners = await fetchFactoryOwners();
  
  // 确定需要删除的工厂所有者
  const ownersToDelete = existingOwners.filter(o => !owners.includes(o));
  
  // 删除不存在的工厂所有者
  if (ownersToDelete.length > 0) {
    const { error: deleteError } = await client
      .from('factory_owners')
      .delete()
      .in('owner_name', ownersToDelete);
    
    if (deleteError) {
      console.error('Error deleting factory owners:', deleteError);
      return false;
    }
  }
  
  // 准备插入或更新的数据
  const upsertData = owners.map(owner => ({
    owner_name: owner
  }));
  
  // 使用upsert方式保存数据，根据owner_name字段更新或插入
  if (upsertData.length > 0) {
    const { error: upsertError } = await client
      .from('factory_owners')
      .upsert(upsertData, { onConflict: 'owner_name' })
      .select();
    
    if (upsertError) {
      console.error('Error upserting factory owners:', upsertError);
      return false;
    }
  }
  
  return true;
};

// 从localStorage迁移数据到Supabase
export const migrateDataFromLocalStorage = async (): Promise<boolean> => {
  try {
    // 从localStorage获取数据
    const storesJson = localStorage.getItem('stores');
    const suppliersJson = localStorage.getItem('suppliers');
    const invoicesJson = localStorage.getItem('invoices');
    const paymentsJson = localStorage.getItem('payments');
    
    // 只有当localStorage中有实际数据时，才执行迁移
    // 避免空数据覆盖Supabase中的现有数据
    if (!storesJson && !suppliersJson && !invoicesJson && !paymentsJson) {
      console.log('localStorage中没有数据，跳过迁移');
      return true;
    }
    
    // 解析数据
    const stores = storesJson ? JSON.parse(storesJson) : [];
    const suppliers = suppliersJson ? JSON.parse(suppliersJson) : [];
    const invoices = invoicesJson ? JSON.parse(invoicesJson) : [];
    const payments = paymentsJson ? JSON.parse(paymentsJson) : [];
    const quarterDataJson = localStorage.getItem('quarterData');
    const availableQuartersJson = localStorage.getItem('availableQuarters');
    const currentQuarter = localStorage.getItem('currentQuarter');
    const factoryOwnersJson = localStorage.getItem('factoryOwners');
    
    const quarterData = quarterDataJson ? JSON.parse(quarterDataJson) : {};
    const availableQuarters = availableQuartersJson ? JSON.parse(availableQuartersJson) : [];
    const factoryOwners = factoryOwnersJson ? JSON.parse(factoryOwnersJson) : [];
    
    console.log('开始从localStorage迁移数据到Supabase...');
    console.log('迁移数据量:', {
      stores: stores.length,
      suppliers: suppliers.length,
      invoices: invoices.length,
      payments: payments.length
    });
    
    // 保存数据到Supabase
    const results = await Promise.all([
      saveStores(stores),
      saveSuppliers(suppliers),
      saveInvoices(invoices),
      savePayments(payments),
      saveQuarterData(quarterData),
      saveAvailableQuarters(availableQuarters),
      saveFactoryOwners(factoryOwners)
    ]);
    
    // 保存当前季度
    if (currentQuarter) {
      results.push(await saveCurrentQuarter(currentQuarter));
    }
    
    // 检查所有操作是否成功
    const allSuccess = results.every(result => result === true);
    
    if (allSuccess) {
      console.log('数据迁移成功！');
    } else {
      console.error('部分数据迁移失败！');
    }
    
    return allSuccess;
  } catch (error) {
    console.error('数据迁移失败:', error);
    return false;
  }
};

// 检查Supabase是否已有数据
export const hasDataInSupabase = async (): Promise<boolean> => {
  try {
    const client = getSupabaseClient();
    
    // 检查多个表，只要有一个表有数据就认为已有数据
    const tables = ['stores', 'suppliers', 'invoices', 'available_quarters'];
    
    for (const table of tables) {
      const { data, error } = await client
        .from(table)
        .select('id')
        .limit(1);
      
      if (error) {
        console.error(`Error checking ${table} existence:`, error);
        continue;
      }
      
      if (data.length > 0) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error checking data existence:', error);
    return false;
  }
};
