import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export { formatINR } from '../domain/money';
export function cn(...inputs: ClassValue[]): string { return twMerge(clsx(inputs)); }
