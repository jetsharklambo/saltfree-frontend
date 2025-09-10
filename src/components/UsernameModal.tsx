import React, { useState, useEffect } from 'react';
import { X, User, Save, Trash2 } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { getDisplayNameInfo } from '../utils/userUtils';
import { ensCache } from '../utils/ensUtils';
import { databaseService } from '../services/databaseService';
import { useActiveAccount } from "thirdweb/react";
import {
  BlockModal,
  BlockModalContent,
  BlockButton,
  BlockInput,
  blockTheme
} from '../styles/blocks';
import { SimpleRetroLoader } from './RetroLoader';
import { FlexBlock } from '../styles/blocks';

interface UsernameModalProps {
  isOpen: boolean;
  onClose: () => void;
}


export const UsernameModal: React.FC<UsernameModalProps> = ({ isOpen, onClose }) => {
  const account = useActiveAccount();
  const { user, updateUsername, loading } = useUser();
  const [username, setUsername] = useState(user?.username || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [availabilityStatus, setAvailabilityStatus] = useState<{
    checked: boolean;
    available: boolean;
    message?: string;
  }>({ checked: false, available: false });
  const [displayInfo, setDisplayInfo] = useState<{
    displayName: string;
    method: 'username' | 'ens' | 'address';
    canRemoveUsername: boolean;
    ensName?: string;
  } | null>(null);

  // Load display info when modal opens
  useEffect(() => {
    if (isOpen && account?.address) {
      const info = getDisplayNameInfo(account.address);
      const ensName = ensCache.getCachedENS(account.address);
      setDisplayInfo({
        ...info,
        ensName: ensName || undefined
      });
      
      // Pre-fetch ENS if not cached
      if (!ensName) {
        ensCache.resolveENS(account.address).then(resolvedENS => {
          if (resolvedENS) {
            setDisplayInfo(prev => prev ? { ...prev, ensName: resolvedENS } : null);
          }
        });
      }
    }
  }, [isOpen, account?.address]);

  // Reset availability status when username changes
  useEffect(() => {
    setAvailabilityStatus({ checked: false, available: false });
    setError(null);
  }, [username]);

  const checkAvailability = async () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setCheckingAvailability(true);
    setError(null);

    try {
      const result = await databaseService.user.checkUsernameAvailability(username.trim());
      
      setAvailabilityStatus({
        checked: true,
        available: result.available,
        message: result.error
      });

      if (!result.available && result.error) {
        setError(result.error);
      }
    } catch (error) {
      setError('Error checking availability. Please try again.');
      setAvailabilityStatus({ checked: false, available: false });
    } finally {
      setCheckingAvailability(false);
    }
  };

  const handleSave = async () => {
    if (!username.trim()) {
      setError('Username cannot be empty');
      return;
    }

    // Require availability check before saving
    if (!availabilityStatus.checked) {
      setError('Please check username availability first');
      return;
    }

    if (!availabilityStatus.available) {
      setError('Username is not available. Please choose a different username.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const success = await updateUsername(username.trim());
      if (success) {
        onClose();
      } else {
        setError('Failed to update username');
      }
    } catch (err: any) {
      // Handle specific error messages from database constraints
      if (err.message && err.message.includes('already taken')) {
        setError(err.message);
        setAvailabilityStatus({ checked: true, available: false, message: err.message });
      } else {
        setError('An error occurred while updating username');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    setError(null);

    try {
      const success = await updateUsername('');
      if (success) {
        onClose();
      } else {
        setError('Failed to remove username');
      }
    } catch (err) {
      setError('An error occurred while removing username');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (!saving) {
      setUsername(user?.username || '');
      setError(null);
      setAvailabilityStatus({ checked: false, available: false });
      setCheckingAvailability(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <BlockModal>
      <BlockModalContent>
        <FlexBlock justify="space-between" align="center" style={{ marginBottom: '1.5rem' }}>
          <FlexBlock align="center" gap="0.5rem">
            <User size={24} style={{ color: blockTheme.accent }} />
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.5rem', 
              color: blockTheme.darkText,
              fontWeight: '600'
            }}>
              {user?.username ? 'Update Username' : 'Set Username'}
            </h2>
          </FlexBlock>
          <BlockButton 
            onClick={handleClose}
            disabled={saving}
            color="pastelCoral"
            style={{ 
              padding: '0.5rem',
              minWidth: 'auto'
            }}
          >
            <X size={18} />
          </BlockButton>
        </FlexBlock>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ 
            color: blockTheme.textMuted, 
            fontSize: '0.9rem', 
            marginBottom: '1rem',
            lineHeight: '1.5'
          }}>
            {user?.username 
              ? 'Update your display name for the gaming platform.' 
              : 'Choose a display name for the gaming platform. This will be visible to other players.'
            }
          </p>
          
          {displayInfo && (
            <div style={{ 
              background: blockTheme.pastelMint,
              border: `3px solid ${blockTheme.darkText}`,
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem',
              boxShadow: `4px 4px 0px ${blockTheme.shadowDark}`
            }}>
              <p style={{ 
                color: blockTheme.darkText, 
                fontSize: '0.8rem', 
                margin: '0 0 0.5rem 0',
                fontWeight: '600'
              }}>
                Current Display Method:
              </p>
              <p style={{ 
                color: blockTheme.darkText, 
                fontSize: '0.9rem', 
                margin: '0',
                fontFamily: displayInfo.method === 'address' ? 'monospace' : 'inherit'
              }}>
                {displayInfo.method === 'username' && '👤 Username: '}
                {displayInfo.method === 'ens' && '🏷️ ENS: '}
                {displayInfo.method === 'address' && '📋 Address: '}
                <strong>{displayInfo.displayName}</strong>
              </p>
              
              {displayInfo.ensName && displayInfo.method !== 'ens' && (
                <p style={{ 
                  color: blockTheme.textMuted, 
                  fontSize: '0.75rem', 
                  margin: '0.5rem 0 0 0'
                }}>
                  💡 You have ENS name "{displayInfo.ensName}" available
                </p>
              )}
            </div>
          )}
          
          {user?.wallet_address && (
            <p style={{ 
              color: blockTheme.textMuted, 
              fontSize: '0.8rem', 
              marginBottom: '1rem',
              fontFamily: 'monospace'
            }}>
              Wallet: {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
            </p>
          )}

          <BlockInput
            type="text"
            placeholder="Enter username (3-20 characters)"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setError(null);
            }}
            disabled={saving || loading}
            style={{ width: '100%' }}
            maxLength={20}
          />

          {/* Username requirements */}
          <div style={{ 
            fontSize: '0.75rem', 
            color: blockTheme.textMuted, 
            margin: '0.5rem 0',
            lineHeight: '1.4'
          }}>
            Requirements: 3-20 characters, letters, numbers, underscores, and hyphens only
          </div>

          {/* Check Availability Button */}
          <FlexBlock gap="0.75rem" align="center" style={{ margin: '0.75rem 0' }}>
            <BlockButton
              variant="secondary"
              size="sm"
              onClick={checkAvailability}
              disabled={!username.trim() || checkingAvailability || saving}
            >
              {checkingAvailability ? 'Checking...' : 'Check Availability'}
            </BlockButton>
            
            {availabilityStatus.checked && (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '0.5rem',
                fontSize: '0.85rem',
                fontWeight: '600'
              }}>
                {availabilityStatus.available ? (
                  <>
                    <span style={{ color: blockTheme.success }}>✓</span>
                    <span style={{ color: blockTheme.success }}>Available</span>
                  </>
                ) : (
                  <>
                    <span style={{ color: blockTheme.error }}>✗</span>
                    <span style={{ color: blockTheme.error }}>Not Available</span>
                  </>
                )}
              </div>
            )}
          </FlexBlock>

          {error && (
            <p style={{ 
              color: blockTheme.error, 
              fontSize: '0.8rem', 
              margin: '0.5rem 0 0 0' 
            }}>
              {error}
            </p>
          )}
        </div>

        <FlexBlock gap="1rem" justify="space-between">
          <div>
            {user?.username && displayInfo?.canRemoveUsername && (
              <BlockButton 
                onClick={handleRemove}
                disabled={saving}
                color="pastelCoral"
              >
                {saving ? (
                  <FlexBlock align="center" gap="0.5rem">
                    <SimpleRetroLoader size="1rem" />
                    Removing...
                  </FlexBlock>
                ) : (
                  <FlexBlock align="center" gap="0.5rem">
                    <Trash2 size={16} />
                    Remove Username
                  </FlexBlock>
                )}
              </BlockButton>
            )}
          </div>
          
          <FlexBlock gap="1rem">
            <BlockButton 
              onClick={handleClose}
              disabled={saving}
              color="pastelBlue"
            >
              Cancel
            </BlockButton>
            <BlockButton 
              onClick={handleSave}
              disabled={saving || loading || !username.trim() || !availabilityStatus.checked || !availabilityStatus.available}
              color="pastelLavender"
            >
              {saving ? (
                <FlexBlock align="center" gap="0.5rem">
                  <SimpleRetroLoader size="1rem" />
                  Saving...
                </FlexBlock>
              ) : (
                <FlexBlock align="center" gap="0.5rem">
                  <Save size={16} />
                  Save Username
                </FlexBlock>
              )}
            </BlockButton>
          </FlexBlock>
        </FlexBlock>
      </BlockModalContent>
    </BlockModal>
  );
};