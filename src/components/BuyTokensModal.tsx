import React, { useState } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { BuyWidget } from "thirdweb/react";
import { X, CreditCard, Wallet, Info } from 'lucide-react';
import { client, chain, BASE_TOKENS, formatAddress } from '../thirdweb';
import { 
  BlockModal, 
  BlockModalContent, 
  BlockButton,
  FlexBlock,
  blockTheme
} from '../styles/blocks';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface BuyTokensModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  defaultToken?: 'ETH' | 'USDC';
  defaultAmount?: string;
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
  background: ${props => props.$active ? blockTheme.pastelLavender : blockTheme.pastelGray};
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
  background: ${blockTheme.pastelGray};
  border: 2px solid ${blockTheme.darkText};
  border-radius: 8px;
  font-size: 0.85rem;
  color: ${blockTheme.darkText};
  text-align: center;
  line-height: 1.5;
`;

const BuyTokensModal: React.FC<BuyTokensModalProps> = ({ 
  onClose, 
  onSuccess,
  defaultToken = 'ETH',
  defaultAmount = '0.01'
}) => {
  const account = useActiveAccount();
  const [selectedToken, setSelectedToken] = useState<'ETH' | 'USDC'>(defaultToken);
  const [amount, setAmount] = useState(defaultAmount);

  const handleSuccess = () => {
    toast.success('Token purchase initiated! Check your wallet for the transaction.');
    if (onSuccess) {
      onSuccess();
    }
    // Keep modal open so user can complete the purchase
  };

  const handleError = (error: any) => {
    console.error('Purchase error:', error);
    toast.error('Failed to initiate purchase. Please try again.');
  };

  if (!account) {
    return (
      <BlockModal onClick={onClose}>
        <BlockModalContent onClick={(e) => e.stopPropagation()}>
          <ModalHeader>
            <ModalTitle>
              <CreditCard size={24} />
              Buy Tokens
            </ModalTitle>
            <CloseButton onClick={onClose}>
              <X size={20} />
            </CloseButton>
          </ModalHeader>
          
          <InfoBox>
            <Info size={20} />
            <InfoText>
              Please connect your wallet first to buy tokens.
            </InfoText>
          </InfoBox>
        </BlockModalContent>
      </BlockModal>
    );
  }

  const tokenAddress = selectedToken === 'ETH' 
    ? BASE_TOKENS.ETH.address 
    : BASE_TOKENS.USDC.address;

  return (
    <BlockModal onClick={onClose}>
      <BlockModalContent 
        onClick={(e) => e.stopPropagation()}
        as={motion.div}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <ModalHeader>
          <ModalTitle>
            <CreditCard size={24} />
            Buy Tokens with Fiat
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

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
            <strong>Buy tokens instantly with your credit card or bank transfer.</strong><br />
            Powered by Thirdweb's secure payment partners. KYC may be required for first-time purchases.
          </InfoText>
        </InfoBox>

        <TokenTabs>
          <TokenTab 
            $active={selectedToken === 'ETH'}
            onClick={() => setSelectedToken('ETH')}
          >
            <img src={BASE_TOKENS.ETH.icon} alt="ETH" />
            ETH
          </TokenTab>
          <TokenTab 
            $active={selectedToken === 'USDC'}
            onClick={() => setSelectedToken('USDC')}
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
            walletAddress={account.address}
            onSuccess={handleSuccess}
            onError={handleError}
            theme="light"
          />
        </BuyWidgetContainer>

        <FooterNote>
          <strong>Note:</strong> Fiat-to-crypto purchases are processed by third-party providers. 
          Fees and processing times may vary. Tokens will be sent directly to your connected wallet on Base network.
        </FooterNote>
      </BlockModalContent>
    </BlockModal>
  );
};

export default BuyTokensModal;