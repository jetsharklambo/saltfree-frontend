import React, { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, readContract } from "thirdweb";
import toast from 'react-hot-toast';
import { X, Users, Search, Shield, ArrowRightLeft } from 'lucide-react';
import { gameContract, formatEth, formatAddress, getTokenByAddress, formatTokenDisplay, isETH } from '../thirdweb';
import { logBuyInInfo, formatBuyInForDisplay, compareTransactionParams } from '../utils/buyInUtils';
import { getDisplayNameByAddressSync } from '../utils/userUtils';
import { useUser } from '../contexts/UserContext';
import { TokenBalance } from './TokenBalance';
import { useBridge } from '../hooks/useBridge';

// Using direct contract values like working /pony-upv3 code
import { 
  BlockButton, 
  BlockInput,
  BlockModal,
  BlockModalContent,
  blockTheme,
  PixelText
} from '../styles/blocks';
import { SimpleRetroLoader } from './RetroLoader';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';

interface JoinGameModalProps {
  onClose: () => void;
  onSuccess: (gameData?: { gameCode: string; buyIn: string; maxPlayers: number }) => void;
  initialGameCode?: string; // Optional pre-filled game code
  joinAsJudge?: boolean; // Whether to join as judge (free entry)
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

const ModalContainer = styled(BlockModalContent)`
  max-width: 500px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  max-width: 500px;
  width: 100%;
  position: relative;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
`;

const ModalTitle = styled(PixelText)`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  color: ${blockTheme.darkText};
`;

const CloseButton = styled.button`
  background: ${blockTheme.pastelCoral};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 50%;
  width: 40px;
  height: 40px;
  color: ${blockTheme.darkText};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  box-shadow: 4px 4px 0px ${blockTheme.shadowMedium};
  
  &:hover {
    background: ${blockTheme.pastelPeach};
    transform: translateY(2px);
    box-shadow: 2px 2px 0px ${blockTheme.shadowMedium};
  }
  
  &:active {
    transform: translateY(4px);
    box-shadow: none;
  }
`;

const InputContainer = styled.div`
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
`;

const GameInfoCard = styled(motion.div)`
  background: ${blockTheme.pastelBlue};
  border: 4px solid ${blockTheme.darkText};
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 6px 6px 0px ${blockTheme.shadowMedium};
`;

const GameCodeTitle = styled.h3`
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  color: ${blockTheme.primary};
`;

const GameStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
`;

const StatItem = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.95rem;
  color: ${blockTheme.darkText};
  font-weight: 600;
`;

const HostInfo = styled.div`
  font-size: 0.85rem;
  color: ${blockTheme.textMuted};
  padding-top: 0.75rem;
  border-top: 3px solid ${blockTheme.darkText};
`;

const InfoNote = styled.div`
  background: ${blockTheme.pastelYellow};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
  color: ${blockTheme.darkText};
  box-shadow: 4px 4px 0px ${blockTheme.shadowLight};
  
  strong {
    color: ${blockTheme.darkText};
    font-weight: 700;
  }
`;

const ErrorMessage = styled(motion.div)`
  background: ${blockTheme.pastelCoral};
  border: 3px solid ${blockTheme.error};
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1rem;
  color: ${blockTheme.darkText};
  font-size: 0.9rem;
  font-weight: 600;
  box-shadow: 4px 4px 0px ${blockTheme.shadowLight};
`;

const JoinGameModal: React.FC<JoinGameModalProps> = ({ onClose, onSuccess, initialGameCode, joinAsJudge = false }) => {
  const account = useActiveAccount();
  const { user } = useUser();
  const [gameCode, setGameCode] = useState(initialGameCode || '');
  const [joining, setJoining] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [gameInfo, setGameInfo] = useState<any>(null);
  const [showBridge, setShowBridge] = useState(false);

  const contract = gameContract;
  const { prepareBridge, executeBridge, isLoading: bridgeLoading } = useBridge();

  // Auto-lookup game if initialGameCode is provided
  useEffect(() => {
    if (initialGameCode && initialGameCode.trim()) {
      lookupGame();
    }
  }, [initialGameCode]);

  const lookupGame = async () => {
    if (!gameCode.trim()) return;
    
    try {
      setLoading(true);
      setError('');
      setGameInfo(null);

      // Fetch game info from actual deployed contract (returns [host, token, buyIn, maxPlayers, playerCount, isLocked, splits, judges])
      const [host, token, buyIn, maxPlayers, playerCount, isLocked, splits, judges] = await readContract({
        contract,
        method: "function getGameInfo(string code) view returns (address host, address token, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool isLocked, uint256[] splits, address[] judges)",
        params: [gameCode.toUpperCase()],
      }) as [string, string, bigint, bigint, bigint, boolean, bigint[], string[]];
      
      // Validate the host address to ensure game exists
      if (host === "0x0000000000000000000000000000000000000000") {
        setError(`Game ${gameCode.toUpperCase()} not found`);
        return;
      }

      console.log(`🔍 JoinGameModal for ${gameCode.toUpperCase()}: buyIn=${buyIn.toString()}, maxPlayers=${maxPlayers.toString()}`);
      
      // Log contract buy-in for debugging
      logBuyInInfo('JoinGameModal loaded', gameCode.toUpperCase(), buyIn, 'direct contract return');

      if (Number(playerCount) >= Number(maxPlayers)) {
        setError('Game is full');
        return;
      }

      setGameInfo({
        gameCode: gameCode.toUpperCase(),
        host: host,
        buyIn: buyIn.toString(),
        buyInToken: token,
        maxPlayers: Number(maxPlayers),
        playerCount: Number(playerCount),
        formattedBuyIn: formatBuyInForDisplay(buyIn)
      });
    } catch (err: any) {
      console.error('Failed to lookup game:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to lookup game';
      if (err.message) {
        if (err.message.includes('execution reverted')) {
          errorMessage = 'Game not found or contract error';
        } else if (err.message.includes('network')) {
          errorMessage = 'Network connection error';
        } else {
          errorMessage = err.message;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!account || !gameInfo) return;

    try {
      setJoining(true);
      setError('');
      
      // Show loading toast
      toast.loading('Joining game...', { id: 'join-game' });

      // Log transaction details for debugging
      // Use 0 buy-in if joining as judge, otherwise use game buy-in
      const buyInAmount = joinAsJudge ? BigInt(0) : BigInt(gameInfo.buyIn || '0');
      const tokenAddress = gameInfo.buyInToken || '0x0000000000000000000000000000000000000000';
      const isEthPayment = isETH(tokenAddress);
      
      logBuyInInfo('JoinGameModal transaction', gameInfo.gameCode, buyInAmount, joinAsJudge ? 'judge (free)' : 'gameInfo');
      
      // Handle ERC20 token approval if needed
      if (!isEthPayment && buyInAmount > 0) {
        toast.loading('Approving token spend...', { id: 'join-game' });
        // In a real implementation, you would check allowance and approve here
        // const allowance = await readContract(...);
        // if (allowance < buyInAmount) { /* approve */ }
      }
      
      // Enhanced debugging: log all transaction parameters
      console.log('🔧 Transaction Debug - Before Preparation:');
      console.log(`  - Game Code: "${gameInfo.gameCode}"`);
      console.log(`  - Buy-in Amount: ${buyInAmount.toString()}`);
      console.log(`  - Token Address: ${tokenAddress}`);
      console.log(`  - Is ETH Payment: ${isEthPayment}`);
      console.log(`  - Contract Address: ${contract.address}`);
      console.log(`  - Account: ${account.address}`);
      
      // Compare with working implementation
      compareTransactionParams(
        'JoinGameModal',
        gameInfo.gameCode,
        buyInAmount,
        contract.address,
        account.address,
        "function joinGame(string code) payable"
      );
      
      // Use actual deployed contract joinGame function
      // The new contract supports both ETH and ERC20 payments through the same function
      const transaction = prepareContractCall({
        contract,
        method: "function joinGame(string code) payable",
        params: [gameInfo.gameCode],
        value: isEthPayment ? buyInAmount : BigInt(0), // Only send ETH value for ETH payments
      });

      // Enhanced debugging: log prepared transaction details
      console.log('🔧 Transaction Debug - After Preparation:');
      console.log(`  - Transaction object:`, transaction);
      console.log(`  - Method: "function joinGame(string code) payable"`);
      console.log(`  - Params: [${JSON.stringify(gameInfo.gameCode)}]`);
      console.log(`  - Value: ${(isEthPayment ? buyInAmount : BigInt(0)).toString()} wei`);
      
      // Try with explicit gas limit to test gas estimation issues
      console.log('🚀 Attempting transaction with enhanced debugging...');
      
      try {
        await sendTransaction({
          transaction,
          account,
        });
        console.log('✅ Transaction succeeded!');
      } catch (txError: any) {
        console.error('❌ Primary transaction failed with detailed error:', txError);
        console.error('❌ Error message:', txError.message);
        console.error('❌ Error code:', txError.code);
        console.error('❌ Error data:', txError.data);
        
        // Test #4: Try fallback with explicit gas limit
        console.log('🔄 Attempting fallback with explicit gas limit...');
        try {
          const fallbackTransaction = prepareContractCall({
            contract,
            method: "function joinGame(string code) payable",
            params: [gameInfo.gameCode],
            value: buyInWei,
            gas: BigInt(200000), // Explicit gas limit
          });
          
          console.log('🔧 Fallback transaction with gas limit:', fallbackTransaction);
          
          await sendTransaction({
            transaction: fallbackTransaction,
            account,
          });
          console.log('✅ Fallback transaction with gas limit succeeded!');
        } catch (gasError: any) {
          console.error('❌ Gas limit fallback also failed:', gasError);
          
          // Test #5: Try alternative method signature (without explicit types)
          console.log('🔄 Attempting alternative method signature...');
          try {
            const altTransaction = prepareContractCall({
              contract,
              method: "joinGame",
              params: [gameInfo.gameCode],
              value: buyInWei,
            });
            
            console.log('🔧 Alternative method signature transaction:', altTransaction);
            
            await sendTransaction({
              transaction: altTransaction,
              account,
            });
            console.log('✅ Alternative method signature succeeded!');
          } catch (altError: any) {
            console.error('❌ Alternative method signature also failed:', altError);
            
            // Test #5b: Try with explicit function selector
            console.log('🔄 Final attempt with different method format...');
            try {
              const selectorTransaction = prepareContractCall({
                contract,
                method: "function joinGame(string) payable", // Different signature format
                params: [gameInfo.gameCode],
                value: buyInWei,
              });
              
              console.log('🔧 Selector method transaction:', selectorTransaction);
              
              await sendTransaction({
                transaction: selectorTransaction,
                account,
              });
              console.log('✅ Selector method succeeded!');
            } catch (selectorError: any) {
              console.error('❌ All transaction methods failed. Final error:', selectorError);
              throw txError; // Re-throw original error
            }
          }
        }
      }

      // Show success toast
      toast.success('Successfully joined game!', { id: 'join-game' });

      // Pass game data back for immediate addition
      onSuccess({
        gameCode: gameInfo.gameCode,
        buyIn: gameInfo.buyInToken ? formatTokenDisplay(gameInfo.buyIn, gameInfo.buyInToken).split(' ')[0] : '0',
        maxPlayers: gameInfo.maxPlayers
      });
    } catch (err: any) {
      console.error('Failed to join game:', err);
      
      // Extract the actual error message from MetaMask/contract
      let errorMessage = 'Failed to join game';
      
      if (err.message) {
        // Check for common contract rejection messages
        if (err.message.includes('Incorrect buy-in')) {
          errorMessage = 'Contract rejected: Incorrect buy-in amount';
        } else if (err.message.includes('execution reverted')) {
          // Extract the revert reason if available
          const revertMatch = err.message.match(/execution reverted:?\s*([^"\n]+)/);
          if (revertMatch && revertMatch[1]) {
            errorMessage = `Contract error: ${revertMatch[1].trim()}`;
          } else {
            errorMessage = 'Transaction was rejected by the smart contract';
          }
        } else if (err.message.includes('insufficient funds')) {
          errorMessage = 'Insufficient ETH balance for transaction';
        } else if (err.message.includes('user rejected')) {
          errorMessage = 'Transaction cancelled by user';
        } else if (err.message.includes('replacement fee too low')) {
          errorMessage = 'Transaction fee too low, try increasing gas price';
        } else {
          // Use the original error message from MetaMask/contract
          errorMessage = err.message;
        }
      }
      
      // Show error toast
      toast.error(`Failed to join game: ${errorMessage}`, { id: 'join-game' });
      
      setError(errorMessage);
    } finally {
      setJoining(false);
    }
  };

  const handleBridgeNeeded = async (fromToken: string, toToken: string, amount: string) => {
    try {
      setShowBridge(true);
      const quote = await prepareBridge({
        fromChain: 'ethereum', // This would be dynamically determined
        fromToken,
        toChain: 'base',
        toToken,
        amount
      });
      
      if (quote) {
        await executeBridge(quote);
        toast.success('Bridge completed! You can now join the game.');
        // Refresh game info to update balance display
        lookupGame();
      }
    } catch (error) {
      console.error('Bridge failed:', error);
      toast.error('Bridge transaction failed');
    } finally {
      setShowBridge(false);
    }
  };

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
          <ModalTitle>{joinAsJudge ? 'Join as Judge' : 'Join Game'}</ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <InputContainer>
          <BlockInput
            placeholder="Enter game code (e.g. ABC-123)"
            value={gameCode}
            onChange={(e) => setGameCode(e.target.value.toUpperCase())}
            maxLength={10}
            style={{ flex: 1 }}
            disabled={loading}
          />
          <BlockButton
            variant="secondary"
            onClick={lookupGame}
            disabled={loading || !gameCode.trim()}
            $loading={loading}
          >
            {loading ? (
              <SimpleRetroLoader />
            ) : (
              <Search size={16} />
            )}
            Find
          </BlockButton>
        </InputContainer>

        <AnimatePresence mode="wait">
          {error && (
            <ErrorMessage
              key="error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              {error}
            </ErrorMessage>
          )}

          {gameInfo && (
            <GameInfoCard
              key="game-info"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <GameCodeTitle>{gameInfo.gameCode}</GameCodeTitle>
              
              <GameStats>
                <StatItem>
                  <Users size={16} />
                  {gameInfo.playerCount}/{gameInfo.maxPlayers} Players
                </StatItem>
                <StatItem>
                  <span>💰</span>
                  {gameInfo.buyInToken && gameInfo.buyIn ? formatTokenDisplay(gameInfo.buyIn, gameInfo.buyInToken) : 'Free'}
                </StatItem>
              </GameStats>

              <HostInfo>
                Host: {getDisplayNameByAddressSync(gameInfo.host || '')}
              </HostInfo>
              
              {/* Token balance and bridge integration */}
              {gameInfo.buyInToken && gameInfo.buyIn !== '0' && (
                <TokenBalance
                  tokenAddress={gameInfo.buyInToken}
                  requiredAmount={formatTokenDisplay(gameInfo.buyIn, gameInfo.buyInToken).split(' ')[0]}
                  onBridgeNeeded={handleBridgeNeeded}
                  showBridgeOption={true}
                />
              )}
            </GameInfoCard>
          )}
        </AnimatePresence>


        <BlockButton
          onClick={handleJoin}
          disabled={joining || !gameInfo}
          $loading={joining}
          style={{ width: '100%' }}
        >
          {joining ? (
            <>
              <SimpleRetroLoader />
              {joinAsJudge ? 'Joining as Judge...' : 'Joining Game...'}
            </>
          ) : joinAsJudge ? (
            <>
              <Shield size={20} />
              Join as Judge (FREE)
            </>
          ) : (
            <>
              <Users size={20} />
              Join Game ({gameInfo && gameInfo.buyInToken ? formatTokenDisplay(gameInfo.buyIn, gameInfo.buyInToken) : 'Free'})
            </>
          )}
        </BlockButton>
      </ModalContainer>
    </ModalOverlay>
  );
};

export default JoinGameModal;