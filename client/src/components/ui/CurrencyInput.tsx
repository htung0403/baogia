import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | '';
  onChange: (value: number | '') => void;
}

export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = useState('');

  // Format number to string with thousand separators
  const format = (val: number | '') => {
    if (val === '') return '';
    return new Intl.NumberFormat('vi-VN').format(val);
  };

  // Parse string with thousand separators back to number
  const parse = (str: string) => {
    const cleaned = str.replace(/\D/g, '');
    if (cleaned === '') return '';
    return parseInt(cleaned, 10);
  };

  useEffect(() => {
    setDisplayValue(format(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value;
    const numericValue = parse(rawValue);
    
    // Update display immediately for better feel
    setDisplayValue(format(numericValue));
    
    // Propagate numeric value
    onChange(numericValue);
  };

  return (
    <input
      {...props}
      type="text"
      value={displayValue}
      onChange={handleChange}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    />
  );
}
