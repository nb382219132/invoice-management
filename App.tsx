import { useState, useEffect } from 'react';
// 导入所有需要的函数
import {
  subscribeToStores,
  subscribeToSuppliers,
  subscribeToInvoices,
  subscribeToPayments,
  subscribeToQuarterData,
  subscribeToFactoryOwners,
  fetchStores,
  fetchSuppliers,
  fetchInvoices,
  fetchPayments,
  fetchQuarterData,
  fetchAvailableQuarters,
  fetchCurrentQuarter,
  fetchFactoryOwners,
  saveStores,
  saveSuppliers,
  saveInvoices,
  savePayments,
  saveQuarterData,
  saveAvailableQuarters,
  saveCurrentQuarter,
  saveFactoryOwners,
  migrateDataFromLocalStorage,
  restoreDataFromBackup,
  hasDataInSupabase
} from './services/supabaseService';
import { 
  LayoutDashboard, 
  Store, 
  Users, 
  Sparkles, 
  PieChart,
  ArrowUpRight,
  TrendingUp,
  Receipt,
  Bot,
  Plus,
  X,
  CreditCard,
  FilePlus,
  Building2,
  Download,
  User,
  Pencil,
  Shield,
  Calendar,
  FileText
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { 
  MOCK_STORES, 
  MOCK_SUPPLIERS, 
  MOCK_INVOICES,
  MOCK_PAYMENTS,
  QUARTERLY_LIMIT_THRESHOLD 
} from './constants';
import { StoreCompany, SupplierEntity, InvoiceRecord, PaymentRecord, EntityType, StoreTaxType } from './types';
import StoreCard from './components/StoreCard';
import SupplierRow, { SupplierItemData } from './components/SupplierRow';
import AiChat from './components/AiChat';
import SearchableSelect from './components/SearchableSelect';
import KpiTooltip from './components/KpiTooltip';
import { analyzeTaxOptimization } from './services/geminiService';
import ReactMarkdown from 'react-markdown';
import { getInvoiceStatusInfo } from './services/invoiceRecognition';

// Simple Navigation State
type View = 'dashboard' | 'stores' | 'suppliers' | 'chat' | 'admin' | 'userInvoices';
type ModalType = 'addStore' | 'editStore' | 'addSupplier' | 'editEntity' | 'editOwner' | 'addPayment' | 'addInvoice' | 'editExpenses' | 'quarterManagement' | 'deleteStore' | 'deleteEntity' | 'deleteOwner' | null;

// --- Modal Component (Defined outside to prevent re-renders losing focus) ---
interface ModalBackdropProps {
  children: React.ReactNode;
  title: string;
  onClose: () => void;
}

const ModalBackdrop: React.FC<ModalBackdropProps> = ({ children, title, onClose }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in fade-in zoom-in duration-200">
      <div className="bg-slate-50 border-b border-slate-100 p-4 flex justify-between items-center">
        <h3 className="font-bold text-lg text-slate-800">{title}</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
      </div>
      <div className="p-6 space-y-4">
        {children}
      </div>
    </div>
  </div>
);

function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  
  // Data State with Supabase persistence
  const [stores, setStores] = useState<StoreCompany[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierEntity[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  // UI State
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    shipping: '', promotion: '', salaries: '', rent: '', office: '', fuel: '', other: ''
  });
  
  // Quarter Management State with Supabase persistence
  const [currentQuarter, setCurrentQuarter] = useState<string>('2025Q3');
  const [availableQuarters, setAvailableQuarters] = useState<string[]>(['2025Q3']);
  const [quarterData, setQuarterData] = useState<Record<string, {
    stores: StoreCompany[];
    suppliers: SupplierEntity[];
    invoices: InvoiceRecord[];
    payments: PaymentRecord[];
  }>>({});
  
  // --- Form States for Add/Edit ---
  const [storeForm, setStoreForm] = useState({ id: '', companyName: '', storeName: '', income: '', expenses: '', taxType: StoreTaxType.GENERAL });
  const [supplierForm, setSupplierForm] = useState({ id: '', name: '', owner: '', type: EntityType.INDIVIDUAL, limit: 280000 });
  const [ownerRenameForm, setOwnerRenameForm] = useState({ oldName: '', newName: '' });
  
  const [isNewFactory, setIsNewFactory] = useState(true); // Toggle between creating new factory or adding to existing
  const [transaction, setTransaction] = useState({ storeId: '', supplierId: '', amount: '', date: '' });
  
  // Search state for suppliers
  const [supplierSearchTerm, setSupplierSearchTerm] = useState('');
  const [storeSearchTerm, setStoreSearchTerm] = useState('');
  const [activeSection, setActiveSection] = useState('quarter-management');
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [paymentSearchTerm, setPaymentSearchTerm] = useState('');
  
  // Filter state for invoice status and verification
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  const [verificationFilter, setVerificationFilter] = useState<string>('all');
  
  // Pagination state for different tables
  const [invoiceCurrentPage, setInvoiceCurrentPage] = useState<number>(1);
  const [invoicePageSize, setInvoicePageSize] = useState<number>(20);
  const [storeCurrentPage, setStoreCurrentPage] = useState<number>(1);
  const [storePageSize, setStorePageSize] = useState<number>(20);
  const [adminInvoiceCurrentPage, setAdminInvoiceCurrentPage] = useState<number>(1);
  const [adminInvoicePageSize, setAdminInvoicePageSize] = useState<number>(20);
  const [paymentCurrentPage, setPaymentCurrentPage] = useState<number>(1);
  const [paymentPageSize, setPaymentPageSize] = useState<number>(20);

  // Factory owners list - to track factories independently from entities
  const [factoryOwners, setFactoryOwners] = useState<string[]>([]);

  // Backup data state for import/export functionality
  const [backupData, setBackupData] = useState<any>({
    version: '1.0',
    timestamp: new Date().toISOString(),
    quarter: currentQuarter,
    data: {
      stores,
      suppliers,
      invoices,
      payments,
      quarterData,
      availableQuarters
    }
  });

  // 从Supabase加载数据的函数
  const loadData = async () => {
    try {
      setIsLoading(true);
      
      let hasSupabaseConnection = true;
      
      // 检查Supabase连接状态
      try {
        console.log('检查Supabase连接...');
        
        // 直接从Supabase加载所有数据，不预先检查hasDataInSupabase
        // 避免因为单个表为空导致逻辑错误
        const [
          storesData,
          suppliersData,
          invoicesData,
          paymentsData,
          quarterDataData,
          availableQuartersData,
          currentQuarterData,
          factoryOwnersData
        ] = await Promise.all([
          fetchStores(),
          fetchSuppliers(),
          fetchInvoices(),
          fetchPayments(),
          fetchQuarterData(),
          fetchAvailableQuarters(),
          fetchCurrentQuarter(),
          fetchFactoryOwners()
        ]);
        
        // 检查是否所有核心表都为空
        const allTablesEmpty = storesData.length === 0 && suppliersData.length === 0 && invoicesData.length === 0 && paymentsData.length === 0;
        
        if (allTablesEmpty) {
          console.log('所有Supabase表都为空，尝试从localStorage迁移数据...');
          
          // 从localStorage迁移数据
          const migrated = await migrateDataFromLocalStorage();
          
          if (migrated) {
            console.log('从localStorage迁移数据成功，重新加载数据...');
            // 重新加载数据
            const [
              newStoresData,
              newSuppliersData,
              newInvoicesData,
              newPaymentsData,
              newQuarterDataData,
              newAvailableQuartersData,
              newCurrentQuarterData,
              newFactoryOwnersData
            ] = await Promise.all([
              fetchStores(),
              fetchSuppliers(),
              fetchInvoices(),
              fetchPayments(),
              fetchQuarterData(),
              fetchAvailableQuarters(),
              fetchCurrentQuarter(),
              fetchFactoryOwners()
            ]);
            
            // 更新状态
            setStores(newStoresData);
            setSuppliers(newSuppliersData);
            setInvoices(newInvoicesData);
            setPayments(newPaymentsData);
            setQuarterData(newQuarterDataData);
            setAvailableQuarters(newAvailableQuartersData);
            setCurrentQuarter(newCurrentQuarterData);
            setFactoryOwners(newFactoryOwnersData);
            
            // 保存到localStorage作为备份
            try {
              localStorage.setItem('stores', JSON.stringify(newStoresData));
              localStorage.setItem('suppliers', JSON.stringify(newSuppliersData));
              localStorage.setItem('invoices', JSON.stringify(newInvoicesData));
              localStorage.setItem('payments', JSON.stringify(newPaymentsData));
              localStorage.setItem('quarterData', JSON.stringify(newQuarterDataData));
              localStorage.setItem('availableQuarters', JSON.stringify(newAvailableQuartersData));
              localStorage.setItem('currentQuarter', newCurrentQuarterData);
              localStorage.setItem('factoryOwners', JSON.stringify(newFactoryOwnersData));
              console.log('迁移数据保存到localStorage作为备份成功！');
            } catch (localError) {
              console.error('保存到localStorage失败:', localError);
            }
          } else {
            console.log('localStorage中没有数据，使用默认数据');
            // 如果localStorage中也没有数据，使用默认数据
            setStores(MOCK_STORES);
            setSuppliers(MOCK_SUPPLIERS);
            setInvoices(MOCK_INVOICES);
            setPayments(MOCK_PAYMENTS);
            setCurrentQuarter('2025Q3');
            setAvailableQuarters(['2025Q3']);
            setFactoryOwners([...new Set(MOCK_SUPPLIERS.map(s => s.owner))]);
            
            // 保存默认数据到Supabase
            try {
              await saveAllDataWithDefaults();
            } catch (saveError) {
              console.error('保存默认数据到Supabase失败:', saveError);
            }
            
            // 保存到localStorage作为备份
            try {
              localStorage.setItem('stores', JSON.stringify(MOCK_STORES));
              localStorage.setItem('suppliers', JSON.stringify(MOCK_SUPPLIERS));
              localStorage.setItem('invoices', JSON.stringify(MOCK_INVOICES));
              localStorage.setItem('payments', JSON.stringify(MOCK_PAYMENTS));
              localStorage.setItem('currentQuarter', '2025Q3');
              localStorage.setItem('availableQuarters', JSON.stringify(['2025Q3']));
              localStorage.setItem('factoryOwners', JSON.stringify([...new Set(MOCK_SUPPLIERS.map(s => s.owner))]));
              console.log('默认数据保存到localStorage作为备份成功！');
            } catch (localError) {
              console.error('保存到localStorage失败:', localError);
            }
          }
        } else {
          console.log('从Supabase加载数据成功！');
          // 更新状态
          setStores(storesData);
          setSuppliers(suppliersData);
          setInvoices(invoicesData);
          setPayments(paymentsData);
          setQuarterData(quarterDataData);
          setAvailableQuarters(availableQuartersData);
          setCurrentQuarter(currentQuarterData);
          setFactoryOwners(factoryOwnersData);
          
          // 保存到localStorage作为备份
          try {
            localStorage.setItem('stores', JSON.stringify(storesData));
            localStorage.setItem('suppliers', JSON.stringify(suppliersData));
            localStorage.setItem('invoices', JSON.stringify(invoicesData));
            localStorage.setItem('payments', JSON.stringify(paymentsData));
            localStorage.setItem('quarterData', JSON.stringify(quarterDataData));
            localStorage.setItem('availableQuarters', JSON.stringify(availableQuartersData));
            localStorage.setItem('currentQuarter', currentQuarterData);
            localStorage.setItem('factoryOwners', JSON.stringify(factoryOwnersData));
            console.log('Supabase数据保存到localStorage作为备份成功！');
          } catch (localError) {
            console.error('保存到localStorage失败:', localError);
          }
        }
      } catch (supabaseError) {
        console.error('Supabase连接或操作失败:', supabaseError);
        hasSupabaseConnection = false;
        
        // 检查是否是网络连接错误
        if (supabaseError instanceof Error) {
          if (supabaseError.message.includes('NetworkError') || supabaseError.message.includes('Failed to fetch') || supabaseError.message.includes('timeout') || supabaseError.message.includes('Unknown host')) {
            console.error('网络连接错误，无法连接到Supabase');
          } else {
            console.error('Supabase操作错误:', supabaseError.message);
          }
        }
        
        // 从localStorage加载数据作为备选
        try {
          console.log('尝试从localStorage加载数据...');
          const storesJson = localStorage.getItem('stores');
          const suppliersJson = localStorage.getItem('suppliers');
          const invoicesJson = localStorage.getItem('invoices');
          const paymentsJson = localStorage.getItem('payments');
          const quarterDataJson = localStorage.getItem('quarterData');
          const availableQuartersJson = localStorage.getItem('availableQuarters');
          const currentQuarter = localStorage.getItem('currentQuarter');
          const factoryOwnersJson = localStorage.getItem('factoryOwners');
          
          if (storesJson || suppliersJson || invoicesJson || paymentsJson) {
            console.log('从localStorage加载数据成功');
            setStores(storesJson ? JSON.parse(storesJson) : MOCK_STORES);
            setSuppliers(suppliersJson ? JSON.parse(suppliersJson) : MOCK_SUPPLIERS);
            setInvoices(invoicesJson ? JSON.parse(invoicesJson) : MOCK_INVOICES);
            setPayments(paymentsJson ? JSON.parse(paymentsJson) : MOCK_PAYMENTS);
            setQuarterData(quarterDataJson ? JSON.parse(quarterDataJson) : {});
            setAvailableQuarters(availableQuartersJson ? JSON.parse(availableQuartersJson) : ['2025Q3']);
            setCurrentQuarter(currentQuarter || '2025Q3');
            setFactoryOwners(factoryOwnersJson ? JSON.parse(factoryOwnersJson) : [...new Set(MOCK_SUPPLIERS.map(s => s.owner))]);
          } else {
            console.log('localStorage中没有数据，使用默认数据');
            // 使用默认数据
            setStores(MOCK_STORES);
            setSuppliers(MOCK_SUPPLIERS);
            setInvoices(MOCK_INVOICES);
            setPayments(MOCK_PAYMENTS);
            setCurrentQuarter('2025Q3');
            setAvailableQuarters(['2025Q3']);
            setFactoryOwners([...new Set(MOCK_SUPPLIERS.map(s => s.owner))]);
          }
        } catch (localStorageError) {
          console.error('从localStorage加载数据失败:', localStorageError);
          // 使用默认数据
          setStores(MOCK_STORES);
          setSuppliers(MOCK_SUPPLIERS);
          setInvoices(MOCK_INVOICES);
          setPayments(MOCK_PAYMENTS);
          setCurrentQuarter('2025Q3');
          setAvailableQuarters(['2025Q3']);
          setFactoryOwners([...new Set(MOCK_SUPPLIERS.map(s => s.owner))]);
        }
      }
      
      // 移除循环调用，因为saveAllData会触发useEffect，导致无限循环
      // loadData的职责是加载数据，而不是保存数据
      // 数据保存由useEffect和用户操作触发
    } catch (error) {
      console.error('加载数据失败:', error);
      // 加载失败时使用默认数据
      setStores(MOCK_STORES);
      setSuppliers(MOCK_SUPPLIERS);
      setInvoices(MOCK_INVOICES);
      setPayments(MOCK_PAYMENTS);
      setCurrentQuarter('2025Q3');
      setAvailableQuarters(['2025Q3']);
      setFactoryOwners([...new Set(MOCK_SUPPLIERS.map(s => s.owner))]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 使用默认数据保存到Supabase
  const saveAllDataWithDefaults = async () => {
    try {
      console.log('使用默认数据保存到Supabase...');
      
      // 保存默认数据到Supabase
      await Promise.all([
        saveStores(MOCK_STORES),
        saveSuppliers(MOCK_SUPPLIERS),
        saveInvoices(MOCK_INVOICES),
        savePayments(MOCK_PAYMENTS),
        saveAvailableQuarters(['2025Q3']),
        saveCurrentQuarter('2025Q3'),
        saveFactoryOwners([...new Set(MOCK_SUPPLIERS.map(s => s.owner))])
      ]);
      
      console.log('默认数据保存成功！');
    } catch (error) {
      console.error('保存默认数据失败:', error);
    }
  };
  
  // 从备份恢复数据
  const handleRestoreData = async () => {
    if (window.confirm('确定要从备份恢复数据吗？这将覆盖当前所有数据！')) {
      try {
        setIsLoading(true);
        console.log('开始从备份恢复数据...');
        
        // 从备份恢复数据到Supabase
        const result = await restoreDataFromBackup();
        
        if (result) {
          // 恢复成功后，重新加载数据
          await loadData();
          alert('数据恢复成功！');
        } else {
          alert('数据恢复失败！');
        }
      } catch (error) {
        console.error('恢复数据失败:', error);
        alert('数据恢复失败！');
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  // 初始加载数据
  useEffect(() => {
    loadData();
  }, []);
  
  // 使用实时订阅替代定期轮询
  useEffect(() => {
    // 订阅stores变化
    const storesSubscription = subscribeToStores(setStores);
    
    // 订阅suppliers变化
    const suppliersSubscription = subscribeToSuppliers(setSuppliers);
    
    // 订阅invoices变化
    const invoicesSubscription = subscribeToInvoices(setInvoices);
    
    // 订阅payments变化
    const paymentsSubscription = subscribeToPayments(setPayments);
    
    // 订阅factoryOwners变化
    const factoryOwnersSubscription = subscribeToFactoryOwners(setFactoryOwners);
    
    // 订阅季度相关数据变化
    const quarterSubscription = subscribeToQuarterData(async () => {
      // 当季度相关数据变化时，重新加载所有季度相关数据
      const [
        quarterDataData,
        availableQuartersData,
        currentQuarterData
      ] = await Promise.all([
        fetchQuarterData(),
        fetchAvailableQuarters(),
        fetchCurrentQuarter()
      ]);
      
      setQuarterData(quarterDataData);
      setAvailableQuarters(availableQuartersData);
      setCurrentQuarter(currentQuarterData);
    });
    
    // 组件卸载时取消所有订阅
    return () => {
      storesSubscription.unsubscribe();
      suppliersSubscription.unsubscribe();
      invoicesSubscription.unsubscribe();
      paymentsSubscription.unsubscribe();
      factoryOwnersSubscription.unsubscribe();
      quarterSubscription.unsubscribe();
    };
  }, []);
  
  // 保存数据到Supabase（优先使用Supabase，仅在连接失败时使用localStorage作为临时备份）
  const saveAllData = async () => {
    try {
      console.log('开始保存数据到Supabase...');
      console.log('保存的stores数量:', stores.length);
      console.log('保存的suppliers数量:', suppliers.length);
      console.log('保存的invoices数量:', invoices.length);
      console.log('保存的factoryOwners数量:', factoryOwners.length);
      
      // 检查是否有数据需要保存
      if (stores.length === 0 && suppliers.length === 0 && invoices.length === 0 && payments.length === 0) {
        console.log('没有数据需要保存');
        return;
      }
      
      try {
        // 优先尝试保存到Supabase
        const results = await Promise.all([
          saveStores(stores),
          saveSuppliers(suppliers),
          saveInvoices(invoices),
          savePayments(payments),
          saveQuarterData(quarterData),
          saveAvailableQuarters(availableQuarters),
          saveCurrentQuarter(currentQuarter),
          saveFactoryOwners(factoryOwners)
        ]);
        
        console.log('数据成功保存到Supabase！结果:', results);
        
        // 检查是否有保存失败的结果
        const failedResults = results.filter(result => result === false);
        if (failedResults.length > 0) {
          console.error(`${failedResults.length}项数据保存到Supabase失败`);
          // 如果Supabase保存失败，尝试保存到localStorage作为临时备份
          try {
            console.log('尝试保存到localStorage作为临时备份...');
            localStorage.setItem('stores', JSON.stringify(stores));
            localStorage.setItem('suppliers', JSON.stringify(suppliers));
            localStorage.setItem('invoices', JSON.stringify(invoices));
            localStorage.setItem('payments', JSON.stringify(payments));
            localStorage.setItem('quarterData', JSON.stringify(quarterData));
            localStorage.setItem('availableQuarters', JSON.stringify(availableQuarters));
            localStorage.setItem('currentQuarter', currentQuarter);
            localStorage.setItem('factoryOwners', JSON.stringify(factoryOwners));
            console.log('数据保存到localStorage作为临时备份成功！');
          } catch (localError) {
            console.error('保存到localStorage也失败:', localError);
          }
        }
      } catch (supabaseError) {
        console.error('保存到Supabase失败:', supabaseError);
        // 如果Supabase连接失败，保存到localStorage作为临时备份
        try {
          console.log('保存到Supabase失败，使用localStorage作为临时备份...');
          localStorage.setItem('stores', JSON.stringify(stores));
          localStorage.setItem('suppliers', JSON.stringify(suppliers));
          localStorage.setItem('invoices', JSON.stringify(invoices));
          localStorage.setItem('payments', JSON.stringify(payments));
          localStorage.setItem('quarterData', JSON.stringify(quarterData));
          localStorage.setItem('availableQuarters', JSON.stringify(availableQuarters));
          localStorage.setItem('currentQuarter', currentQuarter);
          localStorage.setItem('factoryOwners', JSON.stringify(factoryOwners));
          console.log('数据保存到localStorage作为临时备份成功！');
        } catch (localError) {
          console.error('保存到localStorage也失败:', localError);
        }
      }
    } catch (error) {
      console.error('保存数据失败:', error);
      // 检查是否是网络连接错误
      if (error instanceof Error) {
        if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch') || error.message.includes('timeout')) {
          console.error('网络连接错误，请检查您的网络连接或Supabase配置');
        } else if (error.message.includes('Supabase URL')) {
          console.error('Supabase配置错误，请检查环境变量');
        }
      }
    }
  };
  
  // 当数据变化时自动保存
  useEffect(() => {
    saveAllData();
  }, [stores, suppliers, invoices, payments, quarterData, availableQuarters, currentQuarter, factoryOwners]);

  // 动态调整浮窗位置
  useEffect(() => {
    const updateFloatingNavPosition = () => {
      const floatingNav = document.getElementById('floating-nav');
      const quarterManagement = document.getElementById('quarter-management');
      
      if (floatingNav && quarterManagement && currentView === 'admin') {
        const quarterRect = quarterManagement.getBoundingClientRect();
        const navWidth = 200; // 浮窗宽度
        
        // 设置浮窗位置，使其右侧紧挨季度管理模块左侧
        floatingNav.style.left = `${quarterRect.left - navWidth}px`;
        floatingNav.style.top = '100px';
        floatingNav.style.right = 'auto';
      }
    };

    // 初始设置位置
    updateFloatingNavPosition();
    
    // 监听窗口大小变化
    window.addEventListener('resize', updateFloatingNavPosition);
    
    // 监听滚动事件
    const handleScroll = () => {
      updateFloatingNavPosition();
    };
    window.addEventListener('scroll', handleScroll);
    
    // 清理事件监听器
    return () => {
      window.removeEventListener('resize', updateFloatingNavPosition);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [currentView]);

  // --- Data Validation Function ---
  const validateInvoiceData = (invoices: InvoiceRecord[]) => {
    if (!Array.isArray(invoices)) return false;
    return invoices.every(invoice => 
      invoice && 
      typeof invoice === 'object' &&
      typeof invoice.id === 'string' &&
      typeof invoice.storeId === 'string' &&
      typeof invoice.supplierId === 'string' &&
      typeof invoice.amount === 'number' &&
      typeof invoice.date === 'string'
    );
  };

  // --- Computed Data Helpers ---

  // Filter stores based on search term
  const filteredStores = stores.filter(store => 
    store.storeName.toLowerCase().includes(storeSearchTerm.toLowerCase()) ||
    store.companyName.toLowerCase().includes(storeSearchTerm.toLowerCase())
  );
  const getStoreInvoicedTotal = (storeId: string) => 
    invoices.filter(i => i.storeId === storeId).reduce((sum, i) => sum + i.amount, 0);

  const getSupplierInvoicedTotal = (supplierId: string) => 
    invoices.filter(i => i.supplierId === supplierId).reduce((sum, i) => sum + i.amount, 0);

  // --- Aggregated Stats ---
  const totalIncome = stores.reduce((acc, s) => acc + s.quarterIncome, 0);
  const totalInvoiced = invoices.reduce((acc, i) => acc + i.amount, 0);
  const totalQuotaAvailable = suppliers.reduce((acc, s) => {
    const used = getSupplierInvoicedTotal(s.id);
    return acc + Math.max(0, s.quarterlyLimit - used);
  }, 0);
  const totalGap = stores.reduce((acc, s) => {
      const invoiced = getStoreInvoicedTotal(s.id);
      const gap = s.quarterIncome - s.quarterExpenses - invoiced;
      return acc + (gap > 0 ? gap : 0);
  }, 0);

  // 店铺发票缺口数据 - 按缺口金额排序
  const chartData = stores
    .map(s => {
      const invoiced = getStoreInvoicedTotal(s.id);
      return {
        name: s.storeName,
        Gap: Math.max(0, s.quarterIncome - s.quarterExpenses - invoiced)
      };
    })
    .sort((a, b) => b.Gap - a.Gap);

  // 工厂开票剩余总额度数据 - 按工厂分组计算总额度
  const factoryQuotaData = Object.entries(
    suppliers.reduce((acc, s) => {
      const used = getSupplierInvoicedTotal(s.id);
      const remaining = Math.max(0, s.quarterlyLimit - used);
      if (!acc[s.owner]) acc[s.owner] = 0;
      acc[s.owner] += remaining;
      return acc;
    }, {} as Record<string, number>)
  )
    .map(([name, Remaining]) => ({ name, Remaining }))
    .sort((a, b) => b.Remaining - a.Remaining);

  // --- Derived Lists ---
  const uniqueOwners = Array.from(new Set(suppliers.map(s => s.owner)));

  // --- Sorting Data for Tooltips ---
  const sortedIncomeData = [...stores]
    .sort((a, b) => b.quarterIncome - a.quarterIncome)
    .map(s => ({ label: s.storeName, value: s.quarterIncome }));

  const sortedGapData = stores
    .map(s => {
      const invoiced = getStoreInvoicedTotal(s.id);
      const gap = Math.max(0, s.quarterIncome - s.quarterExpenses - invoiced);
      return { label: s.storeName, value: gap };
    })
    .filter(i => i.value > 0)
    .sort((a, b) => b.value - a.value);

  const sortedQuotaData = uniqueOwners.map(owner => {
     const ownerSuppliers = suppliers.filter(s => s.owner === owner);
     const totalRemaining = ownerSuppliers.reduce((sum, s) => {
        const used = getSupplierInvoicedTotal(s.id);
        return sum + Math.max(0, s.quarterlyLimit - used);
     }, 0);
     return { label: owner, value: totalRemaining };
  }).sort((a, b) => b.value - a.value);


  // --- Export Helpers ---
  const downloadCSV = (content: string, fileName: string) => {
    const blob = new Blob(["\uFEFF" + content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportStores = () => {
    // 以店铺为核心，包含详细的发票信息
    const headers = "店铺名称,公司名称,纳税人类型,季度收入,季度支出,已收发票,待抵扣缺口\n";
    const rows = stores.map(s => {
      const invoiced = getStoreInvoicedTotal(s.id);
      const gap = s.quarterIncome - s.quarterExpenses - invoiced;
      return `${s.storeName},${s.companyName},${s.taxType},${s.quarterIncome},${s.quarterExpenses},${invoiced},${gap}`;
    }).join("\n");
    
    // 添加发票明细部分 - 增强版，包含店铺绑定的公司和开票主体所属的工厂
    const invoiceDetails = [
      '',
      '发票明细：',
      '开票日期,店铺名称,店铺绑定公司,开票主体,开票主体所属工厂,开票金额',
      ...invoices.map(invoice => {
        const store = stores.find(s => s.id === invoice.storeId);
        const supplier = suppliers.find(s => s.id === invoice.supplierId);
        return `${invoice.date},${store?.storeName || '未知店铺'},${store?.companyName || '未知公司'},${supplier?.name || '未知主体'},${supplier?.owner || '未知工厂'},${invoice.amount.toFixed(2)}`;
      })
    ].join("\n");
    
    const fullContent = headers + rows + "\n" + invoiceDetails;
    
    downloadCSV(fullContent, `店铺数据_${currentQuarter}.csv`);
  };

  const handleExportSuppliers = () => {
    // 以工厂为核心，包含详细的开票信息和付款信息
    const headers = "工厂负责人,开票单位,类型,季度限额,已开票金额,剩余额度\n";
    const rows = suppliers.map(s => {
      const invoiced = getSupplierInvoicedTotal(s.id);
      const remaining = s.quarterlyLimit - invoiced;
      return `${s.owner},${s.name},${s.type},${s.quarterlyLimit},${invoiced},${remaining}`;
    }).join("\n");
    
    // 添加开票明细部分 - 增强版，包含店铺绑定的公司
    const invoiceDetails = [
      '',
      '开票明细：',
      '开票日期,工厂负责人,开票单位,开票店铺,开票店铺绑定公司,开票金额',
      ...invoices.map(invoice => {
        const store = stores.find(s => s.id === invoice.storeId);
        const supplier = suppliers.find(s => s.id === invoice.supplierId);
        return `${invoice.date},${supplier?.owner || '未知工厂'},${supplier?.name || '未知主体'},${store?.storeName || '未知店铺'},${store?.companyName || '未知公司'},${invoice.amount.toFixed(2)}`;
      })
    ].join("\n");
    
    // 添加付款明细部分 - 增强版，包含工厂信息
    const paymentDetails = [
      '',
      '付款明细：',
      '付款日期,工厂负责人,付款金额,备注',
      ...payments.map(payment => {
        return `${payment.date},${payment.factoryOwner || '未知工厂'},${payment.amount.toFixed(2)},${payment.storeId ? '店铺付款' : '其他付款'}`;
      })
    ].join("\n");
    
    const fullContent = headers + "\n" + invoiceDetails + "\n" + paymentDetails;

    downloadCSV(fullContent, `工厂数据_${currentQuarter}.csv`);
  };

  const handleExportData = () => {
    // 完整的系统数据备份，包含所有季度的数据
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      quarter: currentQuarter,
      data: {
        stores,
        suppliers,
        invoices,
        payments,
        quarterData, // 包含所有历史季度的数据
        availableQuarters
      }
    };
    
    const dataStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    // 更新文件名，明确表示包含所有季度
    link.download = `系统备份_所有季度_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 从备份文件恢复数据
  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const backupData = JSON.parse(e.target?.result as string);
        
        if (backupData.version && backupData.data) {
          if (confirm(`确认恢复备份数据？\n\n备份时间：${backupData.timestamp}\n备份包含：所有季度数据\n\n注意：这将覆盖当前所有数据，包括所有季度的历史数据！`)) {
            setIsLoading(true);
            console.log('开始从备份文件恢复数据...');
            
            // 1. 保存备份时的季度
            const backupQuarter = backupData.quarter || currentQuarter;
            
            // 2. 恢复所有季度的数据
            const backupQuarterData = backupData.data.quarterData || {};
            
            // 3. 恢复所有基础数据（包含所有季度的完整数据）
            const restoredStores = backupData.data.stores || [];
            const restoredSuppliers = backupData.data.suppliers || [];
            const restoredInvoices = backupData.data.invoices || [];
            const restoredPayments = backupData.data.payments || [];
            const restoredAvailableQuarters = backupData.data.availableQuarters || [];
            const restoredFactoryOwners = backupData.data.factoryOwners || Array.from(new Set(restoredSuppliers.map((s: any) => s.owner as string)));
            
            // 4. 更新本地状态
            setQuarterData(backupQuarterData);
            setAvailableQuarters(restoredAvailableQuarters);
            setStores(restoredStores);
            setSuppliers(restoredSuppliers);
            setInvoices(restoredInvoices);
            setPayments(restoredPayments);
            setFactoryOwners(restoredFactoryOwners);
            setCurrentQuarter(backupQuarter);
            
            // 5. 保存到localStorage作为备份
            try {
              localStorage.setItem('stores', JSON.stringify(restoredStores));
              localStorage.setItem('suppliers', JSON.stringify(restoredSuppliers));
              localStorage.setItem('invoices', JSON.stringify(restoredInvoices));
              localStorage.setItem('payments', JSON.stringify(restoredPayments));
              localStorage.setItem('quarterData', JSON.stringify(backupQuarterData));
              localStorage.setItem('availableQuarters', JSON.stringify(restoredAvailableQuarters));
              localStorage.setItem('currentQuarter', backupQuarter);
              localStorage.setItem('factoryOwners', JSON.stringify(restoredFactoryOwners));
              console.log('恢复的数据保存到localStorage成功！');
            } catch (localError) {
              console.error('保存到localStorage失败:', localError);
            }
            
            // 6. 保存到Supabase
            try {
              console.log('开始将恢复的数据保存到Supabase...');
              await Promise.all([
                saveStores(restoredStores),
                saveSuppliers(restoredSuppliers),
                saveInvoices(restoredInvoices),
                savePayments(restoredPayments),
                saveQuarterData(backupQuarterData),
                saveAvailableQuarters(restoredAvailableQuarters),
                saveCurrentQuarter(backupQuarter),
                saveFactoryOwners(restoredFactoryOwners)
              ]);
              console.log('恢复的数据保存到Supabase成功！');
              
              // 7. 显示成功提示
              alert('数据恢复成功！');
            } catch (supabaseError) {
              console.error('保存到Supabase失败:', supabaseError);
              alert('数据恢复成功，但保存到Supabase失败！请检查网络连接或Supabase配置。');
            } finally {
              setIsLoading(false);
            }
          }
        } else {
          alert('无效的备份文件格式！');
        }
      } catch (error) {
        console.error('备份文件解析失败:', error);
        alert('备份文件解析失败，请检查文件格式！');
      }
    };
    reader.readAsText(file);
    
    // 清空input，允许重复选择同一文件
    event.target.value = '';
  };

  const getCurrentQuarterRange = () => {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3);
    const start = new Date(now.getFullYear(), quarter * 3, 1);
    const end = new Date(now.getFullYear(), quarter * 3 + 3, 0);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0]
    };
  };

  // 判断给定日期属于哪个季度，并返回该季度的日期范围
  const getQuarterRangeForDate = (dateString: string) => {
    const date = new Date(dateString);
    const quarter = Math.floor(date.getMonth() / 3);
    const start = new Date(date.getFullYear(), quarter * 3, 1);
    const end = new Date(date.getFullYear(), quarter * 3 + 3, 0);
    return {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
        quarter: quarter + 1,
        year: date.getFullYear()
    };
  };

  // 判断给定日期是否为当前季度或下个季度
  const isCurrentOrNextQuarter = (dateString: string) => {
    const now = new Date();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const currentYear = now.getFullYear();
    
    const date = new Date(dateString);
    const quarter = Math.floor(date.getMonth() / 3);
    const year = date.getFullYear();
    
    // 当前季度
    if (year === currentYear && quarter === currentQuarter) {
      return 'current';
    }
    
    // 下个季度
    if (year === currentYear && quarter === currentQuarter + 1) {
      return 'next';
    }
    
    // 跨年的下个季度（当前是第4季度，下个季度是第1季度）
    if (currentQuarter === 3 && year === currentYear + 1 && quarter === 0) {
      return 'next';
    }
    
    return 'other';
  };

  // --- Handlers ---

  const handleRunAnalysis = async () => {
    setAnalyzing(true);
    // Prepare view models for AI
    const storeAnalysisData = stores.map(s => {
      const invoiced = getStoreInvoicedTotal(s.id);
      return {
        companyName: s.companyName,
        quarterIncome: s.quarterIncome,
        invoicesReceived: invoiced,
        gap: Math.max(0, s.quarterIncome - s.quarterExpenses - invoiced)
      };
    });

    const supplierAnalysisData = suppliers.map(s => {
      const used = getSupplierInvoicedTotal(s.id);
      return {
        name: s.name,
        remainingQuota: s.quarterlyLimit - used,
        status: s.status
      };
    });

    const result = await analyzeTaxOptimization(storeAnalysisData, supplierAnalysisData);
    setAiAnalysis(result || "分析生成失败。");
    setAnalyzing(false);
  };

  const openInvoiceModal = (storeId: string = '') => {
    const today = new Date().toISOString().split('T')[0];
    setTransaction({ storeId: storeId, supplierId: '', amount: '', date: today });
    setActiveModal('addInvoice');
  };

  // --- Expenses Editing ---
  const handleEditExpenses = (store: StoreCompany) => {
    setEditingStoreId(store.id);
    setExpenseForm({
        shipping: store.expenseBreakdown?.shipping?.toString() || '',
        promotion: store.expenseBreakdown?.promotion?.toString() || '',
        salaries: store.expenseBreakdown?.salaries?.toString() || '',
        rent: store.expenseBreakdown?.rent?.toString() || '',
        office: store.expenseBreakdown?.office?.toString() || '',
        fuel: store.expenseBreakdown?.fuel?.toString() || '',
        other: store.expenseBreakdown?.other?.toString() || '',
    });
    setActiveModal('editExpenses');
  };

  const handleSaveExpenses = () => {
    if (!editingStoreId) return;

    const newBreakdown = {
        shipping: parseFloat(expenseForm.shipping) || 0,
        promotion: parseFloat(expenseForm.promotion) || 0,
        salaries: parseFloat(expenseForm.salaries) || 0,
        rent: parseFloat(expenseForm.rent) || 0,
        office: parseFloat(expenseForm.office) || 0,
        fuel: parseFloat(expenseForm.fuel) || 0,
        other: parseFloat(expenseForm.other) || 0,
    };

    const totalExpenses = Object.values(newBreakdown).reduce((a, b) => a + b, 0);

    setStores(stores.map(s => {
        if (s.id === editingStoreId) {
            return {
                ...s,
                quarterExpenses: totalExpenses,
                expenseBreakdown: newBreakdown
            };
        }
        return s;
    }));
    setActiveModal(null);
    setEditingStoreId(null);
  };

  // --- Store CRUD ---

  const handleOpenAddStore = () => {
    setStoreForm({ id: '', companyName: '', storeName: '', income: '', expenses: '', taxType: StoreTaxType.GENERAL });
    setActiveModal('addStore');
  };

  const handleOpenEditStore = (store: StoreCompany) => {
    setStoreForm({
      id: store.id,
      companyName: store.companyName,
      storeName: store.storeName,
      income: store.quarterIncome.toString(),
      expenses: store.quarterExpenses.toString(),
      taxType: store.taxType
    });
    setActiveModal('editStore');
  };

  const handleSaveStore = () => {
    if(!storeForm.companyName) return;
    
    let updatedStores;
    if (activeModal === 'editStore' && storeForm.id) {
       // Update
       updatedStores = stores.map(s => s.id === storeForm.id ? {
         ...s,
         companyName: storeForm.companyName,
         storeName: storeForm.storeName,
         quarterIncome: parseFloat(storeForm.income) || 0,
         // We ignore expenses here as they are managed via expense breakdown now, unless new store
         quarterExpenses: s.quarterExpenses, 
         taxType: storeForm.taxType
       } : s);
    } else {
       // Create
       const s: StoreCompany = {
        id: `c${Date.now()}`,
        companyName: storeForm.companyName,
        storeName: storeForm.storeName,
        quarterIncome: parseFloat(storeForm.income) || 0,
        quarterExpenses: 0, // Initialize to 0, user should add breakdown
        taxType: storeForm.taxType
      };
      updatedStores = [...stores, s];
    }
    setStores(updatedStores);
    setActiveModal(null);
  };

  const handleDeleteStore = (storeId: string) => {
    const updatedStores = stores.filter(s => s.id !== storeId);
    setStores(updatedStores);
    // Optional: Clean up orphaned invoices/payments?
    // For now we keep them or filter them out in display if needed.
  };

  // --- Supplier/Factory CRUD ---

  const handleOpenAddSupplier = () => {
    setSupplierForm({ id: '', name: '', owner: '', type: EntityType.INDIVIDUAL, limit: 280000 });
    setIsNewFactory(uniqueOwners.length === 0);
    setActiveModal('addSupplier');
  };

  const handleOpenEditEntity = (entity: SupplierEntity) => {
    setSupplierForm({
      id: entity.id,
      name: entity.name,
      owner: entity.owner,
      type: entity.type,
      limit: entity.quarterlyLimit
    });
    // Editing an entity only allows editing its details, not moving owner via this modal usually
    // But we can allow it. For simplicity we hide owner selection in edit entity or allow simple text edit?
    // Let's use specific logic for edit entity.
    setActiveModal('editEntity');
  };

  const handleOpenRenameOwner = (oldName: string) => {
    setOwnerRenameForm({ oldName, newName: oldName });
    setActiveModal('editOwner');
  };

  const handleSaveSupplier = () => {
    if(!supplierForm.name) return;

    let updatedSuppliers;
    if (activeModal === 'editEntity' && supplierForm.id) {
       // Update existing entity
       updatedSuppliers = suppliers.map(s => s.id === supplierForm.id ? {
         ...s,
         name: supplierForm.name,
         type: supplierForm.type,
         quarterlyLimit: supplierForm.limit
         // We don't update owner here to prevent confusion, usually renamed via RenameOwner
       } : s);
    } else {
       // Create new entity
       if (!supplierForm.owner) return;
       const s: SupplierEntity = {
        id: `s${Date.now()}`,
        name: supplierForm.name,
        owner: supplierForm.owner,
        type: supplierForm.type,
        quarterlyLimit: supplierForm.limit,
        status: 'Active'
      };
      updatedSuppliers = [...suppliers, s];
      
      // If this is a new factory (owner not in factoryOwners), add it to factoryOwners
      if (!factoryOwners.includes(supplierForm.owner)) {
        const updatedFactoryOwners = [...factoryOwners, supplierForm.owner];
        setFactoryOwners(updatedFactoryOwners);
      }
    }
    setSuppliers(updatedSuppliers);
    setActiveModal(null);
  };

  const handleSaveOwnerRename = () => {
    if (!ownerRenameForm.newName || !ownerRenameForm.oldName) return;
    // Update all suppliers with old owner name
    const updatedSuppliers = suppliers.map(s => s.owner === ownerRenameForm.oldName ? { ...s, owner: ownerRenameForm.newName } : s);
    setSuppliers(updatedSuppliers);
    // Update payments linked to this owner
    const updatedPayments = payments.map(p => p.factoryOwner === ownerRenameForm.oldName ? { ...p, factoryOwner: ownerRenameForm.newName } : p);
    setPayments(updatedPayments);
    // Update factoryOwners list
    const updatedFactoryOwners = factoryOwners.map(owner => owner === ownerRenameForm.oldName ? ownerRenameForm.newName : owner);
    setFactoryOwners(updatedFactoryOwners);
    setActiveModal(null);
  };

  const handleDeleteInvoiceRecord = (invoiceId: string) => {
    if (!confirm('确定要删除这条开票记录吗？')) {
      return;
    }

    // 找到要删除的记录
    const invoiceToDelete = invoices.find(inv => inv.id === invoiceId);
    if (!invoiceToDelete) return;

    // 判断发票属于哪个季度
    const quarterType = isCurrentOrNextQuarter(invoiceToDelete.date);
    const { start, end } = getCurrentQuarterRange();
    
    // 只有当前季度或下个季度的发票才需要特别提示
    if (quarterType === 'current' || quarterType === 'next') {
      const supplier = suppliers.find(s => s.id === invoiceToDelete.supplierId);
      if (supplier) {
        const amount = invoiceToDelete.amount;
        
        // 计算删除该发票后的开票总额（排除即将删除的发票）
        const otherInvoicesTotal = invoices
          .filter(i => i.supplierId === supplier.id && i.id !== invoiceId)
          .reduce((sum, i) => sum + i.amount, 0);
        
        // 删除记录
        const updatedInvoices = invoices.filter(inv => inv.id !== invoiceId);
        setInvoices(updatedInvoices);
        
        // 计算正确的剩余额度：固定额度 - 其他发票总额
        const remainingQuota = supplier.quarterlyLimit - otherInvoicesTotal;
        
        const quarterText = quarterType === 'current' ? '当前季度' : '下个季度';
        alert('开票记录已删除！\n\n额度恢复详情：\n• 开票主体：' + supplier.owner + ' (' + supplier.name + ')\n• 发票季度：' + quarterText + '\n• 删除金额：¥' + amount.toLocaleString() + '\n• 当前剩余额度：¥' + remainingQuota.toLocaleString());
      } else {
        // 删除记录
        const updatedInvoices = invoices.filter(inv => inv.id !== invoiceId);
        setInvoices(updatedInvoices);
        
        alert('开票记录已删除，但未找到对应的开票主体。');
      }
    } else {
      // 非当前季度或下个季度的发票，需要确认
      if (!confirm(`此开票记录不属于当前季度或下个季度。\n开票日期：${invoiceToDelete.date}\n当前季度：${start} 至 ${end}\n\n删除此发票不会影响当前可用额度。\n\n是否确认删除？`)) {
        return;
      }
      
      // 删除记录
      const updatedInvoices = invoices.filter(inv => inv.id !== invoiceId);
      setInvoices(updatedInvoices);
      
      alert('开票记录已删除。由于此发票不属于当前季度或下个季度，不影响当前可用额度。');
    }
  };

  const handleDeleteEntity = (id: string) => {
    const updatedSuppliers = suppliers.filter(s => s.id !== id);
    setSuppliers(updatedSuppliers);
  };

  const handleDeletePaymentRecord = (paymentId: string) => {
    if (confirm('确认删除此支付货款记录？')) {
      const updatedPayments = payments.filter(payment => payment.id !== paymentId);
      setPayments(updatedPayments);

      // 更新本地存储
      const updatedData = {
        ...backupData,
        data: {
          ...backupData.data,
          payments: updatedPayments
        }
      };
      setBackupData(updatedData);

      alert('支付货款记录已删除！');
    }
  };

  // 处理发票识别结果
  const handleInvoiceRecognized = (recognizedData: {
    storeId: string;
    supplierId: string;
    amount: number;
    date: string;
    status: 'pending' | 'verified' | 'rejected';
    verificationResult?: {
      isValid: boolean;
      issues?: string[];
      factoryName?: string;
      companyName?: string;
      amount?: number;
    };
  }) => {
    const newInvoice: InvoiceRecord = {
      id: `inv${Date.now()}`,
      storeId: recognizedData.storeId,
      supplierId: recognizedData.supplierId,
      amount: recognizedData.amount,
      date: recognizedData.date,
      status: recognizedData.status,
      verificationResult: recognizedData.verificationResult
    };

    const updatedInvoices = [...invoices, newInvoice];
    setInvoices(updatedInvoices);
    
    alert('发票识别完成，已添加到开票记录中！');
  };

  const handleDeleteOwner = (ownerName: string) => {
    // Only remove the factory from the factory owners list, keep all entities
    const updatedFactoryOwners = factoryOwners.filter(owner => owner !== ownerName);
    setFactoryOwners(updatedFactoryOwners);
    // Note: We don't delete the entities here anymore - they remain as orphaned records
  };


  const handleAddTransaction = () => {
    if(!transaction.amount || !transaction.date) return;
    const amountVal = parseFloat(transaction.amount);
    
    // Date Validation for Invoices
    if (activeModal === 'addInvoice') {
        const { start, end } = getCurrentQuarterRange();
        if (transaction.date < start || transaction.date > end) {
            alert(`开票日期必须在当前季度内 (${start} 至 ${end})`);
            return;
        }
        
        // 验证发票额度
        if (!transaction.supplierId) {
            alert('请选择开票单位');
            return;
        }
        
        // 获取选中的开票主体
        const selectedSupplier = suppliers.find(s => s.id === transaction.supplierId);
        if (!selectedSupplier) {
            alert('选中的开票单位不存在');
            return;
        }
        
        // 计算已使用额度
        const usedAmount = getSupplierInvoicedTotal(selectedSupplier.id);
        // 计算剩余额度
        const remainingAmount = selectedSupplier.quarterlyLimit - usedAmount;
        
        // 验证剩余额度是否为0或负数
        if (remainingAmount <= 0) {
            alert(`该开票主体的剩余额度为0，无法提交新的发票。\n开票主体：${selectedSupplier.name}\n季度限额：¥${selectedSupplier.quarterlyLimit.toLocaleString()}\n已使用额度：¥${usedAmount.toLocaleString()}\n剩余额度：¥${remainingAmount.toLocaleString()}`);
            return;
        }
        
        // 验证输入金额是否大于剩余额度
        if (amountVal > remainingAmount) {
            alert(`输入的发票金额（¥${amountVal.toLocaleString()}）大于该开票主体的剩余额度（¥${remainingAmount.toLocaleString()}），无法提交。\n开票主体：${selectedSupplier.name}\n季度限额：¥${selectedSupplier.quarterlyLimit.toLocaleString()}\n已使用额度：¥${usedAmount.toLocaleString()}\n剩余额度：¥${remainingAmount.toLocaleString()}`);
            return;
        }
    }

    if(activeModal === 'addPayment') {
      // For payments, storeId is optional (factory payment)
      if (!transaction.supplierId) return; // supplierId here represents the OWNER ID actually? 
      
      const p: PaymentRecord = {
        id: `pay${Date.now()}`,
        storeId: '', 
        supplierId: '',
        factoryOwner: transaction.supplierId, // We reused the field 'supplierId' to store owner name in the modal
        amount: amountVal,
        date: transaction.date
      };
      const updatedPayments = [...payments, p];
      setPayments(updatedPayments);
    } else if (activeModal === 'addInvoice') {
      if (!transaction.storeId || !transaction.supplierId) return;
       const i: InvoiceRecord = {
        id: `inv${Date.now()}`,
        storeId: transaction.storeId,
        supplierId: transaction.supplierId,
        amount: amountVal,
        date: transaction.date
      };
      const updatedInvoices = [...invoices, i];
      setInvoices(updatedInvoices);
    }
    setTransaction({ storeId: '', supplierId: '', amount: '', date: '' });
    setActiveModal(null);
  };

  // Quarter Management Handlers

  const handleStartNewQuarter = () => {
    // 确认开始新季度
    if (!confirm(`确认开始新季度？\n\n注意：开始新季度将清零所有店铺收入、工厂货款和开票数据，但会保留基础设置。`)) {
      return;
    }
    
    // 解析当前季度，获取年份和季度号
    const currentQuarterMatch = currentQuarter.match(/^(\d{4})Q(\d)$/);
    if (!currentQuarterMatch) {
      alert('当前季度格式错误');
      return;
    }
    
    const currentYear = parseInt(currentQuarterMatch[1]);
    const currentQuarterNum = parseInt(currentQuarterMatch[2]);
    
    // 计算下一个季度：基于当前季度+1，而不是基于可用季度列表
    let nextYear = currentYear;
    let nextQuarterNum = currentQuarterNum + 1;
    
    if (nextQuarterNum > 4) {
      nextQuarterNum = 1;
      nextYear += 1;
    }
    
    const newQuarterName = `${nextYear}Q${nextQuarterNum}`;
    
    // 保存当前季度数据到quarterData
    const newQuarterData = {
      ...quarterData,
      [currentQuarter]: {
        stores: [...stores],
        suppliers: [...suppliers],
        invoices: [...invoices],
        payments: [...payments]
      }
    };
    setQuarterData(newQuarterData);
    
    // 添加新季度到可用季度列表
    if (!availableQuarters.includes(newQuarterName)) {
      // 确保季度列表按顺序排列
      const updatedQuarters = [...availableQuarters, newQuarterName].sort();
      setAvailableQuarters(updatedQuarters);
    }
    
    // 设置当前季度为新季度
    setCurrentQuarter(newQuarterName);
    
    // 重置新季度的数据
    const resetStores = stores.map(store => ({
      ...store,
      quarterIncome: 0,
      quarterExpenses: 0
    }));
    
    const resetSuppliers = suppliers.map(supplier => {
      // 如果是个体工商户，将开票额度设置为280000
      if (supplier.type === EntityType.INDIVIDUAL) {
        return {
          ...supplier,
          quarterlyLimit: 280000
        };
      }
      // 其他类型保持不变
      return {
        ...supplier,
        // 保留供应商的基本信息，不重置任何数据
      };
    });
    
    setStores(resetStores);
    setSuppliers(resetSuppliers);
    setInvoices([]);
    setPayments([]);
    
    
  };

  const handleSwitchQuarter = (quarter: string) => {
    if (quarter === currentQuarter) return;
    
    // 保存当前季度数据到quarterData
    const newQuarterData = {
      ...quarterData,
      [currentQuarter]: {
        stores: [...stores],
        suppliers: [...suppliers],
        invoices: [...invoices],
        payments: [...payments]
      }
    };
    
    // 加载目标季度的数据
    // 注意：使用newQuarterData，而不是旧的quarterData状态
    const targetQuarterData = newQuarterData[quarter];
    
    // 先更新季度数据状态
    setQuarterData(newQuarterData);
    
    if (targetQuarterData) {
      // 如果目标季度有数据，使用该数据
      setStores(targetQuarterData.stores);
      setSuppliers(targetQuarterData.suppliers);
      setInvoices(targetQuarterData.invoices);
      setPayments(targetQuarterData.payments);
    } else {
      // 如果目标季度没有数据，使用当前的基础设置（店铺和供应商），但清空发票和付款记录
      setStores(stores.map(store => ({
        ...store,
        quarterIncome: 0,
        quarterExpenses: 0
      })));
      setSuppliers(suppliers);
      setInvoices([]);
      setPayments([]);
    }
    
    // 切换到目标季度
    setCurrentQuarter(quarter);
  };

  // Group suppliers by owner for display
  const groupedSuppliersMap = suppliers.reduce((acc, supplier) => {
    if (!acc[supplier.owner]) acc[supplier.owner] = [];
    acc[supplier.owner].push(supplier);
    return acc;
  }, {} as Record<string, SupplierEntity[]>);

  // Filter suppliers based on search term
  const filteredSuppliers = suppliers.filter(supplier => 
    supplier.owner.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
    supplier.name.toLowerCase().includes(supplierSearchTerm.toLowerCase()) ||
    supplier.type.toLowerCase().includes(supplierSearchTerm.toLowerCase())
  );

  // Group filtered suppliers by owner for display
  const filteredGroupedSuppliersMap = filteredSuppliers.reduce((acc, supplier) => {
    if (!acc[supplier.owner]) acc[supplier.owner] = [];
    acc[supplier.owner].push(supplier);
    return acc;
  }, {} as Record<string, SupplierEntity[]>);

  // Filter and sort invoices
  // 计算状态统计
  const statusStats = {
    all: invoices.length,
    pending: invoices.filter(inv => (inv.status || 'pending') === 'pending').length,
    verified: invoices.filter(inv => (inv.status || 'pending') === 'verified').length,
    rejected: invoices.filter(inv => (inv.status || 'pending') === 'rejected').length,
    completed: invoices.filter(inv => (inv.status || 'pending') === 'verified').length // 使用'verified'代替'completed'
  };
  
  const filteredInvoices = invoices
    .filter(invoice => {
      // Search term filter
      if (invoiceSearchTerm) {
        const store = stores.find(s => s.id === invoice.storeId);
        const supplier = suppliers.find(s => s.id === invoice.supplierId);
        const searchLower = invoiceSearchTerm.toLowerCase();
        
        const matchesSearch = (
          store?.storeName.toLowerCase().includes(searchLower) ||
          supplier?.name.toLowerCase().includes(searchLower) ||
          supplier?.owner.toLowerCase().includes(searchLower) ||
          invoice.amount.toString().includes(invoiceSearchTerm) ||
          invoice.date.includes(invoiceSearchTerm)
        );
        
        if (!matchesSearch) return false;
      }
      
      // Invoice status filter
      if (invoiceStatusFilter !== 'all') {
        const actualStatus = invoice.status || 'pending';
        if (actualStatus !== invoiceStatusFilter) return false;
      }
      
      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  // Pagination calculations for invoices
  const invoiceTotalPages = Math.ceil(filteredInvoices.length / invoicePageSize);
  const invoiceStartIndex = (invoiceCurrentPage - 1) * invoicePageSize;
  const invoiceEndIndex = invoiceStartIndex + invoicePageSize;
  const paginatedInvoices = filteredInvoices.slice(invoiceStartIndex, invoiceEndIndex);
  
  // Reset current page when filters change
  useEffect(() => {
    setInvoiceCurrentPage(1);
  }, [invoiceSearchTerm, invoiceStatusFilter]);
  
  // Pagination calculations for stores
  const storeTotalPages = Math.ceil(filteredStores.length / storePageSize);
  const storeStartIndex = (storeCurrentPage - 1) * storePageSize;
  const storeEndIndex = storeStartIndex + storePageSize;
  const paginatedStores = filteredStores.slice(storeStartIndex, storeEndIndex);
  
  // Reset store current page when search term changes
  useEffect(() => {
    setStoreCurrentPage(1);
  }, [storeSearchTerm]);
  
  // Pagination calculations for admin invoices
  const adminInvoiceTotalPages = Math.ceil(filteredInvoices.length / adminInvoicePageSize);
  const adminInvoiceStartIndex = (adminInvoiceCurrentPage - 1) * adminInvoicePageSize;
  const adminInvoiceEndIndex = adminInvoiceStartIndex + adminInvoicePageSize;
  const adminPaginatedInvoices = filteredInvoices.slice(adminInvoiceStartIndex, adminInvoiceEndIndex);
  
  // Reset admin invoice current page when filters change
  useEffect(() => {
    setAdminInvoiceCurrentPage(1);
  }, [invoiceSearchTerm, invoiceStatusFilter]);

  // Filter and sort payments
  const filteredPayments = payments
    .filter(payment => {
      if (!paymentSearchTerm) return true;
      
      const searchLower = paymentSearchTerm.toLowerCase();
      
      // Search by factory owner
      if (payment.factoryOwner && payment.factoryOwner.toLowerCase().includes(searchLower)) return true;
      
      // Search by amount
      if (payment.amount.toString().includes(paymentSearchTerm)) return true;
      
      // Search by date
      if (payment.date.includes(paymentSearchTerm)) return true;
      
      return false;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort by date descending
  
  // Pagination calculations for payments
  const paymentTotalPages = Math.ceil(filteredPayments.length / paymentPageSize);
  const paymentStartIndex = (paymentCurrentPage - 1) * paymentPageSize;
  const paymentEndIndex = paymentStartIndex + paymentPageSize;
  const paginatedPayments = filteredPayments.slice(paymentStartIndex, paymentEndIndex);
  
  // Reset payment current page when search term changes
  useEffect(() => {
    setPaymentCurrentPage(1);
  }, [paymentSearchTerm]);

  return (
    <div className="min-h-screen flex flex-col md:flex-row relative">
      
      {/* --- MODALS --- */}
      
      {(activeModal === 'addStore' || activeModal === 'editStore') && (
        <ModalBackdrop title={activeModal === 'addStore' ? "添加新店铺" : "编辑店铺信息"} onClose={() => setActiveModal(null)}>
          <input className="w-full p-2 border rounded" placeholder="店铺名称" value={storeForm.storeName} onChange={e => setStoreForm({...storeForm, storeName: e.target.value})} />
          <input className="w-full p-2 border rounded" placeholder="绑定公司名称" value={storeForm.companyName} onChange={e => setStoreForm({...storeForm, companyName: e.target.value})} />
          <div>
             <input className="w-full p-2 border rounded" type="number" placeholder="季度收入" value={storeForm.income} onChange={e => setStoreForm({...storeForm, income: e.target.value})} />
          </div>
          <div className="space-y-1 mt-2">
             <label className="text-xs font-semibold text-slate-500">纳税人类型</label>
             <SearchableSelect
                options={[
                  { value: StoreTaxType.GENERAL, label: StoreTaxType.GENERAL },
                  { value: StoreTaxType.SMALL_SCALE, label: StoreTaxType.SMALL_SCALE }
                ]}
                value={storeForm.taxType}
                onChange={val => setStoreForm({...storeForm, taxType: val as StoreTaxType})}
                placeholder="选择类型"
             />
          </div>
          <button onClick={handleSaveStore} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700">确认{activeModal === 'addStore' ? '添加' : '保存'}</button>
        </ModalBackdrop>
      )}

      {activeModal === 'editExpenses' && (
          <ModalBackdrop title="编辑各项成本支出" onClose={() => {setActiveModal(null); setEditingStoreId(null);}}>
              <div className="grid grid-cols-2 gap-3">
                  <div>
                      <label className="text-xs text-slate-500 mb-1 block">运费</label>
                      <input className="w-full p-2 border rounded text-sm" type="number" value={expenseForm.shipping} onChange={e => setExpenseForm({...expenseForm, shipping: e.target.value})} />
                  </div>
                  <div>
                      <label className="text-xs text-slate-500 mb-1 block">推广费</label>
                      <input className="w-full p-2 border rounded text-sm" type="number" value={expenseForm.promotion} onChange={e => setExpenseForm({...expenseForm, promotion: e.target.value})} />
                  </div>
                  <div>
                      <label className="text-xs text-slate-500 mb-1 block">人员工资</label>
                      <input className="w-full p-2 border rounded text-sm" type="number" value={expenseForm.salaries} onChange={e => setExpenseForm({...expenseForm, salaries: e.target.value})} />
                  </div>
                  <div>
                      <label className="text-xs text-slate-500 mb-1 block">房租水电</label>
                      <input className="w-full p-2 border rounded text-sm" type="number" value={expenseForm.rent} onChange={e => setExpenseForm({...expenseForm, rent: e.target.value})} />
                  </div>
                  <div>
                      <label className="text-xs text-slate-500 mb-1 block">办公费用</label>
                      <input className="w-full p-2 border rounded text-sm" type="number" value={expenseForm.office} onChange={e => setExpenseForm({...expenseForm, office: e.target.value})} />
                  </div>
                  <div>
                      <label className="text-xs text-slate-500 mb-1 block">油费</label>
                      <input className="w-full p-2 border rounded text-sm" type="number" value={expenseForm.fuel} onChange={e => setExpenseForm({...expenseForm, fuel: e.target.value})} />
                  </div>
                  <div className="col-span-2">
                      <label className="text-xs text-slate-500 mb-1 block">其他杂费</label>
                      <input className="w-full p-2 border rounded text-sm" type="number" value={expenseForm.other} onChange={e => setExpenseForm({...expenseForm, other: e.target.value})} />
                  </div>
              </div>
              <div className="bg-slate-50 p-2 rounded text-xs text-slate-500 flex justify-between">
                  <span>总支出将在保存后自动计算更新</span>
              </div>
              <button onClick={handleSaveExpenses} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700">保存更新</button>
          </ModalBackdrop>
      )}

      {(activeModal === 'addSupplier' || activeModal === 'editEntity') && (
        <ModalBackdrop title={activeModal === 'addSupplier' ? "添加工厂及开票主体" : "编辑开票主体"} onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
             {/* Factory Section - Only show for Add mode or if creating new */}
            {activeModal === 'addSupplier' && (
              <div>
                <label className="text-xs text-slate-500 mb-1 block">工厂负责人</label>
                <SearchableSelect
                  options={factoryOwners.map(owner => ({ value: owner, label: owner }))}
                  value={supplierForm.owner}
                  onChange={(val) => setSupplierForm({...supplierForm, owner: val || ''})}
                  placeholder="选择现有工厂或直接输入新工厂名称"
                  allowCustomValues
                />
              </div>
            )}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">开票主体名称</label>
              <input className="w-full p-2 border rounded" placeholder="开票主体名称" value={supplierForm.name} onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">开票主体类型</label>
              <SearchableSelect
                options={[
                  { value: EntityType.INDIVIDUAL, label: EntityType.INDIVIDUAL },
                  { value: EntityType.ENTERPRISE, label: EntityType.ENTERPRISE }
                ]}
                value={supplierForm.type}
                onChange={val => setSupplierForm({...supplierForm, type: val as EntityType})}
                placeholder="选择类型"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">季度限额 (元)</label>
              <input className="w-full p-2 border rounded" type="number" placeholder="季度限额" value={supplierForm.limit} onChange={e => setSupplierForm({...supplierForm, limit: parseInt(e.target.value) || 280000})} />
            </div>
            <button onClick={handleSaveSupplier} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700">确认{activeModal === 'addSupplier' ? '添加' : '保存'}</button>
          </div>
        </ModalBackdrop>
      )}

      {activeModal === 'editOwner' && (
        <ModalBackdrop title="编辑工厂名称" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">旧工厂名称</label>
              <input className="w-full p-2 border rounded bg-slate-50" value={ownerRenameForm.oldName} disabled />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">新工厂名称</label>
              <input className="w-full p-2 border rounded" placeholder="新工厂名称" value={ownerRenameForm.newName} onChange={e => setOwnerRenameForm({...ownerRenameForm, newName: e.target.value})} />
            </div>
            <button onClick={handleSaveOwnerRename} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700">保存更新</button>
          </div>
        </ModalBackdrop>
      )}

      {activeModal === 'addInvoice' && (
        <ModalBackdrop title="添加开票记录" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">店铺</label>
              <SearchableSelect
                options={stores.map(s => ({ value: s.id, label: s.storeName }))}
                value={transaction.storeId}
                onChange={val => setTransaction({...transaction, storeId: val || ''})}
                placeholder="选择店铺"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">开票主体</label>
              <SearchableSelect
                options={suppliers.map(s => ({ value: s.id, label: `${s.owner} (${s.name})` }))}
                value={transaction.supplierId}
                onChange={val => setTransaction({...transaction, supplierId: val || ''})}
                placeholder="选择开票主体"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">开票金额</label>
              <input className="w-full p-2 border rounded" type="number" placeholder="开票金额" value={transaction.amount} onChange={e => setTransaction({...transaction, amount: e.target.value})} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">开票日期</label>
              <input className="w-full p-2 border rounded" type="date" value={transaction.date} onChange={e => setTransaction({...transaction, date: e.target.value})} />
            </div>
            <button onClick={handleAddTransaction} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700">添加开票记录</button>
          </div>
        </ModalBackdrop>
      )}

      {activeModal === 'addPayment' && (
        <ModalBackdrop title="添加工厂货款支付记录" onClose={() => setActiveModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-500 mb-1 block">工厂负责人</label>
              <SearchableSelect
                options={factoryOwners.map(owner => ({ value: owner, label: owner }))}
                value={transaction.supplierId}
                onChange={(val) => setTransaction({...transaction, supplierId: val as string})}
                placeholder="选择工厂负责人"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">支付金额</label>
              <input className="w-full p-2 border rounded" type="number" placeholder="支付金额" value={transaction.amount} onChange={e => setTransaction({...transaction, amount: e.target.value})} />
            </div>
            <div>
              <label className="text-xs text-slate-500 mb-1 block">支付日期</label>
              <input className="w-full p-2 border rounded" type="date" value={transaction.date} onChange={e => setTransaction({...transaction, date: e.target.value})} />
            </div>
            <button onClick={handleAddTransaction} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700">添加支付记录</button>
          </div>
        </ModalBackdrop>
      )}

      {/* --- MAIN CONTENT --- */}

      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 bg-white border-r border-slate-200 p-4 sticky top-0 h-screen overflow-y-auto hidden md:block">
        <h1 className="text-xl font-bold text-slate-800 mb-6">InvoiceFlow</h1>
        
        {/* Navigation Links */}
        <nav className="space-y-1">
          <button 
            onClick={() => setCurrentView('dashboard')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left ${currentView === 'dashboard' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <LayoutDashboard size={20} />
            <span>仪表盘</span>
          </button>
          
          <button 
            onClick={() => setCurrentView('stores')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left ${currentView === 'stores' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Store size={20} />
            <span>店铺管理</span>
          </button>
          
          <button 
            onClick={() => setCurrentView('suppliers')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left ${currentView === 'suppliers' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Users size={20} />
            <span>工厂管理</span>
          </button>
          
          <button 
            onClick={() => setCurrentView('admin')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left ${currentView === 'admin' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Building2 size={20} />
            <span>系统管理</span>
          </button>
          
          <button 
            onClick={() => setCurrentView('chat')}
            className={`w-full flex items-center gap-3 p-3 rounded-lg text-left ${currentView === 'chat' ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Bot size={20} />
            <span>AI分析</span>
          </button>
        </nav>
        
        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-slate-500 mb-3">快捷操作</h2>
          <div className="space-y-2">
            <button onClick={handleOpenAddStore} className="w-full flex items-center gap-3 p-3 rounded-lg text-left bg-green-50 text-green-700 hover:bg-green-100">
              <Plus size={20} />
              <span>新增店铺</span>
            </button>
            <button onClick={handleOpenAddSupplier} className="w-full flex items-center gap-3 p-3 rounded-lg text-left bg-blue-50 text-blue-700 hover:bg-blue-100">
              <Plus size={20} />
              <span>新增工厂</span>
            </button>
            <button onClick={handleRestoreData} className="w-full flex items-center gap-3 p-3 rounded-lg text-left bg-amber-50 text-amber-700 hover:bg-amber-100">
              <RefreshCw size={20} />
              <span>恢复数据</span>
            </button>
          </div>
        </div>
        
        {/* Current Quarter Info */}
        <div className="mt-8 bg-indigo-50 p-4 rounded-lg">
          <h2 className="text-sm font-semibold text-indigo-700 mb-2">当前季度</h2>
          <p className="text-2xl font-bold text-indigo-900">{currentQuarter}</p>
          <div className="mt-2 text-xs text-indigo-600">
            <div className="flex justify-between mb-1">
              <span>已开票总额:</span>
              <span className="font-medium">¥{totalInvoiced.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span>待抵扣缺口:</span>
              <span className="font-medium">¥{totalGap.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {/* Top Navigation Bar */}
        <header className="bg-white border-b border-slate-200 p-4 sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-slate-800">
              {currentView === 'dashboard' && '仪表盘'}
              {currentView === 'stores' && '店铺管理'}
              {currentView === 'suppliers' && '工厂管理'}
              {currentView === 'admin' && '系统管理'}
              {currentView === 'chat' && 'AI分析'}
            </h1>
            <div className="flex items-center gap-3">
              <button onClick={handleExportData} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-sm hover:bg-slate-200">
                <Download size={16} />
                <span>导出数据</span>
              </button>
              <button onClick={() => setActiveModal('quarterManagement')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm hover:bg-indigo-200">
                <Calendar size={16} />
                <span>季度管理</span>
              </button>
            </div>
          </div>
        </header>
        
        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
          </div>
        )}
        
        {/* Dashboard View */}
        {!isLoading && currentView === 'dashboard' && (
          <div className="p-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">季度总营收</p>
                    <h3 className="text-2xl font-bold text-slate-800">¥{totalIncome.toLocaleString()}</h3>
                  </div>
                  <div className="bg-green-100 rounded-full p-2">
                    <TrendingUp size={20} className="text-green-700" />
                  </div>
                </div>
                <KpiTooltip data={sortedIncomeData} title="按店铺排序" />
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">已收发票</p>
                    <h3 className="text-2xl font-bold text-slate-800">¥{totalInvoiced.toLocaleString()}</h3>
                  </div>
                  <div className="bg-blue-100 rounded-full p-2">
                    <Receipt size={20} className="text-blue-700" />
                  </div>
                </div>
                <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${Math.min(100, (totalInvoiced / (totalIncome - totalGap)) * 100)}%` }}
                  ></div>
                </div>
                <p className="text-xs text-slate-500 mt-1">已完成 {Math.min(100, Math.round((totalInvoiced / (totalIncome - totalGap)) * 100))}% 的发票收集</p>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">待抵扣缺口</p>
                    <h3 className="text-2xl font-bold text-amber-700">¥{totalGap.toLocaleString()}</h3>
                  </div>
                  <div className="bg-amber-100 rounded-full p-2">
                    <ArrowUpRight size={20} className="text-amber-700" />
                  </div>
                </div>
                <KpiTooltip data={sortedGapData} title="按店铺排序" />
              </div>
              
              <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">剩余开票额度</p>
                    <h3 className="text-2xl font-bold text-emerald-700">¥{totalQuotaAvailable.toLocaleString()}</h3>
                  </div>
                  <div className="bg-emerald-100 rounded-full p-2">
                    <Shield size={20} className="text-emerald-700" />
                  </div>
                </div>
                <KpiTooltip data={sortedQuotaData} title="按工厂排序" />
              </div>
            </div>
            
            {/* Charts Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Store Gap Chart */}
              <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">店铺发票缺口</h3>
                  <div className="text-xs text-slate-500">按缺口金额排序</div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value) => [`¥${value}`, '缺口金额']}
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Legend />
                      <Bar dataKey="Gap" fill="#f59e0b" name="缺口金额" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Factory Quota Chart */}
              <div className="bg-white rounded-xl shadow-sm p-4 border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-slate-800">工厂开票剩余额度</h3>
                  <div className="text-xs text-slate-500">按剩余额度排序</div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={factoryQuotaData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 12 }} />
                      <YAxis stroke="#94a3b8" tick={{ fontSize: 12 }} />
                      <Tooltip 
                        formatter={(value) => [`¥${value}`, '剩余额度']}
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                      />
                      <Legend />
                      <Bar dataKey="Remaining" fill="#10b981" name="剩余额度" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            {/* Quick Actions Section */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">快捷操作</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button onClick={handleOpenAddStore} className="flex flex-col items-center gap-2 p-4 bg-green-50 rounded-xl hover:bg-green-100 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-green-200 flex items-center justify-center">
                    <Store size={24} className="text-green-700" />
                  </div>
                  <span className="text-sm font-medium text-green-900">新增店铺</span>
                </button>
                <button onClick={handleOpenAddSupplier} className="flex flex-col items-center gap-2 p-4 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-blue-200 flex items-center justify-center">
                    <Users size={24} className="text-blue-700" />
                  </div>
                  <span className="text-sm font-medium text-blue-900">新增工厂</span>
                </button>
                <button onClick={() => setActiveModal('addInvoice')} className="flex flex-col items-center gap-2 p-4 bg-indigo-50 rounded-xl hover:bg-indigo-100 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-indigo-200 flex items-center justify-center">
                    <FilePlus size={24} className="text-indigo-700" />
                  </div>
                  <span className="text-sm font-medium text-indigo-900">添加发票</span>
                </button>
                <button onClick={() => setActiveModal('addPayment')} className="flex flex-col items-center gap-2 p-4 bg-purple-50 rounded-xl hover:bg-purple-100 transition-colors">
                  <div className="w-12 h-12 rounded-full bg-purple-200 flex items-center justify-center">
                    <CreditCard size={24} className="text-purple-700" />
                  </div>
                  <span className="text-sm font-medium text-purple-900">添加付款</span>
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Stores View */}
        {!isLoading && currentView === 'stores' && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">店铺管理</h2>
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  placeholder="搜索店铺..." 
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={storeSearchTerm}
                  onChange={(e) => setStoreSearchTerm(e.target.value)}
                />
                <button onClick={handleOpenAddStore} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  <Plus size={16} />
                  <span>新增店铺</span>
                </button>
              </div>
            </div>
            
            {/* Store List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedStores.map(store => (
                <StoreCard 
                  key={store.id} 
                  store={store}
                  invoiceAmount={getStoreInvoicedTotal(store.id)}
                  onEdit={handleOpenEditStore}
                  onDelete={() => setActiveModal('deleteStore')}
                  onAddInvoice={() => openInvoiceModal(store.id)}
                  onEditExpenses={() => handleEditExpenses(store)}
                />
              ))}
            </div>
            
            {/* Pagination */}
            <div className="flex justify-between items-center text-sm text-slate-500">
              <div>
                显示 {storeStartIndex + 1} 到 {Math.min(storeEndIndex, filteredStores.length)} 条，共 {filteredStores.length} 条
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setStoreCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={storeCurrentPage === 1}
                  className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  上一页
                </button>
                <span>{storeCurrentPage} / {storeTotalPages || 1}</span>
                <button 
                  onClick={() => setStoreCurrentPage(prev => Math.min(storeTotalPages || 1, prev + 1))}
                  disabled={storeCurrentPage === storeTotalPages}
                  className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  下一页
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Suppliers View */}
        {!isLoading && currentView === 'suppliers' && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">工厂管理</h2>
              <div className="flex items-center gap-3">
                <input 
                  type="text" 
                  placeholder="搜索工厂或开票单位..." 
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={supplierSearchTerm}
                  onChange={(e) => setSupplierSearchTerm(e.target.value)}
                />
                <button onClick={handleOpenAddSupplier} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
                  <Plus size={16} />
                  <span>新增工厂</span>
                </button>
              </div>
            </div>
            
            {/* Supplier List */}
            <div className="space-y-6">
              {Object.entries(filteredGroupedSuppliersMap).map(([owner, suppliers]) => (
                <div key={owner} className="bg-white rounded-xl shadow-sm border border-slate-200">
                  <div className="p-4 bg-indigo-50 border-b border-slate-200">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-semibold text-indigo-800">{owner}</h3>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setActiveModal('addSupplier')}
                          className="flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-xs hover:bg-indigo-200"
                        >
                          <Plus size={12} />
                          <span>新增开票单位</span>
                        </button>
                        <button 
                          onClick={() => handleOpenRenameOwner(owner)}
                          className="flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs hover:bg-amber-200"
                        >
                          <Pencil size={12} />
                          <span>重命名工厂</span>
                        </button>
                        <button 
                          onClick={() => handleDeleteOwner(owner)}
                          className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                        >
                          <X size={12} />
                          <span>删除工厂</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {suppliers.map(supplier => (
                      <SupplierRow 
                        key={supplier.id}
                        supplier={supplier}
                        used={getSupplierInvoicedTotal(supplier.id)}
                        onEdit={() => handleOpenEditEntity(supplier)}
                        onDelete={() => handleDeleteEntity(supplier.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Admin View */}
        {!isLoading && currentView === 'admin' && (
          <div className="p-6 space-y-6">
            <h2 className="text-xl font-bold text-slate-800">系统管理</h2>
            
            {/* System Backup Section */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">系统备份与恢复</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <FileText size={16} />
                    <span>导出数据</span>
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">导出完整的系统数据，包括所有季度的历史记录</p>
                  <button onClick={handleExportData} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                    <Download size={14} />
                    <span>导出系统数据</span>
                  </button>
                </div>
                
                <div className="p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Building2 size={16} />
                    <span>导出店铺数据</span>
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">导出店铺相关的数据，包括发票明细</p>
                  <button onClick={handleExportStores} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                    <Download size={14} />
                    <span>导出店铺数据</span>
                  </button>
                </div>
                
                <div className="p-4 border border-slate-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                    <Users size={16} />
                    <span>导出工厂数据</span>
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">导出工厂相关的数据，包括开票和付款明细</p>
                  <button onClick={handleExportSuppliers} className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                    <Download size={14} />
                    <span>导出工厂数据</span>
                  </button>
                </div>
              </div>
              
              <div className="mt-4 p-4 border-2 border-dashed border-slate-300 rounded-lg">
                <h4 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <FilePlus size={16} />
                  <span>恢复数据</span>
                </h4>
                <p className="text-xs text-slate-500 mb-3">从备份文件恢复系统数据，这将覆盖当前所有数据</p>
                <div className="flex items-center gap-3">
                  <input 
                    type="file" 
                    accept=".json" 
                    onChange={handleImportData}
                    className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <span className="text-xs text-slate-400">支持 .json 格式的备份文件</span>
                </div>
              </div>
            </div>
            
            {/* Invoice Records Section */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800">所有发票记录</h3>
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="搜索发票..." 
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={invoiceSearchTerm}
                    onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                  />
                  <button onClick={() => setActiveModal('addInvoice')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                    <Plus size={14} />
                    <span>添加发票</span>
                  </button>
                </div>
              </div>
              
              {/* Invoice Filter Bar */}
              <div className="flex flex-wrap gap-2 mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500">状态:</span>
                  <button 
                    onClick={() => setInvoiceStatusFilter('all')}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${invoiceStatusFilter === 'all' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    全部
                  </button>
                  <button 
                    onClick={() => setInvoiceStatusFilter('pending')}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${invoiceStatusFilter === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    待审核
                  </button>
                  <button 
                    onClick={() => setInvoiceStatusFilter('verified')}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${invoiceStatusFilter === 'verified' ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    已验证
                  </button>
                  <button 
                    onClick={() => setInvoiceStatusFilter('rejected')}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${invoiceStatusFilter === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    已拒绝
                  </button>
                </div>
              </div>
              
              {/* Invoice Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">开票日期</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">店铺名称</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">开票主体</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">开票金额</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">状态</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {adminPaginatedInvoices.map(invoice => {
                      const store = stores.find(s => s.id === invoice.storeId);
                      const supplier = suppliers.find(s => s.id === invoice.supplierId);
                      const statusInfo = getInvoiceStatusInfo(invoice.status || 'pending');
                      
                      return (
                        <tr key={invoice.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{invoice.date}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{store?.storeName || '未知店铺'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{supplier?.name || '未知主体'}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">¥{invoice.amount.toLocaleString()}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.className}`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button 
                              onClick={() => handleDeleteInvoiceRecord(invoice.id)}
                              className="text-red-600 hover:text-red-900 mr-3"
                            >
                              删除
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="flex justify-between items-center text-sm text-slate-500 mt-4">
                <div>
                  显示 {adminInvoiceStartIndex + 1} 到 {Math.min(adminInvoiceEndIndex, filteredInvoices.length)} 条，共 {filteredInvoices.length} 条
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setAdminInvoiceCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={adminInvoiceCurrentPage === 1}
                    className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <span>{adminInvoiceCurrentPage} / {adminInvoiceTotalPages || 1}</span>
                  <button 
                    onClick={() => setAdminInvoiceCurrentPage(prev => Math.min(adminInvoiceTotalPages || 1, prev + 1))}
                    disabled={adminInvoiceCurrentPage === adminInvoiceTotalPages}
                    className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
            
            {/* Payments Section */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-slate-800">工厂货款支付记录</h3>
                <div className="flex items-center gap-3">
                  <input 
                    type="text" 
                    placeholder="搜索付款..." 
                    className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={paymentSearchTerm}
                    onChange={(e) => setPaymentSearchTerm(e.target.value)}
                  />
                  <button onClick={() => setActiveModal('addPayment')} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
                    <Plus size={14} />
                    <span>添加付款</span>
                  </button>
                </div>
              </div>
              
              {/* Payments Table */}
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">付款日期</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">工厂负责人</th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">付款金额</th>
                      <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {paginatedPayments.map(payment => (
                      <tr key={payment.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{payment.date}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{payment.factoryOwner}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">¥{payment.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button 
                            onClick={() => handleDeletePaymentRecord(payment.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="flex justify-between items-center text-sm text-slate-500 mt-4">
                <div>
                  显示 {paymentStartIndex + 1} 到 {Math.min(paymentEndIndex, filteredPayments.length)} 条，共 {filteredPayments.length} 条
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setPaymentCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={paymentCurrentPage === 1}
                    className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    上一页
                  </button>
                  <span>{paymentCurrentPage} / {paymentTotalPages || 1}</span>
                  <button 
                    onClick={() => setPaymentCurrentPage(prev => Math.min(paymentTotalPages || 1, prev + 1))}
                    disabled={paymentCurrentPage === paymentTotalPages}
                    className="px-3 py-1 border border-slate-300 rounded hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    下一页
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* AI Chat View */}
        {!isLoading && currentView === 'chat' && (
          <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">AI税务优化分析</h2>
              <button 
                onClick={handleRunAnalysis}
                disabled={analyzing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {analyzing && <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>}
                <span>{analyzing ? '分析中...' : '运行分析'}</span>
              </button>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-200 min-h-[600px]">
              {aiAnalysis ? (
                <div className="prose max-w-none">
                  <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <Bot size={64} className="mb-4 opacity-50" />
                  <p className="text-lg mb-2">AI税务优化分析</p>
                  <p className="text-sm text-center max-w-md">点击上方"运行分析"按钮，AI将根据您的店铺数据和开票情况，为您提供税务优化建议</p>
                </div>
              )}
            </div>
            
            <AiChat 
              stores={stores} 
              suppliers={suppliers} 
              invoices={invoices} 
              payments={payments}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
