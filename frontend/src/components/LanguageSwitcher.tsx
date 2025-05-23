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
    document.documentElement.dir = lng === 'he' ? 'rtl' : 'ltr';
    if (onLanguageChange) onLanguageChange();
  };

  return (
    <ButtonGroup
      size='small'
      aria-label='language switcher'
      className={className}
      sx={{
        '& .MuiButton-root': {
          order: document.documentElement.dir === 'rtl' ? 2 : 1,
          '&:nth-of-type(2)': {
            order: document.documentElement.dir === 'rtl' ? 1 : 2,
          },
        },
      }}
    >
      <Button variant={i18n.language === 'en' ? 'contained' : 'outlined'} onClick={() => changeLanguage('en')}>
        EN
      </Button>
      <Button variant={i18n.language === 'he' ? 'contained' : 'outlined'} onClick={() => changeLanguage('he')}>
        עב
      </Button>
    </ButtonGroup>
  );
};

export default LanguageSwitcher;
