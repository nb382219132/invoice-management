import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const SearchableSelect: React.FC<Props> = ({ options, value, onChange, placeholder = "请选择...", className = "", disabled=false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    // If closed, display the selected option's label
    if (!isOpen) {
        setSearchTerm(selectedOption ? selectedOption.label : '');
    }
  }, [value, isOpen, selectedOption]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const handleInteraction = () => {
    if (!disabled) {
        setIsOpen(true);
        // If the current text matches the selected value, clear it to show all options
        if (selectedOption && searchTerm === selectedOption.label) {
            setSearchTerm('');
        }
    }
  };

  const handleChevronClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!disabled) {
          if (isOpen) {
              setIsOpen(false);
          } else {
              setIsOpen(true);
              setSearchTerm(''); // Explicitly clear search to show all options
              inputRef.current?.focus();
          }
      }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
        <div className="relative group">
            <input
                ref={inputRef}
                type="text"
                className={`w-full p-2 border rounded pr-8 text-sm focus:ring-2 focus:ring-indigo-500 outline-none truncate ${disabled ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''}`}
                placeholder={placeholder}
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (!isOpen) setIsOpen(true);
                }}
                onClick={handleInteraction}
                onFocus={handleInteraction}
                disabled={disabled}
                autoComplete="off"
            />
             <div 
                className="absolute right-0 top-0 h-full w-8 flex items-center justify-center text-slate-400 cursor-pointer hover:text-slate-600" 
                onClick={handleChevronClick}
             >
                <ChevronDown size={16} />
            </div>
        </div>
        
        {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {filteredOptions.length > 0 ? (
                    filteredOptions.map(opt => (
                        <div 
                            key={opt.value}
                            className={`px-3 py-2 text-sm cursor-pointer hover:bg-indigo-50 flex justify-between items-center ${opt.value === value ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700'}`}
                            onMouseDown={() => handleSelect(opt.value)} 
                        >
                            <span>{opt.label}</span>
                            {opt.value === value && <Check size={14}/>}
                        </div>
                    ))
                ) : (
                    <div className="px-3 py-2 text-sm text-slate-400 text-center">无匹配项</div>
                )}
            </div>
        )}
    </div>
  );
};

export default SearchableSelect;