import React, { useState } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall } from 'thirdweb';
import { sendTransaction } from 'thirdweb';
import { waitForReceipt } from 'thirdweb';
import { getContractEvents } from 'thirdweb';
import { X, Plus } from 'lucide-react';
import { getGameContract, decodeStringFromHex, client, chain } from '../thirdweb';
import { GlassModal, GlassModalContent, GlassButton, GlassInput, GlassSelect, FlexContainer, LoadingSpinner } from '../styles/glass';
import styled from '@emotion/styled';

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
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
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

const FormGroup = styled.div`
  margin-bottom: 1.5rem;
`;

const FormLabel = styled.label`
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
  margin-bottom: 0.5rem;
`;

const InfoBox = styled.div<{ variant?: 'info' | 'warning' | 'error' }>`
  padding: 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
  background: ${({ variant = 'info' }) => {
    const backgrounds = {
      info: 'rgba(102, 126, 234, 0.15)',
      warning: 'rgba(251, 191, 36, 0.15)',
      error: 'rgba(239, 68, 68, 0.15)'
    };
    return backgrounds[variant];
  }};
  border: 1px solid ${({ variant = 'info' }) => {
    const borders = {
      info: 'rgba(102, 126, 234, 0.3)',
      warning: 'rgba(251, 191, 36, 0.3)',
      error: 'rgba(239, 68, 68, 0.3)'
    };
    return borders[variant];
  }};
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
    color: rgba(255, 255, 255, 0.5);
    margin-top: 0.25rem;
  }
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

  const contract = getGameContract();

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
        account: account.address
      });

      const buyInWei = BigInt(Math.floor(parseFloat(formData.buyIn) * 1e18));
      console.log('Buy-in in wei:', buyInWei.toString());

      try {
        const transaction = prepareContractCall({
          contract,
          method: "function startGame(uint256 buyIn, uint256 maxPlayers) returns (string code)",
          params: [buyInWei, BigInt(formData.maxPlayers)],
        });

        console.log('Creating game...');
        
        const result = await sendTransaction({
          transaction,
          account,
        });

        console.log('Game transaction submitted! Hash:', result.transactionHash);
        setTransactionHash(result.transactionHash);
        setTransactionState('waiting');
        
        const receiptPromise = waitForReceipt({
          client: client,
          chain: chain,
          transactionHash: result.transactionHash,
        });
        
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction confirmation timed out after 60 seconds')), 60000)
        );
        
        const receipt = await Promise.race([receiptPromise, timeoutPromise]) as any;

        console.log('Transaction confirmed! Extracting game code...');
        setTransactionState('extracting');
        
        console.log('📊 Full transaction receipt:', receipt);
        console.log('📊 Receipt logs count:', receipt.logs?.length || 0);
        
        let gameCode = 'UNKNOWN';
        
        const GAME_STARTED_TOPIC = '0xc83727715d9b58d35c2b5aa93e8e9144b9f66c103994a03bbafa82b473c142b2';
        
        if (receipt.logs && receipt.logs.length > 0) {
          console.log('🔍 Analyzing transaction logs...');
          
          for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            console.log(`📋 Log ${i}:`, {
              address: log.address,
              topics: log.topics,
              data: log.data,
              dataLength: log.data?.length
            });
            
            if (log.topics && log.topics[0] && log.topics[0].toLowerCase() === GAME_STARTED_TOPIC.toLowerCase()) {
              console.log('🎯 Found GameStarted event! Extracting game code...');
              
              if (log.data) {
                console.log('🔍 Comprehensive hex data analysis:');
                const dataHex = log.data.slice(2);
                console.log('- Raw hex (no 0x):', dataHex);
                console.log('- Hex length:', dataHex.length);
                console.log('- Hex bytes:', dataHex.length / 2);
                
                for (let chunk = 0; chunk < dataHex.length; chunk += 64) {
                  const chunkData = dataHex.slice(chunk, chunk + 64);
                  console.log(`- Chunk ${chunk/64}: ${chunkData} (${chunkData.length} chars)`);
                  
                  try {
                    const asNumber = parseInt(chunkData, 16);
                    console.log(`  As number: ${asNumber}`);
                  } catch (e) {}
                  
                  try {
                    let asciiStr = '';
                    for (let i = 0; i < chunkData.length; i += 2) {
                      const byte = parseInt(chunkData.substr(i, 2), 16);
                      if (byte > 0 && byte < 127) {
                        asciiStr += String.fromCharCode(byte);
                      } else if (byte === 0) {
                        break;
                      }
                    }
                    if (asciiStr.length > 0) {
                      console.log(`  As ASCII: "${asciiStr}"`);
                    }
                  } catch (e) {}
                }
                
                try {
                  const extractedCode = decodeStringFromHex(log.data);
                  console.log('🎯 decodeStringFromHex result:', `"${extractedCode}" (length: ${extractedCode?.length || 0})`);
                  
                  if (extractedCode && extractedCode.length >= 3 && extractedCode.length <= 10) {
                    gameCode = extractedCode;
                    console.log('✅ Extracted game code from GameStarted event:', gameCode);
                    break;
                  } else {
                    console.log('⚠️ Decoded string but invalid length:', extractedCode);
                    
                    console.log('🔄 Trying alternative parsing methods...');
                    
                    for (let pos = 64; pos < dataHex.length; pos += 64) {
                      const stringLengthHex = dataHex.slice(pos, pos + 64);
                      const stringLength = parseInt(stringLengthHex, 16);
                      console.log(`Position ${pos/64}: Length = ${stringLength}`);
                      
                      if (stringLength > 0 && stringLength <= 20) {
                        const stringStart = pos + 64;
                        const stringHex = dataHex.slice(stringStart, stringStart + stringLength * 2);
                        
                        let parsedString = '';
                        for (let i = 0; i < stringHex.length; i += 2) {
                          const byte = parseInt(stringHex.substr(i, 2), 16);
                          if (byte > 0) {
                            parsedString += String.fromCharCode(byte);
                          }
                        }
                        
                        console.log(`Parsed string at position ${pos/64}: "${parsedString}"`);
                        
                        if (parsedString.length >= 3 && parsedString.length <= 10 && /^[A-Z0-9-]+$/i.test(parsedString)) {
                          gameCode = parsedString;
                          console.log('✅ Found valid game code with alternative parsing:', gameCode);
                          break;
                        }
                      }
                    }
                  }
                } catch (err) {
                  console.log('❌ Failed to decode GameStarted event data:', err);
                }
              }
            }
          }
        }
        
        if (gameCode === 'UNKNOWN' && receipt.logs && receipt.logs.length > 0) {
          console.log('🔄 Fallback: Trying to decode from any log data...');
          
          for (let i = 0; i < receipt.logs.length; i++) {
            const log = receipt.logs[i];
            if (log.data && log.data.length > 2) {
              try {
                const extractedCode = decodeStringFromHex(log.data);
                if (extractedCode && extractedCode.length >= 3 && extractedCode.length <= 10 && /^[A-Z0-9-]+$/i.test(extractedCode)) {
                  gameCode = extractedCode;
                  console.log(`✅ Extracted game code from log ${i} (fallback):`, gameCode);
                  break;
                }
              } catch (err) {
                console.log(`Failed to decode log ${i} data`);
              }
            }
          }
        }
        
        if (gameCode === 'UNKNOWN' && receipt.returnData) {
          console.log('🔄 Trying to extract from return data...');
          try {
            const returnedCode = decodeStringFromHex(receipt.returnData);
            if (returnedCode && returnedCode.length >= 3 && returnedCode.length <= 10) {
              gameCode = returnedCode;
              console.log('✅ Extracted game code from return data:', gameCode);
            }
          } catch (err) {
            console.log('Failed to decode from return data');
          }
        }
        
        if (gameCode === 'UNKNOWN' && receipt.blockNumber) {
          console.log('🔄 Trying thirdweb event parsing...');
          try {
            const events = await getContractEvents({
              contract,
              eventName: "GameStarted",
              fromBlock: receipt.blockNumber,
              toBlock: receipt.blockNumber,
            });
            
            console.log('🎯 Found GameStarted events via thirdweb:', events.length);
            
            for (const event of events) {
              if (event.transactionHash === result.transactionHash) {
                console.log('✅ Found matching GameStarted event:', event);
                if (event.args && event.args.code) {
                  gameCode = event.args.code;
                  console.log('✅ Extracted game code from thirdweb event:', gameCode);
                  break;
                }
              }
            }
          } catch (err) {
            console.log('❌ Failed to get events via thirdweb:', err);
          }
        }
        
        console.log('Game created with code:', gameCode);
        
        if (gameCode === 'UNKNOWN') {
          console.warn('Could not extract game code from transaction - using fallback');
          gameCode = `GAME-${result.transactionHash.slice(-6).toUpperCase()}`;
        }
        
        onSuccess({ 
          gameCode: gameCode, 
          buyIn: formData.buyIn, 
          maxPlayers: formData.maxPlayers,
          transactionHash: result.transactionHash,
          blockNumber: receipt.blockNumber
        });
        return;
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
    <GlassModal onClick={onClose}>
      <GlassModalContent onClick={e => e.stopPropagation()}>
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
              <LoadingSpinner />
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
            <GlassInput
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
            <GlassSelect
              value={formData.maxPlayers}
              onChange={(e) => setFormData(prev => ({ ...prev, maxPlayers: parseInt(e.target.value) }))}
            >
              {[2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20].map(num => (
                <option key={num} value={num}>{num} players</option>
              ))}
            </GlassSelect>
          </FormGroup>


          {error && (
            <InfoBox variant="error">
              {error}
            </InfoBox>
          )}

          <GlassButton
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            $loading={creating}
            disabled={creating}
          >
            {creating ? (
              <FlexContainer align="center" justify="center" gap="0.5rem">
                <LoadingSpinner />
                {transactionState === 'submitting' && 'Submitting Transaction...'}
                {transactionState === 'waiting' && 'Waiting for Confirmation...'}
                {transactionState === 'extracting' && 'Extracting Game Code...'}
                {transactionState === 'idle' && 'Creating Game...'}
              </FlexContainer>
            ) : (
              <FlexContainer align="center" justify="center" gap="0.5rem">
                <Plus size={20} />
                Create Game (Free Gas)
              </FlexContainer>
            )}
          </GlassButton>
        </form>
        
      </GlassModalContent>
    </GlassModal>
  );
};

export default CreateGameModal;