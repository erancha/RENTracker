import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, ButtonGroup } from '@mui/material';

interface Props {
  className?: string;
  onLanguageChange?: () => void;
}

const LanguageSwitcher: React.FC<Props> = ({ className, onLanguageChange }) => {
  const { i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    // Update document direction for RTL support
    document.documentElement.dir = lng === 'he' ? 'rtl' : 'ltr';
    // Close menu if callback provided
    if (onLanguageChange) onLanguageChange();
  };

  return (
    <ButtonGroup size="small" aria-label="language switcher" className={className}>
      <Button
        variant={i18n.language === 'en' ? 'contained' : 'outlined'}
        onClick={() => changeLanguage('en')}
      >
        EN
      </Button>
      <Button
        variant={i18n.language === 'he' ? 'contained' : 'outlined'}
        onClick={() => changeLanguage('he')}
      >
        עב
      </Button>
    </ButtonGroup>
  );
};

export default LanguageSwitcher;
