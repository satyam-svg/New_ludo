// hooks/useAuth.js
import React from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const AuthContext = React.createContext();

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedUser = await SecureStore.getItemAsync('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login');
      }
    } catch (error) {
      console.log('Error loading stored auth:', error);
      router.replace('/(auth)/login');
    }
    setIsLoading(false);
  };

  const login = async (email, otp, referralCode = null) => {
    try {
      // Mock API call - replace with actual API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const userData = {
        id: Date.now().toString(),
        email,
        wallet: 1000, // Starting bonus
        joinedAt: new Date().toISOString(),
        referralCode: referralCode || null,
        ownReferralCode: generateReferralCode()
      };

      await SecureStore.setItemAsync('user', JSON.stringify(userData));
      setUser(userData);
      router.replace('/(tabs)');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('user');
      setUser(null);
      router.replace('/(auth)/login');
    } catch (error) {
      console.log('Error logging out:', error);
    }
  };

  const updateWallet = async (newBalance) => {
    if (user) {
      const updatedUser = { ...user, wallet: newBalance };
      await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  const generateReferralCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      logout,
      updateWallet,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
}