import React, { useState } from 'react';
import { StoreCompany, InvoiceRecord, PaymentRecord, SupplierEntity } from '../types';
import { Building2, AlertTriangle, FilePlus, ChevronDown, AlertCircle, CheckCircle2, PenLine, Trash2, Settings, Calculator } from 'lucide-react';

interface Props {
  store: StoreCompany;
  invoices: InvoiceRecord[];
  payments: PaymentRecord[];
  suppliers: SupplierEntity[];
  totalInvoiced: number;
  onEditExpenses: () => void;
  onRequestInvoice: (storeId: string) => void;
  onEditStore: (store: StoreCompany) => void;
  onDeleteStore: (storeId: string) => void;
}

const StoreCard: React.FC<Props> = ({ 
  store, 
  invoices, 
  payments, 
  suppliers, 
  totalInvoiced, 
  onEditExpenses, 
  onRequestInvoice,
  onEditStore,
  onDeleteStore
}) => {
  const [expanded, setExpanded] = useState(false);
  const profitBeforeTax = store.quarterIncome - store.quarterExpenses - totalInvoiced;
  const isHighRisk = profitBeforeTax > 500000;
  const borderColor = isHighRisk ? 'border-red-200' : 'border-gray-200';

  // Group by factory owner (merging different entities under same owner)
  const factoryStats: Record<string, { paid: number, invoiced: number, name: string }> = {};

  const getOwnerName = (supplierId: string) => {
      const s = suppliers.find(sup => sup.id === supplierId);
      return s ? s.owner : '未知工厂';
  };
  
  // Aggregate payments
  payments.forEach(p => {
    let ownerName = '未知工厂';
    // Prioritize factoryOwner if explicit, else derive from supplierId
    if (p.factoryOwner) {
        ownerName = p.factoryOwner;
    } else if (p.supplierId) {
        ownerName = getOwnerName(p.supplierId);
    }

    if (!factoryStats[ownerName]) {
      factoryStats[ownerName] = { paid: 0, invoiced: 0, name: ownerName };
    }
    factoryStats[ownerName].paid += p.amount;
  });

  // Aggregate invoices
  invoices.forEach(i => {
    const ownerName = getOwnerName(i.supplierId);
    if (!factoryStats[ownerName]) {
      factoryStats[ownerName] = { paid: 0, invoiced: 0, name: ownerName };
    }
    factoryStats[ownerName].invoiced += i.amount;
  });

  const factoryList = Object.entries(factoryStats);
  
  // Calculate potential risks
  const discrepancies = factoryList.filter(([_, stats]) => Math.abs(stats.paid - stats.invoiced) > 1);
  const totalMissingInvoice = factoryList.reduce((acc, [_, stats]) => acc + Math.max(0, stats.paid - stats.invoiced), 0);
  const hasDiscrepancies = discrepancies.length > 0;

  // --- Tax Calculation Logic ---
  let estimatedVat = 0;
  let estimatedSurtax = 0;
  let estimatedIncomeTax = 0;
  let taxProfit = 0;

  // Rates
  const GENERAL_VAT_RATE = 0.13; // 13% for trading
  const SMALL_VAT_RATE = 0.01;   // 1% current policy for small scale
  const INPUT_VAT_RATE = 0.01;   // Assuming Getihu invoices are 1% or 3%. Using 1% conservatively.
  const SURTAX_RATE_GENERAL = 0.12; 
  const SURTAX_RATE_SMALL = 0.06; // Often halved

  if (store.taxType === '一般纳税人') {
    // 1. VAT
    const outputVat = (store.quarterIncome / (1 + GENERAL_VAT_RATE)) * GENERAL_VAT_RATE;
    const inputVat = (totalInvoiced / (1 + INPUT_VAT_RATE)) * INPUT_VAT_RATE;
    estimatedVat = Math.max(0, outputVat - inputVat);
    
    // 2. Surtax
    estimatedSurtax = estimatedVat * SURTAX_RATE_GENERAL;

    // 3. Income Tax
    const exTaxIncome = store.quarterIncome / (1 + GENERAL_VAT_RATE);
    // Simplifying assumption: Expenses are mixed, but let's assume raw deduction for estimation
    // In strict accounting, costs should also be ex-tax.
    const exTaxCosts = store.quarterExpenses; 
    const exTaxInvoiced = totalInvoiced / (1 + INPUT_VAT_RATE);
    taxProfit = exTaxIncome - exTaxCosts - exTaxInvoiced;

  } else {
    // Small Scale
    // 1. VAT
    estimatedVat = (store.quarterIncome / (1 + SMALL_VAT_RATE)) * SMALL_VAT_RATE;
    
    // 2. Surtax
    estimatedSurtax = estimatedVat * SURTAX_RATE_SMALL;

    // 3. Income Tax
    taxProfit = store.quarterIncome - store.quarterExpenses - totalInvoiced;
  }

  // Corporate Income Tax Rules (Small Low-Profit Enterprise Policies)
  // < 1M: 2.5% effective (historically changed often, sticking to ~5% for SME estimation range)
  // 1M - 3M: 5% effective
  // > 3M: 25% standard
  if (taxProfit > 0) {
      if (taxProfit <= 3000000) {
          estimatedIncomeTax = taxProfit * 0.05; 
      } else {
          estimatedIncomeTax = taxProfit * 0.25;
      }
  } else {
      estimatedIncomeTax = 0;
  }

  const totalEstimatedTax = estimatedVat + estimatedSurtax + estimatedIncomeTax;


  return (
    <div 
      className={`bg-white rounded-xl shadow-sm border ${borderColor} flex flex-col hover:shadow-md transition-shadow relative group/card h-fit ${expanded ? 'z-50' : 'hover:z-10'}`}
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Risk Indicator Strip */}
      {isHighRisk && <div className="absolute top-0 left-0 w-1 h-full bg-red-400 rounded-l-xl"></div>}
      
      {/* Action Buttons (Visible on Hover) */}
      <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); onEditStore(store); }}
          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
          title="编辑店铺信息"
        >
          <Settings size={16} />
        </button>
        {/* 删除功能已移至管理员设置模块 */}
      </div>
      
      <div className="p-6 pb-4 pl-7">
        <div className="flex justify-between items-start mb-4 pr-12">
          <div>
            <h3 className="text-lg font-bold text-gray-800">{store.storeName}</h3>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <Building2 size={14} className="text-gray-400" /> {store.companyName}
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ml-1 ${store.taxType === '一般纳税人' ? 'bg-blue-100 text-blue-600 border-blue-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  {store.taxType}
              </span>
            </p>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${isHighRisk ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-green-100 text-green-600 border border-green-200'}`}>
            {isHighRisk ? '急需进项票' : '状态良好'}
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">季度回款(收入)</span>
            <span className="font-medium text-gray-800">¥{store.quarterIncome.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm group relative">
            <span className="text-gray-500 flex items-center gap-1">
                各项支出(成本)
                <button 
                  onClick={(e) => { e.stopPropagation(); onEditExpenses(); }}
                  className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-100 rounded"
                  title="编辑支出明细"
                >
                  <PenLine size={12} />
                </button>
            </span>
            <span className="font-medium text-gray-800 cursor-help" title="点击展开查看明细" onClick={() => setExpanded(!expanded)}>
                ¥{store.quarterExpenses.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">已收发票金额</span>
            <span className="font-medium text-blue-600">¥{totalInvoiced.toLocaleString()}</span>
          </div>
          
          <div className="h-px bg-gray-200 my-2"></div>
        </div>
        
        {/* Estimated Profit Display */}
        <div className="mt-1 flex justify-between items-center px-1">
             <span className="text-xs font-semibold text-gray-500">预计利润</span>
             <span className={`text-sm font-bold ${taxProfit > 0 ? 'text-gray-800' : 'text-gray-400'}`}>
                ¥{taxProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </span>
        </div>
        
        {/* Tax Estimation Section */}
        <div className="mt-2 bg-indigo-50 p-3 rounded-lg border border-indigo-200 flex justify-between items-center relative group/tax cursor-help">
            <div className="flex items-center gap-2">
                <div className="bg-indigo-100 text-indigo-600 p-1 rounded">
                    <Calculator size={14} />
                </div>
                <span className="text-sm font-semibold text-indigo-700">预计应纳税额</span>
            </div>
            <span className="text-lg font-bold text-indigo-600">¥{totalEstimatedTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            
            {/* Hover Tooltip - Positioned ABOVE with Frosted Glass Effect */}
            <div className="absolute bottom-full left-0 mb-2 w-full bg-gray-800 shadow-xl border border-gray-600 rounded-lg p-4 hidden group-hover/tax:block z-20 animate-in fade-in slide-in-from-bottom-2">
               <h5 className="text-xs font-bold text-gray-100 uppercase mb-2 border-b border-gray-600 pb-2">税额明细 ({store.taxType})</h5>
               <div className="space-y-2 text-xs">
                   <div className="flex justify-between items-center">
                       <span className="text-gray-300">增值税 ({store.taxType === '一般纳税人' ? '13%' : '1%'})</span>
                       <span className="font-medium text-gray-100">¥{estimatedVat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
                   <div className="flex justify-between items-center">
                       <span className="text-gray-300">附加税 (12%/6%)</span>
                       <span className="font-medium text-gray-100">¥{estimatedSurtax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
                   <div className="flex justify-between items-center pt-2 border-t border-gray-600 border-dashed">
                       <span className="text-gray-300">企业所得税 (预估)</span>
                       <span className="font-medium text-gray-100">¥{estimatedIncomeTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                   </div>
               </div>
            </div>
        </div>

        {/* Pending Deduction Gap (Moved Below Tax) */}
        <div className="mt-4 flex justify-between items-center pt-3 border-t border-gray-200 border-dashed">
          <span className="text-sm font-semibold text-gray-600">待抵扣缺口</span>
          <span className={`text-lg font-bold ${profitBeforeTax > 0 ? 'text-red-600' : 'text-green-600'}`}>
            ¥{profitBeforeTax.toLocaleString()}
          </span>
        </div>

        {/* Summary Warning for Collapsed View */}
        {!expanded && hasDiscrepancies && (
             <div className="mt-3 flex items-center gap-2 text-xs text-orange-600 bg-orange-100 px-3 py-2 rounded-lg border border-orange-200">
                <AlertCircle size={14} />
                <span>
                   {discrepancies.length} 个工厂存在款票差异
                   {totalMissingInvoice > 0 && `，缺票 ¥${totalMissingInvoice.toLocaleString()}`}
                </span>
             </div>
        )}
      </div>

      {/* Action Footer */}
      <div className={`bg-gray-50 border-t border-gray-200 p-3 pl-7 flex justify-between items-center transition-all ${expanded ? 'rounded-b-none' : 'rounded-b-xl'}`}>
        {!expanded ? (
          <button 
            onClick={() => setExpanded(true)}
            onMouseEnter={() => setExpanded(true)}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 font-medium"
          >
            查看成本与工厂开票明细
            <ChevronDown size={14}/>
          </button>
        ) : (
          <span className="text-xs text-gray-400 font-medium">明细已展开</span>
        )}
        <button 
          onClick={() => onRequestInvoice(store.id)}
          className="flex items-center gap-1 text-sm bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <FilePlus size={14} /> 发起开票
        </button>
      </div>

      {/* Expanded Details - Absolute Positioned to overlay content below */}
      {expanded && (
        <div className={`absolute top-full -left-[1px] -right-[1px] bg-white border-x border-b ${borderColor} rounded-b-xl shadow-xl p-4 pl-7 z-50`}>
          
          {/* Cost Breakdown Section */}
          <div className="mb-6">
             <div className="flex justify-between items-center mb-3">
                 <h4 className="text-xs font-semibold text-gray-600 uppercase">成本支出明细</h4>
             </div>
             {store.expenseBreakdown ? (
                 <div className="grid grid-cols-2 gap-2 text-xs text-gray-700">
                    <div className="flex justify-between bg-gray-50 px-2 py-1 rounded border border-gray-200">
                        <span>运费</span> <span>¥{store.expenseBreakdown.shipping.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between bg-gray-50 px-2 py-1 rounded border border-gray-200">
                        <span>推广费</span> <span>¥{store.expenseBreakdown.promotion.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between bg-gray-50 px-2 py-1 rounded border border-gray-200">
                        <span>人员工资</span> <span>¥{store.expenseBreakdown.salaries.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between bg-gray-50 px-2 py-1 rounded border border-gray-200">
                        <span>房租水电</span> <span>¥{store.expenseBreakdown.rent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between bg-gray-50 px-2 py-1 rounded border border-gray-200">
                        <span>办公费用</span> <span>¥{store.expenseBreakdown.office.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between bg-gray-50 px-2 py-1 rounded border border-gray-200">
                        <span>油费</span> <span>¥{store.expenseBreakdown.fuel.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between bg-gray-50 px-2 py-1 rounded border border-gray-200 col-span-2">
                        <span>其他杂费</span> <span>¥{store.expenseBreakdown.other.toLocaleString()}</span>
                    </div>
                 </div>
             ) : (
                 <div className="text-xs text-gray-400 italic bg-gray-50 p-2 rounded border border-gray-200 text-center">
                    暂无详细成本记录
                 </div>
             )}
          </div>

          <div className="flex justify-between items-center mb-3">
             <h4 className="text-xs font-semibold text-gray-600 uppercase">工厂往来明细</h4>
             <div className="text-[10px] text-gray-400">
                共 {factoryList.length} 家工厂
             </div>
          </div>
          
          {factoryList.length === 0 ? (
            <p className="text-sm text-gray-400 italic py-2">暂无往来记录</p>
          ) : (
            <div className="space-y-3">
              {factoryList.map(([ownerName, stats]) => {
                const diff = stats.paid - stats.invoiced;
                const missingInvoice = diff > 0;
                const surplusInvoice = diff < 0; // Negative diff means Invoiced > Paid
                
                return (
                  <div key={ownerName} className="bg-gray-50 border border-gray-200 p-2.5 rounded-lg text-sm shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                        <div className="font-bold text-gray-700 text-xs flex items-center gap-2">
                             <Building2 size={12} className="text-gray-400"/>
                             {stats.name}
                        </div>
                        {Math.abs(diff) < 1 && (
                            <CheckCircle2 size={14} className="text-green-500" />
                        )}
                    </div>
                    
                    <div className="flex items-center text-xs bg-white rounded border border-gray-200 p-2">
                         <div className="flex-1 flex justify-between items-center">
                            <span className="text-gray-500">已付货款</span>
                            <span className="font-medium text-gray-700">¥{stats.paid.toLocaleString()}</span>
                         </div>
                         <div className="w-px h-3 bg-gray-300 mx-2"></div>
                         <div className="flex-1 flex justify-between items-center">
                            <span className="text-gray-500">已开发票</span>
                            <span className={`font-medium ${missingInvoice ? 'text-red-600' : 'text-gray-700'}`}>
                               ¥{stats.invoiced.toLocaleString()}
                            </span>
                         </div>
                    </div>
                    
                    {missingInvoice && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-red-600 bg-red-100 p-2 rounded border border-red-200">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        <span>缺票: <strong>¥{diff.toLocaleString()}</strong></span>
                      </div>
                    )}

                    {surplusInvoice && (
                      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-blue-600 bg-blue-100 p-2 rounded border border-blue-200">
                        <AlertCircle size={14} className="flex-shrink-0" />
                        <span>多开: <strong>¥{Math.abs(diff).toLocaleString()}</strong></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StoreCard;