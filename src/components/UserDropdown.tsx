import React, { useState, useEffect, useRef } from 'react';
import { User, List, TrendingUp, ChevronDown, Settings } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { getDisplayNameInfo } from '../utils/userUtils';
import { FlexBlock, blockTheme, Block, BlockButton } from '../styles/blocks';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';

interface UserDropdownProps {
  onEditUsername: () => void;
  onGameLists: () => void;
  onGameHistory: () => void;
  walletAddress: string;
}

const DropdownContainer = styled.div`
  position: relative;
  display: inline-block;
`;

// Backdrop overlay to separate dropdown from content behind it
const DropdownBackdrop = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9998;
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  pointer-events: auto;
`;

const DropdownButton = styled(BlockButton)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  
  .chevron {
    transition: transform 0.2s ease;
    &.open {
      transform: rotate(180deg);
    }
  }
`;

const DropdownMenu = styled(motion.div)`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  min-width: 320px;
  z-index: 9999;
  background: ${blockTheme.pastelYellow};
  border: 4px solid ${blockTheme.darkText};
  border-radius: 12px;
  padding: 1.5rem;
  pointer-events: auto;
  box-shadow: 8px 8px 0px ${blockTheme.shadowDark};
  
  @media (max-width: 768px) {
    min-width: 280px;
    max-width: 90vw;
    padding: 1.25rem;
  }
`;

const DropdownHeader = styled.div`
  padding: 1rem 0.75rem 0.75rem 0.75rem;
  border-bottom: 3px solid ${blockTheme.darkText};
  margin-bottom: 1rem;
  
  .username {
    font-size: 1rem;
    font-weight: 700;
    color: ${blockTheme.darkText};
    margin-bottom: 0.25rem;
  }
  
  .display-method {
    font-size: 0.75rem;
    color: ${blockTheme.darkText};
    margin-bottom: 0.25rem;
    font-weight: 600;
    opacity: 0.7;
  }
  
  .address {
    font-size: 0.8rem;
    color: ${blockTheme.darkText};
    font-family: monospace;
    font-weight: 600;
    opacity: 0.8;
  }
`;

const DropdownItem = styled(BlockButton)`
  width: 100%;
  justify-content: flex-start;
  margin-bottom: 0.75rem;
  background: ${blockTheme.pastelMint};
  font-size: 0.95rem;
  min-height: 48px; /* Touch-friendly minimum height */
  
  &:hover {
    background: ${blockTheme.pastelCoral};
  }
  
  &:last-child {
    margin-bottom: 0;
  }
  
  @media (max-width: 768px) {
    padding: 1.25rem 1rem;
    font-size: 1rem;
    min-height: 52px;
  }
`;

// ENS Badge component to show ENS names under wallet addresses
const ENSBadge: React.FC<{ address: string }> = ({ address }) => {
  const info = getDisplayNameInfo(address);
  
  // Only show badge for ENS names
  if (info.method !== 'ens' || !info.displayName.endsWith('.eth')) {
    return null;
  }
  
  return (
    <div style={{
      fontSize: '0.65rem',
      color: blockTheme.accent,
      marginTop: '2px',
      fontFamily: 'monospace',
      display: 'flex',
      alignItems: 'center',
      gap: '2px'
    }}>
      🏷️ {info.displayName}
    </div>
  );
};

export const UserDropdown: React.FC<UserDropdownProps> = ({
  onEditUsername,
  onGameLists,
  onGameHistory,
  walletAddress
}) => {
  const { user } = useUser();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleItemClick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOpen(false);
  };

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const displayInfo = getDisplayNameInfo(walletAddress);
  const displayName = displayInfo.displayName;
  const hasUsername = !!user?.username;

  return (
    <DropdownContainer ref={dropdownRef}>
      <DropdownButton 
        ref={buttonRef}
        onClick={handleToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleToggle();
          }
        }}
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <Settings size={16} />
        <span>{hasUsername ? user.username : 'Menu'}</span>
        <ChevronDown 
          size={16} 
          className={`chevron ${isOpen ? 'open' : ''}`}
        />
      </DropdownButton>

      <AnimatePresence>
        {isOpen && (
          <>
            <DropdownBackdrop
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={handleBackdropClick}
            />
            <DropdownMenu
              onClick={handleMenuClick}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2, type: "spring", stiffness: 400, damping: 25 }}
            >
            <DropdownHeader>
              <div className="username">
                {displayName}
              </div>
              <div className="display-method">
                {displayInfo.method === 'username' && '👤 Using Username'}
                {displayInfo.method === 'ens' && '🏷️ Using ENS Name'}
                {displayInfo.method === 'address' && '📋 Using Wallet Address'}
              </div>
              <div className="address">
                <div>
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </div>
                <ENSBadge address={walletAddress} />
              </div>
            </DropdownHeader>

            <DropdownItem onClick={() => handleItemClick(onEditUsername)}>
              <User size={16} />
              {hasUsername ? 'Edit Username' : 'Set Username'}
            </DropdownItem>


            <DropdownItem onClick={() => handleItemClick(onGameLists)}>
              <List size={16} />
              My Game Lists
            </DropdownItem>

            <DropdownItem onClick={() => handleItemClick(onGameHistory)}>
              <TrendingUp size={16} />
              Game History
            </DropdownItem>
            </DropdownMenu>
          </>
        )}
      </AnimatePresence>
    </DropdownContainer>
  );
};

export default UserDropdown;