import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format number as Vietnamese currency
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '-';
  return new Intl.NumberFormat('vi-VN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format date as Vietnamese locale
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Format duration in seconds to human-readable
 */
export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds) return '0s';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

/**
 * Format phone number to E.164 (Vietnam +84 as default)
 */
export function formatPhoneE164(phone: string): string {
  if (!phone) return '';
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  // If starts with 0, replace with +84
  if (cleaned.startsWith('0')) {
    return `+84${cleaned.slice(1)}`;
  }
  // If already starts with 84 but no +, add +
  if (cleaned.startsWith('84') && !phone.startsWith('+')) {
    return `+${cleaned}`;
  }
  // If already starts with +84, return as is
  if (phone.startsWith('+')) {
    return phone;
  }
  // Default: assume it's a local number without leading 0
  return `+84${cleaned}`;
}

/**
 * Convert phone to shadow email for Supabase Auth compatibility
 */
export function phoneToEmail(phone: string): string {
  const formatted = formatPhoneE164(phone);
  return `${formatted.replace('+', '')}@baogia.internal`;
}

/**
 * Format shadow email back to phone for display
 */
export function displayEmailOrPhone(emailOrPhone: string | null | undefined): string {
  if (!emailOrPhone) return '';
  if (emailOrPhone.endsWith('@baogia.internal')) {
    const raw = emailOrPhone.replace('@baogia.internal', '');
    // If raw starts with 84, convert to 0 for local display
    if (raw.startsWith('84')) {
      return `0${raw.slice(2)}`;
    }
    return raw;
  }
  return emailOrPhone;
}
