import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { ArrowRightLeft, AlertCircle, ExternalLink } from 'lucide-react';
import { BASE_TOKENS, getTokenByAddress, formatTokenAmount, isETH } from '../thirdweb';
import { blockTheme, PixelText, BlockButton } from '../styles/blocks';
import { useActiveAccount } from 'thirdweb/react';
import { readContract, prepareContractCall } from 'thirdweb';

interface TokenBalanceProps {
  tokenAddress: string;
  requiredAmount?: string;
  onBridgeNeeded?: (fromToken: string, toToken: string, amount: string) => void;
  showBridgeOption?: boolean;
}

const BalanceContainer = styled.div`
  background: ${blockTheme.lightBg};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 1rem;
  margin: 0.5rem 0;
  box-shadow: 2px 2px 0px ${blockTheme.shadowLight};
`;

const BalanceHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
`;

const TokenInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const TokenIcon = styled.img`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid ${blockTheme.darkText};
`;

const TokenSymbol = styled(PixelText)`
  font-weight: 600;
  font-size: 1rem;
`;

const BalanceAmount = styled(PixelText)<{ hasEnough: boolean }>`
  font-size: 1rem;
  font-weight: 600;
  color: ${props => props.hasEnough ? blockTheme.successGreen : blockTheme.errorRed};
`;

const RequiredAmount = styled(PixelText)`
  font-size: 0.9rem;
  color: ${blockTheme.mutedText};
  margin-top: 0.25rem;
`;

const InsufficientBanner = styled.div`
  background: ${blockTheme.pastelCoral};
  border: 2px solid ${blockTheme.errorRed};
  border-radius: 8px;
  padding: 0.75rem;
  margin-top: 0.5rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const InsufficientText = styled(PixelText)`
  font-size: 0.9rem;
  color: ${blockTheme.errorRed};
  flex: 1;
`;

const BridgeButton = styled(BlockButton)`
  background: ${blockTheme.pastelLavender};
  font-size: 0.8rem;
  padding: 0.5rem 0.75rem;
  min-width: auto;
  
  &:hover {
    background: ${blockTheme.pastelMint};
  }
`;

const BridgeOptions = styled.div`
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 2px dashed ${blockTheme.shadowMedium};
`;

const BridgeOption = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  background: ${blockTheme.pastelYellow};
  border: 2px solid ${blockTheme.darkText};
  border-radius: 8px;
  margin-bottom: 0.5rem;
`;

const BridgeInfo = styled.div`
  flex: 1;
`;

const BridgeFromTo = styled(PixelText)`
  font-size: 0.9rem;
  color: ${blockTheme.darkText};
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const BridgeEstimate = styled(PixelText)`
  font-size: 0.8rem;
  color: ${blockTheme.mutedText};
`;

const BridgeActionButton = styled(BlockButton)`
  background: ${blockTheme.pastelPeach};
  font-size: 0.8rem;
  padding: 0.5rem 0.75rem;
  min-width: auto;
  
  &:hover {
    background: ${blockTheme.pastelCoral};
  }
`;

export const TokenBalance: React.FC<TokenBalanceProps> = ({
  tokenAddress,
  requiredAmount,
  onBridgeNeeded,
  showBridgeOption = true
}) => {
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState(true);
  const [bridgeOptions, setBridgeOptions] = useState<any[]>([]);
  const account = useActiveAccount();

  const token = getTokenByAddress(tokenAddress);
  const requiredAmountNum = requiredAmount ? parseFloat(requiredAmount) : 0;
  const balanceNum = parseFloat(balance);
  const hasEnoughBalance = balanceNum >= requiredAmountNum;
  const shortfall = requiredAmountNum - balanceNum;

  useEffect(() => {
    const fetchBalance = async () => {
      if (!account || !token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        if (isETH(tokenAddress)) {
          // Fetch ETH balance
          // In real implementation, you'd use a proper RPC call
          setBalance('0.5'); // Placeholder
        } else {
          // Fetch ERC20 token balance
          // In real implementation, you'd call the token contract's balanceOf function
          setBalance('100.0'); // Placeholder
        }
      } catch (error) {
        console.error('Failed to fetch balance:', error);
        setBalance('0');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
  }, [account, tokenAddress, token]);

  useEffect(() => {
    const fetchBridgeOptions = async () => {
      if (!hasEnoughBalance && shortfall > 0 && showBridgeOption) {
        // In real implementation, you'd fetch bridge options from various chains
        const mockOptions = [
          {
            fromChain: 'Ethereum',
            fromToken: 'USDC',
            estimatedTime: '~2 mins',
            estimatedFee: '$1.50',
            available: '50.0'
          },
          {
            fromChain: 'Polygon',
            fromToken: 'USDC',
            estimatedTime: '~30s',
            estimatedFee: '$0.10',
            available: '25.0'
          }
        ];
        setBridgeOptions(mockOptions);
      }
    };

    fetchBridgeOptions();
  }, [hasEnoughBalance, shortfall, showBridgeOption]);

  const handleBridge = (option: any) => {
    if (onBridgeNeeded) {
      onBridgeNeeded(option.fromToken, token?.symbol || '', shortfall.toString());
    }
  };

  if (!token) return null;

  return (
    <BalanceContainer>
      <BalanceHeader>
        <TokenInfo>
          <TokenIcon src={token.icon} alt={token.symbol} />
          <TokenSymbol>{token.symbol}</TokenSymbol>
        </TokenInfo>
        <BalanceAmount hasEnough={hasEnoughBalance}>
          {loading ? '...' : `${balance} ${token.symbol}`}
        </BalanceAmount>
      </BalanceHeader>

      {requiredAmount && (
        <RequiredAmount>
          Required: {requiredAmount} {token.symbol}
        </RequiredAmount>
      )}

      {!loading && !hasEnoughBalance && requiredAmount && (
        <>
          <InsufficientBanner>
            <AlertCircle size={16} />
            <InsufficientText>
              Insufficient balance. Need {shortfall.toFixed(4)} more {token.symbol}
            </InsufficientText>
          </InsufficientBanner>

          {showBridgeOption && bridgeOptions.length > 0 && (
            <BridgeOptions>
              <PixelText style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                Bridge from other chains:
              </PixelText>
              
              {bridgeOptions.map((option, index) => (
                <BridgeOption key={index}>
                  <BridgeInfo>
                    <BridgeFromTo>
                      {option.fromChain} {option.fromToken}
                      <ArrowRightLeft size={14} />
                      Base {token.symbol}
                    </BridgeFromTo>
                    <BridgeEstimate>
                      {option.estimatedTime} • {option.estimatedFee} • Available: {option.available}
                    </BridgeEstimate>
                  </BridgeInfo>
                  <BridgeActionButton onClick={() => handleBridge(option)}>
                    Bridge
                    <ExternalLink size={12} />
                  </BridgeActionButton>
                </BridgeOption>
              ))}
            </BridgeOptions>
          )}
        </>
      )}
    </BalanceContainer>
  );
};

export default TokenBalance;