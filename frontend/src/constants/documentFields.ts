/**
 * Maps document form fields to their respective sections
 */
export const fieldToSection: Record<string, string> = {
  date: 'basic',
  landlordName: 'landlordDetails',
  landlordId: 'landlordDetails',
  landlordPhone: 'landlordDetails',
  landlordEmail: 'landlordDetails',
  landlordAddress: 'landlordDetails',
  tenantName: 'tenantDetails',
  tenantId: 'tenantDetails',
  tenantPhone: 'tenantDetails',
  tenantEmail: 'tenantDetails',
  tenantAddress: 'tenantDetails',
  roomCount: 'propertyDetails',
  propertyAddress: 'propertyDetails',
  includedServices: 'propertyDetails',
  includedEquipment: 'propertyDetails',
  leasePeriod: 'leaseTerms',
  startDate: 'leaseTerms',
  endDate: 'leaseTerms',
  rentAmount: 'leaseTerms',
  paymentDay: 'leaseTerms',
  initialPaymentMonths: 'leaseTerms',
  standingOrderStart: 'leaseTerms',
  waterLimit: 'utilityLimits',
  electricityLimit: 'utilityLimits',
  securityRequired: 'securityDetails',
  securityDeposit: 'securityDetails',
  guarantorRequired: 'guarantorDetails',
  guarantorName: 'guarantorDetails',
  guarantorId: 'guarantorDetails',
  guarantorAddress: 'guarantorDetails',
  guarantorPhone: 'guarantorDetails',
};

/**
 * List of fields to be reset when duplicating a document
 */
export const fieldsToResetOnDuplicate = [
  'date',
  'tenantName',
  'tenantId',
  'tenantPhone',
  'tenantEmail',
  'tenantAddress',
  'startDate',
  'endDate',
  'initialPaymentMonths',
  'standingOrderStart',
  'securityRequired',
  'guarantorRequired',
  'guarantorName',
  'guarantorId',
  'guarantorAddress',
  'guarantorPhone',
] as const;
