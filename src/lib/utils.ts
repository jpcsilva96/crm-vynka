import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function maskPhone(value: string) {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  // Limit to 11 digits
  value = value.slice(0, 11);
  
  if (value.length > 10) {
    // (11) 98461-6772
    value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, "($1) $2-$3");
  } else if (value.length > 5) {
    value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3");
  } else if (value.length > 2) {
    value = value.replace(/^(\d{2})(\d{0,5}).*/, "($1) $2");
  } else {
    value = value.replace(/^(\d*)/, "($1");
  }
  return value;
}

export function getPhoneDigits(value?: string | null) {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidBrazilianPhone(value?: string | null) {
  const digits = getPhoneDigits(value);
  return digits.length === 10 || digits.length === 11;
}

export function maskCNPJ(value: string) {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  return value
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .replace(/(-\d{2})\d+?$/, "$1");
}

export function maskCPF(value: string) {
  if (!value) return "";
  value = value.replace(/\D/g, "");
  return value
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2")
    .replace(/(-\d{2})\d+?$/, "$1");
}

export function isPhoneMatch(phone1?: string, phone2?: string): boolean {
  if (!phone1 || !phone2) return false;
  const p1 = phone1.replace(/\D/g, "");
  const p2 = phone2.replace(/\D/g, "");
  if (!p1 || !p2) return false;
  
  if (p1 === p2) return true;
  // Match if one ends with the other (handles missing country codes, e.g. 551198... vs 1198...)
  // Only do this if the shorter one has at least 8 digits to avoid false positives
  if (p1.length >= 8 && p2.length > p1.length && p2.endsWith(p1)) return true;
  if (p2.length >= 8 && p1.length > p2.length && p1.endsWith(p2)) return true;
  
  return false;
}

export function parseLocalDateValue(value?: string | null): Date | null {
  if (!value) return null;

  const localDateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (localDateMatch) {
    const [, year, month, day] = localDateMatch;
    return new Date(Number(year), Number(month) - 1, Number(day), 0, 0, 0, 0);
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getTodayLocalDateInput() {
  return formatLocalDateInput(new Date());
}

export function isPastLocalDate(value?: string | null) {
  const date = parseLocalDateValue(value);
  if (!date) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  return date.getTime() < today.getTime();
}

export function formatLocalDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDueDateTime(value?: string | null, time?: string | null): Date | null {
  const baseDate = parseLocalDateValue(value);
  if (!baseDate) return null;

  if (time) {
    const [hours, minutes] = time.split(":");
    baseDate.setHours(Number(hours) || 0, Number(minutes) || 0, 0, 0);
    return baseDate;
  }

  baseDate.setHours(23, 59, 59, 999);
  return baseDate;
}
