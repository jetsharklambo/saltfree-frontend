import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { ChevronDown, Check } from 'lucide-react';
import { BASE_TOKENS, getTokenByAddress, formatTokenAmount, parseTokenAmount, client, chain } from '../thirdweb';
import { blockTheme, PixelText } from '../styles/blocks';
import { useActiveAccount } from 'thirdweb/react';
import { readContract, getContract, getBalance } from 'thirdweb';
import { gameContract } from '../thirdweb';

interface TokenSelectorProps {
  selectedToken: string;
  onTokenChange: (tokenAddress: string) => void;
  amount?: string;
  onAmountChange?: (amount: string) => void;
  showAmountInput?: boolean;
  disabled?: boolean;
  label?: string;
}

const SelectorContainer = styled.div`
  margin-bottom: 1rem;
`;

const Label = styled(PixelText)`
  font-size: 0.9rem;
  color: ${blockTheme.darkText};
  margin-bottom: 0.5rem;
  display: block;
`;

const DropdownContainer = styled.div`
  position: relative;
  display: inline-block;
  width: 100%;
`;

const DropdownButton = styled.button<{ disabled?: boolean }>`
  background: ${blockTheme.pastelMint};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 0.75rem 1rem;
  width: 100%;
  color: ${blockTheme.darkText};
  font-family: inherit;
  font-size: 1rem;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: all 0.2s ease;
  box-shadow: 4px 4px 0px ${blockTheme.shadowMedium};
  opacity: ${props => props.disabled ? 0.6 : 1};
  
  &:hover:not(:disabled) {
    background: ${blockTheme.pastelYellow};
    transform: translateY(2px);
    box-shadow: 2px 2px 0px ${blockTheme.shadowMedium};
  }
  
  &:active:not(:disabled) {
    transform: translateY(4px);
    box-shadow: none;
  }
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

const DropdownMenu = styled.div<{ isOpen: boolean }>`
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: ${blockTheme.lightBg};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  box-shadow: 4px 4px 0px ${blockTheme.shadowMedium};
  z-index: 1000;
  max-height: 200px;
  overflow-y: auto;
  display: ${props => props.isOpen ? 'block' : 'none'};
`;

const DropdownItem = styled.button<{ isSelected: boolean }>`
  width: 100%;
  padding: 0.75rem 1rem;
  background: ${props => props.isSelected ? blockTheme.pastelLavender : 'transparent'};
  border: none;
  color: ${blockTheme.darkText};
  font-family: inherit;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background-color 0.2s ease;
  
  &:hover {
    background: ${props => props.isSelected ? blockTheme.pastelLavender : blockTheme.pastelMint};
  }
  
  &:first-of-type {
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
  }
  
  &:last-of-type {
    border-bottom-left-radius: 8px;
    border-bottom-right-radius: 8px;
  }
`;

const AmountInputContainer = styled.div`
  margin-top: 0.5rem;
  display: flex;
  gap: 0.5rem;
  align-items: center;
`;

const AmountInput = styled.input`
  flex: 1;
  padding: 0.75rem;
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  background: ${blockTheme.lightBg};
  color: ${blockTheme.darkText};
  font-family: inherit;
  font-size: 1rem;
  box-shadow: inset 2px 2px 0px ${blockTheme.shadowLight};
  
  &:focus {
    outline: none;
    background: ${blockTheme.pastelYellow};
  }
  
  &::placeholder {
    color: ${blockTheme.mutedText};
  }
`;

const TokenUnit = styled(PixelText)`
  font-size: 0.9rem;
  color: ${blockTheme.mutedText};
  min-width: 60px;
  text-align: right;
`;

export const TokenSelector: React.FC<TokenSelectorProps> = ({
  selectedToken,
  onTokenChange,
  amount = '',
  onAmountChange,
  showAmountInput = false,
  disabled = false,
  label = 'Select Token'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [userBalances, setUserBalances] = useState<Record<string, string>>({});
  const account = useActiveAccount();

  const selectedTokenInfo = getTokenByAddress(selectedToken);
  const tokenOptions = Object.values(BASE_TOKENS);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.token-selector-dropdown')) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch real user token balances from blockchain
  useEffect(() => {
    const fetchBalances = async () => {
      if (!account) {
        setUserBalances({});
        return;
      }
      
      try {
        const balances: Record<string, string> = {};
        
        // Fetch ETH balance
        const ethBalance = await getBalance({
          client,
          chain,
          address: account.address
        });
        balances[BASE_TOKENS.ETH.address] = (Number(ethBalance.value) / 1e18).toFixed(4);
        
        // Fetch ERC20 token balances
        const tokenAddresses = [
          BASE_TOKENS.USDC.address,
          BASE_TOKENS.USDT.address,
          BASE_TOKENS.DAI.address
        ];
        
        await Promise.all(tokenAddresses.map(async (tokenAddress) => {
          try {
            // Use known decimals from BASE_TOKENS configuration
            const tokenInfo = getTokenByAddress(tokenAddress);
            const decimals = tokenInfo?.decimals || 18;
            
            const tokenContract = getContract({
              client,
              chain,
              address: tokenAddress,
              abi: [
                {
                  "constant": true,
                  "inputs": [{"name": "_owner", "type": "address"}],
                  "name": "balanceOf",
                  "outputs": [{"name": "balance", "type": "uint256"}],
                  "type": "function"
                }
              ]
            });
            
            const balance = await readContract({
              contract: tokenContract,
              method: "function balanceOf(address) view returns (uint256)",
              params: [account.address]
            }) as bigint;
            
            balances[tokenAddress] = (Number(balance) / Math.pow(10, decimals)).toFixed(4);
          } catch (err) {
            console.warn(`Failed to fetch balance for token ${tokenAddress}:`, err);
            balances[tokenAddress] = '0.0000';
          }
        }));
        
        setUserBalances(balances);
      } catch (err) {
        console.error('Failed to fetch balances:', err);
        setUserBalances({});
      }
    };

    fetchBalances();
  }, [account]);

  const handleTokenSelect = (tokenAddress: string) => {
    onTokenChange(tokenAddress);
    setIsOpen(false);
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (onAmountChange) {
      onAmountChange(value);
    }
  };

  return (
    <SelectorContainer>
      <Label>{label}</Label>
      
      <DropdownContainer className="token-selector-dropdown">
        <DropdownButton
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (!disabled) setIsOpen(!isOpen);
          }}
          disabled={disabled}
        >
          <TokenInfo>
            {selectedTokenInfo && (
              <>
                <TokenIcon src={selectedTokenInfo.icon} alt={selectedTokenInfo.symbol} />
                <TokenSymbol>{selectedTokenInfo.symbol}</TokenSymbol>
              </>
            )}
            {!selectedTokenInfo && <TokenSymbol>Select Token</TokenSymbol>}
          </TokenInfo>
          <ChevronDown size={20} />
        </DropdownButton>
        
        <DropdownMenu isOpen={isOpen}>
          {tokenOptions.map((token) => (
            <DropdownItem
              key={token.address}
              isSelected={token.address === selectedToken}
              onClick={() => handleTokenSelect(token.address)}
            >
              <TokenInfo>
                <TokenIcon src={token.icon} alt={token.symbol} />
                <div>
                  <TokenSymbol>{token.symbol}</TokenSymbol>
                  <div style={{ fontSize: '0.8rem', color: blockTheme.mutedText }}>
                    Balance: {userBalances[token.address] || '0.0'}
                  </div>
                </div>
              </TokenInfo>
              {token.address === selectedToken && <Check size={16} />}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </DropdownContainer>
      
      {showAmountInput && (
        <AmountInputContainer>
          <AmountInput
            type="number"
            min="0"
            step="any"
            placeholder="Enter amount"
            value={amount}
            onChange={handleAmountChange}
            disabled={disabled}
          />
          <TokenUnit>{selectedTokenInfo?.symbol || 'TOKEN'}</TokenUnit>
        </AmountInputContainer>
      )}
    </SelectorContainer>
  );
};

export default TokenSelector;