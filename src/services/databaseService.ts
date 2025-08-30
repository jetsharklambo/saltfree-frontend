import { supabase } from '../lib/supabase';
import { Database } from '../lib/database.types';

type User = Database['public']['Tables']['users']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];
type UserUpdate = Database['public']['Tables']['users']['Update'];

type GameHistory = Database['public']['Tables']['game_history']['Row'];
type GameHistoryInsert = Database['public']['Tables']['game_history']['Insert'];
type GameHistoryUpdate = Database['public']['Tables']['game_history']['Update'];

type GameList = Database['public']['Tables']['game_lists']['Row'];
type GameListInsert = Database['public']['Tables']['game_lists']['Insert'];
type GameListUpdate = Database['public']['Tables']['game_lists']['Update'];

// User operations
export const userService = {
  async createUser(userData: UserInsert): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .insert(userData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating user:', error);
      return null;
    }
    
    return data;
  },

  async getUserByWallet(walletAddress: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        // No user found
        return null;
      }
      console.error('Error fetching user:', error);
      return null;
    }
    
    return data;
  },

  async updateUser(id: string, updates: UserUpdate): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating user:', error);
      return null;
    }
    
    return data;
  },

  async getOrCreateUser(walletAddress: string): Promise<User | null> {
    let user = await this.getUserByWallet(walletAddress);
    
    if (!user) {
      user = await this.createUser({
        wallet_address: walletAddress,
        username: null,
      });
    }
    
    return user;
  },

  async getUsernamesByWallets(walletAddresses: string[]): Promise<Map<string, string | null>> {
    const results = new Map<string, string | null>();
    
    if (walletAddresses.length === 0) {
      return results;
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('wallet_address, username')
        .in('wallet_address', walletAddresses);
      
      if (error) {
        console.error('Error fetching usernames by wallets:', error);
        // Return null for all addresses on error
        walletAddresses.forEach(address => results.set(address, null));
        return results;
      }
      
      // Create map from results
      const foundUsers = new Map(
        (data || []).map(user => [user.wallet_address, user.username])
      );
      
      // Ensure all requested addresses have a result (null if not found)
      walletAddresses.forEach(address => {
        results.set(address, foundUsers.get(address) || null);
      });
      
    } catch (error) {
      console.error('Error in getUsernamesByWallets:', error);
      // Return null for all addresses on error
      walletAddresses.forEach(address => results.set(address, null));
    }
    
    return results;
  },

  async getUsernameByWallet(walletAddress: string): Promise<string | null> {
    if (!walletAddress) return null;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('wallet_address', walletAddress)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No user found
          return null;
        }
        console.error('Error fetching username:', error);
        return null;
      }
      
      return data?.username || null;
    } catch (error) {
      console.error('Error in getUsernameByWallet:', error);
      return null;
    }
  },

  async getUserByUsername(username: string): Promise<User | null> {
    if (!username) return null;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No user found
          return null;
        }
        console.error('Error fetching user by username:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error in getUserByUsername:', error);
      return null;
    }
  },
};

// Game history operations
export const gameHistoryService = {
  async addGameHistory(historyData: GameHistoryInsert): Promise<GameHistory | null> {
    const { data, error } = await supabase
      .from('game_history')
      .insert(historyData)
      .select()
      .single();
    
    if (error) {
      console.error('Error adding game history:', error);
      return null;
    }
    
    return data;
  },

  async getUserGameHistory(userId: string, limit: number = 50): Promise<GameHistory[]> {
    const { data, error } = await supabase
      .from('game_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (error) {
      console.error('Error fetching game history:', error);
      return [];
    }
    
    return data || [];
  },

  async updateGameResult(
    gameCode: string, 
    userId: string, 
    result: 'won' | 'lost', 
    winnings?: string,
    winnerRank?: number
  ): Promise<GameHistory | null> {
    const updates: GameHistoryUpdate = { result };
    if (winnings !== undefined) {
      updates.winnings = winnings;
    }
    if (winnerRank !== undefined) {
      updates.winner_rank = winnerRank;
    }

    const { data, error } = await supabase
      .from('game_history')
      .update(updates)
      .eq('game_code', gameCode)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating game result:', error);
      return null;
    }
    
    return data;
  },

  async updateGameStatus(
    gameCode: string, 
    updates: { 
      isLocked?: boolean; 
      prizeSplits?: number[] 
    }
  ): Promise<void> {
    const dbUpdates: GameHistoryUpdate = {};
    
    if (updates.isLocked !== undefined) {
      dbUpdates.is_locked = updates.isLocked;
    }
    if (updates.prizeSplits !== undefined) {
      dbUpdates.prize_splits = updates.prizeSplits as any;
    }

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase
      .from('game_history')
      .update(dbUpdates)
      .eq('game_code', gameCode);
    
    if (error) {
      console.error('Error updating game status:', error);
    }
  },

  async getUserStats(userId: string): Promise<{
    totalGames: number;
    gamesWon: number;
    gamesLost: number;
    totalWinnings: string;
    winRate: number;
  }> {
    const { data, error } = await supabase
      .from('game_history')
      .select('result, winnings')
      .eq('user_id', userId)
      .neq('result', 'active');
    
    if (error) {
      console.error('Error fetching user stats:', error);
      return {
        totalGames: 0,
        gamesWon: 0,
        gamesLost: 0,
        totalWinnings: '0',
        winRate: 0,
      };
    }
    
    const games = data || [];
    const totalGames = games.length;
    const gamesWon = games.filter(g => g.result === 'won').length;
    const gamesLost = games.filter(g => g.result === 'lost').length;
    const winRate = totalGames > 0 ? (gamesWon / totalGames) * 100 : 0;
    
    // Calculate total winnings (sum of all winnings, treating null as 0)
    const totalWinnings = games
      .reduce((sum, game) => {
        const winnings = parseFloat(game.winnings || '0');
        return sum + winnings;
      }, 0)
      .toString();
    
    return {
      totalGames,
      gamesWon,
      gamesLost,
      totalWinnings,
      winRate,
    };
  },
};

// Game lists operations
export const gameListService = {
  async createGameList(listData: GameListInsert): Promise<GameList | null> {
    const { data, error } = await supabase
      .from('game_lists')
      .insert(listData)
      .select()
      .single();
    
    if (error) {
      console.error('Error creating game list:', error);
      return null;
    }
    
    return data;
  },

  async getUserGameLists(userId: string): Promise<GameList[]> {
    const { data, error } = await supabase
      .from('game_lists')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching game lists:', error);
      return [];
    }
    
    return data || [];
  },

  async updateGameList(id: string, updates: GameListUpdate): Promise<GameList | null> {
    const { data, error } = await supabase
      .from('game_lists')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating game list:', error);
      return null;
    }
    
    return data;
  },

  async deleteGameList(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('game_lists')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting game list:', error);
      return false;
    }
    
    return true;
  },

  async addGameToList(listId: string, gameCode: string): Promise<GameList | null> {
    // First get the current list
    const { data: currentList, error: fetchError } = await supabase
      .from('game_lists')
      .select('game_codes')
      .eq('id', listId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching current game list:', fetchError);
      return null;
    }
    
    const currentCodes = Array.isArray(currentList.game_codes) ? currentList.game_codes : [];
    const updatedCodes = [...new Set([...currentCodes, gameCode])]; // Remove duplicates
    
    return await this.updateGameList(listId, {
      game_codes: updatedCodes,
    });
  },

  async removeGameFromList(listId: string, gameCode: string): Promise<GameList | null> {
    // First get the current list
    const { data: currentList, error: fetchError } = await supabase
      .from('game_lists')
      .select('game_codes')
      .eq('id', listId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching current game list:', fetchError);
      return null;
    }
    
    const currentCodes = Array.isArray(currentList.game_codes) ? currentList.game_codes : [];
    const updatedCodes = currentCodes.filter((code: any) => code !== gameCode);
    
    return await this.updateGameList(listId, {
      game_codes: updatedCodes,
    });
  },
};

// Export all services as a single object
export const databaseService = {
  user: userService,
  gameHistory: gameHistoryService,
  gameLists: gameListService,
};