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
  
  // 先删除所有现有数据
  const { error: deleteError } = await client
    .from('stores')
    .delete()
    .neq('id', '');
  
  if (deleteError) {
    console.error('Error deleting stores:', deleteError);
    return false;
  }
  
  // 插入新数据
  if (stores.length > 0) {
    const { error: insertError, data: insertedData } = await client
      .from('stores')
      .insert(stores)
      .select();
    
    if (insertError) {
      console.error('Error inserting stores:', insertError);
      return false;
    }
    console.log('Successfully inserted stores:', insertedData?.length, 'records');
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
  
  // 先删除所有现有数据
  const { error: deleteError } = await client
    .from('suppliers')
    .delete()
    .neq('id', '');
  
  if (deleteError) {
    console.error('Error deleting suppliers:', deleteError);
    return false;
  }
  
  // 插入新数据
  if (suppliers.length > 0) {
    const { error: insertError } = await client
      .from('suppliers')
      .insert(suppliers);
    
    if (insertError) {
      console.error('Error inserting suppliers:', insertError);
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
  
  // 先删除所有现有数据
  const { error: deleteError } = await client
    .from('invoices')
    .delete()
    .neq('id', '');
  
  if (deleteError) {
    console.error('Error deleting invoices:', deleteError);
    return false;
  }
  
  // 插入新数据
  if (invoices.length > 0) {
    const { error: insertError } = await client
      .from('invoices')
      .insert(invoices);
    
    if (insertError) {
      console.error('Error inserting invoices:', insertError);
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
  
  // 先删除所有现有数据
  const { error: deleteError } = await client
    .from('payments')
    .delete()
    .neq('id', '');
  
  if (deleteError) {
    console.error('Error deleting payments:', deleteError);
    return false;
  }
  
  // 插入新数据
  if (payments.length > 0) {
    const { error: insertError } = await client
      .from('payments')
      .insert(payments);
    
    if (insertError) {
      console.error('Error inserting payments:', insertError);
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
  
  // 先删除所有现有数据
  const { error: deleteError } = await client
    .from('quarter_data')
    .delete()
    .neq('id', '');
  
  if (deleteError) {
    console.error('Error deleting quarter data:', deleteError);
    return false;
  }
  
  // 准备插入数据
  const insertData = Object.entries(quarterData).map(([quarterName, data]) => ({
    quarter_name: quarterName,
    stores: data.stores || [],
    suppliers: data.suppliers || [],
    invoices: data.invoices || [],
    payments: data.payments || []
  }));
  
  // 插入新数据
  if (insertData.length > 0) {
    const { error: insertError } = await client
      .from('quarter_data')
      .insert(insertData);
    
    if (insertError) {
      console.error('Error inserting quarter data:', insertError);
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
  
  // 先删除所有现有数据
  const { error: deleteError } = await client
    .from('available_quarters')
    .delete()
    .neq('id', '');
  
  if (deleteError) {
    console.error('Error deleting available quarters:', deleteError);
    return false;
  }
  
  // 准备插入数据
  const insertData = quarters.map(quarter => ({
    quarter_name: quarter
  }));
  
  // 插入新数据
  if (insertData.length > 0) {
    const { error: insertError } = await client
      .from('available_quarters')
      .insert(insertData);
    
    if (insertError) {
      console.error('Error inserting available quarters:', insertError);
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
  
  // 先删除所有现有数据
  const { error: deleteError } = await client
    .from('current_quarter')
    .delete()
    .neq('id', '');
  
  if (deleteError) {
    console.error('Error deleting current quarter:', deleteError);
    return false;
  }
  
  // 插入新数据
  const { error: insertError } = await client
    .from('current_quarter')
    .insert({ quarter_name: quarter });
  
  if (insertError) {
    console.error('Error inserting current quarter:', insertError);
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
  
  // 先删除所有现有数据
  const { error: deleteError } = await client
    .from('factory_owners')
    .delete()
    .neq('id', '');
  
  if (deleteError) {
    console.error('Error deleting factory owners:', deleteError);
    return false;
  }
  
  // 准备插入数据
  const insertData = owners.map(owner => ({
    owner_name: owner
  }));
  
  // 插入新数据
  if (insertData.length > 0) {
    const { error: insertError } = await client
      .from('factory_owners')
      .insert(insertData);
    
    if (insertError) {
      console.error('Error inserting factory owners:', insertError);
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
