-- PU2 Database Migration
-- Add new columns to support PU2 features: game locking, prize splits, and winner rankings

-- Add new columns to game_history table
ALTER TABLE game_history 
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS prize_splits JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS winner_rank INTEGER DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN game_history.is_locked IS 'Whether the game was locked (prevents new players from joining)';
COMMENT ON COLUMN game_history.prize_splits IS 'Custom prize distribution as array of basis points [500, 300, 200] = [50%, 30%, 20%]';
COMMENT ON COLUMN game_history.winner_rank IS 'Winner rank (1 = first place, 2 = second place, 3 = third place) - NULL for non-winners';

-- Create index on winner_rank for efficient querying
CREATE INDEX IF NOT EXISTS idx_game_history_winner_rank ON game_history(winner_rank);

-- Create index on game_code and winner_rank for leaderboards
CREATE INDEX IF NOT EXISTS idx_game_history_game_code_winner_rank ON game_history(game_code, winner_rank);

-- Update any existing 'won' results to have winner_rank = 1 (retroactively assign first place)
-- This is safe because the old contract only supported single winners
UPDATE game_history 
SET winner_rank = 1 
WHERE result = 'won' AND winner_rank IS NULL;

-- Verify the migration
SELECT 
  column_name, 
  data_type, 
  is_nullable, 
  column_default
FROM information_schema.columns 
WHERE table_name = 'game_history' 
AND column_name IN ('is_locked', 'prize_splits', 'winner_rank');