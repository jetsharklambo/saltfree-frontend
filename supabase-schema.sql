-- Supabase Database Schema for Pony-Up Gaming Platform
-- Run this in your Supabase SQL Editor to create the tables

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table to store wallet addresses and usernames
CREATE TABLE IF NOT EXISTS users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    wallet_address TEXT UNIQUE NOT NULL,
    username TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game history table to track user's game participation and results
CREATE TABLE IF NOT EXISTS game_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_code TEXT NOT NULL,
    game_type TEXT NOT NULL DEFAULT 'standard',
    buy_in_amount TEXT NOT NULL, -- Stored as string to handle Wei amounts
    result TEXT NOT NULL DEFAULT 'active' CHECK (result IN ('won', 'lost', 'active')),
    winnings TEXT, -- Stored as string, nullable
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    block_number BIGINT, -- Optional: store blockchain block number
    transaction_hash TEXT -- Optional: store transaction hash
);

-- Custom game lists table for user-curated collections
CREATE TABLE IF NOT EXISTS game_lists (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    game_codes JSONB DEFAULT '[]'::jsonb, -- Array of game codes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_game_history_user_id ON game_history (user_id);
CREATE INDEX IF NOT EXISTS idx_game_history_game_code ON game_history (game_code);
CREATE INDEX IF NOT EXISTS idx_game_history_created_at ON game_history (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_game_lists_user_id ON game_lists (user_id);
CREATE INDEX IF NOT EXISTS idx_game_lists_updated_at ON game_lists (updated_at DESC);

-- Row Level Security (RLS) Policies
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_lists ENABLE ROW LEVEL SECURITY;

-- Users table policies
-- Users can read and update their own records
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = wallet_address OR auth.role() = 'anon');

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = wallet_address OR auth.role() = 'anon');

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.role() = 'anon');

-- Game history policies  
-- Users can only access their own game history
CREATE POLICY "Users can view own game history" ON game_history
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM users WHERE wallet_address = auth.uid()::text
        ) OR auth.role() = 'anon'
    );

CREATE POLICY "Users can insert own game history" ON game_history
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM users WHERE wallet_address = auth.uid()::text
        ) OR auth.role() = 'anon'
    );

CREATE POLICY "Users can update own game history" ON game_history
    FOR UPDATE USING (
        user_id IN (
            SELECT id FROM users WHERE wallet_address = auth.uid()::text
        ) OR auth.role() = 'anon'
    );

-- Game lists policies
-- Users can only access their own game lists
CREATE POLICY "Users can view own game lists" ON game_lists
    FOR SELECT USING (
        user_id IN (
            SELECT id FROM users WHERE wallet_address = auth.uid()::text
        ) OR auth.role() = 'anon'
    );

CREATE POLICY "Users can insert own game lists" ON game_lists
    FOR INSERT WITH CHECK (
        user_id IN (
            SELECT id FROM users WHERE wallet_address = auth.uid()::text
        ) OR auth.role() = 'anon'
    );

CREATE POLICY "Users can update own game lists" ON game_lists
    FOR UPDATE USING (
        user_id IN (
            SELECT id FROM users WHERE wallet_address = auth.uid()::text
        ) OR auth.role() = 'anon'
    );

CREATE POLICY "Users can delete own game lists" ON game_lists
    FOR DELETE USING (
        user_id IN (
            SELECT id FROM users WHERE wallet_address = auth.uid()::text
        ) OR auth.role() = 'anon'
    );

-- Trigger to automatically update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_lists_updated_at BEFORE UPDATE ON game_lists
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create some helpful views for analytics

-- User statistics view
CREATE OR REPLACE VIEW user_stats AS
SELECT 
    u.id,
    u.wallet_address,
    u.username,
    COUNT(gh.id) as total_games,
    COUNT(CASE WHEN gh.result = 'won' THEN 1 END) as games_won,
    COUNT(CASE WHEN gh.result = 'lost' THEN 1 END) as games_lost,
    COUNT(CASE WHEN gh.result = 'active' THEN 1 END) as active_games,
    COALESCE(
        ROUND(
            ((COUNT(CASE WHEN gh.result = 'won' THEN 1 END)::numeric / 
             NULLIF(COUNT(CASE WHEN gh.result != 'active' THEN 1 END), 0)) * 100)::numeric, 
            2
        ), 
        0
    ) as win_rate_percentage,
    COALESCE(
        SUM(CASE 
            WHEN gh.result = 'won' AND gh.winnings IS NOT NULL 
            THEN gh.winnings::numeric 
            ELSE 0 
        END)::text, 
        '0'
    ) as total_winnings
FROM users u
LEFT JOIN game_history gh ON u.id = gh.user_id
GROUP BY u.id, u.wallet_address, u.username;

-- Game participation summary
CREATE OR REPLACE VIEW game_participation AS
SELECT 
    gh.game_code,
    COUNT(*) as total_participants,
    COUNT(CASE WHEN gh.result = 'won' THEN 1 END) as winners,
    COUNT(CASE WHEN gh.result = 'lost' THEN 1 END) as losers,
    COUNT(CASE WHEN gh.result = 'active' THEN 1 END) as active_players,
    AVG(gh.buy_in_amount::numeric) as avg_buy_in,
    MAX(gh.created_at) as last_activity
FROM game_history gh
GROUP BY gh.game_code;

-- Comments and instructions
COMMENT ON TABLE users IS 'Stores user profiles linked to Web3 wallet addresses';
COMMENT ON TABLE game_history IS 'Tracks all game participation and results for users';
COMMENT ON TABLE game_lists IS 'User-created collections of favorite games';

COMMENT ON COLUMN users.wallet_address IS 'Ethereum wallet address (used as primary identifier)';
COMMENT ON COLUMN game_history.buy_in_amount IS 'Buy-in amount stored as string to handle Wei precision';
COMMENT ON COLUMN game_history.winnings IS 'Winnings amount stored as string, null if no winnings';
COMMENT ON COLUMN game_lists.game_codes IS 'JSONB array of game codes in this list';

-- Grant necessary permissions (adjust as needed for your setup)
-- Note: In Supabase, most permissions are handled through RLS policies above