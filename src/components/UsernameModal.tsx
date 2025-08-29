import React, { useState, useEffect } from 'react';
import { X, User, Save, Trash2 } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { getDisplayNameInfo } from '../utils/userUtils';
import { ensCache } from '../utils/ensUtils';
import { useActiveAccount } from "thirdweb/react";
import {
  GlassModal,
  GlassModalContent,
  GlassButton,
  GlassInput,
  FlexContainer,
  LoadingSpinner
} from '../styles/glass';

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

  const handleSave = async () => {
    if (!username.trim()) {
      setError('Username cannot be empty');
      return;
    }

    if (username.trim().length < 3) {
      setError('Username must be at least 3 characters');
      return;
    }

    if (username.trim().length > 20) {
      setError('Username must be 20 characters or less');
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
    } catch (err) {
      setError('An error occurred while updating username');
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
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <GlassModal>
      <GlassModalContent>
        <FlexContainer justify="space-between" align="center" style={{ marginBottom: '1.5rem' }}>
          <FlexContainer align="center" gap="0.5rem">
            <User size={24} style={{ color: 'rgba(139, 92, 246, 0.9)' }} />
            <h2 style={{ 
              margin: 0, 
              fontSize: '1.5rem', 
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: '600'
            }}>
              {user?.username ? 'Update Username' : 'Set Username'}
            </h2>
          </FlexContainer>
          <GlassButton 
            onClick={handleClose}
            disabled={saving}
            style={{ 
              padding: '0.5rem',
              minWidth: 'auto',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)'
            }}
          >
            <X size={18} />
          </GlassButton>
        </FlexContainer>

        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{ 
            color: 'rgba(255, 255, 255, 0.7)', 
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
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '0.75rem',
              marginBottom: '1rem'
            }}>
              <p style={{ 
                color: 'rgba(255, 255, 255, 0.8)', 
                fontSize: '0.8rem', 
                margin: '0 0 0.5rem 0',
                fontWeight: '600'
              }}>
                Current Display Method:
              </p>
              <p style={{ 
                color: 'rgba(255, 255, 255, 0.9)', 
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
                  color: 'rgba(255, 255, 255, 0.6)', 
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
              color: 'rgba(255, 255, 255, 0.5)', 
              fontSize: '0.8rem', 
              marginBottom: '1rem',
              fontFamily: 'monospace'
            }}>
              Wallet: {user.wallet_address.slice(0, 6)}...{user.wallet_address.slice(-4)}
            </p>
          )}

          <GlassInput
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

          {error && (
            <p style={{ 
              color: 'rgba(239, 68, 68, 0.9)', 
              fontSize: '0.8rem', 
              margin: '0.5rem 0 0 0' 
            }}>
              {error}
            </p>
          )}
        </div>

        <FlexContainer gap="1rem" justify="space-between">
          <div>
            {user?.username && displayInfo?.canRemoveUsername && (
              <GlassButton 
                onClick={handleRemove}
                disabled={saving}
                style={{ 
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                {saving ? (
                  <FlexContainer align="center" gap="0.5rem">
                    <LoadingSpinner size="1rem" />
                    Removing...
                  </FlexContainer>
                ) : (
                  <FlexContainer align="center" gap="0.5rem">
                    <Trash2 size={16} />
                    Remove Username
                  </FlexContainer>
                )}
              </GlassButton>
            )}
          </div>
          
          <FlexContainer gap="1rem">
            <GlassButton 
              onClick={handleClose}
              disabled={saving}
              style={{ 
                background: 'rgba(107, 114, 128, 0.2)',
                border: '1px solid rgba(107, 114, 128, 0.3)'
              }}
            >
              Cancel
            </GlassButton>
            <GlassButton 
              onClick={handleSave}
              disabled={saving || loading || !username.trim()}
              style={{ 
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)'
              }}
            >
              {saving ? (
                <FlexContainer align="center" gap="0.5rem">
                  <LoadingSpinner size="1rem" />
                  Saving...
                </FlexContainer>
              ) : (
                <FlexContainer align="center" gap="0.5rem">
                  <Save size={16} />
                  Save Username
                </FlexContainer>
              )}
            </GlassButton>
          </FlexContainer>
        </FlexContainer>
      </GlassModalContent>
    </GlassModal>
  );
};