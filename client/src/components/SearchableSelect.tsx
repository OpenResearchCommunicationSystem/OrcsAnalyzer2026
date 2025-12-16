import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function SearchableSelect({ 
  options, 
  value, 
  onValueChange, 
  placeholder = "Search..." 
}: SearchableSelectProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(opt => 
      opt.label.toLowerCase().includes(term) || 
      opt.value.toLowerCase().includes(term)
    );
  }, [options, searchTerm]);

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setSearchTerm('');
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder={placeholder}
          className="pl-8 bg-gray-900 border-gray-600 text-sm"
          data-testid="searchable-select-input"
        />
      </div>
      
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.map(opt => (
            <button
              key={opt.value}
              onMouseDown={() => handleSelect(opt.value)}
              className="w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-gray-700 transition-colors"
              data-testid={`searchable-option-${opt.value}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      
      {isOpen && filteredOptions.length === 0 && searchTerm && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg p-3 text-sm text-slate-400">
          No matches found
        </div>
      )}
    </div>
  );
}
