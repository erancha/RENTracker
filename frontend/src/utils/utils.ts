import { IApartment } from 'redux/apartments/types';

/**
 * Filters and sorts an array of apartments (currently returns unmodified array)
 * @param apartments - Array of apartment objects to process
 * @returns The processed array of apartments
 */
export const filterAndSortApartments = (apartments: IApartment[]) => {
  return apartments;
};

/**
 * Formats a date into a short display format with time (DD/MM, HH:mm)
 * @param dateTime - Date object to format
 * @returns Formatted date string in British locale format
 * @example
 * timeShortDisplay(new Date('2025-04-07T20:02:40')) // Returns "07/04, 20:02"
 */
export const timeShortDisplay = (dateTime: Date) => {
  const options: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: 'numeric',
    day: 'numeric',
    month: 'numeric',
    hour12: false,
  };

  return dateTime.toLocaleString('en-GB', options);
};

/**
 * Formats a date string into DD/MM/YYYY format
 * @param dateString - ISO date string to format
 * @returns Formatted date string in British locale format, or empty string if input is falsy
 * @example
 * formatDate('2025-04-07') // Returns "07/04/2025"
 * formatDate('') // Returns ""
 */
export const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Finds an apartment by its ID in an array of apartments
 * @param apartments - Array of apartments to search through
 * @param apartment_id - ID of the apartment to find
 * @returns The matching apartment object or undefined if not found
 */
export const getApartment = (apartments: IApartment[], apartment_id: string) => apartments.find((apartment) => apartment.apartment_id === apartment_id);

/**
 * Validates an Israeli mobile phone number
 * @param phone - The phone number to validate
 * @returns true if the phone number is valid or empty, false otherwise
 */
export const validateIsraeliPhone = (phone: string): boolean => {
  const digits = phone.replace(/\D/g, '');
  // Empty is valid (not required field)
  if (digits.length === 0) return true;
  // Must be exactly 10 digits starting with 05X
  return /^05\d{8}$/.test(digits);
};

/**
 * Validates an email address
 * @param email - The email address to validate
 * @returns true if the email address is valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

/**
 * Formats a phone number with dashes
 * @param phone - The phone number to format
 * @returns The formatted phone number
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/**
 * Validates an Israeli ID number using the Luhn algorithm
 * @param id - The ID number to validate
 * @returns true if the ID is valid, false otherwise
 */
export function validateIsraeliId(id: string): boolean {
  // Remove any non-digit characters
  id = id.replace(/\D/g, '');
  // Pad 8-digit IDs with leading zero
  if (id.length === 8) id = '0' + id;
  if (id.length !== 9) return false;

  const digits = id.split('').map(Number);
  let sum = 0;

  for (let i = 0; i < 8; i++) {
    let digit = digits[i] * ((i % 2) + 1);
    digit = digit > 9 ? digit - 9 : digit;
    sum += digit;
  }

  return (10 - (sum % 10)) % 10 === digits[8];
}
