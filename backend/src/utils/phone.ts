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
  // Remove '+' to make it a valid email prefix if needed, though '+' is usually fine
  return `${formatted.replace('+', '')}@baogia.internal`;
}
