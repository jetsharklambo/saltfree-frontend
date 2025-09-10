import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { databaseService } from '../services/databaseService';
import { Database } from '../lib/database.types';

type User = Database['public']['Tables']['users']['Row'];

interface UserContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  updateUsername: (username: string) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const activeAccount = useActiveAccount();
  const walletAddress = activeAccount?.address;

  const refreshUser = async () => {
    if (!walletAddress) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const userData = await databaseService.user.getOrCreateUser(walletAddress);
      setUser(userData);
    } catch (err) {
      console.error('Error fetching user:', err);
      setError('Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const updateUsername = async (username: string): Promise<boolean> => {
    if (!user) {
      console.error('❌ UpdateUsername failed: No user context available');
      setError('No user logged in');
      return false;
    }

    console.log('📝 Starting username update process:', {
      userId: user.id,
      currentUsername: user.username,
      newUsername: username,
      walletAddress: user.wallet_address
    });

    try {
      // Allow empty string to remove username (set to null)
      const usernameValue = username.trim() === '' ? null : username.trim();
      
      console.log('🔄 Calling databaseService.user.updateUser with:', {
        userId: user.id,
        usernameValue
      });
      
      const updatedUser = await databaseService.user.updateUser(user.id, { username: usernameValue });
      
      if (updatedUser) {
        console.log('✅ Username update successful:', {
          updatedUsername: updatedUser.username,
          updatedAt: updatedUser.updated_at
        });
        setUser(updatedUser);
        setError(null); // Clear any previous errors
        return true;
      } else {
        console.error('❌ UpdateUser returned null/undefined');
        setError('Database update failed - no data returned');
        return false;
      }
    } catch (error: any) {
      console.error('❌ Error updating username:', {
        error: error.message,
        stack: error.stack,
        userId: user.id,
        username: username
      });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to update username';
      
      if (error.message?.includes('duplicate')) {
        errorMessage = 'Username already taken';
      } else if (error.message?.includes('permission') || error.message?.includes('policy')) {
        errorMessage = 'Permission denied - please check database policies';
      } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
        errorMessage = 'Network error - please check connection';
      } else if (error.message) {
        errorMessage = `Update failed: ${error.message}`;
      }
      
      setError(errorMessage);
      return false;
    }
  };

  // Effect to load user when wallet connects/disconnects
  useEffect(() => {
    refreshUser();
  }, [walletAddress]);

  const value: UserContextType = {
    user,
    loading,
    error,
    updateUsername,
    refreshUser,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};