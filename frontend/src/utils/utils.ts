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
export const getApartment = (apartments: IApartment[], apartment_id: string) => 
  apartments.find((apartment) => apartment.apartment_id === apartment_id);
