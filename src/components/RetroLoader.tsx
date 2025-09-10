import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';
import { blockTheme, PixelText, RetroProgressBar, Block, dialupConnect } from '../styles/blocks';

// Dial-up connection stages
const dialupStages = [
  { message: 'Initializing connection...', duration: 800, progress: 0 },
  { message: 'Detecting modem...', duration: 600, progress: 15 },
  { message: 'Dialing ISP...', duration: 1000, progress: 30 },
  { message: 'Handshaking...', duration: 1200, progress: 50 },
  { message: 'Authenticating...', duration: 800, progress: 70 },
  { message: 'Establishing connection...', duration: 600, progress: 85 },
  { message: 'Connected!', duration: 500, progress: 100 },
];

// ASCII art modem sounds visualization
const modemSounds = [
  '♪ BEEP ♪',
  '♫ BOOP ♫', 
  '♪ SCREECH ♪',
  '♫ STATIC ♫',
  '♪ WHISTLE ♪',
];

// Retro computer terminal styling
const TerminalWindow = styled(Block)`
  background: ${blockTheme.darkText};
  color: ${blockTheme.crtGreen};
  font-family: 'Courier New', monospace;
  padding: 2rem;
  border: 4px solid #333;
  position: relative;
  min-height: 200px;
  
  /* CRT screen effect */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: repeating-linear-gradient(
      0deg,
      transparent,
      transparent 2px,
      rgba(0, 255, 65, 0.03) 2px,
      rgba(0, 255, 65, 0.03) 4px
    );
    pointer-events: none;
    border-radius: 12px;
  }
  
  /* Flickering animation */
  animation: ${keyframes`
    0%, 98%, 100% { opacity: 1; }
    99% { opacity: 0.98; }
  `} 3s infinite;
`;

const DialupText = styled(PixelText)`
  color: ${blockTheme.crtGreen};
  text-shadow: 0 0 5px ${blockTheme.crtGreen};
  margin: 0.5rem 0;
  
  &.blink {
    animation: ${keyframes`
      0%, 50% { opacity: 1; }
      51%, 100% { opacity: 0; }
    `} 1s infinite;
  }
`;

const ModemSound = styled.div`
  position: absolute;
  top: 1rem;
  right: 1rem;
  font-size: 0.8rem;
  color: ${blockTheme.retroBlue};
  animation: ${keyframes`
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.2); opacity: 0.7; }
    100% { transform: scale(1); opacity: 1; }
  `} 0.5s ease-in-out infinite;
`;

const RetroSpinner = styled.div`
  display: inline-block;
  width: 20px;
  height: 20px;
  margin-right: 10px;
  
  &::after {
    content: '|';
    color: ${blockTheme.crtGreen};
    font-weight: bold;
    animation: ${keyframes`
      0% { content: '|'; }
      25% { content: '/'; }
      50% { content: '-'; }
      75% { content: '\\'; }
      100% { content: '|'; }
    `} 0.5s infinite;
  }
`;

const StatusBar = styled.div`
  background: #333;
  border: 2px inset #666;
  padding: 0.5rem;
  margin-top: 1rem;
  border-radius: 4px;
`;

// ASCII art for different connection stages
const getASCIIArt = (stage: number) => {
  const art = [
    // Initializing
    `
    ╔══════════════════════════╗
    ║   [■]  INITIALIZING...   ║
    ╚══════════════════════════╝`,
    // Detecting modem
    `
    📞  ≋≋≋  [MODEM DETECTED]`,
    // Dialing
    `
    ☎️  ♪ RING RING ♪  📡`,
    // Handshaking
    `
    🤝  ←→  HANDSHAKE PROTOCOL`,
    // Authenticating  
    `
    🔐  [AUTH]  ✓ VERIFIED`,
    // Establishing
    `
    🌐  ═══════  CONNECTING...`,
    // Connected
    `
    ✅  ◆ ONLINE ◆  🎉`
  ];
  
  return art[Math.min(stage, art.length - 1)];
};

interface RetroLoaderProps {
  message?: string;
  onComplete?: () => void;
  autoStart?: boolean;
  showASCII?: boolean;
}

const RetroLoader: React.FC<RetroLoaderProps> = ({ 
  message = 'Connecting to blockchain...', 
  onComplete,
  autoStart = true,
  showASCII = true 
}) => {
  const [currentStage, setCurrentStage] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [currentSound, setCurrentSound] = useState(0);
  const [displayMessage, setDisplayMessage] = useState(message);

  useEffect(() => {
    if (!autoStart) return;

    let timeoutId: NodeJS.Timeout;
    
    if (currentStage < dialupStages.length) {
      const stage = dialupStages[currentStage];
      setDisplayMessage(stage.message);
      
      timeoutId = setTimeout(() => {
        if (currentStage === dialupStages.length - 1) {
          setIsComplete(true);
          if (onComplete) {
            setTimeout(onComplete, 500);
          }
        } else {
          setCurrentStage(prev => prev + 1);
        }
      }, stage.duration);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [currentStage, autoStart, onComplete]);

  // Update modem sounds
  useEffect(() => {
    if (currentStage < 3) { // Only during first few stages
      const soundInterval = setInterval(() => {
        setCurrentSound(prev => (prev + 1) % modemSounds.length);
      }, 800);
      
      return () => clearInterval(soundInterval);
    }
  }, [currentStage]);

  const currentProgress = currentStage < dialupStages.length 
    ? dialupStages[currentStage].progress 
    : 100;

  return (
    <TerminalWindow color="darkText">
      <ModemSound>
        {currentStage < 3 && modemSounds[currentSound]}
      </ModemSound>
      
      <DialupText size="lg" glow>
        {isComplete ? '◆ CONNECTION ESTABLISHED ◆' : '◆ DIAL-UP CONNECTION ◆'}
      </DialupText>
      
      {showASCII && (
        <DialupText size="sm" style={{ whiteSpace: 'pre-line', textAlign: 'center', margin: '1rem 0' }}>
          {getASCIIArt(currentStage)}
        </DialupText>
      )}
      
      <div style={{ display: 'flex', alignItems: 'center', margin: '1rem 0' }}>
        {!isComplete && <RetroSpinner />}
        <DialupText size="md" className={!isComplete ? 'blink' : ''}>
          {displayMessage}
        </DialupText>
      </div>
      
      <StatusBar>
        <RetroProgressBar progress={currentProgress} />
        <DialupText size="sm" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
          {isComplete ? 'CONNECTED @ 56k' : `${currentProgress}% - CONNECTING...`}
        </DialupText>
      </StatusBar>
      
      {isComplete && (
        <DialupText size="sm" glow style={{ textAlign: 'center', marginTop: '1rem' }}>
          🎮 Ready to play! 🎮
        </DialupText>
      )}
    </TerminalWindow>
  );
};

// Simpler loading component for inline use
export const SimpleRetroLoader: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '0.5rem',
      background: blockTheme.darkText,
      padding: '0.5rem 0.75rem',
      border: `2px solid ${blockTheme.darkText}`,
      borderRadius: '8px',
      boxShadow: `2px 2px 0px ${blockTheme.shadowDark}`
    }}>
      <RetroSpinner />
      <PixelText size={size} color="crtGreen" glow>
        Loading...
      </PixelText>
    </div>
  );
};

// Blockchain transaction loader with custom messages
export const TransactionLoader: React.FC<{
  stage: 'signing' | 'broadcasting' | 'confirming' | 'complete';
  transactionHash?: string;
}> = ({ stage, transactionHash }) => {
  const stageMessages = {
    signing: 'Signing transaction...',
    broadcasting: 'Broadcasting to network...',
    confirming: 'Awaiting confirmation...',
    complete: 'Transaction confirmed!'
  };

  const stageProgress = {
    signing: 25,
    broadcasting: 50,
    confirming: 75,
    complete: 100
  };

  return (
    <Block color="pastelMint" style={{ textAlign: 'center' }}>
      <PixelText size="lg" style={{ marginBottom: '1rem' }}>
        🔗 BLOCKCHAIN TRANSACTION 🔗
      </PixelText>
      
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
        {stage !== 'complete' && <RetroSpinner />}
        <PixelText size="md">
          {stageMessages[stage]}
        </PixelText>
      </div>
      
      <RetroProgressBar progress={stageProgress[stage]} />
      
      {transactionHash && (
        <PixelText size="sm" style={{ marginTop: '1rem', wordBreak: 'break-all' }}>
          TX: {transactionHash.slice(0, 20)}...
        </PixelText>
      )}
      
      {stage === 'complete' && (
        <PixelText size="md" glow style={{ marginTop: '1rem', color: blockTheme.success }}>
          ✅ SUCCESS! ✅
        </PixelText>
      )}
    </Block>
  );
};

export default RetroLoader;