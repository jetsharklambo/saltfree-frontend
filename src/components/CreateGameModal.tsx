import React, { useState } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, waitForReceipt, getContractEvents } from 'thirdweb';
import toast from 'react-hot-toast';
import { X, Plus, Shield, Trash2 } from 'lucide-react';
import { getGameContract, decodeStringFromHex, client, chain, CONTRACT_ADDRESS } from '../thirdweb';
import { resolveToWalletAddress, formatResolvedAddress, ResolvedAddress } from '../utils/addressResolver';
import { pollForNewGame } from '../utils/gamePolling';
import { 
  BlockModal, 
  BlockModalContent, 
  BlockButton, 
  BlockInput, 
  BlockSelect,
  FlexBlock,
  blockTheme,
  PixelText
} from '../styles/blocks';
import { SimpleRetroLoader } from './RetroLoader';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateGameModalProps {
  onClose: () => void;
  onSuccess: (gameData: { gameCode: string; buyIn: string; maxPlayers: number; transactionHash?: string; blockNumber?: number }) => void;
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
  color: ${blockTheme.darkText};
  margin: 0;
`;

const CloseButton = styled.button`
  background: ${blockTheme.pastelCoral};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 50%;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${blockTheme.darkText};
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  
  &:hover {
    background: ${blockTheme.error};
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
  }
  
  &:active {
    transform: translate(2px, 2px);
    box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
  }
`;

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const FormLabel = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: ${blockTheme.darkText};
  margin-bottom: 0.5rem;
`;

const InfoBox = styled.div<{ variant?: 'info' | 'warning' | 'error' }>`
  padding: 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
  background: ${({ variant = 'info' }) => {
    const backgrounds = {
      info: blockTheme.pastelBlue,
      warning: blockTheme.pastelYellow,
      error: blockTheme.pastelCoral
    };
    return backgrounds[variant];
  }};
  border: 3px solid ${({ variant = 'info' }) => {
    const borders = {
      info: blockTheme.info,
      warning: blockTheme.warning,
      error: blockTheme.error
    };
    return borders[variant];
  }};
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  color: ${blockTheme.darkText};
  font-weight: 600;
`;

const TransactionStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  
  .status-text {
    flex: 1;
  }
  
  .tx-hash {
    font-size: 0.75rem;
    color: ${blockTheme.textMuted};
    margin-top: 0.25rem;
  }
`;

const JudgesSection = styled.div`
  background: ${blockTheme.pastelMint};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
`;

const JudgesSectionTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: ${blockTheme.darkText};
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const JudgeInputRow = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
`;

const ResolvedAddressInfo = styled(motion.div)<{ $hasError?: boolean }>`
  background: ${({ $hasError }) => 
    $hasError ? blockTheme.pastelCoral : blockTheme.pastelMint};
  border: 3px solid ${({ $hasError }) => 
    $hasError ? blockTheme.error : blockTheme.success};
  border-radius: 12px;
  padding: 0.75rem;
  font-size: 0.85rem;
  color: ${blockTheme.darkText};
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-family: monospace;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  font-weight: 600;
`;

const JudgeItem = styled(motion.div)`
  background: ${blockTheme.pastelLavender};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.2s ease;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  
  &:hover {
    background: ${blockTheme.pastelPink};
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
  }
`;

const JudgeInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const JudgeDisplayName = styled.div`
  font-weight: 600;
  color: ${blockTheme.darkText};
  font-size: 0.95rem;
`;

const JudgeAddress = styled.div`
  font-size: 0.8rem;
  color: ${blockTheme.textMuted};
  font-family: monospace;
`;

const RemoveJudgeButton = styled.button`
  background: ${blockTheme.pastelCoral};
  border: 3px solid ${blockTheme.error};
  border-radius: 8px;
  color: ${blockTheme.darkText};
  padding: 0.5rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
  
  &:hover {
    background: ${blockTheme.error};
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0px ${blockTheme.shadowDark};
  }
  
  &:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0px ${blockTheme.shadowDark};
  }
`;

const DecisionTypeSection = styled.div`
  background: ${blockTheme.pastelPeach};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
`;

const DecisionTypeTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: ${blockTheme.darkText};
`;

const RadioGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const RadioOption = styled.label<{ $selected: boolean }>`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: ${({ $selected }) => 
    $selected ? blockTheme.pastelBlue : blockTheme.lightText};
  border: 3px solid ${({ $selected }) => 
    $selected ? blockTheme.info : blockTheme.darkText};
  box-shadow: ${({ $selected }) => 
    $selected ? `6px 6px 0px ${blockTheme.shadowDark}` : `4px 4px 0px ${blockTheme.shadowDark}`};
  
  &:hover {
    background: ${({ $selected }) => 
      $selected ? blockTheme.pastelBlue : blockTheme.pastelMint};
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
  }
`;

const RadioInput = styled.input`
  margin: 0;
  margin-top: 0.125rem;
`;

const RadioContent = styled.div`
  flex: 1;
`;

const RadioTitle = styled.div`
  font-weight: 600;
  color: ${blockTheme.darkText};
  margin-bottom: 0.25rem;
`;

const RadioDescription = styled.div`
  font-size: 0.875rem;
  color: ${blockTheme.textMuted};
  line-height: 1.4;
`;

const MajorityIndicator = styled.div`
  background: ${blockTheme.pastelBlue};
  border: 2px solid ${blockTheme.info};
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  color: ${blockTheme.darkText};
  font-weight: 600;
  margin-top: 0.5rem;
  box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
`;

const CreateGameModal: React.FC<CreateGameModalProps> = ({ onClose, onSuccess }) => {
  const account = useActiveAccount();
  const [formData, setFormData] = useState({
    buyIn: '0.001',
    maxPlayers: 4,
  });
  const [creating, setCreating] = useState(false);
  const [transactionState, setTransactionState] = useState<'idle' | 'submitting' | 'waiting' | 'extracting'>('idle');
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [error, setError] = useState('');
  const [createdGameCode, setCreatedGameCode] = useState<string>('');
  
  // Decision type state
  const [decisionType, setDecisionType] = useState<'player_vote' | 'judge'>('player_vote');
  
  // Judges state
  const [judgeInput, setJudgeInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<ResolvedAddress | null>(null);
  const [judges, setJudges] = useState<ResolvedAddress[]>([]);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const contract = getGameContract();

  // Helper function to calculate majority needed for player voting
  const calculateMajority = (totalPlayers: number): number => {
    return Math.floor(totalPlayers / 2) + 1;
  };

  // Handle judges input change with debounced address resolution
  const handleJudgeInputChange = (value: string) => {
    setJudgeInput(value);
    setResolvedAddress(null);
    
    // Clear existing timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    
    // Set new timer to resolve after 1.5 seconds of no typing
    if (value.trim().length > 2) {
      const timer = setTimeout(async () => {
        setResolving(true);
        try {
          const resolved = await resolveToWalletAddress(value.trim());
          setResolvedAddress(resolved);
        } catch (error) {
          console.error('Judge resolution error:', error);
        } finally {
          setResolving(false);
        }
      }, 1500); // Wait 1.5 seconds after typing stops
      
      setDebounceTimer(timer);
    }
  };

  // Add judge to the list
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

    // Add to judges list
    setJudges(prev => [...prev, resolvedAddress]);
    setJudgeInput('');
    setResolvedAddress(null);
    setError('');
  };

  // Remove judge from the list
  const handleRemoveJudge = (addressToRemove: string) => {
    setJudges(prev => prev.filter(judge => 
      judge.address.toLowerCase() !== addressToRemove.toLowerCase()
    ));
  };

  const validateInputs = () => {
    const buyInValue = parseFloat(formData.buyIn);
    if (isNaN(buyInValue) || buyInValue <= 0 || buyInValue > 10) {
      throw new Error('Buy-in must be between 0.001 and 10 ETH');
    }
    
    if (formData.maxPlayers < 2 || formData.maxPlayers > 50) {
      throw new Error('Max players must be between 2 and 50');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) {
      setError('Please connect your wallet first');
      return;
    }

    try {
      setCreating(true);
      setError('');
      setTransactionState('submitting');

      validateInputs();

      console.log('Creating game with:', {
        buyIn: formData.buyIn,
        maxPlayers: formData.maxPlayers,
        judges: judges.map(j => j.address),
        account: account.address
      });

      const buyInWei = BigInt(Math.floor(parseFloat(formData.buyIn) * 1e18));
      // Use judges only when decision type is 'judge', otherwise empty array for player voting
      const judgeAddresses = decisionType === 'judge' ? judges.map(judge => judge.address) : [];
      console.log('Buy-in in wei:', buyInWei.toString());
      console.log('Decision type:', decisionType);
      console.log('Judge addresses:', judgeAddresses);

      try {
        console.log('Creating game...');
        
        const transaction = prepareContractCall({
          contract,
          method: "function startGame(uint256 buyIn, uint256 maxPlayers, address[] judgeList) returns (string code)",
          params: [buyInWei, BigInt(formData.maxPlayers), judgeAddresses],
        });
        
        const { transactionHash } = await sendTransaction({
          account,
          transaction,
        });

        console.log('Game transaction submitted! Hash:', transactionHash);
        
        // Close modal immediately and let background monitoring handle the rest
        onSuccess({ 
          gameCode: 'PENDING', // Special code to indicate pending status
          buyIn: formData.buyIn, 
          maxPlayers: formData.maxPlayers,
          transactionHash: transactionHash,
          blockNumber: 0 // Will be set when transaction confirms
        });
        
        // Exit early - background monitoring will handle completion
        return;

        // This code has been moved to background monitoring
        // The modal closes immediately after transaction submission
      } catch (apiError: any) {
        console.error('Transaction error:', apiError);
        
        if (apiError.message?.includes('receipt')) {
          throw new Error('Transaction was submitted but confirmation failed. Please check your transaction history.');
        } else if (apiError.message?.includes('timeout')) {
          throw new Error('Transaction is taking longer than expected. Please check your transaction history.');
        } else {
          throw new Error('Smart contract interaction failed. Please try again.');
        }
      }
      
    } catch (err: any) {
      console.error('Failed to create game:', err);
      
      let errorMessage = 'Failed to create game';
      
      if (err.message?.includes('execution reverted')) {
        // Extract the revert reason if available
        const revertMatch = err.message.match(/execution reverted:?\s*([^"\n]+)/);
        if (revertMatch && revertMatch[1]) {
          errorMessage = `Contract error: ${revertMatch[1].trim()}`;
        } else {
          errorMessage = 'Contract rejected the transaction (invalid buy-in amount or max players)';
        }
      } else if (err.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient ETH for gas fees';
      } else if (err.message?.includes('user rejected')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (err.message?.includes('replacement fee too low')) {
        errorMessage = 'Transaction fee too low, try increasing gas price';
      } else if (err.message) {
        // Use the original error message from MetaMask/contract
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      // Also show toast notification for immediate feedback
      toast.error(errorMessage, {
        duration: 5000,
        style: {
          maxWidth: '400px'
        }
      });
    } finally {
      setCreating(false);
      setTransactionState('idle');
      setTransactionHash('');
    }
  };

  const getStatusText = () => {
    switch (transactionState) {
      case 'submitting': return '🚀 Submitting transaction to blockchain...';
      case 'waiting': return '⏳ Transaction submitted! Waiting for confirmation...';
      case 'extracting': return '🎯 Transaction confirmed! Extracting game code...';
      case 'settingPrizes': return '🏆 Setting prize distribution...';
      default: return '';
    }
  };

  return (
    <BlockModal onClick={onClose}>
      <BlockModalContent onClick={e => e.stopPropagation()}>
        <ModalHeader>
          <ModalTitle>Create New Game</ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>
        
        <InfoBox variant="info">
          <strong>Note:</strong> Game code will be auto-generated (e.g., ABC-123)
        </InfoBox>

        {transactionState !== 'idle' && (
          <InfoBox variant="warning">
            <TransactionStatus>
              <SimpleRetroLoader />
              <div className="status-text">
                {getStatusText()}
                {transactionHash && (
                  <div className="tx-hash">
                    Hash: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
                  </div>
                )}
              </div>
            </TransactionStatus>
          </InfoBox>
        )}

        <form onSubmit={handleSubmit}>
          <FormGroup>
            <FormLabel>Buy-in Amount (ETH)</FormLabel>
            <BlockInput
              type="number"
              step="0.001"
              min="0.001"
              max="10"
              value={formData.buyIn}
              onChange={(e) => setFormData(prev => ({ ...prev, buyIn: e.target.value }))}
              required
            />
          </FormGroup>

          <FormGroup>
            <FormLabel>Max Players</FormLabel>
            <BlockSelect
              value={formData.maxPlayers}
              onChange={(e) => setFormData(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) }))}
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].map(num => (
                <option key={num} value={num}>{num} players</option>
              ))}
            </BlockSelect>
          </FormGroup>

          <DecisionTypeSection>
            <DecisionTypeTitle>Winner Decision Method</DecisionTypeTitle>
            <RadioGroup>
              <RadioOption $selected={decisionType === 'player_vote'}>
                <RadioInput
                  type="radio"
                  name="decisionType"
                  value="player_vote"
                  checked={decisionType === 'player_vote'}
                  onChange={(e) => setDecisionType(e.target.value as 'player_vote' | 'judge')}
                />
                <RadioContent>
                  <RadioTitle>Player Vote</RadioTitle>
                  <RadioDescription>
                    Players vote to determine winners. Majority vote required.
                  </RadioDescription>
                  {decisionType === 'player_vote' && (
                    <MajorityIndicator>
                      {calculateMajority(formData.maxPlayers)} out of {formData.maxPlayers} players needed for majority
                    </MajorityIndicator>
                  )}
                </RadioContent>
              </RadioOption>
              
              <RadioOption $selected={decisionType === 'judge'}>
                <RadioInput
                  type="radio"
                  name="decisionType"
                  value="judge"
                  checked={decisionType === 'judge'}
                  onChange={(e) => setDecisionType(e.target.value as 'player_vote' | 'judge')}
                />
                <RadioContent>
                  <RadioTitle>Judge Decision</RadioTitle>
                  <RadioDescription>
                    Designated judges determine winners. Judges vote for free and can override player preferences.
                  </RadioDescription>
                </RadioContent>
              </RadioOption>
            </RadioGroup>
          </DecisionTypeSection>

          {decisionType === 'judge' && (
          <JudgesSection>
            <JudgesSectionTitle>
              <Shield size={16} />
              Judges
            </JudgesSectionTitle>
            
            <InfoBox variant="info" style={{ marginBottom: '1rem' }}>
              Add trusted judges who will determine the winners. Judges vote for free and their decisions are final.
            </InfoBox>
            
            <JudgeInputRow>
              <BlockInput
                placeholder="Enter username, ENS name, or wallet address"
                value={judgeInput}
                onChange={(e) => handleJudgeInputChange(e.target.value)}
                style={{ flex: 1 }}
                disabled={resolving}
              />
              <BlockButton
                variant="secondary"
                onClick={handleAddJudge}
                disabled={!resolvedAddress || resolvedAddress.error || resolving}
                type="button"
              >
                {resolving ? <SimpleRetroLoader size="sm" /> : <Plus size={16} />}
                Add
              </BlockButton>
            </JudgeInputRow>

            <AnimatePresence mode="wait">
              {resolving && (
                <ResolvedAddressInfo
                  key="resolving"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <SimpleRetroLoader size="sm" />
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
                  {resolvedAddress.error ? '⚠️' : '✅'}
                  {formatResolvedAddress(resolvedAddress)}
                </ResolvedAddressInfo>
              )}
            </AnimatePresence>
            
            {judges.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
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
                      <RemoveJudgeButton onClick={() => handleRemoveJudge(judge.address)}>
                        <Trash2 size={16} />
                      </RemoveJudgeButton>
                    </JudgeItem>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </JudgesSection>
          )}

          {error && (
            <InfoBox variant="error">
              {error}
            </InfoBox>
          )}

          <BlockButton
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            $loading={creating}
            disabled={creating}
          >
            {creating ? (
              <FlexBlock align="center" justify="center" gap="0.5rem">
                <SimpleRetroLoader />
                {transactionState === 'submitting' && 'Submitting Transaction...'}
                {transactionState === 'waiting' && 'Waiting for Confirmation...'}
                {transactionState === 'extracting' && 'Extracting Game Code...'}
                {transactionState === 'idle' && 'Creating Game...'}
              </FlexBlock>
            ) : (
              <FlexBlock align="center" justify="center" gap="0.5rem">
                <Plus size={20} />
                Create Game
              </FlexBlock>
            )}
          </BlockButton>
        </form>
        
      </BlockModalContent>
    </BlockModal>
  );
};

export default CreateGameModal;