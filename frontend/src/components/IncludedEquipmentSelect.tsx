import React from 'react';
import { FormGroup, FormControlLabel, Checkbox, FormControl, FormLabel, FormHelperText } from '@mui/material';
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
  { key: 'stove' },
  { key: 'microwave' },
  { key: 'washingMachine' },
  { key: 'dryer' },
  { key: 'tv1' },
  { key: 'tv2' },
  { key: 'sofaAndTable' },
  { key: 'diningTable' },
  { key: 'ac1' },
  { key: 'ac2' },
  { key: 'bed' },
  { key: 'mattress' },
  { key: 'closet' },
];

export const IncludedEquipmentSelect: React.FC<IncludedEquipmentSelectProps> = ({ value, onChange, error, disabled = false }) => {
  const { t } = useTranslation();
  // Parse the comma-separated string into an array
  const selectedEquipment = value ? value.split(',').map((item) => item.trim()) : [];

  const handleChange = (equipmentKey: string) => {
    const equipmentValue = t('documentForm.equipment.' + equipmentKey, { lng: 'he' });
    const newSelected = selectedEquipment.includes(equipmentValue)
      ? selectedEquipment.filter((item) => item !== equipmentValue)
      : [...selectedEquipment, equipmentValue];

    onChange(newSelected.join(', '));
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
          <FormControlLabel
            key={option.key}
            control={
              <Checkbox
                checked={selectedEquipment.includes(t('documentForm.equipment.' + option.key, { lng: 'he' }))}
                onChange={() => handleChange(option.key)}
                disabled={disabled}
              />
            }
            label={t('documentForm.equipment.' + option.key, { lng: 'he' })}
          />
        ))}
      </FormGroup>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
};
