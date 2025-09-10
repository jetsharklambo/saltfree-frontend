import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useActiveAccount } from "thirdweb/react";
import { prepareContractCall, sendTransaction, waitForReceipt } from 'thirdweb';
import { X, Trophy, Lock, Unlock, Percent, Award, Grip, Plus, Minus } from 'lucide-react';
import { getGameContract, validatePrizeSplits, formatPrizeSplit } from '../thirdweb';
import { 
  BlockModal, 
  BlockModalContent, 
  BlockButton, 
  BlockInput,
  FlexBlock,
  blockTheme,
  PixelText
} from '../styles/blocks';
import { SimpleRetroLoader } from './RetroLoader';
import styled from '@emotion/styled';

const PrizeSplitsModalWrapper = styled(BlockModal)`
  z-index: 1100; // Higher than GameDetailModal (z-index: 1000)
`;

interface PrizeSplitsModalProps {
  gameCode: string;
  onClose: () => void;
  onSuccess: (splits: number[]) => void;
  currentSplits?: number[];
  isCreationMode?: boolean; // Don't call contract, just return splits
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
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${blockTheme.darkText};
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  
  &:hover {
    background: ${blockTheme.error};
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
  }
`;

const SplitsContainer = styled.div`
  margin-bottom: 2rem;
`;

const SplitInputGroup = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
`;

const PlaceIcon = styled.div<{ place: number; isActive?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: ${({ place }) => {
    const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
    return colors[place - 1] || '#666';
  }};
  color: #000;
  font-weight: bold;
  font-size: 1.2rem;
  transition: all 0.2s ease;
  position: relative;
  
  ${({ isActive }) => isActive && `
    transform: scale(1.1);
    box-shadow: 0 0 20px rgba(120, 119, 198, 0.4);
  `}
  
  &::after {
    content: '';
    position: absolute;
    inset: -2px;
    border-radius: 50%;
    background: linear-gradient(45deg, transparent, rgba(120, 119, 198, 0.3));
    z-index: -1;
    opacity: ${({ isActive }) => isActive ? 1 : 0};
    transition: opacity 0.2s ease;
  }
`;

const SplitInput = styled(BlockInput)<{ isActive?: boolean }>`
  flex: 1;
  max-width: 120px;
  transition: all 0.2s ease;
  
  ${({ isActive }) => isActive && `
    border-color: rgba(120, 119, 198, 0.6);
    box-shadow: 0 0 0 2px rgba(120, 119, 198, 0.2);
    transform: scale(1.02);
  `}
`;

const VisualSliderContainer = styled.div`
  margin-bottom: 1.5rem;
`;

const SliderRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
  gap: 1rem;
`;

const SliderTrack = styled.div<{ isDragging?: boolean }>`
  flex: 1;
  height: 40px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: visible; // Allow handle to extend beyond track
  cursor: ${({ isDragging }) => isDragging ? 'grabbing' : 'pointer'};
  transition: all 0.2s ease;
  user-select: none;
  
  &:hover {
    border-color: rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
  }
  
  ${({ isDragging }) => isDragging && `
    border-color: rgba(120, 119, 198, 0.4);
    box-shadow: 0 0 20px rgba(120, 119, 198, 0.2);
  `}
`;

const SliderFill = styled.div<{ percentage: number; color: string; isActive?: boolean; isDragging?: boolean }>`
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  width: ${({ percentage }) => percentage}%;
  background: linear-gradient(90deg, ${({ color }) => color}88, ${({ color }) => color}cc);
  transition: ${({ isDragging }) => isDragging ? 'none' : 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'};
  border-radius: 20px;
  pointer-events: none; // Let track handle mouse events
  
  ${({ isActive }) => isActive && `
    box-shadow: 0 0 20px rgba(120, 119, 198, 0.3);
    transform: scaleY(1.1);
  `}
`;

const SliderHandle = styled.div<{ 
  percentage: number; 
  color: string; 
  isActive?: boolean; 
  isDragging?: boolean;
  isLocked?: boolean;
}>`
  position: absolute;
  right: -12px;
  top: 50%;
  transform: translateY(-50%);
  width: 24px;
  height: 24px;
  background: ${({ color, isLocked }) => isLocked ? '#ffc107' : color};
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.9);
  cursor: ${({ isDragging, isLocked }) => 
    isLocked ? 'not-allowed' : 
    isDragging ? 'grabbing' : 'grab'
  };
  opacity: ${({ isLocked }) => isLocked ? 0.6 : 1};
  transition: ${({ isDragging }) => isDragging ? 'none' : 'all 0.2s ease'};
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  touch-action: none; // Prevent default touch behaviors
  user-select: none;
  
  ${({ isActive, isDragging }) => (isActive || isDragging) && `
    transform: translateY(-50%) scale(1.2);
    box-shadow: 0 4px 16px rgba(120, 119, 198, 0.4), 0 0 0 4px rgba(120, 119, 198, 0.2);
  `}
  
  &::before {
    content: '';
    position: absolute;
    inset: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    opacity: ${({ isDragging, isActive }) => (isDragging || isActive) ? 1 : 0};
    transition: opacity 0.2s ease;
  }
  
  &::after {
    content: '';
    position: absolute;
    inset: -8px; // Larger touch target
    border-radius: 50%;
    
    @media (hover: none) {
      inset: -12px; // Even larger on touch devices
    }
  }
  
  &:hover {
    transform: translateY(-50%) scale(1.1);
    
    &::before {
      opacity: 1;
    }
  }
  
  @media (hover: none) {
    // Touch devices - always show handle clearly
    width: 28px;
    height: 28px;
    
    &::before {
      opacity: 0.5;
    }
  }
`;

const SliderLabel = styled.div`
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: ${blockTheme.darkText};
  font-weight: 600;
  font-size: 0.875rem;
  pointer-events: none;
  z-index: 2;
`;

const SliderValue = styled.div<{ color: string }>`
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: ${({ color }) => color};
  font-weight: 700;
  font-size: 1rem;
  pointer-events: none;
  z-index: 2;
`;

const LockButton = styled.button<{ locked?: boolean }>`
  background: ${({ locked }) => locked ? blockTheme.warning : blockTheme.pastelMint};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ locked }) => locked ? blockTheme.darkText : blockTheme.darkText};
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
  
  &:hover {
    background: ${({ locked }) => locked ? blockTheme.warning : blockTheme.pastelBlue};
    transform: translate(-2px, -2px);
    box-shadow: 6px 6px 0px ${blockTheme.shadowDark};
  }
`;

const NumberInputWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 80px;
`;

const SmartInput = styled(SplitInput)`
  max-width: 60px;
  text-align: center;
  font-weight: 600;
`;

const MobileAdjuster = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  
  @media (min-width: 769px) {
    display: none;
  }
`;

const AdjustButton = styled.button<{ variant?: 'decrease' | 'increase' }>`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: ${({ variant }) => 
    variant === 'decrease' 
      ? 'rgba(239, 68, 68, 0.1)' 
      : 'rgba(34, 197, 94, 0.1)'
  };
  border: 1px solid ${({ variant }) => 
    variant === 'decrease' 
      ? 'rgba(239, 68, 68, 0.3)' 
      : 'rgba(34, 197, 94, 0.3)'
  };
  color: ${({ variant }) => 
    variant === 'decrease' 
      ? '#ef4444' 
      : '#22c55e'
  };
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  
  &:active {
    transform: scale(0.95);
    background: ${({ variant }) => 
      variant === 'decrease' 
        ? 'rgba(239, 68, 68, 0.2)' 
        : 'rgba(34, 197, 94, 0.2)'
    };
  }
  
  &:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    transform: none;
  }
`;

const PercentageDisplay = styled.div<{ color: string }>`
  font-size: 1.5rem;
  font-weight: 700;
  min-width: 100px;
  text-align: center;
  color: ${({ color }) => color};
  padding: 0.5rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
`;

const DesktopSliderContainer = styled.div`
  @media (max-width: 768px) {
    display: none;
  }
`;

const MobileControlContainer = styled.div`
  display: none;
  
  @media (max-width: 768px) {
    display: block;
  }
`;

const PercentLabel = styled.span`
  color: ${blockTheme.textMuted};
  font-weight: 500;
`;

const PresetButtons = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const PresetButton = styled(BlockButton)<{ active?: boolean }>`
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  background: ${({ active }) => 
    active 
      ? 'rgba(120, 119, 198, 0.3)' 
      : 'rgba(255, 255, 255, 0.05)'
  };
  border: 1px solid ${({ active }) => 
    active 
      ? 'rgba(120, 119, 198, 0.5)' 
      : 'rgba(255, 255, 255, 0.1)'
  };
`;

const ValidationError = styled.div`
  color: #ff6b6b;
  font-size: 0.875rem;
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: rgba(255, 107, 107, 0.1);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: 8px;
`;

const InfoBox = styled.div`
  padding: 1rem;
  background: ${blockTheme.pastelBlue};
  border: 3px solid ${blockTheme.darkText};
  border-radius: 12px;
  margin-bottom: 1.5rem;
  font-size: 0.875rem;
  color: ${blockTheme.darkText};
  box-shadow: 4px 4px 0px ${blockTheme.shadowDark};
`;

const TotalIndicator = styled.div<{ isValid?: boolean; isAnimating?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 1rem;
  border-radius: 12px;
  margin: 1rem 0;
  background: ${({ isValid }) => isValid 
    ? 'rgba(76, 175, 80, 0.15)' 
    : 'rgba(255, 107, 107, 0.15)'
  };
  border: 1px solid ${({ isValid }) => isValid 
    ? 'rgba(76, 175, 80, 0.3)' 
    : 'rgba(255, 107, 107, 0.3)'
  };
  color: ${({ isValid }) => isValid ? '#4CAF50' : '#ff6b6b'};
  font-weight: 600;
  font-size: 1.1rem;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  ${({ isAnimating }) => isAnimating && `
    transform: scale(1.02);
    box-shadow: 0 0 20px rgba(120, 119, 198, 0.2);
  `}
`;

const ProgressRing = styled.div<{ percentage: number; isValid?: boolean }>`
  position: relative;
  width: 60px;
  height: 60px;
  
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(
      ${({ isValid }) => isValid ? '#4CAF50' : '#ff6b6b'} ${({ percentage }) => percentage * 3.6}deg,
      rgba(255, 255, 255, 0.1) ${({ percentage }) => percentage * 3.6}deg
    );
    transition: all 0.3s ease;
  }
  
  &::after {
    content: '';
    position: absolute;
    inset: 4px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.8);
  }
`;

const RingContent = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.875rem;
  z-index: 1;
`;

const AnimatedPresetButton = styled(PresetButton)<{ isApplying?: boolean }>`
  transform: ${({ isApplying }) => isApplying ? 'scale(0.95)' : 'scale(1)'};
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  ${({ isApplying }) => isApplying && `
    background: rgba(120, 119, 198, 0.4) !important;
    border-color: rgba(120, 119, 198, 0.6) !important;
  `}
`;

const StatusMessage = styled.div<{ type: 'info' | 'success' | 'warning' }>`
  padding: 0.75rem 1rem;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  
  ${({ type }) => {
    switch (type) {
      case 'success':
        return `
          background: rgba(76, 175, 80, 0.15);
          border: 1px solid rgba(76, 175, 80, 0.3);
          color: #4CAF50;
        `;
      case 'warning':
        return `
          background: rgba(255, 193, 7, 0.15);
          border: 1px solid rgba(255, 193, 7, 0.3);
          color: #ffc107;
        `;
      default:
        return `
          background: rgba(102, 126, 234, 0.15);
          border: 1px solid rgba(102, 126, 234, 0.3);
          color: ${blockTheme.darkText};
        `;
    }
  }}
`;

const presets = [
  { name: '🏆 Winner Takes All', splits: [], description: 'First place takes 100%' },
  { name: '🥇🥈 60/40', splits: [600, 400], description: 'Traditional two-winner split' },
  { name: '🥇🥈🥉 50/30/20', splits: [500, 300, 200], description: 'Balanced three-way split' },
  { name: '🏆 70/20/10', splits: [700, 200, 100], description: 'Winner-heavy distribution' },
  { name: '🎆 80/15/5', splits: [800, 150, 50], description: 'Winner takes most' },
];

const PrizeSplitsModal: React.FC<PrizeSplitsModalProps> = ({ 
  gameCode, 
  onClose, 
  onSuccess, 
  currentSplits = [],
  isCreationMode = false
}) => {
  const account = useActiveAccount();
  const [splits, setSplits] = useState<number[]>(
    Array.isArray(currentSplits) && currentSplits.length > 0 ? currentSplits.filter(s => typeof s === 'number' && s >= 0) : []
  );
  const [lockedIndices, setLockedIndices] = useState<boolean[]>([]);
  const [activeAdjustment, setActiveAdjustment] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [applyingPreset, setApplyingPreset] = useState<number | null>(null);
  const [focusedSlider, setFocusedSlider] = useState<number | null>(null);
  const dragStartX = useRef<number>(0);
  const dragStartValue = useRef<number>(0);
  const sliderRefs = useRef<(HTMLDivElement | null)[]>([]);
  const isDraggingRef = useRef(false);
  const dragIndexRef = useRef<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Forward declarations for callback functions
  const handleSplitChangeRef = useRef<(index: number, value: string) => void>();
  const toggleLockRef = useRef<(index: number) => void>();
  const removeSplitRef = useRef<(index: number) => void>();

  // Mouse/Touch drag handlers
  const handlePointerDown = useCallback((e: React.PointerEvent, index: number) => {
    if (lockedIndices[index]) return; // Can't drag locked values
    
    e.preventDefault();
    const track = sliderRefs.current[index];
    if (!track) return;
    
    // Capture the pointer for consistent tracking
    (e.target as Element).setPointerCapture(e.pointerId);
    
    const rect = track.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startPercentage = splits[index] / 10; // Convert to percentage
    
    dragStartX.current = startX;
    dragStartValue.current = startPercentage;
    setIsDragging(true);
    setDragIndex(index);
    isDraggingRef.current = true;
    dragIndexRef.current = index;
    setActiveAdjustment(index);
    
    // Add global event listeners for consistent behavior
    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
    document.body.style.touchAction = 'none'; // Prevent scrolling on mobile
  }, [lockedIndices, splits]);

  const handlePointerMove = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current || dragIndexRef.current === null) return;
    
    const index = dragIndexRef.current;
    const track = sliderRefs.current[index];
    if (!track) return;
    
    const rect = track.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const trackWidth = rect.width;
    
    // Calculate new percentage based on pointer position
    let newPercentage = (currentX / trackWidth) * 100;
    newPercentage = Math.max(0.1, Math.min(99.9, newPercentage)); // Keep within valid range
    
    // Apply the change using the auto-balancing logic
    if (handleSplitChangeRef.current) {
      handleSplitChangeRef.current(index, newPercentage.toFixed(1));
    }
  }, []);

  const handlePointerUp = useCallback(() => {
    if (!isDraggingRef.current) return;
    
    setIsDragging(false);
    setDragIndex(null);
    isDraggingRef.current = false;
    dragIndexRef.current = null;
    
    // Remove global event listeners
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    document.body.style.touchAction = '';
    
    // Clear active adjustment after animation
    setTimeout(() => setActiveAdjustment(null), 300);
  }, [handlePointerMove]);

  // Cleanup pointer events on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.body.style.touchAction = '';
    };
  }, [handlePointerMove, handlePointerUp]);

  // Keyboard navigation handler
  const handleKeyDown = useCallback((e: KeyboardEvent, index: number) => {
    if (!splits[index] && splits[index] !== 0) return;
    
    const currentValue = splits[index] / 10; // Convert from basis points to percentage
    let newValue = currentValue;
    const step = e.shiftKey ? 10 : e.ctrlKey || e.metaKey ? 0.1 : 1;
    
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault();
        newValue = Math.min(100, currentValue + step);
        handleSplitChangeRef.current?.(index, newValue.toString());
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault();
        newValue = Math.max(0, currentValue - step);
        handleSplitChangeRef.current?.(index, newValue.toString());
        break;
      case 'Home':
        e.preventDefault();
        handleSplitChangeRef.current?.(index, '0');
        break;
      case 'End':
        e.preventDefault();
        handleSplitChangeRef.current?.(index, '100');
        break;
      case ' ':
      case 'Enter':
        e.preventDefault();
        toggleLockRef.current?.(index);
        break;
      case 'Delete':
      case 'Backspace':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          removeSplitRef.current?.(index);
        }
        break;
    }
  }, [splits]);

  const contract = getGameContract();

  // Auto-balancing algorithm for maintaining 100%
  const redistributeToMaintain100 = useCallback((changedIndex: number, newValue: number) => {
    const totalOthers = 1000 - newValue; // 100% in basis points minus new value
    const unlockedIndices = splits.map((_, i) => i).filter(i => i !== changedIndex && !lockedIndices[i]);
    
    if (unlockedIndices.length === 0) return null; // Can't adjust if all others locked
    
    // Get current sum of unlocked splits (excluding the changed one)
    const currentOthersSum = unlockedIndices.reduce((sum, i) => sum + (splits[i] || 0), 0);
    
    if (currentOthersSum === 0) {
      // If others are zero, distribute equally
      const equalShare = Math.floor(totalOthers / unlockedIndices.length);
      const remainder = totalOthers - (equalShare * unlockedIndices.length);
      
      return unlockedIndices.map((i, idx) => ({
        index: i,
        value: equalShare + (idx < remainder ? 1 : 0)
      }));
    }
    
    // Proportional distribution
    const ratio = totalOthers / currentOthersSum;
    let newOthers = unlockedIndices.map(i => ({
      index: i,
      value: Math.round(splits[i] * ratio)
    }));
    
    // Adjust for rounding errors to ensure exact 100%
    const actualTotal = newValue + newOthers.reduce((sum, item) => sum + item.value, 0);
    const adjustment = 1000 - actualTotal;
    
    if (adjustment !== 0 && newOthers.length > 0) {
      // Apply adjustment to the largest value
      const largestIndex = newOthers.reduce((maxIdx, item, idx) => 
        item.value > newOthers[maxIdx].value ? idx : maxIdx
      , 0);
      newOthers[largestIndex].value += adjustment;
    }
    
    return newOthers;
  }, [splits, lockedIndices]);

  const handleSplitChange = useCallback((index: number, value: string) => {
    // Handle empty input
    if (value === '') {
      const newValue = 0;
      const redistributions = redistributeToMaintain100(index, newValue);
      
      const newSplits = [...splits];
      newSplits[index] = newValue;
      
      if (redistributions) {
        redistributions.forEach(({ index: i, value: v }) => {
          newSplits[i] = Math.max(0, Math.min(1000, v));
        });
      }
      
      setSplits(newSplits);
      setActiveAdjustment(index);
      return;
    }

    const numericValue = parseFloat(value) * 10; // Convert percentage to basis points
    
    // Safety checks for invalid values
    if (isNaN(numericValue) || numericValue < 0 || numericValue > 1000) return;
    if (index < 0 || index >= splits.length) return;

    const redistributions = redistributeToMaintain100(index, Math.round(numericValue));
    
    const newSplits = [...splits];
    newSplits[index] = Math.round(numericValue);
    
    if (redistributions) {
      redistributions.forEach(({ index: i, value: v }) => {
        newSplits[i] = Math.max(0, Math.min(1000, v));
      });
    }
    
    setSplits(newSplits);
    setActiveAdjustment(index);
    
    // Clear active adjustment after animation
    setTimeout(() => setActiveAdjustment(null), 300);
  }, [redistributeToMaintain100, splits]);

  // Assign to refs for keyboard handler
  handleSplitChangeRef.current = handleSplitChange;

  const addSplit = () => {
    if (splits.length < 3) {
      const newSplits = [...splits];
      const newLockedIndices = [...lockedIndices];
      
      // If this is the first split, start with 100%
      if (splits.length === 0) {
        newSplits.push(1000);
        newLockedIndices.push(false);
      } else {
        // Add new split and redistribute proportionally
        const targetValue = Math.floor(1000 / (splits.length + 1));
        newSplits.push(targetValue);
        newLockedIndices.push(false);
        
        // Redistribute existing splits
        const redistributions = redistributeToMaintain100(splits.length, targetValue);
        if (redistributions) {
          redistributions.forEach(({ index: i, value: v }) => {
            newSplits[i] = Math.max(0, Math.min(1000, v));
          });
        }
      }
      
      setSplits(newSplits);
      setLockedIndices(newLockedIndices);
    }
  };

  const removeSplit = useCallback((index: number) => {
    if (index < 0 || index >= splits.length) return;
    
    const removedValue = splits[index];
    const newSplits = splits.filter((_, i) => i !== index);
    const newLockedIndices = lockedIndices.filter((_, i) => i !== index);
    
    if (newSplits.length > 0) {
      // Redistribute the removed value proportionally among remaining unlocked splits
      const unlockedIndices = newSplits.map((_, i) => i).filter(i => !newLockedIndices[i]);
      
      if (unlockedIndices.length > 0) {
        const currentSum = unlockedIndices.reduce((sum, i) => sum + newSplits[i], 0);
        
        if (currentSum > 0) {
          const ratio = (currentSum + removedValue) / currentSum;
          unlockedIndices.forEach(i => {
            newSplits[i] = Math.round(newSplits[i] * ratio);
          });
          
          // Adjust for rounding to maintain 1000 total
          const actualTotal = newSplits.reduce((sum, split) => sum + split, 0);
          const adjustment = 1000 - actualTotal;
          
          if (adjustment !== 0 && unlockedIndices.length > 0) {
            const adjustIndex = unlockedIndices.reduce((maxIdx, i) => 
              newSplits[i] > newSplits[maxIdx] ? i : maxIdx
            );
            newSplits[adjustIndex] += adjustment;
          }
        } else {
          // If all remaining are zero, distribute equally
          const equalShare = Math.floor(1000 / unlockedIndices.length);
          const remainder = 1000 - (equalShare * unlockedIndices.length);
          
          unlockedIndices.forEach((i, idx) => {
            newSplits[i] = equalShare + (idx < remainder ? 1 : 0);
          });
        }
      }
    }
    
    setSplits(newSplits);
    setLockedIndices(newLockedIndices);
  }, [splits, lockedIndices, redistributeToMaintain100]);

  // Assign to refs for keyboard handler
  removeSplitRef.current = removeSplit;

  // Mobile adjustment functions
  const adjustValue = useCallback((index: number, delta: number) => {
    const currentValue = splits[index] / 10; // Convert from basis points to percentage
    const newValue = Math.max(0.1, Math.min(99.9, currentValue + delta));
    
    if (handleSplitChangeRef.current) {
      handleSplitChangeRef.current(index, newValue.toFixed(1));
    }
  }, [splits]);

  const handleIncrease = useCallback((index: number) => {
    if (lockedIndices[index]) return;
    adjustValue(index, 5); // Increase by 5%
    setActiveAdjustment(index);
    setTimeout(() => setActiveAdjustment(null), 300);
  }, [adjustValue, lockedIndices]);

  const handleDecrease = useCallback((index: number) => {
    if (lockedIndices[index]) return;
    adjustValue(index, -5); // Decrease by 5%
    setActiveAdjustment(index);
    setTimeout(() => setActiveAdjustment(null), 300);
  }, [adjustValue, lockedIndices]);

  const toggleLock = useCallback((index: number) => {
    const newLockedIndices = [...lockedIndices];
    newLockedIndices[index] = !newLockedIndices[index];
    setLockedIndices(newLockedIndices);
  }, [lockedIndices]);

  // Assign to refs for keyboard handler
  toggleLockRef.current = toggleLock;

  const applyPreset = async (preset: number[], presetIndex: number) => {
    setApplyingPreset(presetIndex);
    setActiveAdjustment(null);
    
    // Smooth transition animation
    await new Promise(resolve => setTimeout(resolve, 100));
    
    setSplits([...preset]);
    setLockedIndices(new Array(preset.length).fill(false));
    
    // Brief highlight effect
    await new Promise(resolve => setTimeout(resolve, 200));
    setApplyingPreset(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validatePrizeSplits(splits);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    
    // In creation mode, just return the splits without calling contract
    if (isCreationMode) {
      onSuccess(splits);
      return;
    }
    
    if (!account) return;
    setIsSubmitting(true);

    try {
      const transaction = prepareContractCall({
        contract,
        method: "function setPrizeSplits(string code, uint256[] splits)",
        params: [gameCode, splits.map(s => BigInt(s))]
      });

      const { transactionHash } = await sendTransaction({
        transaction,
        account
      });

      console.log('Prize splits transaction hash:', transactionHash);
      
      await waitForReceipt({
        client: contract.client,
        chain: contract.chain,
        transactionHash
      });

      onSuccess(splits);
      onClose();
    } catch (error) {
      console.error('Error setting prize splits:', error);
      setValidationError(error instanceof Error ? error.message : 'Failed to set prize splits');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (splits.length === 0) {
      setValidationError(null);
      return;
    }

    const error = validatePrizeSplits(splits);
    setValidationError(error);
  }, [splits]);

  const totalPercentage = splits.reduce((sum, split) => sum + split, 0) / 10;

  const handleBackdropClick = (e: React.MouseEvent) => {
    // Close modal when clicking on backdrop
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleContentClick = (e: React.MouseEvent) => {
    // Prevent event propagation when clicking inside modal content
    e.stopPropagation();
  };

  return (
    <PrizeSplitsModalWrapper onClick={handleBackdropClick}>
      <BlockModalContent onClick={handleContentClick}>
        <ModalHeader>
          <ModalTitle>
            <Trophy size={20} />
            Prize Distribution
          </ModalTitle>
          <CloseButton onClick={onClose}>
            <X size={20} />
          </CloseButton>
        </ModalHeader>

        <InfoBox role="region" aria-label="Prize distribution instructions">
          Configure how winnings are split between winners. 
          {isMobile ? 'Use +/- buttons to adjust values, or type exact amounts.' : 'Drag handles to adjust values, or use arrow keys. Space to lock/unlock, Ctrl+Delete to remove.'}
        </InfoBox>

        <PresetButtons>
          {presets.map((preset, index) => (
            <AnimatedPresetButton
              key={index}
              active={JSON.stringify(preset.splits) === JSON.stringify(splits)}
              isApplying={applyingPreset === index}
              onClick={() => applyPreset(preset.splits, index)}
              title={preset.description}
            >
              {preset.name}
            </AnimatedPresetButton>
          ))}
        </PresetButtons>

        <form onSubmit={handleSubmit}>
          <SplitsContainer>
            {/* Desktop Sliders */}
            <DesktopSliderContainer>
              <VisualSliderContainer>
                {splits.map((split, index) => {
                  const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                  const color = colors[index] || '#666';
                  const percentage = Math.round(split / 10 * 10) / 10;
                  const isActive = activeAdjustment === index;
                  const isLocked = lockedIndices[index];
                  
                  return (
                    <SliderRow key={index}>
                      <PlaceIcon place={index + 1} isActive={isActive}>
                        {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                      </PlaceIcon>
                      
                      <SliderTrack
                        ref={el => sliderRefs.current[index] = el}
                        role="slider"
                        aria-label={`${index === 0 ? 'First' : index === 1 ? 'Second' : 'Third'} place prize percentage`}
                        aria-valuenow={percentage}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuetext={`${percentage.toFixed(1)} percent`}
                        tabIndex={0}
                        onFocus={() => setFocusedSlider(index)}
                        onBlur={() => setFocusedSlider(null)}
                        onKeyDown={(e) => handleKeyDown(e.nativeEvent, index)}
                        isDragging={dragIndex === index}
                        style={{
                          outline: focusedSlider === index ? '2px solid rgba(120, 119, 198, 0.8)' : 'none',
                          outlineOffset: '2px'
                        }}
                      >
                        <SliderFill 
                          percentage={percentage} 
                          color={color}
                          isActive={isActive || focusedSlider === index}
                          isDragging={dragIndex === index}
                        />
                        <SliderHandle
                          percentage={percentage}
                          color={color}
                          isActive={isActive || focusedSlider === index}
                          isDragging={dragIndex === index}
                          isLocked={isLocked}
                          onPointerDown={(e) => handlePointerDown(e, index)}
                          style={{ left: `${percentage}%` }}
                        />
                        <SliderLabel>
                          {index === 0 ? '1st Place' : index === 1 ? '2nd Place' : '3rd Place'}
                        </SliderLabel>
                        <SliderValue color={color}>
                          {percentage.toFixed(1)}%
                        </SliderValue>
                      </SliderTrack>
                      
                      <NumberInputWrapper>
                        <SmartInput
                          type="number"
                          step="0.1"
                          min="0"
                          max="100"
                          value={split > 0 ? (split / 10).toFixed(1) : ""}
                          onChange={(e) => handleSplitChange(index, e.target.value)}
                          placeholder="0"
                          isActive={isActive}
                          disabled={isLocked}
                        />
                        <PercentLabel>%</PercentLabel>
                      </NumberInputWrapper>
                      
                      <LockButton 
                        type="button"
                        locked={isLocked}
                        onClick={() => toggleLock(index)}
                        title={isLocked ? "Unlock this value" : "Lock this value"}
                        aria-label={isLocked ? `Unlock ${index === 0 ? 'first' : index === 1 ? 'second' : 'third'} place value` : `Lock ${index === 0 ? 'first' : index === 1 ? 'second' : 'third'} place value`}
                        aria-pressed={isLocked}
                      >
                        {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                      </LockButton>
                      
                      <BlockButton
                        type="button"
                        onClick={() => removeSplit(index)}
                        style={{ padding: '0.5rem', minWidth: 'auto' }}
                        aria-label={`Remove ${index === 0 ? 'first' : index === 1 ? 'second' : 'third'} place winner`}
                        title={`Remove ${index === 0 ? 'first' : index === 1 ? 'second' : 'third'} place winner`}
                      >
                        <X size={16} />
                      </BlockButton>
                    </SliderRow>
                  );
                })}
              </VisualSliderContainer>
            </DesktopSliderContainer>
            
            {/* Mobile Controls */}
            <MobileControlContainer>
              {splits.map((split, index) => {
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                const color = colors[index] || '#666';
                const percentage = Math.round(split / 10 * 10) / 10;
                const isActive = activeAdjustment === index;
                const isLocked = lockedIndices[index];
                
                return (
                  <div key={index} style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '1rem', 
                    marginBottom: '1.5rem',
                    padding: '1rem',
                    background: blockTheme.pastelLavender,
                    borderRadius: '12px',
                    border: `3px solid ${blockTheme.darkText}`,
                    boxShadow: `4px 4px 0px ${blockTheme.shadowDark}`
                  }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <PlaceIcon place={index + 1} isActive={isActive}>
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                        </PlaceIcon>
                        <span style={{ fontWeight: '600', color: blockTheme.darkText }}>
                          {index === 0 ? '1st' : index === 1 ? '2nd' : '3rd'} Place
                        </span>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <LockButton 
                          type="button"
                          locked={isLocked}
                          onClick={() => toggleLock(index)}
                          title={isLocked ? "Unlock this value" : "Lock this value"}
                          aria-label={isLocked ? `Unlock ${index === 0 ? 'first' : index === 1 ? 'second' : 'third'} place value` : `Lock ${index === 0 ? 'first' : index === 1 ? 'second' : 'third'} place value`}
                          aria-pressed={isLocked}
                          style={{ width: '36px', height: '36px' }}
                        >
                          {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                        </LockButton>
                        
                        <BlockButton
                          type="button"
                          onClick={() => removeSplit(index)}
                          style={{ padding: '0.5rem', minWidth: 'auto', width: '36px', height: '36px' }}
                          aria-label={`Remove ${index === 0 ? 'first' : index === 1 ? 'second' : 'third'} place winner`}
                          title={`Remove ${index === 0 ? 'first' : index === 1 ? 'second' : 'third'} place winner`}
                        >
                          <X size={14} />
                        </BlockButton>
                      </div>
                    </div>
                    
                    {/* Adjustment Controls */}
                    <MobileAdjuster>
                      <AdjustButton
                        type="button"
                        variant="decrease"
                        onClick={() => handleDecrease(index)}
                        disabled={isLocked || percentage <= 0.1}
                        aria-label="Decrease by 5%"
                      >
                        <Minus size={18} />
                      </AdjustButton>
                      
                      <PercentageDisplay color={color}>
                        {percentage.toFixed(1)}%
                      </PercentageDisplay>
                      
                      <AdjustButton
                        type="button"
                        variant="increase"
                        onClick={() => handleIncrease(index)}
                        disabled={isLocked || percentage >= 99.9}
                        aria-label="Increase by 5%"
                      >
                        <Plus size={18} />
                      </AdjustButton>
                    </MobileAdjuster>
                    
                    {/* Fine control input */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: blockTheme.textSecondary }}>Fine adjust:</span>
                      <SmartInput
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        value={split > 0 ? (split / 10).toFixed(1) : ""}
                        onChange={(e) => handleSplitChange(index, e.target.value)}
                        placeholder="0"
                        isActive={isActive}
                        disabled={isLocked}
                        style={{ maxWidth: '80px' }}
                      />
                      <PercentLabel>%</PercentLabel>
                    </div>
                  </div>
                );
              })}
            </MobileControlContainer>
            
            <div style={{ marginBottom: '1rem' }}>
              {/* Legacy input fallback - hidden but kept for keyboard users */}
              <div style={{ display: 'none' }}>
                {splits.map((split, index) => (
                  <SplitInputGroup key={`legacy-${index}`}>
                    <PlaceIcon place={index + 1}>
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                    </PlaceIcon>
                    <SplitInput
                      type="number"
                      step="1"
                      min="0"
                      max="100"
                      value={split > 0 ? Math.round(split / 10).toString() : ""}
                      onChange={(e) => handleSplitChange(index, e.target.value)}
                      placeholder="0"
                    />
                    <PercentLabel>%</PercentLabel>
                    <BlockButton
                      type="button"
                      onClick={() => removeSplit(index)}
                      style={{ padding: '0.5rem', minWidth: 'auto' }}
                    >
                      <X size={16} />
                    </BlockButton>
                  </SplitInputGroup>
                ))}
              </div>
            </div>

            {splits.length < 3 && (
              <BlockButton
                type="button"
                onClick={addSplit}
                aria-label={`Add ${splits.length === 0 ? 'first' : splits.length === 1 ? 'second' : 'third'} place winner`}
                style={{ 
                  background: blockTheme.pastelMint,
                  border: `3px dashed ${blockTheme.darkText}`,
                  boxShadow: `4px 4px 0px ${blockTheme.shadowDark}`,
                  marginTop: '0.5rem'
                }}
              >
                <Award size={16} style={{ marginRight: '0.5rem' }} />
                Add Winner Rank
              </BlockButton>
            )}
          </SplitsContainer>

          {splits.length > 0 && (
            <TotalIndicator 
              isValid={totalPercentage === 100}
              isAnimating={activeAdjustment !== null}
            >
              <ProgressRing percentage={Math.min(totalPercentage, 100)} isValid={totalPercentage === 100}>
                <RingContent>
                  {totalPercentage.toFixed(1)}%
                </RingContent>
              </ProgressRing>
              <div>
                <div style={{ fontSize: '1.1rem' }}>
                  {totalPercentage === 100 ? '✓ Perfect Split!' : `${totalPercentage.toFixed(1)}% of 100%`}
                </div>
                {totalPercentage !== 100 && (
                  <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>
                    {totalPercentage > 100 ? 'Reduce values' : 'Add more percentage'}
                  </div>
                )}
              </div>
            </TotalIndicator>
          )}
          
          {splits.length === 0 && (
            <StatusMessage type="info">
              <Trophy size={16} />
              Start by selecting a preset or adding winners below
            </StatusMessage>
          )}
          
          {lockedIndices.some(locked => locked) && (
            <StatusMessage type="warning">
              <Lock size={16} />
              {lockedIndices.filter(locked => locked).length} value{lockedIndices.filter(locked => locked).length > 1 ? 's' : ''} locked - others will auto-adjust
            </StatusMessage>
          )}

          {validationError && (
            <ValidationError>{validationError}</ValidationError>
          )}

          <FlexBlock style={{ gap: '1rem', marginTop: '2rem' }}>
            <BlockButton
              type="button"
              onClick={onClose}
              style={{ 
                background: blockTheme.pastelCoral,
                flex: 1
              }}
            >
              Cancel
            </BlockButton>
            <BlockButton
              type="submit"
              disabled={isSubmitting || (splits.length > 0 && !!validationError)}
              style={{ 
                background: blockTheme.accent,
                flex: 1
              }}
            >
              {isSubmitting ? (
                <FlexBlock style={{ gap: '0.5rem' }}>
                  <SimpleRetroLoader size={16} />
                  Setting Splits...
                </FlexBlock>
              ) : (
                isCreationMode ? 'Save Prize Splits' : 'Set Prize Splits'
              )}
            </BlockButton>
          </FlexBlock>
        </form>
      </BlockModalContent>
    </PrizeSplitsModalWrapper>
  );
};

export default PrizeSplitsModal;