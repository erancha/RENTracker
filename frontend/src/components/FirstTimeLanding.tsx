import React, { useCallback, useEffect, useState } from 'react';
import { Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions, FormControlLabel, Checkbox } from '@mui/material';
import { getClipboardDocumentId } from '../utils/clipboard';
import { UserType } from 'redux/auth/types';
import { useTranslation } from 'react-i18next';
import { SAAS_TENANTS_VIEW } from 'redux/menu/types';
import { ISetMenuSelectedPageAction } from 'redux/menu/actions';

/**
 * A component that handles initial user role selection.
 * Displays a welcome screen with options to choose between Landlord and Tenant roles.
 * If a document ID is detected in the clipboard, it will highlight the Tenant option
 * and auto-select it after 10 seconds.
 */
export const FirstTimeLanding: React.FC<FirstTimeLandingProps> = ({ userId, setUserTypeAction, setMenuSelectedPageAction }) => {
  const { t } = useTranslation();
  const [hasDocumentId, setHasDocumentId] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<UserType | null>(null);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [, setAutoSelectTimer] = useState<NodeJS.Timeout | null>(null);
  const APP_KEY_NAME = 'RENTracker-tenants.v4';

  /**
   * Handles the completion of user role selection.
   * Stores the selected user type in localStorage and Redux store.
   * @param {UserType} selectedUserType - The selected user type
   */
  const handleSelect = useCallback(
    (selectedUserType: UserType) => {
      if (!userId) return;
      setSelectedType(selectedUserType);
      setConfirmationOpen(true);
    },
    [userId]
  );

  const handleConfirm = useCallback(() => {
    if (!userId || !selectedType || !confirmationChecked) return;

    if (selectedType === UserType.Tenant) {
      // Save to localStorage
      saveTenantUserTypeToStorage(userId, selectedType);
      setUserTypeAction(selectedType);
    } else setMenuSelectedPageAction(SAAS_TENANTS_VIEW);

    setConfirmationOpen(false);
  }, [userId, selectedType, confirmationChecked, setUserTypeAction, setMenuSelectedPageAction]);

  // Check for stored user type on mount
  useEffect(() => {
    if (!userId) return;

    try {
      const storedTenants = localStorage.getItem(APP_KEY_NAME);
      if (storedTenants) {
        const tenantIds = JSON.parse(storedTenants);
        if (tenantIds.includes(userId)) setUserTypeAction(UserType.Tenant);
      }
    } catch (e) {
      console.warn('Error reading tenants from storage:', e);
    }
  }, [userId, setUserTypeAction]);

  // Handle clipboard and auto-selection
  useEffect(() => {
    let startTime: number;
    let timer: NodeJS.Timeout | undefined;
    let animationFrame: number;

    const updateCountdown = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const remaining = Math.ceil((10000 - elapsed) / 1000);

      if (remaining <= 0) {
        setCountdown(0);
        cancelAnimationFrame(animationFrame);
        return;
      }

      setCountdown(remaining);
      animationFrame = requestAnimationFrame(updateCountdown);
    };

    const startAutoSelect = (documentId: string) => {
      setHasDocumentId(true);
      startTime = Date.now();

      // Start countdown
      updateCountdown();

      // Auto-select tenant role after delay
      timer = setTimeout(() => {
        handleSelect(UserType.Tenant);
      }, 10000);
      setAutoSelectTimer(timer);
    };

    // Check clipboard on mount and when user clicks anywhere in the component
    const checkClipboard = async () => {
      const documentId = await getClipboardDocumentId();
      if (documentId) startAutoSelect(documentId);
    };

    // Initial check
    checkClipboard();

    // Add click handler to retry clipboard access
    const handleClick = () => {
      if (!hasDocumentId) checkClipboard();
    };

    document.addEventListener('click', handleClick);

    // Cleanup function
    return () => {
      document.removeEventListener('click', handleClick);
      if (timer) clearTimeout(timer);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [handleSelect, hasDocumentId]); // handleSelect is stable as it uses props from closure

  /**
   * Saves a user ID to the tenants array in localStorage if they are a tenant
   * @param {string} userId - The ID of the user to save
   * @param {UserType} userType - The type of the user
   */
  const saveTenantUserTypeToStorage = (userId: string, userType: UserType): void => {
    if (userType === UserType.Tenant) {
      try {
        const stored = localStorage.getItem(APP_KEY_NAME);
        const tenantIds = stored ? JSON.parse(stored) : [];

        if (!tenantIds.includes(userId)) {
          tenantIds.push(userId);
          localStorage.setItem(APP_KEY_NAME, JSON.stringify(tenantIds));
        }
      } catch (e) {
        console.warn('Error saving tenant to storage:', e);
      }
    }
  };

  return (
    <div className='first-time-landing'>
      <div className='content'>
        <Typography variant='h4' gutterBottom align='center'>
          {t('welcome.title')}
        </Typography>
        <Typography variant='body1' paragraph align='center'>
          {t('welcome.description')}
        </Typography>
        <Typography variant='body1' paragraph align='center'>
          {t('welcome.selectRole')}
        </Typography>
        <div className='buttons'>
          <div className='button-container'>
            <Button variant='contained' size='large' onClick={() => handleSelect(UserType.Landlord)}>
              {t('welcome.landlord')}
            </Button>
            <p>{t('welcome.landlordsDesc')}</p>
          </div>
          <div className='button-container'>
            <Button variant='contained' size='large' onClick={() => handleSelect(UserType.Tenant)} className={hasDocumentId ? 'has-document-id' : ''}>
              {t('welcome.tenant')}
            </Button>
            <p>{t('welcome.tenantsDesc')}</p>
          </div>
        </div>
        {hasDocumentId && (
          <Typography variant='body2' align='center' color='text.secondary' className='has-document-id message'>
            {t('documentDetection.message')} <span className='countdown-timer'>{t('documentDetection.countdown', { count: countdown })}</span>
          </Typography>
        )}
      </div>
      <Dialog open={confirmationOpen} onClose={() => setConfirmationOpen(false)}>
        <DialogTitle>
          {t('welcome.confirmTitle')} : {selectedType === UserType.Landlord ? t('welcome.landlord') : t('welcome.tenant')}
          <Typography variant='body2' paragraph>
            ({selectedType === UserType.Landlord ? t('welcome.landlordsDesc') : t('welcome.tenantsDesc')})
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant='body1' paragraph>
            {t('welcome.confirmMessage')}
          </Typography>
          <FormControlLabel
            control={<Checkbox checked={confirmationChecked} onChange={(e) => setConfirmationChecked(e.target.checked)} />}
            label={t('welcome.confirmCheckbox')}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmationOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleConfirm} disabled={!confirmationChecked} variant='contained'>
            {t('common.confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

/**
 * Props for the FirstTimeLanding component
 */
interface FirstTimeLandingProps {
  userId: string | null;
  setUserTypeAction: (userType: UserType) => void;
  setMenuSelectedPageAction: (menuSelectedPage: string | null) => ISetMenuSelectedPageAction;
}
