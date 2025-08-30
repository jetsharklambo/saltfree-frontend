import React, { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract } from "thirdweb";
import { X, Shield, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import { gameContract } from '../thirdweb';
import { resolveToWalletAddress, formatResolvedAddress, ResolvedAddress } from '../utils/addressResolver';
import {
  GlassButton,
  GlassInput,
  LoadingSpinner,
  glassTheme
} from '../styles/glass';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';

interface JudgesModalProps {
  onClose: () => void;
}

const ModalOverlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
`;

const ModalContainer = styled(motion.div)`
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 2rem;
  max-width: 600px;
  width: 100%;
  position: relative;
  max-height: 80vh;
  overflow-y: auto;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const ModalTitle = styled.h2`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.9), ${glassTheme.primary});
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CloseButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
    color: white;
  }
`;

const Description = styled.p`
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 2rem;
  font-size: 0.9rem;
  line-height: 1.5;
`;

const AddJudgeSection = styled.div`
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

const AddJudgeTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: rgba(255, 255, 255, 0.9);
`;

const InputRow = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
`;

const ResolvedAddressInfo = styled(motion.div)<{ $hasError?: boolean }>`
  background: ${({ $hasError }) => 
    $hasError ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)'};
  border: 1px solid ${({ $hasError }) => 
    $hasError ? 'rgba(239, 68, 68, 0.3)' : 'rgba(34, 197, 94, 0.3)'};
  border-radius: 12px;
  padding: 0.75rem;
  font-size: 0.85rem;
  color: ${({ $hasError }) => 
    $hasError ? '#ff6b6b' : '#4ade80'};
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: monospace;
`;

const JudgesListSection = styled.div`
  margin-bottom: 2rem;
`;

const JudgesListTitle = styled.h3`
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: rgba(255, 255, 255, 0.9);
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const JudgeItem = styled(motion.div)`
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.25);
  }
`;

const JudgeInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const JudgeDisplayName = styled.div`
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  font-size: 0.95rem;
`;

const JudgeAddress = styled.div`
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.6);
  font-family: monospace;
`;

const RemoveButton = styled.button`
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  border-radius: 8px;
  color: #ff6b6b;
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(239, 68, 68, 0.3);
    border-color: rgba(239, 68, 68, 0.6);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 2rem;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
`;

const ErrorMessage = styled(motion.div)`
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
  color: #ff6b6b;
  font-size: 0.9rem;
`;

const SaveSection = styled.div`
  padding-top: 1.5rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
`;

const SaveInfo = styled.div`
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.6);
  flex: 1;
`;

const JudgesModal: React.FC<JudgesModalProps> = ({ onClose }) => {
  const account = useActiveAccount();
  const [judgeInput, setJudgeInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<ResolvedAddress | null>(null);
  const [judges, setJudges] = useState<ResolvedAddress[]>([]);
  const [currentJudges, setCurrentJudges] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load current judges from contract
  useEffect(() => {
    loadCurrentJudges();
  }, [account]);

  const loadCurrentJudges = async () => {
    if (!account) return;

    try {
      setLoading(true);
      const judges = await readContract({
        contract: gameContract,
        method: "function judges(address player) view returns (address[] judges)",
        params: [account.address],
      }) as string[];

      console.log('Current judges from contract:', judges);
      setCurrentJudges(judges || []);

      // Convert current judges to ResolvedAddress format for display
      if (judges && judges.length > 0) {
        const resolved = await Promise.all(
          judges.map(async (address) => {
            const result = await resolveToWalletAddress(address);
            return result;
          })
        );
        setJudges(resolved);
      }
    } catch (error) {
      console.error('Failed to load current judges:', error);
      setError('Failed to load current judges from contract');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = async (value: string) => {
    setJudgeInput(value);
    setResolvedAddress(null);
    
    if (value.trim().length > 2) {
      setResolving(true);
      try {
        const resolved = await resolveToWalletAddress(value.trim());
        setResolvedAddress(resolved);
      } catch (error) {
        console.error('Resolution error:', error);
      } finally {
        setResolving(false);
      }
    }
  };

  const handleAddJudge = () => {
    if (!resolvedAddress || resolvedAddress.error || !resolvedAddress.address) return;

    // Check if already exists
    const existsInList = judges.some(judge => 
      judge.address.toLowerCase() === resolvedAddress.address.toLowerCase()
    );

    if (existsInList) {
      setError('This judge is already in your list');
      return;
    }

    // Add to local list
    setJudges(prev => [...prev, resolvedAddress]);
    setJudgeInput('');
    setResolvedAddress(null);
    setError('');
  };

  const handleRemoveJudge = (addressToRemove: string) => {
    setJudges(prev => prev.filter(judge => 
      judge.address.toLowerCase() !== addressToRemove.toLowerCase()
    ));
  };

  const handleSaveJudges = async () => {
    if (!account) return;

    try {
      setSaving(true);
      setError('');

      const judgeAddresses = judges.map(judge => judge.address);
      console.log('Saving judges to contract:', judgeAddresses);

      const transaction = prepareContractCall({
        contract: gameContract,
        method: "function setJudges(address[] judgeList)",
        params: [judgeAddresses],
      });

      await sendTransaction({
        transaction,
        account,
      });

      console.log('✅ Judges updated successfully');
      onClose();
    } catch (error: any) {
      console.error('Failed to save judges:', error);
      setError(error.message || 'Failed to save judges to contract');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(judges.map(j => j.address)) !== JSON.stringify(currentJudges);

  return (
    <ModalOverlay
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <ModalContainer
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        onClick={e => e.stopPropagation()}
      >
        <ModalHeader>
          <ModalTitle>
            <Shield size={20} />
            Manage Judges
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <Description>
          Set trusted judges who can join your games for free and help determine winners. 
          Judges cannot win games but participate in winner confirmation.
        </Description>

        <AddJudgeSection>
          <AddJudgeTitle>Add Judge</AddJudgeTitle>
          
          <InputRow>
            <GlassInput
              placeholder="Enter username, ENS name, or wallet address"
              value={judgeInput}
              onChange={(e) => handleInputChange(e.target.value)}
              style={{ flex: 1 }}
              disabled={resolving}
            />
            <GlassButton
              variant="secondary"
              onClick={handleAddJudge}
              disabled={!resolvedAddress || resolvedAddress.error || resolving}
            >
              {resolving ? <LoadingSpinner size="sm" /> : <Plus size={16} />}
              Add
            </GlassButton>
          </InputRow>

          <AnimatePresence mode="wait">
            {resolving && (
              <ResolvedAddressInfo
                key="resolving"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <LoadingSpinner size="sm" />
                Resolving address...
              </ResolvedAddressInfo>
            )}

            {resolvedAddress && !resolving && (
              <ResolvedAddressInfo
                key="resolved"
                $hasError={!!resolvedAddress.error}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                {resolvedAddress.error ? (
                  <AlertCircle size={16} />
                ) : (
                  <CheckCircle size={16} />
                )}
                {formatResolvedAddress(resolvedAddress)}
              </ResolvedAddressInfo>
            )}
          </AnimatePresence>
        </AddJudgeSection>

        <JudgesListSection>
          <JudgesListTitle>
            <Shield size={16} />
            Current Judges ({judges.length})
          </JudgesListTitle>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <LoadingSpinner />
              Loading current judges...
            </div>
          ) : judges.length === 0 ? (
            <EmptyState>
              No judges set. Add judges to enable gasless game participation for trusted players.
            </EmptyState>
          ) : (
            <AnimatePresence>
              {judges.map((judge, index) => (
                <JudgeItem
                  key={judge.address}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <JudgeInfo>
                    <JudgeDisplayName>
                      {judge.method === 'ens' && '🏷️ '}
                      {judge.method === 'username' && '👤 '}
                      {judge.method === 'wallet' && '📋 '}
                      {judge.displayName}
                    </JudgeDisplayName>
                    <JudgeAddress>
                      {judge.address}
                    </JudgeAddress>
                  </JudgeInfo>
                  <RemoveButton onClick={() => handleRemoveJudge(judge.address)}>
                    <Trash2 size={16} />
                  </RemoveButton>
                </JudgeItem>
              ))}
            </AnimatePresence>
          )}
        </JudgesListSection>

        <AnimatePresence>
          {error && (
            <ErrorMessage
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {error}
            </ErrorMessage>
          )}
        </AnimatePresence>

        <SaveSection>
          <SaveInfo>
            {hasChanges ? (
              'Changes will be saved to the blockchain'
            ) : (
              'No changes to save'
            )}
          </SaveInfo>
          <GlassButton
            onClick={handleSaveJudges}
            disabled={saving || !hasChanges}
            $loading={saving}
          >
            {saving ? (
              <>
                <LoadingSpinner />
                Saving...
              </>
            ) : (
              <>
                <Shield size={16} />
                Save Judges
              </>
            )}
          </GlassButton>
        </SaveSection>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default JudgesModal;