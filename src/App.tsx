import React from 'react';
import { ThirdwebProvider, ConnectButton } from 'thirdweb/react';
import { client, chain } from './thirdweb';
import GameDashboard from './components/GameDashboard';
import { GameDataProvider } from './contexts/GameDataContext';
import { UserProvider } from './contexts/UserContext';
// Removed unused imports
import styled from '@emotion/styled';
import { Global, css } from '@emotion/react';

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
    background: linear-gradient(135deg, 
      rgba(16, 24, 39, 0.95) 0%, 
      rgba(31, 41, 55, 0.85) 50%, 
      rgba(17, 24, 39, 0.95) 100%);
    color: rgba(255, 255, 255, 0.9);
    min-height: 100vh;
    position: relative;
  }

  body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-image: 
      radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.2) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 40%, rgba(120, 219, 226, 0.08) 0%, transparent 50%);
    z-index: -1;
    pointer-events: none;
  }

  #root {
    min-height: 100vh;
    position: relative;
    z-index: 1;
  }

  /* Scrollbar styling */
  ::-webkit-scrollbar {
    width: 8px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.4);
  }
`;

const AppContainer = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
`;

const WalletBar = styled.div`
  position: fixed;
  top: 2rem;
  right: 2rem;
  z-index: 1000;
  
  @media (max-width: 768px) {
    top: 1rem;
    right: 1rem;
    left: 1rem;
    display: flex;
    justify-content: center;
  }
`;

const StyledConnectButton = styled.div`
  button {
    background: rgba(255, 255, 255, 0.1) !important;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.2) !important;
    border-radius: 12px !important;
    color: rgba(255, 255, 255, 0.9) !important;
    font-weight: 500 !important;
    padding: 0.75rem 1.5rem !important;
    transition: all 0.2s ease !important;
    
    &:hover {
      background: rgba(255, 255, 255, 0.15) !important;
      transform: translateY(-2px);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3) !important;
    }
  }
  
  @media (max-width: 768px) {
    button {
      padding: 1rem 1.5rem !important;
      font-size: 16px !important; /* Prevent zoom on iOS */
    }
  }
`;

const MainContent = styled.main`
  flex: 1;
  padding-top: 5rem;
  
  @media (max-width: 768px) {
    padding-top: 6rem;
  }
`;

function App() {
  return (
    <GracefulErrorBoundary onError={(error, errorInfo) => {
        console.error('🚨 App-level error (non-blocking):', error, errorInfo);
      }}>
      <ThirdwebProvider client={client}>
        <UserProvider>
          <GameDataProvider>
            <Global styles={globalStyles} />
            <AppContainer>
            <WalletBar>
              <StyledConnectButton>
                <ConnectButton 
                  client={client}
                  chain={chain}
                />
              </StyledConnectButton>
            </WalletBar>

            <MainContent>
              <GameDashboard />
            </MainContent>
          </AppContainer>
          </GameDataProvider>
        </UserProvider>
      </ThirdwebProvider>
    </GracefulErrorBoundary>
  );
}

export default App;