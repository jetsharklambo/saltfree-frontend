import React, { useState, useEffect } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { BuyWidget } from "thirdweb/react";
import { X, CreditCard, Wallet, Info, ArrowDown, ArrowUp, Coins } from 'lucide-react';
import { client, chain, BASE_TOKENS, formatAddress } from '../thirdweb';
import { ethereum } from 'thirdweb/chains';
import { getBalance } from 'thirdweb/extensions/erc20';
import { eth_getBalance } from 'thirdweb/rpc';
import { getRpcClient } from 'thirdweb/rpc';
import { 
  BlockModal, 
  BlockModalContent, 
  blockTheme
} from '../styles/blocks';
import styled from '@emotion/styled';
import toast from 'react-hot-toast';

interface BuyTokensModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  defaultToken?: 'ETH' | 'USDC';
  defaultAmount?: string;
  defaultMode?: 'cashin' | 'cashout';
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
  display: flex;
  align-items: center;
  gap: 0.5rem;
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
  
  &:hover {
    background: ${blockTheme.pastelPink};
    transform: rotate(90deg);
  }
  
  &:active {
    transform: rotate(90deg) scale(0.95);
  }
`;

const InfoBox = styled.div`
  background: ${blockTheme.pastelYellow};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  
  svg {
    flex-shrink: 0;
    margin-top: 2px;
  }
`;

const InfoText = styled.div`
  font-size: 0.9rem;
  color: ${blockTheme.darkText};
  line-height: 1.5;
  
  strong {
    font-weight: 600;
  }
`;

const WalletInfo = styled.div`
  background: ${blockTheme.pastelMint};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
`;

const WalletLabel = styled.span`
  font-size: 0.9rem;
  color: ${blockTheme.darkText};
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const WalletAddress = styled.span`
  font-family: monospace;
  font-size: 0.9rem;
  color: ${blockTheme.darkText};
  background: ${blockTheme.pastelBlue};
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  border: 2px solid ${blockTheme.darkText};
`;

const TokenTabs = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
`;

const TokenTab = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 0.75rem;
  background: ${props => props.$active ? blockTheme.pastelLavender : 'transparent'};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: ${blockTheme.darkText};
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  &:hover {
    background: ${props => props.$active ? blockTheme.pastelLavender : blockTheme.pastelBlue};
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  img {
    width: 24px;
    height: 24px;
  }
`;

const BuyWidgetContainer = styled.div`
  background: white;
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 1rem;
  min-height: 400px;
  
  /* Style the BuyWidget iframe/container */
  & > div {
    border-radius: 8px;
    overflow: hidden;
  }
`;

const FooterNote = styled.div`
  margin-top: 1.5rem;
  padding: 1rem;
  background: ${blockTheme.pastelBlue};
  border: 2px solid ${blockTheme.darkText};
  border-radius: 8px;
  font-size: 0.85rem;
  color: ${blockTheme.darkText};
  text-align: center;
  line-height: 1.5;
`;

const ModeSwitch = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  background: ${blockTheme.pastelBlue};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 0.5rem;
`;

const ModeButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 0.75rem;
  background: ${props => props.$active ? blockTheme.pastelLavender : 'transparent'};
  border: ${props => props.$active ? `2px solid ${blockTheme.darkText}` : 'none'};
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  color: ${blockTheme.darkText};
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  &:hover {
    background: ${props => props.$active ? blockTheme.pastelLavender : blockTheme.pastelBlue};
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const BalanceDisplay = styled.div`
  background: ${blockTheme.pastelMint};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const BalanceInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const BalanceLabel = styled.span`
  font-size: 0.9rem;
  color: ${blockTheme.darkText};
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const BalanceAmount = styled.span`
  font-family: monospace;
  font-size: 1.1rem;
  font-weight: 700;
  color: ${blockTheme.darkText};
  background: ${blockTheme.pastelYellow};
  padding: 0.5rem 0.75rem;
  border-radius: 8px;
  border: 2px solid ${blockTheme.darkText};
`;

const MaxButton = styled.button`
  background: ${blockTheme.pastelCoral};
  border: 2px solid ${blockTheme.darkText};
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: ${blockTheme.darkText};
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background: ${blockTheme.pastelPink};
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;


const BuyTokensModal: React.FC<BuyTokensModalProps> = ({ 
  onClose, 
  onSuccess,
  defaultToken = 'ETH',
  defaultAmount = '0.01',
  defaultMode = 'cashin'
}) => {
  const account = useActiveAccount();
  const [selectedToken, setSelectedToken] = useState<'ETH' | 'USDC'>(defaultToken);
  const [amount, setAmount] = useState(defaultAmount);
  const [mode, setMode] = useState<'cashin' | 'cashout'>(defaultMode);
  const [baseEthBalance, setBaseEthBalance] = useState<string>('0');
  const [baseUsdcBalance, setBaseUsdcBalance] = useState<string>('0');
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Mainnet token definitions
  const MAINNET_TOKENS = {
    ETH: {
      address: "0x0000000000000000000000000000000000000000", // ETH on mainnet
      symbol: "ETH",
      name: "Ethereum",
      decimals: 18,
      icon: BASE_TOKENS.ETH.icon
    },
    USDC: {
      address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC on mainnet
      symbol: "USDC", 
      name: "USD Coin",
      decimals: 6,
      icon: BASE_TOKENS.USDC.icon
    }
  };

  // Fetch Base network balances for cash out mode
  useEffect(() => {
    const fetchBaseBalances = async () => {
      if (!account || mode !== 'cashout') return;

      setLoadingBalance(true);
      try {
        console.log('Fetching Base balances for address:', account.address);
        
        // Fetch ETH balance on Base using proper Thirdweb RPC client
        const rpcClient = getRpcClient({ client, chain });
        
        const ethBalanceWei = await eth_getBalance(rpcClient, {
          address: account.address,
          blockTag: 'latest'
        });
        
        console.log('Raw ETH balance (wei):', ethBalanceWei.toString());
        
        // Convert BigInt to ETH with proper precision handling
        const ethBalanceStr = ethBalanceWei.toString();
        const ethBalance = (parseFloat(ethBalanceStr) / 1e18).toFixed(6);
        
        console.log('Converted ETH balance:', ethBalance);
        setBaseEthBalance(ethBalance);

        // Fetch USDC balance on Base
        console.log('Fetching USDC balance from contract:', BASE_TOKENS.USDC.address);
        const usdcBalance = await getBalance({
          contract: {
            client,
            chain,
            address: BASE_TOKENS.USDC.address as `0x${string}`,
          },
          address: account.address,
        });
        
        console.log('Raw USDC balance:', usdcBalance);
        const usdcBalanceFormatted = parseFloat(usdcBalance.displayValue).toFixed(2);
        console.log('Formatted USDC balance:', usdcBalanceFormatted);
        setBaseUsdcBalance(usdcBalanceFormatted);
        
      } catch (error) {
        console.error('Failed to fetch Base balances - Full error details:', error);
        console.error('Error message:', error instanceof Error ? error.message : 'Unknown error');
        console.error('Account address:', account.address);
        console.error('Chain:', chain);
        
        // Show user-friendly error in UI
        toast.error('Failed to load Base network balances. Please try again.');
        
        // Set balances to 0 as fallback
        setBaseEthBalance('0');
        setBaseUsdcBalance('0');
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBaseBalances();
  }, [account, mode]);

  // Auto-populate amount with full balance when in cash out mode and token changes
  useEffect(() => {
    if (mode === 'cashout' && !loadingBalance) {
      const balance = selectedToken === 'ETH' ? baseEthBalance : baseUsdcBalance;
      setAmount(balance);
    }
  }, [mode, selectedToken, baseEthBalance, baseUsdcBalance, loadingBalance]);

  const handleTokenSwitch = (token: 'ETH' | 'USDC') => {
    setSelectedToken(token);
    if (mode === 'cashout' && !loadingBalance) {
      const balance = token === 'ETH' ? baseEthBalance : baseUsdcBalance;
      setAmount(balance);
    }
  };

  const handleMaxClick = () => {
    if (mode === 'cashout') {
      const balance = selectedToken === 'ETH' ? baseEthBalance : baseUsdcBalance;
      setAmount(balance);
    }
  };

  const handleSuccess = () => {
    const message = mode === 'cashin' 
      ? 'Token purchase initiated! Check your wallet for the transaction.'
      : 'Bridge transaction initiated! Check your wallet for the transaction.';
    toast.success(message);
    if (onSuccess) {
      onSuccess();
    }
    // Keep modal open so user can complete the transaction
  };

  const handleError = (error: any) => {
    console.error('Transaction error:', error);
    const message = mode === 'cashin'
      ? 'Failed to initiate purchase. Please try again.'
      : 'Failed to initiate bridge transaction. Please try again.';
    toast.error(message);
  };


  if (!account) {
    return (
      <BlockModal onClick={onClose}>
        <BlockModalContent onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>
              <CreditCard size={24} />
              Cash In/Out
            </ModalTitle>
            <CloseButton onClick={onClose}>
              <X size={20} />
            </CloseButton>
          </ModalHeader>
          
          <InfoBox>
            <Info size={20} />
            <InfoText>
              Please connect your wallet first to access cash in/out features.
            </InfoText>
          </InfoBox>
        </BlockModalContent>
      </BlockModal>
    );
  }

  // Get the appropriate token address and chain based on mode
  const currentTokens = mode === 'cashin' ? BASE_TOKENS : MAINNET_TOKENS;
  const currentChain = mode === 'cashin' ? chain : ethereum;
  const tokenAddress = (selectedToken === 'ETH' 
    ? currentTokens.ETH.address 
    : currentTokens.USDC.address) as `0x${string}`;

  return (
    <BlockModal onClick={onClose}>
      <BlockModalContent 
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader>
          <ModalTitle>
            {mode === 'cashin' ? <ArrowDown size={24} /> : <ArrowUp size={24} />}
            {mode === 'cashin' ? 'Cash In - Buy Tokens' : 'Cash Out - Bridge to Mainnet'}
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <ModeSwitch>
          <ModeButton 
            $active={mode === 'cashin'}
            onClick={() => setMode('cashin')}
          >
            <ArrowDown size={18} />
            Cash In
          </ModeButton>
          <ModeButton 
            $active={mode === 'cashout'}
            onClick={() => setMode('cashout')}
          >
            <ArrowUp size={18} />
            Cash Out
          </ModeButton>
        </ModeSwitch>

        <WalletInfo>
          <WalletLabel>
            <Wallet size={18} />
            Receiving Wallet:
          </WalletLabel>
          <WalletAddress>
            {formatAddress(account.address)}
          </WalletAddress>
        </WalletInfo>

        <InfoBox>
          <Info size={20} />
          <InfoText>
            {mode === 'cashin' ? (
              <>
                <strong>Buy tokens instantly with your credit card or bank transfer.</strong><br />
                Powered by Thirdweb's secure payment partners. KYC may be required for first-time purchases.
              </>
            ) : (
              <>
                <strong>Transfer your Base tokens to Ethereum mainnet.</strong><br />
                Your Base balance is shown above. Use the amount you want to bridge to mainnet.
              </>
            )}
          </InfoText>
        </InfoBox>

        {mode === 'cashin' && (
          <>
            <TokenTabs>
              <TokenTab 
                $active={selectedToken === 'ETH'}
                onClick={() => handleTokenSwitch('ETH')}
              >
                <img src={BASE_TOKENS.ETH.icon} alt="ETH" />
                ETH
              </TokenTab>
              <TokenTab 
                $active={selectedToken === 'USDC'}
                onClick={() => handleTokenSwitch('USDC')}
              >
                <img src={BASE_TOKENS.USDC.icon} alt="USDC" />
                USDC
              </TokenTab>
            </TokenTabs>

            <BuyWidgetContainer>
              <BuyWidget
                client={client}
                chain={chain}
                tokenAddress={tokenAddress}
                amount={amount}
                onSuccess={handleSuccess}
                onError={handleError}
                theme="light"
              />
            </BuyWidgetContainer>
          </>
        )}

        {mode === 'cashout' && (
          <>
            <BalanceDisplay>
              <BalanceInfo>
                <BalanceLabel>
                  <Coins size={18} />
                  Base {selectedToken} Balance:
                </BalanceLabel>
                <BalanceAmount>
                  {loadingBalance ? '...' : `${selectedToken === 'ETH' ? baseEthBalance : baseUsdcBalance} ${selectedToken}`}
                </BalanceAmount>
              </BalanceInfo>
              <MaxButton onClick={handleMaxClick}>
                Use Max
              </MaxButton>
            </BalanceDisplay>

            <TokenTabs>
              <TokenTab 
                $active={selectedToken === 'ETH'}
                onClick={() => handleTokenSwitch('ETH')}
              >
                <img src={MAINNET_TOKENS.ETH.icon} alt="ETH" />
                ETH (Mainnet)
              </TokenTab>
              <TokenTab 
                $active={selectedToken === 'USDC'}
                onClick={() => handleTokenSwitch('USDC')}
              >
                <img src={MAINNET_TOKENS.USDC.icon} alt="USDC" />
                USDC (Mainnet)
              </TokenTab>
            </TokenTabs>

            <BuyWidgetContainer>
              <BuyWidget
                client={client}
                chain={currentChain}
                tokenAddress={tokenAddress}
                amount={amount}
                onSuccess={handleSuccess}
                onError={handleError}
                theme="light"
              />
            </BuyWidgetContainer>
          </>
        )}

        <FooterNote>
          <strong>Note:</strong> {mode === 'cashin' ? (
            <>
              Fiat-to-crypto purchases are processed by third-party providers. 
              Fees and processing times may vary. Tokens will be sent directly to your connected wallet on Base network.
            </>
          ) : (
            <>
              Bridge transactions transfer your Base tokens to Ethereum mainnet. 
              The amount will be deducted from your Base balance and delivered to the same wallet on mainnet.
            </>
          )}
        </FooterNote>
      </BlockModalContent>
    </BlockModal>
  );
};

export default BuyTokensModal;