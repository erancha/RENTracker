import React from 'react';
import { FormGroup, FormControlLabel, Checkbox, FormControl, FormLabel, FormHelperText } from '@mui/material';

interface IncludedEquipmentSelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

const EQUIPMENT_OPTIONS = [
  { value: 'מקרר', label: 'מקרר' },
  { value: 'תנור', label: 'תנור' },
  { value: 'מיקרוגל', label: 'מיקרוגל' },
  { value: 'ספה + שולחן קפה', label: 'ספה + שולחן קפה' },
  { value: 'שולחן פ"א + כסאות', label: 'שולחן פ"א + כסאות' },
  { value: 'מכונת כביסה', label: 'מכונת כביסה' },
  { value: 'מייבש', label: 'מייבש' },
  { value: 'מזגן', label: 'מזגן' },
  { value: 'מיטה', label: 'מיטה' },
  { value: 'מזרון', label: 'מזרון' },
  { value: 'ארון קיר', label: 'ארון קיר' },
];

export const IncludedEquipmentSelect: React.FC<IncludedEquipmentSelectProps> = ({ value, onChange, error, disabled = false }) => {
  // Parse the comma-separated string into an array
  const selectedEquipment = value ? value.split(',').map((item) => item.trim()) : [];

  const handleChange = (equipmentValue: string) => {
    const newSelected = selectedEquipment.includes(equipmentValue)
      ? selectedEquipment.filter((item) => item !== equipmentValue)
      : [...selectedEquipment, equipmentValue];

    onChange(newSelected.join(', '));
  };

  return (
    <FormControl error={!!error} fullWidth margin='normal'>
      <FormLabel component='legend'>ציוד כלול</FormLabel>
      <FormGroup>
        {EQUIPMENT_OPTIONS.map((option) => (
          <FormControlLabel
            key={option.value}
            control={
              <Checkbox
                checked={selectedEquipment.includes(option.value)}
                onChange={() => handleChange(option.value)}
                disabled={disabled}
                name={option.value}
              />
            }
            label={option.label}
          />
        ))}
      </FormGroup>
      {error && <FormHelperText>{error}</FormHelperText>}
    </FormControl>
  );
};
