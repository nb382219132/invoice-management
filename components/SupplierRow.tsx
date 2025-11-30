import React from 'react';
import { SupplierEntity } from '../types';
import { AlertTriangle, AlertOctagon, PlusCircle, Building2, User, History, Trash2, PenLine } from 'lucide-react';

interface SupplierStats {
  totalPaid: number;
  totalInvoiced: number;
}

export interface SupplierItemData {
  entity: SupplierEntity;
  stats: SupplierStats;
  linkedStores: { name: string; companyName: string }[];
  invoiceDetails?: Record<string, { date: string; amount: number }[]>;
}

export interface PaymentDetail {
  date: string;
  amount: number;
}

interface Props {
  ownerName: string;
  items: SupplierItemData[];
  paymentDetails?: PaymentDetail[];
  onAddInvoice: (supplierId: string) => void;
  onDeleteOwner: (ownerName: string) => void;
  onDeleteEntity: (entityId: string) => void;
}

const SupplierRow: React.FC<Props> = ({ 
  ownerName, 
  items, 
  paymentDetails, 
  onAddInvoice,
  onDeleteOwner,
  onDeleteEntity
}) => {
  // Aggregate totals for the whole factory (owner)
  const factoryTotalPaid = paymentDetails 
    ? paymentDetails.reduce((sum, p) => sum + p.amount, 0)
    : items.reduce((sum, item) => sum + item.stats.totalPaid, 0);
    
  const factoryTotalInvoiced = items.reduce((sum, item) => sum + item.stats.totalInvoiced, 0);
  const factoryTotalLimit = items.reduce((sum, item) => sum + item.entity.quarterlyLimit, 0);
  
  // Calculate factory level risk
  const factoryPending = factoryTotalPaid - factoryTotalInvoiced;
  const factoryPercentage = Math.min(100, (factoryTotalInvoiced / factoryTotalLimit) * 100);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group/row relative hover:z-40">
      <div className="flex flex-col md:flex-row">
        
        {/* Left Sidebar: Factory / Owner Info */}
        <div className="w-full md:w-64 bg-slate-50 p-5 border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-center relative rounded-t-xl md:rounded-l-xl md:rounded-tr-none">
          
          <div className="flex items-center gap-2 mb-4 justify-between">
             <div className="flex items-center gap-2">
                <div className="bg-indigo-100 text-indigo-600 p-1.5 rounded-md">
                    <User size={18} />
                </div>
                <h3 className="text-lg font-bold text-slate-800">{ownerName}</h3>
             </div>
             
             {/* Owner Actions */}
             <div className="flex gap-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
                {/* 编辑功能已移至管理员设置模块 */}
             </div>
          </div>

          <div className="space-y-2 text-xs bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
             <div className="flex justify-between text-slate-500 group relative">
                <span className="flex items-center gap-1">
                    总货款(收入)
                    {paymentDetails && paymentDetails.length > 0 && <History size={12} className="text-slate-400" />}
                </span>
                <span className="font-medium text-slate-900 cursor-help">¥{(factoryTotalPaid/10000).toFixed(1)}万</span>
                
                {/* Tooltip for payment details */}
                {paymentDetails && paymentDetails.length > 0 && (
                    <div className="absolute left-full top-0 ml-3 w-56 bg-white text-slate-600 text-xs p-3 rounded-xl hidden group-hover:block z-50 shadow-xl border border-slate-100 ring-1 ring-slate-900/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="font-bold mb-2 text-slate-800 border-b border-slate-100 pb-2">最近付款记录</div>
                        {paymentDetails.slice(0, 5).map((p, i) => (
                           <div key={i} className="flex justify-between py-1">
                              <span className="text-slate-500">{p.date}</span>
                              <span className="font-medium text-slate-700">¥{p.amount.toLocaleString()}</span>
                           </div>
                        ))}
                        {paymentDetails.length > 5 && <div className="text-center pt-1 text-slate-400">...</div>}
                    </div>
                )}
             </div>
             <div className="flex justify-between text-slate-500">
                <span>总已开票</span>
                <span className="font-medium text-blue-600">¥{(factoryTotalInvoiced/10000).toFixed(1)}万</span>
             </div>
             <div className="border-t border-slate-100 pt-1.5 flex justify-between items-center">
                <span className="text-slate-500">总待开缺口</span>
                <span className={`font-bold ${factoryPending > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                   ¥{(factoryPending).toLocaleString()}
                </span>
             </div>
          </div>
        </div>

        {/* Right Content: List of Business Entities */}
        <div className="flex-1 divide-y divide-slate-100">
           {items.map((item, idx) => {
              const { entity, stats, linkedStores, invoiceDetails } = item;
              const pending = stats.totalPaid - stats.totalInvoiced;
              const percentage = Math.min(100, (stats.totalInvoiced / entity.quarterlyLimit) * 100);
              const remaining = entity.quarterlyLimit - stats.totalInvoiced;
              const isHighRisk = percentage > 85;
              const isFull = percentage >= 100;

              return (
                <div key={entity.id} className="p-4 hover:bg-slate-50/50 transition-colors grid grid-cols-12 gap-4 items-center group/item">
                   
                   {/* Entity Name & Type */}
                   <div className="col-span-12 md:col-span-4 relative">
                      <div className="flex items-start gap-2">
                        <Building2 size={16} className="text-slate-400 mt-1 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-slate-700 text-sm flex items-center gap-2">
                              {entity.name}
                              <div className="hidden group-hover/item:flex gap-1">
                                  {/* 编辑功能已移至管理员设置模块 */}
                              </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                             <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded border border-slate-200">
                               {entity.type}
                             </span>
                             {isFull && <span className="text-[10px] text-red-600 flex items-center gap-0.5 font-medium"><AlertOctagon size={10}/> 满额</span>}
                             {!isFull && isHighRisk && <span className="text-[10px] text-orange-600 flex items-center gap-0.5 font-medium"><AlertTriangle size={10}/> 额度不足</span>}
                          </div>
                        </div>
                      </div>
                   </div>

                   {/* Linked Stores */}
                   <div className="col-span-12 md:col-span-3 text-xs text-slate-500">
                      {linkedStores.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                           {linkedStores.map((store, i) => (
                             <span key={i} className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] cursor-help relative group/tooltip">
                               {store.name}
                               {/* Hover Tooltip for invoices */}
                               {invoiceDetails && invoiceDetails[store.name] && (
                                   <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 w-48 bg-white text-slate-600 text-xs p-3 rounded-lg z-50 hidden group-hover/tooltip:block pointer-events-none shadow-xl border border-slate-200 ring-1 ring-slate-900/5">
                                       <div className="font-bold border-b border-slate-100 pb-2 mb-2 text-slate-800">{store.companyName}</div>
                                       {invoiceDetails[store.name].map((inv, idx) => (
                                           <div key={idx} className="flex justify-between py-1">
                                               <span className="text-slate-500">{inv.date}</span>
                                               <span className="font-medium text-slate-700">¥{inv.amount.toLocaleString()}</span>
                                           </div>
                                       ))}
                                   </div>
                               )}
                             </span>
                           ))}
                        </div>
                      ) : (
                        <span className="text-slate-300 italic">暂无往来</span>
                      )}
                   </div>

                   {/* Progress Bar & Actions */}
                   <div className="col-span-12 md:col-span-5">
                      <div className="flex justify-between items-center mb-1.5">
                         <span className="text-[10px] text-slate-500">已开: ¥{(stats.totalInvoiced/10000).toFixed(1)}万 / {(entity.quarterlyLimit/10000).toFixed(1)}万</span>
                         <span className={`text-[10px] font-bold ${remaining < 50000 ? 'text-red-500' : 'text-green-600'}`}>
                           余: ¥{remaining.toLocaleString()}
                         </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div 
                                className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : isHighRisk ? 'bg-orange-500' : 'bg-blue-500'}`}
                                style={{ width: `${percentage}%` }}
                            />
                        </div>
                        <button 
                            onClick={() => onAddInvoice(entity.id)}
                            className="text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 p-1.5 rounded transition-colors"
                            title="新增开票"
                        >
                            <PlusCircle size={18} />
                        </button>
                      </div>
                   </div>
                </div>
              );
           })}
        </div>
      </div>
    </div>
  );
};

export default SupplierRow;