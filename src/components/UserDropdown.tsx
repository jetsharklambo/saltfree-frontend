import React, { useState, useEffect, useRef } from 'react';
import { User, List, TrendingUp, ChevronDown, Settings } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import { getDisplayNameInfo } from '../utils/userUtils';
import {
  GlassCard,
  GlassButton,
  FlexContainer
} from '../styles/glass';
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

const DropdownButton = styled(GlassButton)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
  transition: all 0.2s ease;
  
  &:hover {
    background: rgba(139, 92, 246, 0.15);
    transform: translateY(-2px);
  }
  
  .chevron {
    transition: transform 0.2s ease;
    &.open {
      transform: rotate(180deg);
    }
  }
`;

const DropdownMenu = styled(motion.div)`
  position: fixed;
  min-width: 280px;
  z-index: 9999;
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(32px);
  -webkit-backdrop-filter: blur(32px);
  border: 2px solid rgba(255, 255, 255, 0.25);
  border-radius: 20px;
  padding: 1rem;
  pointer-events: auto;
  transform-origin: bottom center;
  box-shadow: 
    0 -15px 50px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.15),
    inset 0 1px 0 rgba(255, 255, 255, 0.25);
  
  @media (max-width: 768px) {
    min-width: 320px;
    border-radius: 24px;
    padding: 1.25rem;
  }
`;

const DropdownHeader = styled.div`
  padding: 1rem 0.75rem 0.75rem 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 0.5rem;
  
  .username {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 0.25rem;
  }
  
  .display-method {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 0.25rem;
    font-weight: 500;
  }
  
  .address {
    font-size: 0.8rem;
    color: rgba(255, 255, 255, 0.6);
    font-family: monospace;
  }
`;

const DropdownItem = styled(GlassButton)`
  width: 100%;
  justify-content: flex-start;
  padding: 1rem 0.75rem;
  margin-bottom: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  font-size: 0.95rem;
  transition: all 0.2s ease;
  min-height: 48px; /* Touch-friendly minimum height */
  
  &:hover, &:focus {
    background: rgba(255, 255, 255, 0.15);
    border-color: rgba(255, 255, 255, 0.25);
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
    background: rgba(255, 255, 255, 0.2);
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
      color: 'rgba(139, 92, 246, 0.8)',
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
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

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

  const updateDropdownPosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const scrollTop = window.scrollY;
      
      // Calculate position to place dropup menu above the button
      // Estimate menu height and width
      const estimatedMenuHeight = 280;
      const estimatedMenuWidth = 280;
      
      // Calculate center position of button
      const buttonCenterX = rect.left + rect.width / 2;
      
      // Position menu centered above button
      const idealLeft = buttonCenterX - estimatedMenuWidth / 2;
      
      // Ensure menu doesn't go off screen edges
      const minLeft = 16; // 16px from left edge
      const maxLeft = window.innerWidth - estimatedMenuWidth - 16; // 16px from right edge
      const finalLeft = Math.max(minLeft, Math.min(idealLeft, maxLeft));
      
      setDropdownPosition({
        top: rect.top + scrollTop - estimatedMenuHeight - 12, // Position above button with gap
        left: finalLeft // Use left positioning directly
      });
    }
  };

  const handleToggle = () => {
    if (!isOpen) {
      updateDropdownPosition();
    }
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
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`
              }}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.25, type: "spring", stiffness: 400, damping: 25 }}
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