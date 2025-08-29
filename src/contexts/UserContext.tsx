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
    if (!user) return false;

    try {
      // Allow empty string to remove username (set to null)
      const usernameValue = username.trim() === '' ? null : username.trim();
      const updatedUser = await databaseService.user.updateUser(user.id, { username: usernameValue });
      if (updatedUser) {
        setUser(updatedUser);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating username:', err);
      setError('Failed to update username');
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