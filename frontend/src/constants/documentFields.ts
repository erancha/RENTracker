/**
 * Maps document form fields to their respective sections
 */
export const fieldToSection: Record<string, string> = {
  propertyAddress: 'propertyDetails',
  roomCount: 'propertyDetails',
  includedServices: 'propertyDetails',
  includedEquipment: 'propertyDetails',
  date: 'leaseTerms',
  leasePeriod: 'leaseTerms',
  startDate: 'leaseTerms',
  endDate: 'leaseTerms',
  rentAmount: 'leaseTerms',
  paymentDay: 'leaseTerms',
  initialPaymentMonths: 'leaseTerms',
  standingOrderStart: 'leaseTerms',
  waterLimit: 'utilityLimits',
  electricityLimit: 'utilityLimits',
  landlordName: 'landlordDetails',
  landlordId: 'landlordDetails',
  landlordPhone: 'landlordDetails',
  landlordEmail: 'landlordDetails',
  landlordAddress: 'landlordDetails',
  tenant1Name: 'tenant1Details',
  tenant1Id: 'tenant1Details',
  tenant1Phone: 'tenant1Details',
  tenant1Email: 'tenant1Details',
  tenant1Address: 'tenant1Details',
  tenant1IdCard: 'tenant1Attachments',
  tenant1Salary1: 'tenant1Attachments',
  tenant1Salary2: 'tenant1Attachments',
  tenant2Name: 'tenant2Details',
  tenant2Id: 'tenant2Details',
  tenant2Phone: 'tenant2Details',
  tenant2Email: 'tenant2Details',
  tenant2Address: 'tenant2Details',
  tenant2IdCard: 'tenant2Attachments',
  tenant2Salary1: 'tenant2Attachments',
  tenant2Salary2: 'tenant2Attachments',
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
  'landlordSignature',
  'tenant1Name',
  'tenant1Id',
  'tenant1Phone',
  'tenant1Email',
  'tenant1Address',
  'tenant1IdCard',
  'tenant1Salary1',
  'tenant1Salary2',
  'tenant2Name',
  'tenant2Id',
  'tenant2Phone',
  'tenant2Email',
  'tenant2Address',
  'tenant2IdCard',
  'tenant2Salary1',
  'tenant2Salary2',
  'tenantSignature',
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
