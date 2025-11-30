import React, { useState, useEffect } from 'react';
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
    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
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
  
  // 清空localStorage中的数据，确保使用空的MOCK数据
  useEffect(() => {
    localStorage.removeItem('stores');
    localStorage.removeItem('suppliers');
    localStorage.removeItem('invoices');
    localStorage.removeItem('payments');
  }, []);
  
  // Data State with localStorage persistence
  const [stores, setStores] = useState<StoreCompany[]>(MOCK_STORES);
  const [suppliers, setSuppliers] = useState<SupplierEntity[]>(MOCK_SUPPLIERS);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>(MOCK_INVOICES);
  const [payments, setPayments] = useState<PaymentRecord[]>(MOCK_PAYMENTS);

  // UI State
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    shipping: '', promotion: '', salaries: '', rent: '', office: '', fuel: '', other: ''
  });
  


  // Quarter Management State with localStorage persistence
  const [currentQuarter, setCurrentQuarter] = useState<string>(() => {
    return localStorage.getItem('currentQuarter') || '2025Q3';
  });
  const [availableQuarters, setAvailableQuarters] = useState<string[]>(() => {
    const saved = localStorage.getItem('availableQuarters');
    return saved ? JSON.parse(saved) : ['2025Q3'];
  });
  const [quarterData, setQuarterData] = useState<Record<string, {
    stores: StoreCompany[];
    suppliers: SupplierEntity[];
    invoices: InvoiceRecord[];
    payments: PaymentRecord[];
  }>>(() => {
    const saved = localStorage.getItem('quarterData');
    return saved ? JSON.parse(saved) : {};
  });
  
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
  const [factoryOwners, setFactoryOwners] = useState<string[]>(() => {
    const saved = localStorage.getItem('factoryOwners');
    if (saved) return JSON.parse(saved);
    // Initialize from existing suppliers if no saved data
    const owners = Array.from(new Set(suppliers.map(s => s.owner)));
    return owners.length > 0 ? owners : ['雷震', '陈晨']; // Default factories
  });

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

  // 数据加载完成后的处理
  useEffect(() => {
    setIsLoading(false);
  }, []);

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
      if (!acc[s.owner]) {
        acc[s.owner] = 0;
      }
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

  const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const backupData = JSON.parse(e.target?.result as string);
        
        if (backupData.version && backupData.data) {
          if (confirm(`确认恢复备份数据？\n\n备份时间：${backupData.timestamp}\n备份包含：所有季度数据\n\n注意：这将覆盖当前所有数据，包括所有季度的历史数据！`)) {
            setStores(backupData.data.stores || []);
            setSuppliers(backupData.data.suppliers || []);
            setInvoices(backupData.data.invoices || []);
            setPayments(backupData.data.payments || []);
            setQuarterData(backupData.data.quarterData || {});
            setAvailableQuarters(backupData.data.availableQuarters || []);
            setCurrentQuarter(backupData.quarter || currentQuarter);
            
            // 保存到localStorage
            localStorage.setItem('stores', JSON.stringify(backupData.data.stores || []));
            localStorage.setItem('suppliers', JSON.stringify(backupData.data.suppliers || []));
            localStorage.setItem('invoices', JSON.stringify(backupData.data.invoices || []));
            localStorage.setItem('payments', JSON.stringify(backupData.data.payments || []));
            localStorage.setItem('quarterData', JSON.stringify(backupData.data.quarterData || {}));
            localStorage.setItem('availableQuarters', JSON.stringify(backupData.data.availableQuarters || []));
            localStorage.setItem('currentQuarter', backupData.quarter || currentQuarter);
            
            alert('数据恢复成功！');
          }
        } else {
          alert('无效的备份文件格式！');
        }
      } catch (error) {
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
    localStorage.setItem('stores', JSON.stringify(updatedStores));
    setActiveModal(null);
  };

  const handleDeleteStore = (storeId: string) => {
    const updatedStores = stores.filter(s => s.id !== storeId);
    setStores(updatedStores);
    localStorage.setItem('stores', JSON.stringify(updatedStores));
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
        localStorage.setItem('factoryOwners', JSON.stringify(updatedFactoryOwners));
      }
    }
    setSuppliers(updatedSuppliers);
    localStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
    setActiveModal(null);
  };

  const handleSaveOwnerRename = () => {
    if (!ownerRenameForm.newName || !ownerRenameForm.oldName) return;
    // Update all suppliers with old owner name
    const updatedSuppliers = suppliers.map(s => s.owner === ownerRenameForm.oldName ? { ...s, owner: ownerRenameForm.newName } : s);
    setSuppliers(updatedSuppliers);
    localStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
    // Update payments linked to this owner
    const updatedPayments = payments.map(p => p.factoryOwner === ownerRenameForm.oldName ? { ...p, factoryOwner: ownerRenameForm.newName } : p);
    setPayments(updatedPayments);
    localStorage.setItem('payments', JSON.stringify(updatedPayments));
    // Update factoryOwners list
    const updatedFactoryOwners = factoryOwners.map(owner => owner === ownerRenameForm.oldName ? ownerRenameForm.newName : owner);
    setFactoryOwners(updatedFactoryOwners);
    localStorage.setItem('factoryOwners', JSON.stringify(updatedFactoryOwners));
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
        localStorage.setItem('invoices', JSON.stringify(updatedInvoices));
        
        // 计算正确的剩余额度：固定额度 - 其他发票总额
        const remainingQuota = supplier.quarterlyLimit - otherInvoicesTotal;
        
        const quarterText = quarterType === 'current' ? '当前季度' : '下个季度';
        alert('开票记录已删除！\n\n额度恢复详情：\n• 开票主体：' + supplier.owner + ' (' + supplier.name + ')\n• 发票季度：' + quarterText + '\n• 删除金额：¥' + amount.toLocaleString() + '\n• 当前剩余额度：¥' + remainingQuota.toLocaleString());
      } else {
        // 删除记录
        const updatedInvoices = invoices.filter(inv => inv.id !== invoiceId);
        setInvoices(updatedInvoices);
        localStorage.setItem('invoices', JSON.stringify(updatedInvoices));
        
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
      localStorage.setItem('invoices', JSON.stringify(updatedInvoices));
      
      alert('开票记录已删除。由于此发票不属于当前季度或下个季度，不影响当前可用额度。');
    }
  };

  const handleDeleteEntity = (id: string) => {
    const updatedSuppliers = suppliers.filter(s => s.id !== id);
    setSuppliers(updatedSuppliers);
    localStorage.setItem('suppliers', JSON.stringify(updatedSuppliers));
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
      localStorage.setItem('invoiceBackup', JSON.stringify(updatedData));
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
    localStorage.setItem('invoices', JSON.stringify(updatedInvoices));
    
    alert('发票识别完成，已添加到开票记录中！');
  };

  const handleDeleteOwner = (ownerName: string) => {
    // Only remove the factory from the factory owners list, keep all entities
    const updatedFactoryOwners = factoryOwners.filter(owner => owner !== ownerName);
    setFactoryOwners(updatedFactoryOwners);
    localStorage.setItem('factoryOwners', JSON.stringify(updatedFactoryOwners));
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
      localStorage.setItem('payments', JSON.stringify(updatedPayments));
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
      localStorage.setItem('invoices', JSON.stringify(updatedInvoices));
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
    localStorage.setItem('quarterData', JSON.stringify(newQuarterData));
    
    // 添加新季度到可用季度列表
    if (!availableQuarters.includes(newQuarterName)) {
      // 确保季度列表按顺序排列
      const updatedQuarters = [...availableQuarters, newQuarterName].sort();
      setAvailableQuarters(updatedQuarters);
      localStorage.setItem('availableQuarters', JSON.stringify(updatedQuarters));
    }
    
    // 设置当前季度为新季度
    setCurrentQuarter(newQuarterName);
    localStorage.setItem('currentQuarter', newQuarterName);
    
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
    
    // 保存重置后的数据到localStorage
    localStorage.setItem('stores', JSON.stringify(resetStores));
    localStorage.setItem('suppliers', JSON.stringify(resetSuppliers));
    localStorage.setItem('invoices', JSON.stringify([]));
    localStorage.setItem('payments', JSON.stringify([]));
    
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
    setQuarterData(newQuarterData);
    localStorage.setItem('quarterData', JSON.stringify(newQuarterData));
    
    // 加载目标季度的数据
    const targetQuarterData = quarterData[quarter];
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
    localStorage.setItem('currentQuarter', quarter);
    
    // 更新localStorage中的当前数据
    const currentStores = stores;
    const currentSuppliers = suppliers;
    const currentInvoices = invoices;
    const currentPayments = payments;
    localStorage.setItem('stores', JSON.stringify(currentStores));
    localStorage.setItem('suppliers', JSON.stringify(currentSuppliers));
    localStorage.setItem('invoices', JSON.stringify(currentInvoices));
    localStorage.setItem('payments', JSON.stringify(currentPayments));
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
             <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
               <label className="text-xs font-bold text-indigo-700 uppercase mb-2 block flex items-center gap-1">
                  <User size={12}/> 1. 所属工厂 (法人)
               </label>
               
               <div className="flex gap-2 mb-2 text-xs">
                  <button 
                    onClick={() => { setIsNewFactory(true); setSupplierForm({...supplierForm, owner: ''}); }}
                    className={`flex-1 py-1.5 rounded border transition-colors ${isNewFactory ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    新增工厂
                  </button>
                  <button 
                    onClick={() => setIsNewFactory(false)}
                    className={`flex-1 py-1.5 rounded border transition-colors ${!isNewFactory ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  >
                    选择已有
                  </button>
               </div>

               {isNewFactory ? (
                  <input 
                    className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    placeholder="输入工厂负责人姓名 (法人)" 
                    value={supplierForm.owner} 
                    onChange={e => setSupplierForm({...supplierForm, owner: e.target.value})} 
                    autoFocus
                  />
               ) : (
                  <SearchableSelect
                     options={uniqueOwners.map(owner => ({ value: owner, label: owner }))}
                     value={supplierForm.owner}
                     onChange={val => setSupplierForm({...supplierForm, owner: val})}
                     placeholder="搜索或选择现有工厂"
                  />
               )}
             </div>
             )}

             {/* Entity Section */}
             <div className="bg-white p-1">
                <label className="text-xs font-bold text-slate-500 uppercase mb-2 block flex items-center gap-1">
                  <Building2 size={12}/> {activeModal === 'addSupplier' ? '2. 开票主体 (公司/个体户)' : '开票主体信息'}
                </label>
                
                <div className="space-y-3">
                    <div>
                       <label className="text-[10px] text-slate-400 mb-0.5 block">营业执照名称</label>
                       <input 
                         className="w-full p-2 border rounded text-sm" 
                         placeholder="公司名称" 
                         value={supplierForm.name} 
                         onChange={e => setSupplierForm({...supplierForm, name: e.target.value})} 
                       />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-[10px] text-slate-400 mb-0.5 block">主体类型</label>
                         <SearchableSelect
                            options={[
                              { value: EntityType.INDIVIDUAL, label: EntityType.INDIVIDUAL },
                              { value: EntityType.COMPANY, label: EntityType.COMPANY },
                              { value: EntityType.GENERAL, label: EntityType.GENERAL }
                            ]}
                            value={supplierForm.type}
                            onChange={val => setSupplierForm({...supplierForm, type: val as EntityType})}
                            placeholder="选择类型"
                         />
                      </div>
                      <div>
                          <label className="text-[10px] text-slate-400 mb-0.5 block">季度限额 (元)</label>
                          <input 
                            className="w-full p-2 border rounded text-sm" 
                            type="number" 
                            placeholder="280000" 
                            value={supplierForm.limit} 
                            onChange={e => setSupplierForm({...supplierForm, limit: parseFloat(e.target.value)})} 
                          />
                      </div>
                    </div>
                </div>
             </div>
          </div>
          <button onClick={handleSaveSupplier} className="w-full mt-4 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors shadow-sm">确认{activeModal === 'addSupplier' ? '添加' : '保存'}</button>
        </ModalBackdrop>
      )}

      {activeModal === 'editOwner' && (
          <ModalBackdrop title="修改" onClose={() => setActiveModal(null)}>
             <input 
                className="w-full p-2 border rounded text-sm" 
                placeholder="新的负责人姓名" 
                value={ownerRenameForm.newName} 
                onChange={e => setOwnerRenameForm({...ownerRenameForm, newName: e.target.value})} 
                autoFocus
             />
             <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
                注意：修改后，所有关联的公司/个体户及历史回款记录的负责人姓名都会同步更新。
             </div>
             <button onClick={handleSaveOwnerRename} className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700">确认修改</button>
          </ModalBackdrop>
      )}

      {(activeModal === 'addPayment' || activeModal === 'addInvoice') && (
        <ModalBackdrop title={activeModal === 'addPayment' ? "登记工厂货款 (支出)" : "发起开票需求 (进项)"} onClose={() => setActiveModal(null)}>
           {activeModal === 'addInvoice' && (
             <div className="space-y-1">
               <label className="text-xs font-semibold text-slate-500">选择店铺</label>
               <SearchableSelect
                  options={stores.map(s => ({ value: s.id, label: `${s.storeName} [${s.companyName}]` }))}
                  value={transaction.storeId}
                  onChange={val => setTransaction({...transaction, storeId: val})}
                  placeholder="搜索或选择店铺"
               />
             </div>
           )}
           
           <div className="space-y-1">
             <label className="text-xs font-semibold text-slate-500">
                {activeModal === 'addPayment' ? '选择工厂' : '选择开票单位 (公司/个体户)'}
             </label>
             {activeModal === 'addPayment' ? (
                <SearchableSelect
                    options={uniqueOwners.map(owner => ({ value: owner, label: owner }))}
                    value={transaction.supplierId}
                    onChange={val => setTransaction({...transaction, supplierId: val})}
                    placeholder="搜索或选择工厂"
                />
             ) : (
                <SearchableSelect
                    options={suppliers.map(s => {
                        const used = getSupplierInvoicedTotal(s.id);
                        const remaining = s.quarterlyLimit - used;
                        return { 
                            value: s.id, 
                            label: `[${s.owner}] ${s.name} (余: ${remaining > 0 ? (remaining/10000).toFixed(1) + '万' : '0'})` 
                        };
                    })}
                    value={transaction.supplierId}
                    onChange={val => setTransaction({...transaction, supplierId: val})}
                    placeholder="搜索或选择开票单位"
                />
             )}
           </div>
           
           <div className="grid grid-cols-2 gap-4">
               <div className="space-y-1">
                 <label className="text-xs font-semibold text-slate-500">金额 (¥)</label>
                 <input className="w-full p-2 border rounded" type="number" placeholder="0.00" value={transaction.amount} onChange={e => setTransaction({...transaction, amount: e.target.value})} />
               </div>
               <div className="space-y-1">
                 <label className="text-xs font-semibold text-slate-500">{activeModal === 'addPayment' ? '付款日期' : '开票日期'}</label>
                 <input className="w-full p-2 border rounded" type="date" value={transaction.date} onChange={e => setTransaction({...transaction, date: e.target.value})} />
               </div>
           </div>

           {/* 发票额度验证提示 */}
           {activeModal === 'addInvoice' && transaction.supplierId && (
             <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
               {(() => {
                 const selectedSupplier = suppliers.find(s => s.id === transaction.supplierId);
                 if (!selectedSupplier) return null;
                 
                 const usedAmount = getSupplierInvoicedTotal(selectedSupplier.id);
                 const remainingAmount = selectedSupplier.quarterlyLimit - usedAmount;
                 const inputAmount = parseFloat(transaction.amount) || 0;
                 
                 return (
                   <div className="text-xs space-y-1">
                     <div className="flex justify-between">
                       <span className="text-slate-600">季度限额:</span>
                       <span className="font-medium">¥{selectedSupplier.quarterlyLimit.toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-slate-600">已使用额度:</span>
                       <span className="font-medium">¥{usedAmount.toLocaleString()}</span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-slate-600">剩余额度:</span>
                       <span className={`font-medium ${remainingAmount <= 0 ? 'text-red-600' : remainingAmount < 10000 ? 'text-orange-600' : 'text-green-600'}`}>
                         ¥{remainingAmount.toLocaleString()}
                       </span>
                     </div>
                     {inputAmount > 0 && (
                       <div className={`pt-2 border-t ${inputAmount > remainingAmount ? 'border-red-200' : 'border-green-200'}`}>
                         <div className={`text-center font-medium ${inputAmount > remainingAmount ? 'text-red-600' : 'text-green-600'}`}>
                           {inputAmount > remainingAmount 
                             ? `⚠️ 输入金额超出剩余额度 ¥${(inputAmount - remainingAmount).toLocaleString()}`
                             : `✓ 输入金额在可用额度内`
                           }
                         </div>
                       </div>
                     )}
                   </div>
                 );
               })()}
             </div>
           )}

           <button 
             onClick={handleAddTransaction} 
             className={`w-full py-2 rounded-lg font-medium text-white ${
               activeModal === 'addPayment' 
                 ? 'bg-orange-600 hover:bg-orange-700' 
                 : transaction.supplierId && parseFloat(transaction.amount) > 0 && suppliers.find(s => s.id === transaction.supplierId) && 
                   (parseFloat(transaction.amount) > (suppliers.find(s => s.id === transaction.supplierId)!.quarterlyLimit - getSupplierInvoicedTotal(transaction.supplierId)))
                   ? 'bg-gray-400 cursor-not-allowed' 
                   : 'bg-indigo-600 hover:bg-indigo-700'
             }`}
             disabled={activeModal === 'addInvoice' && transaction.supplierId && parseFloat(transaction.amount) > 0 && suppliers.find(s => s.id === transaction.supplierId) && 
               (parseFloat(transaction.amount) > (suppliers.find(s => s.id === transaction.supplierId)!.quarterlyLimit - getSupplierInvoicedTotal(transaction.supplierId)))}
           >
             确认提交
           </button>
        </ModalBackdrop>
      )}

      {/* Quarter Management Modal */}
      {activeModal === 'quarterManagement' && (
        <ModalBackdrop title="季度历史记录" onClose={() => setActiveModal(null)}>
           <div className="space-y-3">
               {availableQuarters.map(quarter => (
                   <div key={quarter} className={`p-3 rounded-lg border ${currentQuarter === quarter ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50'}`}>
                       <div className="flex justify-between items-center">
                           <div>
                               <h4 className="font-medium text-slate-800">{quarter}</h4>
                               <p className="text-xs text-slate-500">
                                   {quarterData[quarter] ? 
                                       `总收入: ¥${(quarterData[quarter].stores.reduce((sum, s) => sum + s.quarterIncome, 0) / 10000).toFixed(1)}万, 总支出: ¥${(quarterData[quarter].stores.reduce((sum, s) => sum + s.quarterExpenses, 0) / 10000).toFixed(1)}万` : 
                                       '暂无数据'
                                   }
                               </p>
                           </div>
                           <div className="flex gap-2">
                               <button 
                                   onClick={() => {
                                       if (confirm(`确认删除${quarter}的季度数据？\n\n注意：这将永久删除该季度的所有数据，包括店铺、工厂、发票和付款记录。`)) {
                                           // 创建新的季度数据对象，删除指定季度
                                           const newQuarterData = { ...quarterData };
                                           delete newQuarterData[quarter];
                                           setQuarterData(newQuarterData);
                                           localStorage.setItem('quarterData', JSON.stringify(newQuarterData));
                                            
                                           // 从availableQuarters中移除该季度
                                           const newAvailableQuarters = availableQuarters.filter(q => q !== quarter);
                                           setAvailableQuarters(newAvailableQuarters);
                                           localStorage.setItem('availableQuarters', JSON.stringify(newAvailableQuarters));
                                            
                                           // 如果删除的是当前季度，切换到其他可用季度或保持当前季度但重置数据
                                           if (currentQuarter === quarter) {
                                               if (newAvailableQuarters.length > 0) {
                                                   // 切换到最新的可用季度
                                                   const latestQuarter = newAvailableQuarters.sort().pop() || '2025Q3';
                                                   handleSwitchQuarter(latestQuarter);
                                               } else {
                                                   // 如果没有其他季度，重置当前季度数据但不改变季度名称
                                                   setStores([]);
                                                   setSuppliers([]);
                                                   setInvoices([]);
                                                   setPayments([]);
                                                   localStorage.setItem('stores', JSON.stringify([]));
                                                   localStorage.setItem('suppliers', JSON.stringify([]));
                                                   localStorage.setItem('invoices', JSON.stringify([]));
                                                   localStorage.setItem('payments', JSON.stringify([]));
                                               }
                                           }
                                       }
                                   }}
                                   className="px-2 py-1 rounded text-xs bg-red-100 text-red-600 hover:bg-red-200 border border-red-200"
                                   title="删除季度数据"
                               >
                                   删除
                               </button>
                               <button 
                                   onClick={() => {
                                       handleSwitchQuarter(quarter);
                                       setActiveModal(null);
                                   }}
                                   className={`px-3 py-1 rounded text-sm ${currentQuarter === quarter ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50'}`}
                               >
                                   {currentQuarter === quarter ? '当前季度' : '切换'}
                               </button>
                           </div>
                       </div>
                   </div>
               ))}
           </div>
           <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-100 mt-4">
               <p className="font-medium mb-1">提示：</p>
               <ul className="space-y-1 list-disc list-inside">
                   <li>点击"切换"按钮可查看对应季度的历史数据</li>
                   <li>数据按季度独立保存，互不影响</li>
               </ul>
           </div>
        </ModalBackdrop>
      )}


      {/* --- SIDEBAR --- */}
      <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex-shrink-0 sticky top-0 h-auto md:h-screen overflow-y-auto z-10 flex flex-col">
        <div className="p-6 flex flex-col min-h-full">
          <div className="flex items-center gap-2 mb-8 text-white">
            <Receipt className="text-indigo-400" size={28} />
            <h1 className="text-xl font-bold tracking-tight">{currentQuarter}</h1>
          </div>
          
          <nav className="space-y-2">
            <button 
              onClick={() => setCurrentView('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
            >
              <LayoutDashboard size={20} /> 数据总览
            </button>
            <button 
              onClick={() => setCurrentView('stores')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'stores' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
            >
              <Store size={20} /> 店铺管理
            </button>
            <button 
              onClick={() => setCurrentView('suppliers')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'suppliers' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
            >
              <Users size={20} /> 工厂管理
            </button>
            <button 
              onClick={() => setCurrentView('userInvoices')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'userInvoices' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
            >
              <FileText size={20} /> 开票记录
            </button>
             <button 
              onClick={() => setCurrentView('chat')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'chat' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800'}`}
            >
              <Sparkles size={20} /> AI 助手
            </button>
          </nav>

          <div className="mt-8 pt-8 border-t border-slate-700 space-y-3">
            <button 
              onClick={() => { const today = new Date().toISOString().split('T')[0]; setTransaction({storeId:'', supplierId:'', amount:'', date: today}); setActiveModal('addPayment'); }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-700"
            >
              <CreditCard size={18} className="text-orange-400" /> 登记工厂货款
            </button>
            <button 
              onClick={() => { const today = new Date().toISOString().split('T')[0]; setTransaction({storeId:'', supplierId:'', amount:'', date: today}); setActiveModal('addInvoice'); }}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white p-3 rounded-lg flex items-center justify-center gap-2 transition-colors border border-slate-700"
            >
               <FilePlus size={18} className="text-green-400" /> 登记发票进项
            </button>
          </div>

          <div className="mt-auto pt-8">
            <button 
               onClick={() => setCurrentView('admin')}
               className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'admin' ? 'bg-indigo-900 text-indigo-200' : 'hover:bg-slate-800 text-slate-500 hover:text-slate-300'}`}
            >
               <Shield size={20} /> 管理员设置
            </button>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-gray-50 text-gray-900">
        <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-800 capitalize">
                {currentView === 'dashboard' && '数据总览'}
                {currentView === 'stores' && '店铺管理'}
                {currentView === 'suppliers' && '工厂发票管理'}
                {currentView === 'userInvoices' && '开票记录'}
                {currentView === 'chat' && 'AI 税务助手'}
                {currentView === 'admin' && '管理员设置'}
              </h2>
            </div>
            <div className="flex gap-3">
              {currentView === 'stores' && (
                <>
                  <button onClick={handleExportStores} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors">
                    <Download size={18}/> 导出数据
                  </button>
                  <button onClick={handleOpenAddStore} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                    <Plus size={18}/> 添加店铺
                  </button>
                </>
              )}
              {currentView === 'suppliers' && (
                <>
                  <button onClick={handleExportSuppliers} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors">
                    <Download size={18}/> 导出数据
                  </button>
                  <button onClick={handleOpenAddSupplier} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                    <Plus size={18}/> 添加工厂
                  </button>
                </>
              )}
              {currentView === 'dashboard' && (
                  <button 
                    onClick={handleRunAnalysis}
                    disabled={analyzing}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-colors disabled:opacity-70"
                  >
                    {analyzing ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    ) : (
                      <Sparkles size={18} />
                    )}
                    一键 AI 优化
                  </button>
              )}
            </div>
        </header>

        {/* DASHBOARD VIEW */}
        {currentView === 'dashboard' && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
               <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 relative group hover:z-20 transition-all hover:shadow-md">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-green-100 text-green-600 rounded-lg"><TrendingUp size={20}/></div>
                    <span className="text-gray-500 text-sm font-medium">季度总收入</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">¥{(totalIncome / 10000).toFixed(2)}万</p>
                  <KpiTooltip title="店铺收入排行" items={sortedIncomeData} colorClass="bg-green-500" />
               </div>
               <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 relative group hover:z-20 transition-all hover:shadow-md">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg"><ArrowUpRight size={20}/></div>
                    <span className="text-gray-500 text-sm font-medium">发票缺口</span>
                  </div>
                  <p className="text-2xl font-bold text-red-600">¥{(totalGap / 10000).toFixed(2)}万</p>
                  <KpiTooltip title="店铺缺口排行" items={sortedGapData} colorClass="bg-red-500" />
               </div>
               <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 relative group hover:z-20 transition-all hover:shadow-md">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><PieChart size={20}/></div>
                    <span className="text-gray-500 text-sm font-medium">可用发票额度</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">¥{(totalQuotaAvailable / 10000).toFixed(2)}万</p>
                  <KpiTooltip title="工厂可用额度排行" items={sortedQuotaData} colorClass="bg-blue-500" />
               </div>
               <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:z-20 transition-all hover:shadow-md">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-lg"><Users size={20}/></div>
                    <span className="text-gray-500 text-sm font-medium">额度预警</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-800">
                    {suppliers.filter(s => {
                      const used = getSupplierInvoicedTotal(s.id);
                      return (used / s.quarterlyLimit) > 0.9;
                    }).length}
                  </p>
               </div>
            </div>

            {/* AI Analysis Section */}
            {aiAnalysis && (
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Sparkles size={120} />
                </div>
                <h3 className="text-lg font-bold text-indigo-700 mb-4 flex items-center gap-2">
                  <Sparkles className="text-indigo-400" size={20} /> Gemini 优化策略建议
                </h3>
                <div className="prose prose-sm prose-invert max-w-none text-slate-300 bg-slate-800/50 p-4 rounded-lg">
                  <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Store Gap Chart */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-6">所有店铺发票缺口</h3>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 60, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        tickLine={{ stroke: '#e2e8f0' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        height={150}
                        interval={0}
                        tick={(props: any) => {
                          const { x, y, payload } = props;
                          const chars = payload.value.split('');
                          return (
                            <g>
                              {chars.map((char: string, index: number) => (
                                <text
                                  key={`${payload.value}-${index}`}
                                  x={x}
                                  y={y + 10 + index * 12}
                                  fill="#64748b"
                                  fontSize={12}
                                  textAnchor="middle"
                                >
                                  {char}
                                </text>
                              ))}
                            </g>
                          );
                        }}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        tickFormatter={(value) => `${value / 10000}万`}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#e2e8f0' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <Tooltip 
                        formatter={(value: number) => `¥${value.toLocaleString()}`}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#ffffff', color: '#475569' }}
                      />
                      <Bar dataKey="Gap" name="发票缺口" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Factory Remaining Quota Chart */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="text-lg font-bold text-gray-800 mb-6">工厂开票剩余总额度</h3>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={factoryQuotaData} margin={{ top: 20, right: 30, left: 60, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis 
                        dataKey="name" 
                        stroke="#94a3b8" 
                        tickLine={{ stroke: '#e2e8f0' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                        height={180}
                        interval={0}
                        tick={(props: any) => {
                          const { x, y, payload } = props;
                          const chars = payload.value.split('');
                          return (
                            <g>
                              {chars.map((char: string, index: number) => (
                                <text
                                  key={`${payload.value}-${index}`}
                                  x={x}
                                  y={y + 10 + index * 12}
                                  fill="#64748b"
                                  fontSize={12}
                                  textAnchor="middle"
                                >
                                  {char}
                                </text>
                              ))}
                            </g>
                          );
                        }}
                      />
                      <YAxis 
                        stroke="#94a3b8" 
                        tickFormatter={(value) => `${value / 10000}万`}
                        tick={{ fontSize: 12, fill: '#64748b' }}
                        tickLine={{ stroke: '#e2e8f0' }}
                        axisLine={{ stroke: '#e2e8f0' }}
                      />
                      <Tooltip 
                        formatter={(value: number) => `¥${value.toLocaleString()}`}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: '#ffffff', color: '#475569' }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const factoryName = payload[0].payload.name;
                            
                            // 获取该工厂下所有主体的详细信息
                            const factorySuppliers = suppliers.filter(s => s.owner === factoryName);
                            const supplierDetails = factorySuppliers.map(supplier => {
                              const used = getSupplierInvoicedTotal(supplier.id);
                              const remaining = Math.max(0, supplier.quarterlyLimit - used);
                              return {
                                name: supplier.name,
                                limit: supplier.quarterlyLimit,
                                used: used,
                                remaining: remaining
                              };
                            });
                            
                            return (
                              <div className="bg-white p-3 border border-gray-300 rounded shadow-lg" style={{ maxWidth: '250px' }}>
                                <p className="font-semibold mb-2">{factoryName}</p>
                                <p className="text-sm mb-2">总剩余额度: ¥{payload[0].value.toLocaleString()}</p>
                                <div className="border-t pt-2">
                                  <p className="text-xs font-semibold mb-1">明细:</p>
                                  {supplierDetails.map((detail, index) => (
                                    <div key={`${detail.name}-${index}`} className="text-xs mb-1">
                                      <div className="font-medium">{detail.name}</div>
                                      <div className="text-gray-600">
                                        限额: ¥{detail.limit.toLocaleString()} | 
                                        剩余: ¥{detail.remaining.toLocaleString()}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="Remaining" name="剩余额度" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STORES VIEW */}
        {currentView === 'stores' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
            {stores.map(store => {
               const storeInvoices = invoices.filter(i => i.storeId === store.id);
               const storePayments = payments.filter(p => p.storeId === store.id);
               const total = storeInvoices.reduce((sum, i) => sum + i.amount, 0);
               return (
                  <StoreCard 
                    key={store.id} 
                    store={store} 
                    invoices={storeInvoices}
                    payments={storePayments}
                    suppliers={suppliers}
                    totalInvoiced={total}
                    onEditExpenses={() => handleEditExpenses(store)}
                    onRequestInvoice={openInvoiceModal}
                    onEditStore={handleOpenEditStore}
                    onDeleteStore={handleDeleteStore}
                  />
               );
            })}
          </div>
        )}

        {/* USER INVOICES VIEW */}
        {currentView === 'userInvoices' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">

              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={20} /> 开票记录
                  </h3>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="店铺、工厂、开票主体或金额"
                      value={invoiceSearchTerm}
                      onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                      className="w-64 pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                    />
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-2.5 text-slate-400">
                      <circle cx="11" cy="11" r="8"></circle>
                      <path d="m21 21-4.3-4.3"></path>
                    </svg>
                    {invoiceSearchTerm && (
                      <button
                        onClick={() => setInvoiceSearchTerm('')}
                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"></line>
                          <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                      </button>
                    )}
                  </div>
                  {invoiceSearchTerm && (
                    <div className="text-xs text-slate-500">
                      找到 {filteredInvoices.length} 个结果
                    </div>
                  )}
                </div>
                <div className="text-sm text-slate-500">
                  共 {invoices.length} 条记录
                </div>
              </div>
              
              {/* 发票上传组件 - 暂缺 */}
              {/* <InvoiceUpload
                stores={stores}
                suppliers={suppliers}
                onInvoiceUpload={(invoiceData, image, verificationResult) => {
                  // 处理上传的发票数据
                  const newInvoice: InvoiceRecord = {
                    id: `inv_${Date.now()}`,
                    storeId: invoiceData.storeId || '',
                    supplierId: invoiceData.supplierId || '',
                    amount: invoiceData.amount || 0,
                    date: invoiceData.date || new Date().toISOString().split('T')[0],
                    image: image,
                    status: verificationResult?.isValid ? 'verified' : 'pending',
                    verificationResult: verificationResult
                  };
                  
                  const updatedInvoices = [...invoices, newInvoice];
                  setInvoices(updatedInvoices);
                  localStorage.setItem('invoices', JSON.stringify(updatedInvoices));
                }}
              /> */}

              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-center">序号</th>
                      <th className="px-4 py-3 text-center">开票日期</th>
                      <th className="px-4 py-3 text-center">店铺名称-工厂主体</th>
                      <th className="px-4 py-3 text-center">金额</th>
                      <th className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span>发票状态</span>
                          <select 
                            value={invoiceStatusFilter} 
                            onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                            className="text-xs px-1 py-0.5 border border-slate-300 rounded bg-white"
                          >
                            <option value="all">全部</option>
                            <option value="pending">待核验</option>
                            <option value="completed">完成</option>
                          </select>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedInvoices.map((invoice, index) => {
                      const store = stores.find(s => s.id === invoice.storeId);
                      const supplier = suppliers.find(s => s.id === invoice.supplierId);
                      const factoryOwner = supplier?.owner || '未知工厂';
                      const supplierName = supplier?.name || '未知主体';
                      const statusInfo = getInvoiceStatusInfo(invoice.status || 'pending');
                      const serialNumber = invoiceStartIndex + index + 1;
                       
                      return (
                        <tr key={invoice.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900 text-center">{serialNumber}</td>
                          <td className="px-4 py-3 font-medium text-slate-900 text-center">{invoice.date}</td>
                          <td className="px-4 py-3 text-slate-700 text-center">
                            <div className="font-medium">{store?.storeName || '未知店铺'}-{store?.companyName || '未知公司'}</div>
                            <div className="text-xs text-slate-500">{factoryOwner} - {supplierName}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700 font-medium text-center">¥{invoice.amount.toLocaleString()}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusInfo.className}`}>
                              {statusInfo.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* 分页控件 */}
              {invoiceTotalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <div className="text-sm text-slate-500">
                    显示 {invoiceStartIndex + 1} 到 {Math.min(invoiceEndIndex, filteredInvoices.length)} 条，共 {filteredInvoices.length} 条
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setInvoiceCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={invoiceCurrentPage === 1}
                      className="px-3 py-1 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      上一页
                    </button>
                    
                    {/* 页码按钮 */}
                    {Array.from({ length: invoiceTotalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setInvoiceCurrentPage(page)}
                        className={`px-3 py-1 rounded-md text-sm font-medium ${invoiceCurrentPage === page ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        {page}
                      </button>
                    ))}
                    
                    <button
                      onClick={() => setInvoiceCurrentPage(prev => Math.min(invoiceTotalPages, prev + 1))}
                      disabled={invoiceCurrentPage === invoiceTotalPages}
                      className="px-3 py-1 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
              

              
              {filteredInvoices.length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  <FileText size={32} className="mx-auto mb-2 text-slate-300"/>
                  <p>暂无开票记录</p>
                  <p className="text-sm">请上传发票图片或联系管理员</p>
                </div>
              )}
              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                <div className="text-sm text-slate-500">
                  {invoiceSearchTerm ? `搜索到 ${filteredInvoices.length} 条记录` : `共 ${invoices.length} 条记录`}
                </div>
                <div className="text-sm text-slate-500">
                  总金额: ¥{filteredInvoices.reduce((sum, invoice) => sum + invoice.amount, 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUPPLIERS VIEW */}
        {currentView === 'suppliers' && (
          <div className="space-y-6 relative">
             {/* Frozen Header */}
             <div className="sticky top-0 z-30 bg-slate-100/95 backdrop-blur-sm border-b border-slate-200 py-3 text-sm font-bold text-slate-600 shadow-sm transition-all -mx-4 px-4 md:-mx-8 md:px-8">
                <div className="flex items-center">
                    <div className="hidden md:block w-64 pl-6">工厂</div>
                    <div className="flex-1 grid grid-cols-12 gap-4 px-4">
                        <div className="col-span-4 pl-1">公司/个体户</div>
                        <div className="col-span-3">店铺名称</div>
                        <div className="col-span-5">开票余额</div>
                    </div>
                </div>
             </div>

             {/* Note: We now group by Owner (Factory Name) */}
             {Object.entries(groupedSuppliersMap).map(([ownerName, groupedSuppliers]) => {
                
                // Calculate item data for each supplier in the group
                const supplierItems: SupplierItemData[] = (groupedSuppliers as SupplierEntity[]).map(supplier => {
                    const supplierInvoices = invoices.filter(i => i.supplierId === supplier.id);
                    
                    const totalInvoiced = supplierInvoices.reduce((sum, i) => sum + i.amount, 0);
                    
                    const linkedStoreIds = Array.from(new Set([
                        ...supplierInvoices.map(i => i.storeId),
                    ]));
                    
                    const linkedStores = linkedStoreIds.map(id => {
                        const st = stores.find(s => s.id === id);
                        return st ? { name: st.storeName, companyName: st.companyName } : { name: '未知店铺', companyName: '未知公司' };
                    });
                    
                    // Group invoices by store for tooltip
                    const invoiceDetails: Record<string, {date: string, amount: number}[]> = {};
                    supplierInvoices.forEach(inv => {
                        const st = stores.find(s => s.id === inv.storeId);
                        const stName = st?.storeName || '未知店铺';
                        if (!invoiceDetails[stName]) invoiceDetails[stName] = [];
                        invoiceDetails[stName].push({ date: inv.date, amount: inv.amount });
                    });

                    return {
                      entity: supplier,
                      stats: { totalPaid: 0, totalInvoiced }, // Paid is now tracked at factory level
                      linkedStores: linkedStores,
                      invoiceDetails
                    };
                });
                
                const factoryPayments = payments.filter(p => {
                    // Match payments recorded against the factory owner directly
                    if (p.factoryOwner === ownerName) return true;
                    // Also match legacy/mock payments where supplierId belongs to one of this owner's entities
                    if (p.supplierId) {
                        const sup = suppliers.find(s => s.id === p.supplierId);
                        return sup && sup.owner === ownerName;
                    }
                    return false;
                });
                
                const totalFactoryPaid = factoryPayments.reduce((sum, p) => sum + p.amount, 0);
                
                const paymentDetails = factoryPayments.map(p => ({
                    date: p.date,
                    amount: p.amount
                })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                
                if (supplierItems.length > 0) {
                    supplierItems[0].stats.totalPaid = totalFactoryPaid;
                }

                return (
                  <SupplierRow 
                    key={ownerName}
                    ownerName={ownerName}
                    items={supplierItems}
                    paymentDetails={paymentDetails}
                    onAddInvoice={(id) => {
                        setTransaction({ storeId: '', supplierId: id, amount: '', date: new Date().toISOString().split('T')[0] });
                        setActiveModal('addInvoice');
                    }}
                    onDeleteOwner={handleDeleteOwner}
                    onDeleteEntity={handleDeleteEntity}
                  />
                );
             })}
          </div>
        )}

        {/* CHAT VIEW */}
        {currentView === 'chat' && (
          <div className="max-w-4xl mx-auto">
             <div className="mb-6 bg-blue-50 border border-blue-100 p-4 rounded-lg flex gap-3">
                <div className="bg-blue-100 text-blue-600 p-2 rounded-lg h-fit">
                   <Bot size={20} />
                </div>
                <div>
                   <h4 className="font-bold text-blue-900">专家模式</h4>
                   <p className="text-sm text-blue-700 mt-1">
                     您可以询问复杂的问题，例如“我应该如何在安吉新昌和义乌起泛之间分配40万的发票金额？”或者“如果再增加2家个体户，能节省多少税？”
                   </p>
                </div>
             </div>
             <AiChat />
          </div>
        )}

        {/* ADMIN VIEW */}
        {currentView === 'admin' && (
            <div className="max-w-4xl mx-auto space-y-8 relative">
                {/* 浮窗翻页导航 */}
                <div 
                    id="floating-nav"
                    className="fixed z-50 bg-white shadow-lg border border-slate-200 rounded-lg"
                    style={{
                        top: '80px',
                        left: '0px'
                    }}
                >
                    <button 
                        onClick={() => {
                            document.getElementById('quarter-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            setActiveSection('quarter-management');
                        }}
                        className={`flex items-center gap-3 px-4 py-3 w-full hover:bg-slate-100 transition-colors ${
                            activeSection === 'quarter-management' 
                                ? 'bg-indigo-50 text-indigo-600 border-l-2 border-indigo-600' 
                                : 'text-slate-600 hover:text-slate-800'
                        }`}
                        title="季度管理"
                    >
                        <Calendar size={18} />
                        <span className="text-sm font-medium whitespace-nowrap">季度管理</span>
                    </button>
                    <button 
                        onClick={() => {
                            document.getElementById('store-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            setActiveSection('store-management');
                        }}
                        className={`flex items-center gap-3 px-4 py-3 w-full hover:bg-slate-100 transition-colors ${
                            activeSection === 'store-management' 
                                ? 'bg-indigo-50 text-indigo-600 border-l-2 border-indigo-600' 
                                : 'text-slate-600 hover:text-slate-800'
                        }`}
                        title="店铺管理"
                    >
                        <Store size={18} />
                        <span className="text-sm font-medium whitespace-nowrap">店铺管理</span>
                    </button>
                    <button 
                        onClick={() => {
                            document.getElementById('factory-management')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            setActiveSection('factory-management');
                        }}
                        className={`flex items-center gap-3 px-4 py-3 w-full hover:bg-slate-100 transition-colors ${
                            activeSection === 'factory-management' 
                                ? 'bg-indigo-50 text-indigo-600 border-l-2 border-indigo-600' 
                                : 'text-slate-600 hover:text-slate-800'
                        }`}
                        title="工厂管理"
                    >
                        <Users size={18} />
                        <span className="text-sm font-medium whitespace-nowrap">工厂管理</span>
                    </button>
                    <button 
                        onClick={() => {
                            document.getElementById('invoice-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            setActiveSection('invoice-records');
                        }}
                        className={`flex items-center gap-3 px-4 py-3 w-full hover:bg-slate-100 transition-colors ${
                            activeSection === 'invoice-records' 
                                ? 'bg-indigo-50 text-indigo-600 border-l-2 border-indigo-600' 
                                : 'text-slate-600 hover:text-slate-800'
                        }`}
                        title="开票记录"
                    >
                        <FileText size={18} />
                        <span className="text-sm font-medium whitespace-nowrap">开票记录</span>
                    </button>
                    <button 
                        onClick={() => {
                            document.getElementById('payment-records')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            setActiveSection('payment-records');
                        }}
                        className={`flex items-center gap-3 px-4 py-3 w-full hover:bg-slate-100 transition-colors ${
                            activeSection === 'payment-records' 
                                ? 'bg-indigo-50 text-indigo-600 border-l-2 border-indigo-600' 
                                : 'text-slate-600 hover:text-slate-800'
                        }`}
                        title="货款记录"
                    >
                        <CreditCard size={18} />
                        <span className="text-sm font-medium whitespace-nowrap">货款记录</span>
                    </button>
                </div>
                {/* Quarter Management Section */}
                <div id="quarter-management" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Calendar size={20} /> 季度管理
                    </h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <span className="text-sm font-medium text-slate-700">当前季度：</span>
                            <span className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-800">
                                {currentQuarter}
                            </span>
                        </div>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => {
                                    if (confirm(`确认开始新季度？\n\n注意：开始新季度将清零所有店铺收入、工厂货款和开票数据，但会保留基础设置。`)) {
                                        handleStartNewQuarter();
                                    }
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                开始新季度
                            </button>

                            <button 
                                onClick={() => setActiveModal('quarterManagement')}
                                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors border border-slate-200"
                            >
                                季度历史记录
                            </button>
                            <button 
                                onClick={handleExportData}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                            >
                                备份数据
                            </button>
                            <label className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer">
                                恢复数据
                                <input 
                                    type="file" 
                                    accept=".json" 
                                    onChange={handleImportData}
                                    className="hidden"
                                />
                            </label>

                        </div>
                        <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded border border-slate-100">
                            <p className="font-medium mb-1">季度管理说明：</p>
                            <ul className="space-y-1 list-disc list-inside">
                                <li>开始新季度会清零所有收入、货款和开票数据</li>
                                <li>店铺、工厂等基础设置会被保留</li>
                                <li>建议在每个季度开始时备份重要数据</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div id="store-management" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Store size={20} /> 店铺管理
                            </h3>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="搜索店铺或公司"
                                    value={storeSearchTerm}
                                    onChange={(e) => setStoreSearchTerm(e.target.value)}
                                    className="w-64 pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-2.5 text-slate-400">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.3-4.3"></path>
                                </svg>
                                {storeSearchTerm && (
                                    <button
                                        onClick={() => setStoreSearchTerm('')}
                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {storeSearchTerm && (
                                <div className="text-xs text-slate-500">
                                    找到 {filteredStores.length} 个结果
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleOpenAddStore} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                                <Plus size={18}/> 添加店铺
                            </button>
                            <button 
                                onClick={() => {
                                    if (stores.length === 0) {
                                        alert('没有店铺数据可导出');
                                        return;
                                    }
                                    handleExportStores();
                                }}
                                className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors"
                            >
                                <Download size={18}/> 导出数据
                            </button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3">店铺</th>
                                    <th className="px-4 py-3">公司名称</th>
                                    <th className="px-4 py-3">纳税人类型</th>
                                    <th className="px-4 py-3">季度收入</th>
                                    <th className="px-4 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedStores.map(store => (
                                    <tr key={store.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-medium text-slate-900">{store.storeName}</td>
                                        <td className="px-4 py-3 text-slate-500">{store.companyName}</td>
                                        <td className="px-4 py-3 text-slate-500">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                store.taxType === StoreTaxType.GENERAL 
                                                    ? 'bg-blue-100 text-blue-700' 
                                                    : 'bg-green-100 text-green-700'
                                            }`}>
                                                {store.taxType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-700 font-medium">¥{store.quarterIncome.toLocaleString()}</td>
                                        <td className="px-4 py-3 text-right flex gap-2 justify-end">
                                            <button onClick={() => handleEditExpenses(store)} className="text-green-600 hover:text-green-800 text-xs font-medium bg-green-50 px-2 py-1 rounded">支出设置</button>
                                            <button onClick={() => handleOpenEditStore(store)} className="text-indigo-600 hover:text-indigo-800 text-xs font-medium bg-indigo-50 px-2 py-1 rounded">基本信息</button>
                                            <button onClick={() => { if(confirm('确认删除此店铺？\n\n注意：这将同时删除与该店铺相关的所有发票记录！')) handleDeleteStore(store.id); }} className="text-red-600 hover:text-red-800 text-xs font-medium bg-red-50 px-2 py-1 rounded">删除</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* 分页控件 */}
                    {storeTotalPages > 1 && (
                        <div className="flex justify-between items-center mt-4">
                            <div className="text-sm text-slate-500">
                                显示 {storeStartIndex + 1} 到 {Math.min(storeEndIndex, filteredStores.length)} 条，共 {filteredStores.length} 条
                            </div>
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={() => setStoreCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={storeCurrentPage === 1}
                                    className="px-3 py-1 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    上一页
                                </button>
                                
                                {/* 页码按钮 */}
                                {Array.from({ length: storeTotalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setStoreCurrentPage(page)}
                                        className={`px-3 py-1 rounded-md text-sm font-medium ${storeCurrentPage === page ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                
                                <button
                                    onClick={() => setStoreCurrentPage(prev => Math.min(storeTotalPages, prev + 1))}
                                    disabled={storeCurrentPage === storeTotalPages}
                                    className="px-3 py-1 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {filteredStores.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            <Store size={32} className="mx-auto mb-2 text-slate-300"/>
                            <p>暂无店铺数据</p>
                            <p className="text-sm">点击下方按钮添加第一个店铺</p>
                        </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                        <div className="text-sm text-slate-500">
                            {storeSearchTerm ? `搜索到 ${filteredStores.length} 个店铺` : `共 ${stores.length} 个店铺`}
                        </div>
                    </div>
                </div>

                <div id="factory-management" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Users size={20} /> 工厂管理
                            </h3>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="搜索工厂或开票主体..."
                                    value={supplierSearchTerm}
                                    onChange={(e) => setSupplierSearchTerm(e.target.value)}
                                    className="w-64 pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-2.5 text-slate-400">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.3-4.3"></path>
                                </svg>
                                {supplierSearchTerm && (
                                    <button
                                        onClick={() => setSupplierSearchTerm('')}
                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {supplierSearchTerm && (
                                <div className="text-xs text-slate-500">
                                    找到 {filteredSuppliers.length} 个结果
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleOpenAddSupplier} className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700">
                                <Plus size={18}/> 添加新工厂
                            </button>
                        </div>
                    </div>
                    <div className="space-y-6">
                        {factoryOwners.length === 0 && (
                            <div className="text-center py-8 text-slate-500">
                                <Users size={32} className="mx-auto mb-2 text-slate-300"/>
                                <p>暂无工厂数据</p>
                                <p className="text-sm">点击下方按钮添加第一个工厂</p>
                            </div>
                        )}
                        {factoryOwners.map(owner => {
                            const entities = filteredSuppliers.filter(s => s.owner === owner);
                            const shouldShowFactory = entities.length > 0 || !supplierSearchTerm;
                            
                            if (!shouldShowFactory) return null;
                            
                            return (
                                <div key={owner} className="border border-slate-200 rounded-lg p-4">
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        {/* 左侧：工厂信息和操作按钮 */}
                                        <div className="md:col-span-1">
                                            {/* 工厂名称 */}
                                            <h4 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
                                                <Building2 size={16} className="text-slate-400"/>
                                                {owner}
                                            </h4>
                                            
                                            {/* 操作按钮 */}
                                            <div className="flex gap-2">
                                                <button onClick={() => handleOpenRenameOwner(owner)} className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded border border-blue-100 backdrop-blur-sm bg-white/80 hover:bg-white/90 transition-all">编辑</button>
                                                <button onClick={() => { if(confirm('确认删除该工厂？\n\n注意：这将保留该工厂下的所有开票主体！')) handleDeleteOwner(owner); }} className="text-xs text-red-600 hover:bg-red-50 px-2 py-1 rounded border border-red-100 backdrop-blur-sm bg-white/80 hover:bg-white/90 transition-all">删除</button>
                                            </div>
                                        </div>
                                        
                                        {/* 右侧：工厂拥有的主体公司 */}
                                        <div className="md:col-span-3 space-y-2">
                                            <div className="flex justify-between items-center mb-2">
                                                <h5 className="text-sm font-medium text-slate-600">开票主体</h5>
                                                <button onClick={() => { setIsNewFactory(false); setSupplierForm({...supplierForm, owner: owner, name: '', type: EntityType.INDIVIDUAL, limit: 280000}); setActiveModal('addSupplier'); }} className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1">
                                                    <Plus size={12}/> 添加新主体
                                                </button>
                                            </div>
                                            
                                            {entities.length === 0 ? (
                                                <div className="text-sm text-slate-500 text-center py-4 bg-slate-50 rounded-lg">
                                                    该工厂暂无开票主体
                                                </div>
                                            ) : (
                                                entities.map(entity => (
                                                    <div key={entity.id} className="flex justify-between items-center text-sm bg-slate-50 p-2 rounded hover:bg-slate-100 transition-colors">
                                                        <div>
                                                            <span className="font-medium text-slate-700">{entity.name}</span>
                                                            <span className="text-xs text-slate-500 ml-2">({entity.type})</span>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleOpenEditEntity(entity)} className="text-blue-600 hover:text-blue-800 text-xs">编辑</button>
                                                            <button onClick={() => { if(confirm('确认删除此主体？\n\n注意：这将同时删除与该主体相关的所有开票和付款记录！')) handleDeleteEntity(entity.id); }} className="text-red-600 hover:text-red-800 text-xs">删除</button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <div className="text-sm text-slate-500 text-center">
                            {supplierSearchTerm ? `搜索到 ${filteredSuppliers.length} 个工厂，${Object.keys(filteredGroupedSuppliersMap).length} 个开票主体` : `共 ${factoryOwners.length} 个工厂，${suppliers.length} 个开票主体`}
                        </div>
                    </div>
                </div>

                <div id="invoice-records" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <FileText size={20} /> 开票记录
                            </h3>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="店铺、工厂、开票主体或金额"
                                    value={invoiceSearchTerm}
                                    onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                                    className="w-64 pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-2.5 text-slate-400">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.3-4.3"></path>
                                </svg>
                                {invoiceSearchTerm && (
                                    <button
                                        onClick={() => setInvoiceSearchTerm('')}
                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {invoiceSearchTerm && (
                                <div className="text-xs text-slate-500">
                                    找到 {filteredInvoices.length} 个结果
                                </div>
                            )}
                        </div>
                        <div className="text-sm text-slate-500">
                            共 {invoices.length} 条记录
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3">开票日期</th>
                                    <th className="px-4 py-3">店铺名称</th>
                                    <th className="px-4 py-3">工厂-主体</th>
                                    <th className="px-4 py-3">金额</th>
                                    <th className="px-4 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {adminPaginatedInvoices.map(invoice => {
                                    const store = stores.find(s => s.id === invoice.storeId);
                                    const supplier = suppliers.find(s => s.id === invoice.supplierId);
                                    const factoryOwner = supplier?.owner || '未知工厂';
                                    const supplierName = supplier?.name || '未知主体';
                                    
                                    return (
                                        <tr key={invoice.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-900">{invoice.date}</td>
                                            <td className="px-4 py-3 text-slate-700">{store?.storeName || '未知店铺'}-{store?.companyName || '未知公司'}</td>
                                            <td className="px-4 py-3 text-slate-700">
                                                <div className="font-medium">{factoryOwner}</div>
                                                <div className="text-xs text-slate-500">{supplierName}</div>
                                            </td>
                                            <td className="px-4 py-3 text-slate-700 font-medium">¥{invoice.amount.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button 
                                                    onClick={() => handleDeleteInvoiceRecord(invoice.id)}
                                                    className="text-red-600 hover:text-red-800 text-xs font-medium bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors"
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
                    
                    {/* 分页控件 */}
                    {adminInvoiceTotalPages > 1 && (
                        <div className="flex justify-between items-center mt-4">
                            <div className="text-sm text-slate-500">
                                显示 {adminInvoiceStartIndex + 1} 到 {Math.min(adminInvoiceEndIndex, filteredInvoices.length)} 条，共 {filteredInvoices.length} 条
                            </div>
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={() => setAdminInvoiceCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={adminInvoiceCurrentPage === 1}
                                    className="px-3 py-1 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    上一页
                                </button>
                                
                                {/* 页码按钮 */}
                                {Array.from({ length: adminInvoiceTotalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setAdminInvoiceCurrentPage(page)}
                                        className={`px-3 py-1 rounded-md text-sm font-medium ${adminInvoiceCurrentPage === page ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                
                                <button
                                    onClick={() => setAdminInvoiceCurrentPage(prev => Math.min(adminInvoiceTotalPages, prev + 1))}
                                    disabled={adminInvoiceCurrentPage === adminInvoiceTotalPages}
                                    className="px-3 py-1 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {filteredInvoices.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            <FileText size={32} className="mx-auto mb-2 text-slate-300"/>
                            <p>暂无开票记录</p>
                            <p className="text-sm">请在店铺管理页面发起开票</p>
                        </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                        <div className="text-sm text-slate-500">
                            {invoiceSearchTerm ? `搜索到 ${filteredInvoices.length} 条记录` : `共 ${invoices.length} 条记录`}
                        </div>
                        <div className="text-sm text-slate-500">
                            总金额: ¥{filteredInvoices.reduce((sum, invoice) => sum + invoice.amount, 0).toLocaleString()}
                        </div>
                    </div>
                </div>

                <div id="payment-records" className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <CreditCard size={20} /> 货款记录
                            </h3>
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="工厂、金额或日期"
                                    value={paymentSearchTerm}
                                    onChange={(e) => setPaymentSearchTerm(e.target.value)}
                                    className="w-64 pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3 top-2.5 text-slate-400">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <path d="m21 21-4.3-4.3"></path>
                                </svg>
                                {paymentSearchTerm && (
                                    <button
                                        onClick={() => setPaymentSearchTerm('')}
                                        className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </button>
                                )}
                            </div>
                            {paymentSearchTerm && (
                                <div className="text-xs text-slate-500">
                                    找到 {filteredPayments.length} 个结果
                                </div>
                            )}
                        </div>
                        <div className="text-sm text-slate-500">
                            共 {payments.length} 条记录
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                                <tr>
                                    <th className="px-4 py-3">支付日期</th>
                                    <th className="px-4 py-3">工厂</th>
                                    <th className="px-4 py-3">金额</th>
                                    <th className="px-4 py-3 text-right">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginatedPayments.map(payment => {
                                    return (
                                        <tr key={payment.id} className="hover:bg-slate-50">
                                            <td className="px-4 py-3 font-medium text-slate-900">{payment.date}</td>
                                            <td className="px-4 py-3 text-slate-700">{payment.factoryOwner || '未知工厂'}</td>
                                            <td className="px-4 py-3 text-slate-700 font-medium">¥{payment.amount.toLocaleString()}</td>
                                            <td className="px-4 py-3 text-right">
                                                <button 
                                                    onClick={() => handleDeletePaymentRecord(payment.id)}
                                                    className="text-red-600 hover:text-red-800 text-xs font-medium bg-red-50 px-2 py-1 rounded hover:bg-red-100 transition-colors"
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
                    
                    {/* 分页控件 */}
                    {paymentTotalPages > 1 && (
                        <div className="flex justify-between items-center mt-4">
                            <div className="text-sm text-slate-500">
                                显示 {paymentStartIndex + 1} 到 {Math.min(paymentEndIndex, filteredPayments.length)} 条，共 {filteredPayments.length} 条
                            </div>
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={() => setPaymentCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={paymentCurrentPage === 1}
                                    className="px-3 py-1 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    上一页
                                </button>
                                
                                {/* 页码按钮 */}
                                {Array.from({ length: paymentTotalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setPaymentCurrentPage(page)}
                                        className={`px-3 py-1 rounded-md text-sm font-medium ${paymentCurrentPage === page ? 'bg-indigo-600 text-white' : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                
                                <button
                                    onClick={() => setPaymentCurrentPage(prev => Math.min(paymentTotalPages, prev + 1))}
                                    disabled={paymentCurrentPage === paymentTotalPages}
                                    className="px-3 py-1 rounded-md border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    下一页
                                </button>
                            </div>
                        </div>
                    )}
                    
                    {filteredPayments.length === 0 && (
                        <div className="text-center py-8 text-slate-500">
                            <CreditCard size={32} className="mx-auto mb-2 text-slate-300"/>
                            <p>暂无支付货款记录</p>
                            <p className="text-sm">请在店铺管理页面发起支付</p>
                        </div>
                    )}
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                        <div className="text-sm text-slate-500">
                            {paymentSearchTerm ? `搜索到 ${filteredPayments.length} 条记录` : `共 ${payments.length} 条记录`}
                        </div>
                        <div className="text-sm text-slate-500">
                            总金额: ¥{filteredPayments.reduce((sum, payment) => sum + payment.amount, 0).toLocaleString()}
                        </div>
                    </div>
                </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;