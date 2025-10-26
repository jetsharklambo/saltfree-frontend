import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ThirdwebProvider, ConnectButton, useActiveAccount, useActiveWalletChain } from 'thirdweb/react';
import { Toaster } from 'react-hot-toast';
import { client, base, ethereum } from './thirdweb';
import GameDashboard from './components/GameDashboard';
import GameDetailPage from './pages/GameDetailPage';
import MultiGamePage from './pages/MultiGamePage';
import TestPage from './pages/TestPage';
import DebugPage from './pages/DebugPage';
import Footer from './components/Footer';
import BuyTokensModal from './components/BuyTokensModal';
import { GameDataProvider } from './contexts/GameDataContext';
import { UserProvider } from './contexts/UserContext';
import { validateEnvironment } from './utils/envUtils';
import styled from '@emotion/styled';
import { Global, css } from '@emotion/react';
import { blockTheme, blockMedia, BlockButton } from './styles/blocks';
import { CreditCard } from 'lucide-react';

import { GracefulErrorBoundary } from './components/GracefulErrorBoundary';

const globalStyles = css`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html, body {
    height: 100%;
    overflow-x: hidden;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 
                 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
    /* 90s pastel gradient background */
    background: linear-gradient(45deg, 
      ${blockTheme.pastelPink} 0%,
      ${blockTheme.pastelPeach} 25%,
      ${blockTheme.pastelYellow} 50%,
      ${blockTheme.pastelMint} 75%,
      ${blockTheme.pastelBlue} 100%
    );
    background-size: 400% 400%;
    animation: gradientShift 10s ease infinite;
    color: ${blockTheme.darkText};
    min-height: 100vh;
    position: relative;
    /* Prevent iOS bounce effect */
    -webkit-overflow-scrolling: touch;
  }
  
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }

  #root {
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  /* 90s-style chunky scrollbar */
  ::-webkit-scrollbar {
    width: 16px;
  }

  ::-webkit-scrollbar-track {
    background: ${blockTheme.pastelBlue};
    border: 2px solid ${blockTheme.darkText};
    border-radius: 8px;
  }

  ::-webkit-scrollbar-thumb {
    background: ${blockTheme.pastelPink};
    border: 2px solid ${blockTheme.darkText};
    border-radius: 8px;
    
    &:hover {
      background: ${blockTheme.pastelCoral};
    }
  }

  ::-webkit-scrollbar-corner {
    background: ${blockTheme.pastelYellow};
    border: 2px solid ${blockTheme.darkText};
  }
`;

const AppContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
`;

const BackgroundOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* 90s geometric patterns overlay */
  background: 
    repeating-linear-gradient(
      45deg,
      transparent 0px,
      transparent 20px,
      rgba(0, 0, 0, 0.02) 20px,
      rgba(0, 0, 0, 0.02) 40px
    ),
    repeating-linear-gradient(
      -45deg,
      transparent 0px,
      transparent 30px,
      rgba(255, 255, 255, 0.03) 30px,
      rgba(255, 255, 255, 0.03) 60px
    );
  z-index: 0;
  pointer-events: none;
  
  ${blockMedia.mobile} {
    opacity: 0.7;
  }
`;

const WalletBar = styled.div`
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 1000;
  display: flex;
  gap: 1rem;
  align-items: center;
  
  ${blockMedia.tablet} {
    top: 1rem;
    right: 1rem;
    left: 1rem;
    justify-content: center;
  }
`;

const StyledConnectButton = styled.div`
  button {
    background: ${blockTheme.pastelLavender} !important;
    border: 3px solid ${blockTheme.darkText} !important;
    border-radius: 12px !important;
    color: ${blockTheme.darkText} !important;
    font-weight: 700 !important;
    padding: 0.75rem 1.5rem !important;
    transition: all 0.15s ease !important;
    box-shadow: 6px 6px 0px ${blockTheme.shadowDark} !important;
    font-family: inherit !important;
    
    &:hover {
      background: ${blockTheme.pastelCoral} !important;
      transform: translate(-2px, -2px) !important;
      box-shadow: 8px 8px 0px ${blockTheme.shadowDark} !important;
    }
    
    &:active {
      transform: translate(2px, 2px) !important;
      box-shadow: 2px 2px 0px ${blockTheme.shadowDark} !important;
    }
  }
  
  ${blockMedia.tablet} {
    button {
      padding: 1rem 1.5rem !important;
      font-size: 16px !important; /* Prevent zoom on iOS */
    }
  }
`;

const BuyTokensButton = styled(BlockButton)`
  background: ${blockTheme.pastelMint};
  border: 3px solid ${blockTheme.darkText};
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  &:hover {
    background: ${blockTheme.pastelYellow};
  }
  
  svg {
    width: 20px;
    height: 20px;
  }
`;

const MainContent = styled.main`
  flex: 1;
  padding-top: 5rem;
  position: relative;
  z-index: 1;
  
  @media (max-width: 768px) {
    padding-top: 6rem;
  }
`;

// Wallet Controls Component
function WalletControls() {
  const account = useActiveAccount();
  const activeChain = useActiveWalletChain();
  const [showBuyTokensModal, setShowBuyTokensModal] = useState(false);

  // Check if user is on Ethereum mainnet
  const isOnEthereum = activeChain?.id === ethereum.id;

  return (
    <>
      <WalletBar>
        {account && (
          <>
            {isOnEthereum ? (
              // On Ethereum - show ConnectButton styled as wallet button
              <StyledConnectButton>
                <ConnectButton 
                  client={client}
                  chain={ethereum}
                  chains={[ethereum]}
                />
              </StyledConnectButton>
            ) : (
              // On Base or other networks - show Cash In/Out button
              <BuyTokensButton onClick={() => setShowBuyTokensModal(true)}>
                <CreditCard size={20} />
                Cash In/Out
              </BuyTokensButton>
            )}
          </>
        )}
        <StyledConnectButton>
          <ConnectButton 
            client={client}
            chains={[base, ethereum]}
            chain={base}
            switchButton={{
              label: "Connect to Base to Play",
              style: {
                background: `${blockTheme.pastelYellow} !important`,
                border: `3px solid ${blockTheme.darkText} !important`,
                borderRadius: "12px !important",
                color: `${blockTheme.darkText} !important`,
                fontWeight: "700 !important",
                padding: "0.75rem 1.5rem !important",
              }
            }}
          />
        </StyledConnectButton>
      </WalletBar>
      
      {showBuyTokensModal && (
        <BuyTokensModal 
          onClose={() => setShowBuyTokensModal(false)}
          onSuccess={() => {
            // Modal stays open for user to complete purchase
          }}
        />
      )}
    </>
  );
}

function App() {
  // Validate environment variables on app startup
  useEffect(() => {
    try {
      validateEnvironment();
    } catch (error) {
      // Error is already logged in validateEnvironment()
      // In production, this would prevent the app from starting
    }
  }, []);

  return (
    <HelmetProvider>
      <BrowserRouter>
        <GracefulErrorBoundary onError={(error, errorInfo) => {
            // Note: Replaced console.error with conditional logging for production
            if (process.env.NODE_ENV === 'development') {
              console.error('🚨 App-level error (non-blocking):', error, errorInfo);
            }
          }}>
          <ThirdwebProvider>
            <UserProvider>
              <GameDataProvider>
                <Global styles={globalStyles} />
                <AppContainer>
                <BackgroundOverlay />
                <WalletControls />

                <MainContent>
                  <Routes>
                    <Route path="/" element={<GameDashboard />} />
                    <Route path="/games/active" element={<GameDashboard filter="active" />} />
                    <Route path="/games/mine" element={<GameDashboard filter="mine" />} />
                    <Route path="/leaderboard" element={<GameDashboard view="leaderboard" />} />
                    <Route path="/test" element={<TestPage />} />
                    <Route path="/debug" element={<DebugPage />} />
                    <Route path="/game/:gameCode" element={<GameDetailPage />} />
                    <Route path="/game/*" element={<MultiGamePage />} />
                    <Route path="/join/:gameCode" element={<GameDetailPage autoJoin={true} />} />
                  </Routes>
                </MainContent>
                
                <Footer />
                
                
                {/* 90s-style Toast notifications */}
                <Toaster
                  position="bottom-right"
                  reverseOrder={false}
                  gutter={8}
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: blockTheme.pastelYellow,
                      border: `3px solid ${blockTheme.darkText}`,
                      borderRadius: '12px',
                      color: blockTheme.darkText,
                      boxShadow: `6px 6px 0px ${blockTheme.shadowDark}`,
                      fontSize: '0.9rem',
                      fontWeight: '600',
                      maxWidth: '400px',
                      padding: '16px',
                    },
                    success: {
                      style: {
                        background: blockTheme.pastelMint,
                      },
                      iconTheme: {
                        primary: blockTheme.success,
                        secondary: blockTheme.darkText,
                      },
                    },
                    error: {
                      style: {
                        background: blockTheme.pastelCoral,
                      },
                      iconTheme: {
                        primary: blockTheme.error,
                        secondary: blockTheme.darkText,
                      },
                    },
                  }}
                />
              </AppContainer>
              </GameDataProvider>
            </UserProvider>
          </ThirdwebProvider>
        </GracefulErrorBoundary>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;