import React from 'react';
import { Users } from 'lucide-react';
import { GlassButton } from '../styles/glass';
import { formatEth } from '../thirdweb';

interface JoinDropdownProps {
  gameCode: string;
  buyIn: string;
  onJoin: (gameCode: string, joinAsJudge: boolean) => void;
  disabled?: boolean;
}

const JoinDropdown: React.FC<JoinDropdownProps> = ({
  gameCode,
  buyIn,
  onJoin,
  disabled = false
}) => {
  const handleJoinClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent parent card's onClick
    if (disabled) return;
    onJoin(gameCode, false); // Always join as player
  };

  const buyInEth = formatEth(buyIn);

  return (
    <GlassButton
      size="sm"
      onClick={handleJoinClick}
      disabled={disabled}
      title={`Join game for ${buyInEth} ETH`}
    >
      <Users size={14} />
      Join Game
    </GlassButton>
  );
};

export default JoinDropdown;