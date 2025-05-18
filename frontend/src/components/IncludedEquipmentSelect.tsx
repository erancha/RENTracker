import React from 'react';
import { FormGroup, FormControlLabel, Checkbox, FormControl, FormLabel, FormHelperText, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface IncludedEquipmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

const EQUIPMENT_OPTIONS = [
  { key: 'refrigerator' },
  { key: 'oven' },
  { key: 'microwave' },
  { key: 'tv' },
  { key: 'washingMachine' },
  { key: 'dryer' },
  { key: 'sofaAndTable' },
  { key: 'diningTable' },
  { key: 'ac' },
  { key: 'bed' },
  { key: 'mattress' },
  { key: 'closet' },
];

export const IncludedEquipmentSelect: React.FC<IncludedEquipmentSelectProps> = ({ value, onChange, error, disabled = false }) => {
  const { t } = useTranslation();
  // Parse the comma-separated string into an array and separate checkbox items from free text
  const allItems = value ? value.split(',').map((item) => item.trim()) : [];
  const selectedEquipment = allItems.filter((item) => EQUIPMENT_OPTIONS.some((option) => t('documentForm.equipment.' + option.key, { lng: 'he' }) === item));
  const freeTextItems = allItems
    .filter((item) => !EQUIPMENT_OPTIONS.some((option) => t('documentForm.equipment.' + option.key, { lng: 'he' }) === item))
    .join(', ');

  const handleChange = (equipmentKey: string) => {
    const equipmentValue = t('documentForm.equipment.' + equipmentKey, { lng: 'he' });
    const newSelected = selectedEquipment.includes(equipmentValue)
      ? selectedEquipment.filter((item) => item !== equipmentValue)
      : [...selectedEquipment, equipmentValue];

    const allEquipment = [...newSelected];
    if (freeTextItems) {
      allEquipment.push(...freeTextItems.split(',').map((item) => item.trim()));
    }
    onChange(allEquipment.join(', '));
  };

  return (
    <FormControl error={!!error} fullWidth margin='normal'>
      <FormLabel component='legend'>{t('documentForm.sections.includedEquipment')}</FormLabel>
      <FormGroup
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(2, 1fr)', // 2 columns on mobile
            sm: 'repeat(3, 1fr)', // 3 columns on tablet
            md: 'repeat(5, 1fr)', // 4 columns on desktop
          },
          gap: 2,
        }}
      >
        {EQUIPMENT_OPTIONS.map((option) => (
          /* Displaying labels in the current language, while the values exported/imported with the form are always in Hebrew (since the template supports only Hebrew for the time being..) */
          <FormControlLabel
            key={option.key}
            control={
              <Checkbox
                checked={selectedEquipment.includes(t('documentForm.equipment.' + option.key, { lng: 'he' }))}
                onChange={() => handleChange(option.key)}
                disabled={disabled}
              />
            }
            label={t('documentForm.equipment.' + option.key)}
          />
        ))}
      </FormGroup>
      <TextField
        fullWidth
        margin='normal'
        label={t('documentForm.equipment.additionalEquipment')}
        value={freeTextItems}
        onChange={(e) => {
          const newFreeText = e.target.value;
          const allEquipment = [...selectedEquipment];
          if (newFreeText) {
            allEquipment.push(...newFreeText.split(',').map((item) => item.trim()));
          }
          onChange(allEquipment.join(', '));
        }}
        disabled={disabled}
        placeholder={t('documentForm.equipment.additionalEquipmentPlaceholder')}
        helperText={t('documentForm.equipment.additionalEquipmentHelper')}
      />
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
};
