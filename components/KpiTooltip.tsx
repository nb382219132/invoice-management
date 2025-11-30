import React from 'react';

interface TooltipItem {
  label: string;
  value: number;
  subLabel?: string;
}

interface Props {
  title: string;
  items: TooltipItem[];
  colorClass?: string;
  valuePrefix?: string;
}

const KpiTooltip: React.FC<Props> = ({ title, items, colorClass = 'bg-indigo-500', valuePrefix = '¥' }) => {
  if (items.length === 0) return null;
  const maxVal = Math.max(...items.map(i => i.value));

  return (
    <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto transition-opacity duration-200">
      <h4 className="text-xs font-bold text-gray-600 uppercase mb-3 border-b border-gray-200 pb-2">{title}</h4>
      <div className="space-y-3 max-h-64 overflow-y-auto pr-2 scrollbar-hide">
        {items.map((item, idx) => (
          <div key={idx} className="text-xs">
            <div className="flex justify-between mb-1">
              <span className="font-medium text-gray-700 truncate max-w-[140px]" title={item.label}>{item.label}</span>
              <span className="font-mono text-gray-500">{valuePrefix}{(item.value / 10000).toFixed(2)}万</span>
            </div>
            <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${colorClass}`} 
                style={{ width: `${(item.value / maxVal) * 100}%` }}
              ></div>
            </div>
            {item.subLabel && <div className="text-[10px] text-gray-500 mt-0.5">{item.subLabel}</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default KpiTooltip;