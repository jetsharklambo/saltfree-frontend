import React, { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, waitForReceipt } from 'thirdweb';
import { X, Trophy, Percent, Award } from 'lucide-react';
import { getGameContract, validatePrizeSplits, formatPrizeSplit } from '../thirdweb';
import { 
  GlassModal, 
  GlassModalContent, 
  GlassButton, 
  GlassInput,
  FlexContainer, 
  LoadingSpinner,
  glassTheme 
} from '../styles/glass';
import styled from '@emotion/styled';

const PrizeSplitsModalWrapper = styled(GlassModal)`
  z-index: 1100; // Higher than GameDetailModal (z-index: 1000)
`;

interface PrizeSplitsModalProps {
  gameCode: string;
  onClose: () => void;
  onSuccess: (splits: number[]) => void;
  currentSplits?: number[];
  isCreationMode?: boolean; // Don't call contract, just return splits
}

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const ModalTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const CloseButton = styled.button`
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(255, 255, 255, 0.15);
    color: rgba(255, 255, 255, 0.9);
    transform: scale(1.05);
  }
`;

const SplitsContainer = styled.div`
  margin-bottom: 2rem;
`;

const SplitInputGroup = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
`;

const PlaceIcon = styled.div<{ place: number }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${({ place }) => {
    const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    return colors[place - 1] || '#666';
  }};
  color: #000;
  font-weight: bold;
  font-size: 1.2rem;
`;

const SplitInput = styled(GlassInput)`
  flex: 1;
  max-width: 120px;
`;

const PercentLabel = styled.span`
  color: rgba(255, 255, 255, 0.7);
  font-weight: 500;
`;

const PresetButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const PresetButton = styled(GlassButton)<{ active?: boolean }>`
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  background: ${({ active }) => 
    active 
      ? 'rgba(120, 119, 198, 0.3)' 
      : 'rgba(255, 255, 255, 0.05)'
  };
  border: 1px solid ${({ active }) => 
    active 
      ? 'rgba(120, 119, 198, 0.5)' 
      : 'rgba(255, 255, 255, 0.1)'
  };
`;

const ValidationError = styled.div`
  color: #ff6b6b;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 8px;
`;

const InfoBox = styled.div`
  padding: 1rem;
  background: rgba(102, 126, 234, 0.15);
  border: 1px solid rgba(102, 126, 234, 0.3);
  border-radius: 12px;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
`;

const presets = [
  { name: '🏆 Winner Takes All', splits: [] },
  { name: '60/40', splits: [600, 400] },
  { name: '50/30/20', splits: [500, 300, 200] },
  { name: '70/20/10', splits: [700, 200, 100] },
  { name: '80/15/5', splits: [800, 150, 50] },
];

const PrizeSplitsModal: React.FC<PrizeSplitsModalProps> = ({ 
  gameCode, 
  onClose, 
  onSuccess, 
  currentSplits = [],
  isCreationMode = false
}) => {
  const account = useActiveAccount();
  const [splits, setSplits] = useState<number[]>(
    Array.isArray(currentSplits) && currentSplits.length > 0 ? currentSplits.filter(s => typeof s === 'number' && s >= 0) : []
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contract = getGameContract();

  const handleSplitChange = (index: number, value: string) => {
    const numericValue = parseFloat(value) * 10; // Convert percentage to basis points
    
    // Safety checks for invalid values
    if (isNaN(numericValue) || numericValue < 0 || numericValue > 999) return;
    if (index < 0 || index >= splits.length) return;

    const newSplits = [...splits];
    newSplits[index] = Math.round(numericValue);
    setSplits(newSplits);
  };

  const addSplit = () => {
    if (splits.length < 3) {
      // Calculate a reasonable default based on existing splits
      const remainingPercentage = 1000 - splits.reduce((sum, split) => sum + split, 0);
      const defaultValue = remainingPercentage > 0 ? Math.min(remainingPercentage, 333) : 333; // Default to 33.3% or remaining
      setSplits([...splits, defaultValue]);
    }
  };

  const removeSplit = (index: number) => {
    if (index < 0 || index >= splits.length) return;
    const newSplits = splits.filter((_, i) => i !== index);
    setSplits(newSplits);
  };

  const applyPreset = (preset: number[]) => {
    setSplits([...preset]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validatePrizeSplits(splits);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    
    // In creation mode, just return the splits without calling contract
    if (isCreationMode) {
      onSuccess(splits);
      return;
    }
    
    if (!account) return;
    setIsSubmitting(true);

    try {
      const transaction = prepareContractCall({
        contract,
        method: "function setPrizeSplits(string code, uint256[] splits)",
        params: [gameCode, splits]
      });

      const { transactionHash } = await sendTransaction({
        transaction,
        account
      });

      console.log('Prize splits transaction hash:', transactionHash);
      
      await waitForReceipt({
        client: contract.client,
        chain: contract.chain,
        transactionHash
      });

      onSuccess(splits);
      onClose();
    } catch (error) {
      console.error('Error setting prize splits:', error);
      setValidationError(error instanceof Error ? error.message : 'Failed to set prize splits');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (splits.length === 0) {
      setValidationError(null);
      return;
    }

    const error = validatePrizeSplits(splits);
    setValidationError(error);
  }, [splits]);

  const totalPercentage = splits.reduce((sum, split) => sum + split, 0) / 10;

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Close modal when clicking on backdrop
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    // Prevent event propagation when clicking inside modal content
    e.stopPropagation();
  };

  return (
    <PrizeSplitsModalWrapper onClick={handleBackdropClick}>
      <GlassModalContent onClick={handleContentClick}>
        <ModalHeader>
          <ModalTitle>
            <Trophy size={20} />
            Prize Distribution
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <InfoBox>
          Configure how winnings are split between winners. Leave empty for winner-takes-all.
        </InfoBox>

        <PresetButtons>
          {presets.map((preset, index) => (
            <PresetButton
              key={index}
              active={JSON.stringify(preset.splits) === JSON.stringify(splits)}
              onClick={() => applyPreset(preset.splits)}
            >
              {preset.name}
            </PresetButton>
          ))}
        </PresetButtons>

        <form onSubmit={handleSubmit}>
          <SplitsContainer>
            {splits.map((split, index) => (
              <SplitInputGroup key={index}>
                <PlaceIcon place={index + 1}>
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                </PlaceIcon>
                <SplitInput
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="99.9"
                  value={split > 0 ? (split / 10).toFixed(1) : "0.1"}
                  onChange={(e) => handleSplitChange(index, e.target.value)}
                  placeholder="0.1"
                />
                <PercentLabel>%</PercentLabel>
                <GlassButton
                  type="button"
                  onClick={() => removeSplit(index)}
                  style={{ padding: '0.5rem', minWidth: 'auto' }}
                >
                  <X size={16} />
                </GlassButton>
              </SplitInputGroup>
            ))}

            {splits.length < 3 && (
              <GlassButton
                type="button"
                onClick={addSplit}
                style={{ 
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px dashed rgba(255, 255, 255, 0.3)',
                  marginTop: '0.5rem'
                }}
              >
                <Award size={16} style={{ marginRight: '0.5rem' }} />
                Add Winner Rank
              </GlassButton>
            )}
          </SplitsContainer>

          {splits.length > 0 && (
            <div style={{ 
              textAlign: 'center', 
              marginBottom: '1rem',
              color: totalPercentage === 100 ? '#4CAF50' : '#ff6b6b'
            }}>
              Total: {totalPercentage.toFixed(1)}% / 100%
            </div>
          )}

          {validationError && (
            <ValidationError>{validationError}</ValidationError>
          )}

          <FlexContainer style={{ gap: '1rem', marginTop: '2rem' }}>
            <GlassButton
              type="button"
              onClick={onClose}
              style={{ 
                background: 'rgba(255, 255, 255, 0.05)',
                flex: 1
              }}
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              disabled={isSubmitting || (splits.length > 0 && !!validationError)}
              style={{ 
                background: glassTheme.accent,
                flex: 1
              }}
            >
              {isSubmitting ? (
                <FlexContainer style={{ gap: '0.5rem' }}>
                  <LoadingSpinner size={16} />
                  Setting Splits...
                </FlexContainer>
              ) : (
                isCreationMode ? 'Save Prize Splits' : 'Set Prize Splits'
              )}
            </GlassButton>
          </FlexContainer>
        </form>
      </GlassModalContent>
    </PrizeSplitsModalWrapper>
  );
};

export default PrizeSplitsModal;