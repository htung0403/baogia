import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Plus, Check } from 'lucide-react';

interface Option {
  id: string;
  name: string;
}

interface SearchableSelectWithCreateProps {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  onCreate: (name: string) => void;
  isCreating?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SearchableSelectWithCreate({
  options,
  value,
  onChange,
  onCreate,
  isCreating = false,
  placeholder = '— Chọn —',
  searchPlaceholder = 'Tìm hoặc nhập tên mới...',
  open,
  onOpenChange,
}: SearchableSelectWithCreateProps) {
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);
  const filtered = search.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()))
    : options;
  const exactMatch = options.some((o) => o.name.toLowerCase() === search.trim().toLowerCase());
  const showCreate = search.trim().length > 0 && !exactMatch;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setSearch('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const handleOpen = () => {
    onOpenChange(true);
  };

  const handleSelect = (id: string) => {
    onChange(id);
    onOpenChange(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  const handleCreate = () => {
    if (!search.trim() || isCreating) return;
    onCreate(search.trim());
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={handleOpen}
        className="w-full h-8 px-3 flex items-center justify-between text-[13px] border border-slate-200 rounded-md bg-background hover:border-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-left"
      >
        <span className={selected ? 'text-slate-900' : 'text-slate-400'}>
          {selected ? selected.name : placeholder}
        </span>
        <span className="flex items-center gap-0.5 shrink-0">
          {selected && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === 'Enter' && handleClear(e as unknown as React.MouseEvent)}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Xóa"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </span>
      </button>

      {open && (
        <div className="absolute z-[10000] top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          <div className="px-2 py-2 border-b border-slate-100">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filtered.length === 1 && !showCreate) {
                    handleSelect(filtered[0].id);
                  } else if (showCreate) {
                    handleCreate();
                  }
                }
                if (e.key === 'Escape') {
                  onOpenChange(false);
                  setSearch('');
                }
              }}
              placeholder={searchPlaceholder}
              className="w-full h-7 px-2 text-[12px] border border-slate-200 rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 && !showCreate && (
              <li className="px-3 py-2 text-[12px] text-slate-400 text-center">
                Không tìm thấy
              </li>
            )}
            {filtered.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(o.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] hover:bg-slate-50 transition-colors text-left"
                >
                  <span>{o.name}</span>
                  {o.id === value && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                </button>
              </li>
            ))}

            {showCreate && (
              <li>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={isCreating}
                  className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-indigo-600 hover:bg-indigo-50 transition-colors text-left font-medium disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {isCreating ? 'Đang tạo...' : `Tạo mới "${search.trim()}"`}
                  </span>
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
