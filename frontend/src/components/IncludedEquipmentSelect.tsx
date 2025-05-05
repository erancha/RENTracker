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
  { value: 'כיריים', label: 'כיריים' },
  { value: 'מיקרוגל', label: 'מיקרוגל' },
  { value: 'מכונת כביסה', label: 'מכונת כביסה' },
  { value: 'מייבש', label: 'מייבש' },
  { value: 'טלויזיה 1', label: 'טלויזיה 1' },
  { value: 'טלויזיה 2', label: 'טלויזיה 2' },
  { value: 'ספה + שולחן קפה', label: 'ספה + שולחן קפה' },
  { value: 'שולחן פ"א + כסאות', label: 'שולחן פ"א + כסאות' },
  { value: 'מזגן 1', label: 'מזגן 1' },
  { value: 'מזגן 2', label: 'מזגן 2' },
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
            key={option.value}
            sx={{ minWidth: 0 }}
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
