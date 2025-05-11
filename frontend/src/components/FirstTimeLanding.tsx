import React, { useCallback, useEffect, useState } from 'react';
import { Button, Typography } from '@mui/material';
import { getClipboardDocumentId } from '../utils/clipboard';
import { UserType } from 'redux/auth/types';
import { useTranslation } from 'react-i18next';

/**
 * Props for the FirstTimeLanding component
 */
interface FirstTimeLandingProps {
  userId: string | null;
  setUserTypeAction: (userType: UserType) => void;
}

/**
 * A component that handles initial user role selection.
 * Displays a welcome screen with options to choose between Landlord and Tenant roles.
 * If a document ID is detected in the clipboard, it will highlight the Tenant option
 * and auto-select it after 10 seconds.
 *
 * @param {FirstTimeLandingProps} props - Component props
 * @param {(isLandlord: boolean) => void} props.onSelect - Callback function when a role is selected
 */

/**
 * Saves a user ID to the tenants array in localStorage if they are a tenant
 * @param {string} userId - The ID of the user to save
 * @param {UserType} userType - The type of the user
 */
const saveUserTypeToStorage = (userId: string, userType: UserType): void => {
  if (userType !== UserType.Tenant) return;

  try {
    const stored = localStorage.getItem('RENTracker');
    const tenantIds = stored ? JSON.parse(stored) : [];

    if (!tenantIds.includes(userId)) {
      tenantIds.push(userId);
      localStorage.setItem('RENTracker', JSON.stringify(tenantIds));
    }
  } catch (e) {
    console.warn('Error saving tenant to storage:', e);
  }
};

export const FirstTimeLanding: React.FC<FirstTimeLandingProps> = ({ userId, setUserTypeAction }) => {
  const { t } = useTranslation();
  const [hasDocumentId, setHasDocumentId] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [, setAutoSelectTimer] = useState<NodeJS.Timeout | null>(null);

  /**
   * Handles the completion of user role selection.
   * Stores the selected user type in localStorage and Redux store.
   * @param {UserType} selectedUserType - The selected user type
   */
  const handleSelect = useCallback(
    (selectedUserType: UserType) => {
      if (!userId) return;

      // Save to localStorage
      saveUserTypeToStorage(userId, selectedUserType);

      // Update Redux state
      setUserTypeAction(selectedUserType);
    },
    [userId, setUserTypeAction]
  );

  // Check for stored user type on mount
  useEffect(() => {
    if (!userId) return;

    try {
      const storedTenants = localStorage.getItem('RENTracker');
      if (storedTenants) {
        const tenantIds = JSON.parse(storedTenants);
        if (tenantIds.includes(userId)) {
          setUserTypeAction(UserType.Tenant);
        }
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

  return (
    <div className='first-time-landing'>
      <div className='content'>
        <Typography variant='h4' gutterBottom align='center'>
          {t('welcome.title')}
        </Typography>
        <Typography variant='body1' paragraph align='center'>
          {t('welcome.description', {
            landlords: <b>{t('roles.landlordDesc')}</b>,
            tenants: <b>{t('roles.tenantDesc')}</b>,
          })}
        </Typography>
        <Typography variant='body1' paragraph align='center'>
          {t('welcome.selectRole')}
        </Typography>
        <div className='buttons'>
          <Button variant='contained' size='large' onClick={() => handleSelect(UserType.Landlord)}>
            {t('roles.landlord')}
          </Button>
          <Button variant='contained' size='large' onClick={() => handleSelect(UserType.Tenant)} className={hasDocumentId ? 'has-document-id' : ''}>
            {t('roles.tenant')}
          </Button>
        </div>
        {hasDocumentId && (
          <Typography variant='body2' align='center' color='text.secondary' className='has-document-id message'>
            {t('documentDetection.message')} <span className='countdown-timer'>{t('documentDetection.countdown', { count: countdown })}</span>
          </Typography>
        )}
      </div>
    </div>
  );
};
