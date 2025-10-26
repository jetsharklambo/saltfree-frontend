import React, { useState } from 'react';
import { useActiveAccount } from "thirdweb/react";
import toast from 'react-hot-toast';
import { X, Plus, Shield, Trash2, Trophy } from 'lucide-react';
import { BASE_TOKENS, parseTokenAmount, isETH } from '../thirdweb';
import { resolveToWalletAddress, formatResolvedAddress, ResolvedAddress } from '../utils/addressResolver';
import { gaslessCreateGame } from '../utils/gaslessHelper';
import { 
  BlockModal, 
  BlockModalContent, 
  BlockButton, 
  BlockInput, 
  BlockSelect,
  FlexBlock,
  blockTheme
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

const PrizeSplitsSection = styled.div`
  background: ${blockTheme.pastelYellow};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
`;

const PrizeSplitsTitle = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 1rem 0;
  color: ${blockTheme.darkText};
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const PrizeSplitRow = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
  align-items: center;
`;

const PrizeSplitLabel = styled.div`
  min-width: 80px;
  font-weight: 600;
  color: ${blockTheme.darkText};
  font-size: 0.9rem;
`;

const PrizeSplitInput = styled(BlockInput)`
  flex: 1;
`;

const PrizeSplitPercentage = styled.div`
  min-width: 60px;
  font-weight: 600;
  color: ${blockTheme.darkText};
  font-size: 0.9rem;
  text-align: right;
`;

const PrizeTotalIndicator = styled.div<{ $isValid: boolean }>`
  background: ${({ $isValid }) =>
    $isValid ? blockTheme.pastelMint : blockTheme.pastelCoral};
  border: 2px solid ${({ $isValid }) =>
    $isValid ? blockTheme.success : blockTheme.error};
  border-radius: 8px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  color: ${blockTheme.darkText};
  font-weight: 600;
  margin-top: 0.5rem;
  box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
  text-align: center;
`;

const PresetButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const PresetButton = styled.button`
  padding: 0.5rem 1rem;
  border: 2px solid ${blockTheme.darkText};
  border-radius: 8px;
  background: ${blockTheme.pastelBlue};
  color: ${blockTheme.darkText};
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 2px 2px 0px ${blockTheme.shadowDark};

  &:hover {
    background: ${blockTheme.pastelMint};
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

// Token Selection Button Styles
const TokenSelectionSection = styled.div`
  background: ${blockTheme.pastelMint};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
`;

const TokenButtonGroup = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const TokenButton = styled.button<{ $selected: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 1.5rem;
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  background: ${({ $selected }) => 
    $selected ? blockTheme.pastelBlue : blockTheme.lightText};
  color: ${blockTheme.darkText};
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: ${({ $selected }) => 
    $selected ? `6px 6px 0px ${blockTheme.shadowDark}` : `4px 4px 0px ${blockTheme.shadowDark}`};
  font-size: 0.9rem;
  
  &:hover {
    background: ${({ $selected }) => 
      $selected ? blockTheme.pastelBlue : blockTheme.pastelPeach};
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
  }
  
  &:active {
    transform: translate(1px, 1px);
    box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
  }
`;

const TokenIcon = styled.div`
  width: 20px;
  height: 20px;
  img {
    width: 100%;
    height: 100%;
    border-radius: 50%;
  }
`;

const CustomTokenSection = styled(motion.div)`
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 2px dashed ${blockTheme.textMuted};
`;

const AmountInputSection = styled.div`
  margin-top: 1.5rem;
`;

const CreateGameModal: React.FC<CreateGameModalProps> = ({ onClose, onSuccess }) => {
  const account = useActiveAccount();
  const [formData, setFormData] = useState({
    buyIn: '0.001',
    maxPlayers: 4,
  });
  const [selectedToken, setSelectedToken] = useState<string>(BASE_TOKENS.ETH.address);
  const [buyInAmount, setBuyInAmount] = useState('0.001');
  const [isCustomToken, setIsCustomToken] = useState(false);
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [creating, setCreating] = useState(false);
  const [transactionState, setTransactionState] = useState<'idle' | 'submitting' | 'waiting' | 'extracting'>('idle');
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [error, setError] = useState('');
  const [createdGameCode, setCreatedGameCode] = useState<string>('');

  // Decision type state
  const [decisionType, setDecisionType] = useState<'player_vote' | 'judge'>('player_vote');

  // Prize splits state (basis points: 10000 = 100%)
  const [prizeSplits, setPrizeSplits] = useState<number[]>([10000]); // Default: winner takes all
  
  // Judges state
  const [judgeInput, setJudgeInput] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolvedAddress, setResolvedAddress] = useState<ResolvedAddress | null>(null);
  const [judges, setJudges] = useState<ResolvedAddress[]>([]);
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  // Helper function to calculate majority needed for player voting
  const calculateMajority = (totalPlayers: number): number => {
    return Math.floor(totalPlayers / 2) + 1;
  };

  // Helper functions for prize splits
  const getPrizeSplitTotal = (): number => {
    return prizeSplits.reduce((sum, split) => sum + split, 0);
  };

  const isPrizeSplitValid = (): boolean => {
    return getPrizeSplitTotal() === 10000;
  };

  const setPrizePreset = (preset: 'winner-takes-all' | '70-30' | '60-30-10' | '50-30-20') => {
    switch (preset) {
      case 'winner-takes-all':
        setPrizeSplits([10000]);
        break;
      case '70-30':
        setPrizeSplits([7000, 3000]);
        break;
      case '60-30-10':
        setPrizeSplits([6000, 3000, 1000]);
        break;
      case '50-30-20':
        setPrizeSplits([5000, 3000, 2000]);
        break;
    }
  };

  const handlePrizeSplitChange = (index: number, value: string) => {
    const numValue = parseInt(value) || 0;
    const newSplits = [...prizeSplits];
    newSplits[index] = Math.max(0, Math.min(10000, numValue));
    setPrizeSplits(newSplits);
  };

  const addPrizePosition = () => {
    if (prizeSplits.length < 5) {
      setPrizeSplits([...prizeSplits, 0]);
    }
  };

  const removePrizePosition = (index: number) => {
    if (prizeSplits.length > 1) {
      setPrizeSplits(prizeSplits.filter((_, i) => i !== index));
    }
  };

  // Token selection handlers
  const handleTokenSelection = (tokenAddress: string) => {
    setSelectedToken(tokenAddress);
    setIsCustomToken(false);
    setError(''); // Clear any previous errors
  };

  const handleCustomTokenToggle = () => {
    setIsCustomToken(true);
    setSelectedToken(customTokenAddress || '');
    setError('');
  };

  const handleCustomTokenAddressChange = (address: string) => {
    setCustomTokenAddress(address);
    if (isCustomToken) {
      setSelectedToken(address);
    }
  };

  // Get the effective token address to use
  const getEffectiveTokenAddress = () => {
    return isCustomToken ? customTokenAddress : selectedToken;
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
    const buyInValue = parseFloat(buyInAmount);
    if (buyInAmount !== '0' && (isNaN(buyInValue) || buyInValue <= 0)) {
      throw new Error('Buy-in must be greater than 0 or set to 0 for free games');
    }

    if (formData.maxPlayers < 2 || formData.maxPlayers > 50) {
      throw new Error('Max players must be between 2 and 50');
    }

    if (!isPrizeSplitValid()) {
      throw new Error('Prize splits must total exactly 100%');
    }

    if (prizeSplits.length > formData.maxPlayers) {
      throw new Error(`Cannot have more prize positions (${prizeSplits.length}) than max players (${formData.maxPlayers})`);
    }
  };

  // Generate a random game code (3-10 alphanumeric characters)
  const generateGameCode = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const length = 6; // Use 6 characters for game codes
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
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

      // Parse buy-in amount based on selected token
      const effectiveTokenAddress = getEffectiveTokenAddress();
      const selectedTokenInfo = Object.values(BASE_TOKENS).find(token => token.address === effectiveTokenAddress);
      const tokenDecimals = selectedTokenInfo?.decimals || 18;
      const buyInTokenAmount = parseFloat(buyInAmount) === 0 ? BigInt(0) : parseTokenAmount(buyInAmount, tokenDecimals);

      console.log('Creating game with:', {
        buyIn: buyInAmount,
        buyInTokenAmount: buyInTokenAmount.toString(),
        token: effectiveTokenAddress,
        maxPlayers: formData.maxPlayers,
        account: account.address
      });

      // Call gasless create function (user will sign, backend will pay gas)
      const result = await gaslessCreateGame(
        account, // Pass account object for signing
        buyInTokenAmount.toString(),
        effectiveTokenAddress,
        formData.maxPlayers,
        [], // No judges for now
        prizeSplits
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to create game');
      }

      console.log('Game created successfully via gasless relay!');
      console.log('Game Code:', result.gameCode);
      console.log('TX Hash:', result.txHash);

      toast.success(`Game ${result.gameCode} created! ⚡ Gasless transaction`, {
        duration: 3000,
        icon: '🎮'
      });

      // Call onSuccess with game details
      onSuccess({
        gameCode: result.gameCode!,
        buyIn: buyInAmount,
        maxPlayers: formData.maxPlayers,
        transactionHash: result.txHash,
        blockNumber: result.blockNumber
      });

      onClose();

    } catch (err: any) {
      console.error('Failed to create game:', err);

      let errorMessage = 'Failed to create game';

      if (err.message?.includes('Signature cancelled')) {
        errorMessage = 'Signature cancelled by user';
      } else if (err.message?.includes('user rejected')) {
        errorMessage = 'Transaction cancelled by user';
      } else if (err.message?.includes('Relay failed')) {
        errorMessage = 'Gasless relay failed - backend may be offline';
      } else if (err.message) {
        errorMessage = err.message;
      }

      setError(errorMessage);

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
          <TokenSelectionSection>
            <FormLabel>Buy-in Token & Amount (Set to 0 for free games)</FormLabel>
            <TokenButtonGroup>
              <TokenButton 
                type="button"
                $selected={!isCustomToken && selectedToken === BASE_TOKENS.ETH.address}
                onClick={() => handleTokenSelection(BASE_TOKENS.ETH.address)}
              >
                <TokenIcon dangerouslySetInnerHTML={{ __html: atob(BASE_TOKENS.ETH.icon.split(',')[1]) }} />
                ETH
              </TokenButton>
              
              <TokenButton 
                type="button"
                $selected={!isCustomToken && selectedToken === BASE_TOKENS.USDC.address}
                onClick={() => handleTokenSelection(BASE_TOKENS.USDC.address)}
              >
                <TokenIcon dangerouslySetInnerHTML={{ __html: atob(BASE_TOKENS.USDC.icon.split(',')[1]) }} />
                USDC
              </TokenButton>
              
              <TokenButton 
                type="button"
                $selected={isCustomToken}
                onClick={handleCustomTokenToggle}
              >
                🔗 Custom Token
              </TokenButton>
            </TokenButtonGroup>

            <AnimatePresence>
              {isCustomToken && (
                <CustomTokenSection
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <FormLabel>Token Address</FormLabel>
                  <BlockInput
                    type="text"
                    placeholder="0x... (paste ERC20 token address)"
                    value={customTokenAddress}
                    onChange={(e) => handleCustomTokenAddressChange(e.target.value)}
                  />
                </CustomTokenSection>
              )}
            </AnimatePresence>

            <AmountInputSection>
              <FormLabel>Buy-in Amount</FormLabel>
              <BlockInput
                type="text"
                placeholder="0.001"
                value={buyInAmount}
                onChange={(e) => setBuyInAmount(e.target.value)}
              />
            </AmountInputSection>
          </TokenSelectionSection>

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

          <PrizeSplitsSection>
            <PrizeSplitsTitle>
              <Trophy size={16} />
              Prize Distribution
            </PrizeSplitsTitle>

            <InfoBox variant="info" style={{ marginBottom: '1rem' }}>
              Configure how prizes are distributed among winners. Total must equal 100%. Values are in basis points (100 = 1%).
            </InfoBox>

            <PresetButtons>
              <PresetButton type="button" onClick={() => setPrizePreset('winner-takes-all')}>
                Winner Takes All
              </PresetButton>
              <PresetButton type="button" onClick={() => setPrizePreset('70-30')}>
                70% / 30%
              </PresetButton>
              <PresetButton type="button" onClick={() => setPrizePreset('60-30-10')}>
                60% / 30% / 10%
              </PresetButton>
              <PresetButton type="button" onClick={() => setPrizePreset('50-30-20')}>
                50% / 30% / 20%
              </PresetButton>
            </PresetButtons>

            {prizeSplits.map((split, index) => (
              <PrizeSplitRow key={index}>
                <PrizeSplitLabel>{index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`} Place:</PrizeSplitLabel>
                <PrizeSplitInput
                  type="number"
                  min="0"
                  max="10000"
                  value={split}
                  onChange={(e) => handlePrizeSplitChange(index, e.target.value)}
                  placeholder="Enter basis points (100 = 1%)"
                />
                <PrizeSplitPercentage>{(split / 100).toFixed(1)}%</PrizeSplitPercentage>
                {prizeSplits.length > 1 && (
                  <RemoveJudgeButton type="button" onClick={() => removePrizePosition(index)}>
                    <Trash2 size={14} />
                  </RemoveJudgeButton>
                )}
              </PrizeSplitRow>
            ))}

            {prizeSplits.length < 5 && (
              <BlockButton
                type="button"
                variant="secondary"
                onClick={addPrizePosition}
                style={{ marginTop: '0.5rem' }}
              >
                <Plus size={16} />
                Add Prize Position
              </BlockButton>
            )}

            <PrizeTotalIndicator $isValid={isPrizeSplitValid()}>
              {isPrizeSplitValid() ? '✅' : '⚠️'} Total: {(getPrizeSplitTotal() / 100).toFixed(1)}%
              {isPrizeSplitValid() ? ' (Valid)' : ` (Must be 100%, currently ${(getPrizeSplitTotal() / 100).toFixed(1)}%)`}
            </PrizeTotalIndicator>
          </PrizeSplitsSection>

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