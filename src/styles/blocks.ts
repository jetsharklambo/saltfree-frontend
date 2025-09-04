import styled from '@emotion/styled';
import { css, keyframes } from '@emotion/react';

// Block theme - 90s pastel colors with high contrast
export const blockTheme = {
  // Pastel background colors
  pastelPink: '#FFB3D9',
  pastelPeach: '#FFDAC6', 
  pastelYellow: '#FFF4B3',
  pastelMint: '#B3FFD1',
  pastelBlue: '#B3D9FF',
  pastelLavender: '#D4C5FF',
  pastelCoral: '#FFB3B3',
  
  // High contrast text colors
  darkText: '#1a1a1a',
  lightText: '#ffffff',
  text: '#1a1a1a', // Primary text color
  textMuted: 'rgba(26, 26, 26, 0.6)', // Muted text color
  textSecondary: 'rgba(26, 26, 26, 0.8)', // Secondary text color
  accentText: '#2563eb',
  accent: '#7877c6', // Primary accent color for highlights
  
  // Shadow colors for thick block shadows
  shadowDark: '#000000',
  shadowMedium: 'rgba(0, 0, 0, 0.4)',
  shadowLight: 'rgba(0, 0, 0, 0.2)',
  
  // Status colors (90s style)  
  success: '#32CD32',
  warning: '#FFD700', 
  error: '#FF6347',
  info: '#00BFFF',
  primary: '#7877c6', // Primary brand color
  
  // 90s computer aesthetic
  retroBlue: '#0080FF',
  retroGreen: '#00FF80',
  retroPurple: '#8000FF',
  crtGreen: '#00FF41',
};

// Thick shadow effects for blocks
export const thickShadow = css`
  box-shadow: 8px 8px 0px ${blockTheme.shadowDark};
`;

export const mediumShadow = css`
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
`;

export const softShadow = css`
  box-shadow: 2px 2px 4px ${blockTheme.shadowMedium};
`;

export const insetShadow = css`
  box-shadow: inset 4px 4px 8px ${blockTheme.shadowLight};
`;

// 90s-style animations
const pixelGlow = keyframes`
  0%, 100% { 
    box-shadow: 8px 8px 0px ${blockTheme.shadowDark}, 0 0 20px ${blockTheme.retroGreen};
  }
  50% { 
    box-shadow: 8px 8px 0px ${blockTheme.shadowDark}, 0 0 40px ${blockTheme.retroGreen};
  }
`;

const blockFloat = keyframes`
  0%, 100% { 
    transform: translateY(0px);
    box-shadow: 8px 8px 0px ${blockTheme.shadowDark};
  }
  50% { 
    transform: translateY(-4px);
    box-shadow: 12px 12px 0px ${blockTheme.shadowDark};
  }
`;

const retroSlide = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
`;

const dialupConnect = keyframes`
  0% { width: 0%; }
  20% { width: 15%; }
  40% { width: 30%; }
  60% { width: 50%; }
  80% { width: 80%; }
  100% { width: 100%; }
`;

// Responsive breakpoints
export const blockBreakpoints = {
  mobile: '480px',
  tablet: '768px', 
  desktop: '1024px',
  wide: '1400px',
};

export const blockMedia = {
  mobile: `@media (max-width: ${blockBreakpoints.mobile})`,
  tablet: `@media (max-width: ${blockBreakpoints.tablet})`,
  desktop: `@media (min-width: ${blockBreakpoints.desktop})`,
  wide: `@media (min-width: ${blockBreakpoints.wide})`,
};

// Core block components
export const Block = styled.div<{
  color?: keyof typeof blockTheme;
  shadow?: 'thick' | 'medium' | 'soft' | 'inset';
  rounded?: boolean;
  interactive?: boolean;
  floating?: boolean;
}>`
  background: ${({ color = 'pastelBlue' }) => blockTheme[color]};
  border: 3px solid ${blockTheme.darkText};
  border-radius: ${({ rounded = true }) => rounded ? '16px' : '4px'};
  padding: 1.5rem;
  color: ${blockTheme.darkText};
  font-weight: 600;
  position: relative;
  transition: all 0.2s ease;
  
  ${({ shadow = 'thick' }) => {
    switch (shadow) {
      case 'thick': return thickShadow;
      case 'medium': return mediumShadow;
      case 'soft': return softShadow;
      case 'inset': return insetShadow;
      default: return thickShadow;
    }
  }}
  
  ${({ interactive }) => interactive && css`
    cursor: pointer;
    
    &:hover {
      transform: translate(-2px, -2px);
      box-shadow: 10px 10px 0px ${blockTheme.shadowDark};
    }
    
    &:active {
      transform: translate(2px, 2px);
      box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
    }
  `}
  
  ${({ floating }) => floating && css`
    animation: ${blockFloat} 3s ease-in-out infinite;
  `}
  
  ${blockMedia.mobile} {
    padding: 1rem;
    border-radius: ${({ rounded = true }) => rounded ? '12px' : '4px'};
    box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  }
`;

export const BlockButton = styled.button<{
  color?: keyof typeof blockTheme;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  $loading?: boolean;
}>`
  background: ${({ color = 'pastelPink' }) => blockTheme[color]};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  color: ${blockTheme.darkText};
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  position: relative;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  
  ${thickShadow}
  
  ${({ size = 'md' }) => {
    switch (size) {
      case 'sm':
        return css`
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          height: 2.5rem;
        `;
      case 'lg':
        return css`
          padding: 1rem 2rem;
          font-size: 1.25rem;
          height: 4rem;
        `;
      default:
        return css`
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          height: 3rem;
        `;
    }
  }}
  
  ${({ fullWidth }) => fullWidth && css`
    width: 100%;
  `}
  
  &:hover:not(:disabled) {
    transform: translate(-2px, -2px);
    box-shadow: 10px 10px 0px ${blockTheme.shadowDark};
    background: ${({ color = 'pastelPink' }) => 
      // Slightly brighten the color on hover
      blockTheme[color].replace(/\d+/g, (match) => String(Math.min(255, parseInt(match) + 20)))
    };
  }
  
  &:active:not(:disabled) {
    transform: translate(2px, 2px);
    box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  }
  
  ${({ $loading }) => $loading && css`
    opacity: 0.7;
    cursor: not-allowed;
    
    &::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: repeating-linear-gradient(
        45deg,
        transparent,
        transparent 5px,
        rgba(0, 0, 0, 0.1) 5px,
        rgba(0, 0, 0, 0.1) 10px
      );
      animation: ${retroSlide} 1s linear infinite;
    }
  `}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none !important;
    box-shadow: 4px 4px 0px ${blockTheme.shadowMedium} !important;
  }
  
  ${blockMedia.mobile} {
    min-height: 48px;
    font-size: 16px; /* Prevent zoom on iOS */
  }
`;

export const BlockInput = styled.input<{
  hasError?: boolean;
}>`
  background: ${blockTheme.lightText};
  border: 3px solid ${({ hasError }) => hasError ? blockTheme.error : blockTheme.darkText};
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  font-family: inherit;
  color: ${blockTheme.darkText};
  width: 100%;
  transition: all 0.2s ease;
  
  ${insetShadow}
  
  &::placeholder {
    color: rgba(26, 26, 26, 0.6);
    font-style: italic;
  }
  
  &:focus {
    outline: none;
    border-color: ${blockTheme.retroBlue};
    background: #f0f8ff;
    box-shadow: 
      inset 4px 4px 8px ${blockTheme.shadowLight},
      0 0 10px ${blockTheme.retroBlue};
  }
  
  ${blockMedia.mobile} {
    padding: 1rem;
    font-size: 16px; /* Prevent zoom on iOS */
  }
`;

export const BlockSelect = styled.select<{
  hasError?: boolean;
}>`
  background: ${blockTheme.lightText};
  border: 3px solid ${({ hasError }) => hasError ? blockTheme.error : blockTheme.darkText};
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  font-family: inherit;
  color: ${blockTheme.darkText};
  width: 100%;
  transition: all 0.2s ease;
  cursor: pointer;
  
  ${insetShadow}
  
  &:focus {
    outline: none;
    border-color: ${blockTheme.retroBlue};
    background: #f0f8ff;
    box-shadow: 
      inset 4px 4px 8px ${blockTheme.shadowLight},
      0 0 10px ${blockTheme.retroBlue};
  }
  
  option {
    background: ${blockTheme.lightText};
    color: ${blockTheme.darkText};
    padding: 0.5rem;
  }
  
  ${blockMedia.mobile} {
    padding: 1rem;
    font-size: 16px; /* Prevent zoom on iOS */
  }
`;

export const BlockModal = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
  
  ${blockMedia.mobile} {
    align-items: flex-end;
  }
`;

export const BlockModalContent = styled.div<{
  color?: keyof typeof blockTheme;
}>`
  background: ${({ color = 'pastelYellow' }) => blockTheme[color]};
  border: 4px solid ${blockTheme.darkText};
  border-radius: 20px;
  padding: 2rem;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  color: ${blockTheme.darkText};
  position: relative;
  
  ${thickShadow}
  
  /* 90s-style chunky scrollbar styling */
  &::-webkit-scrollbar {
    width: 18px;
    height: 18px;
  }

  &::-webkit-scrollbar-track {
    background: ${blockTheme.pastelMint};
    border: 3px solid ${blockTheme.darkText};
    border-radius: 8px;
    box-shadow: inset 2px 2px 4px ${blockTheme.shadowMedium};
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(45deg, ${blockTheme.pastelPink}, ${blockTheme.pastelPeach});
    border: 3px solid ${blockTheme.darkText};
    border-radius: 8px;
    box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
    
    &:hover {
      background: linear-gradient(45deg, ${blockTheme.pastelPeach}, ${blockTheme.pastelCoral});
      box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
    }
    
    &:active {
      box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
    }
  }

  &::-webkit-scrollbar-corner {
    background: ${blockTheme.pastelMint};
    border: 3px solid ${blockTheme.darkText};
  }

  /* Firefox fallback */
  scrollbar-width: thick;
  scrollbar-color: ${blockTheme.pastelPink} ${blockTheme.pastelMint};
  
  ${blockMedia.mobile} {
    border-radius: 20px 20px 0 0;
    max-height: 85vh;
    margin-bottom: 0;
  }
`;

export const RetroProgressBar = styled.div<{
  progress: number;
}>`
  width: 100%;
  height: 32px;
  background: ${blockTheme.lightText};
  border: 4px solid ${blockTheme.darkText};
  border-radius: 6px;
  position: relative;
  overflow: hidden;
  box-shadow: inset 4px 4px 8px ${blockTheme.shadowLight};
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: ${({ progress }) => progress}%;
    background: repeating-linear-gradient(
      45deg,
      ${blockTheme.retroGreen},
      ${blockTheme.retroGreen} 10px,
      ${blockTheme.crtGreen} 10px,
      ${blockTheme.crtGreen} 20px
    );
    transition: width 0.3s ease;
    animation: ${({ progress }) => progress > 0 && progress < 100 ? css`${pixelGlow} 2s ease-in-out infinite` : 'none'};
    box-shadow: 0 2px 4px ${blockTheme.shadowMedium};
  }
  
  &::before {
    content: '${({ progress }) => Math.round(progress)}%';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-family: 'Courier New', monospace;
    font-weight: bold;
    font-size: 0.75rem;
    color: ${blockTheme.darkText};
    text-shadow: 1px 1px 0px ${blockTheme.lightText};
    z-index: 1;
    pointer-events: none;
  }
`;

export const PixelText = styled.div<{
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: keyof typeof blockTheme;
  glow?: boolean;
}>`
  font-family: 'Courier New', monospace;
  font-weight: bold;
  color: ${({ color = 'darkText' }) => blockTheme[color]};
  
  ${({ size = 'md' }) => {
    switch (size) {
      case 'sm': return css`font-size: 0.75rem; line-height: 1.2;`;
      case 'lg': return css`font-size: 1.5rem; line-height: 1.2;`;
      case 'xl': return css`font-size: 2rem; line-height: 1.2;`;
      default: return css`font-size: 1rem; line-height: 1.2;`;
    }
  }}
  
  ${({ glow, color = 'darkText' }) => glow && css`
    text-shadow: 0 0 10px ${blockTheme[color]};
    animation: ${pixelGlow} 2s ease-in-out infinite;
  `}
`;

export const BlockGrid = styled.div<{
  columns?: number;
  gap?: string;
}>`
  display: grid;
  grid-template-columns: repeat(${({ columns = 2 }) => columns}, 1fr);
  gap: ${({ gap = '2rem' }) => gap};
  
  ${blockMedia.tablet} {
    grid-template-columns: 1fr;
    gap: 1.5rem;
  }
  
  ${blockMedia.mobile} {
    gap: 1rem;
  }
`;

export const FlexBlock = styled.div<{
  direction?: 'row' | 'column';
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  gap?: string;
  wrap?: boolean;
}>`
  display: flex;
  flex-direction: ${({ direction = 'row' }) => direction};
  align-items: ${({ align = 'stretch' }) => align};
  justify-content: ${({ justify = 'flex-start' }) => justify};
  gap: ${({ gap = '1rem' }) => gap};
  ${({ wrap }) => wrap && 'flex-wrap: wrap;'}
  
  ${blockMedia.mobile} {
    ${({ direction = 'row' }) => direction === 'row' && 'flex-direction: column;'}
  }
`;

// 90s-style chunky scrollbar styling
export const chunkyScrollbar = css`
  /* Webkit browsers (Chrome, Safari, newer Edge) */
  &::-webkit-scrollbar {
    width: 18px;
    height: 18px;
  }

  &::-webkit-scrollbar-track {
    background: ${blockTheme.pastelMint};
    border: 3px solid ${blockTheme.darkText};
    border-radius: 8px;
    box-shadow: inset 2px 2px 4px ${blockTheme.shadowMedium};
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(45deg, ${blockTheme.pastelPink}, ${blockTheme.pastelPeach});
    border: 3px solid ${blockTheme.darkText};
    border-radius: 8px;
    box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
    
    &:hover {
      background: linear-gradient(45deg, ${blockTheme.pastelPeach}, ${blockTheme.pastelCoral});
      box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
    }
    
    &:active {
      box-shadow: 2px 2px 0px ${blockTheme.shadowDark};
    }
  }

  &::-webkit-scrollbar-corner {
    background: ${blockTheme.pastelMint};
    border: 3px solid ${blockTheme.darkText};
  }

  /* Firefox fallback */
  scrollbar-width: thick;
  scrollbar-color: ${blockTheme.pastelPink} ${blockTheme.pastelMint};
`;

// Apply chunky scrollbar globally for the 90s aesthetic
export const globalScrollbarStyles = css`
  * {
    ${chunkyScrollbar}
  }
`;

// Export keyframes for use in other components
export { pixelGlow, blockFloat, retroSlide, dialupConnect };