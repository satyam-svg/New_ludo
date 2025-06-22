// hooks/useAuth.js
import React, { useState } from 'react';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const AuthContext = React.createContext();

export function useAuth() {
  return React.useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null); // Add token state
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await SecureStore.getItemAsync('authToken');
      if (storedToken) {
        setToken(storedToken);
        const userData = await fetchUserData(storedToken);
        setUser(userData);
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

  const fetchUserData = async (authToken) => {
    try {
      // console.log(authToken);
      const response = await fetch('http://192.168.1.4:5000/api/users/me', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });
      
      // console.log(response.json())
      if (!response.ok) throw new Error('Failed to fetch user data');
      
      const userData = await response.json();
      console.log(userData);
      return userData;
      
    } catch (error) {
      console.error('User data fetch error:', error);
      return null;
    }
  };

  const login = async (authToken) => {
    try {
      await SecureStore.setItemAsync('authToken', authToken);
      setToken(authToken);
      const userData = await fetchUserData(authToken);
      setUser(userData);
      router.replace('/(tabs)');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };


  const logout = async () => {
    try {
      await SecureStore.deleteItemAsync('authToken');
      setUser(null);
      router.replace('/(auth)/login');
    } catch (error) {
      console.log('Logout error:', error);
    }
  };

  const updateWallet = (newBalance) => {
    if (user) {
      const updatedUser = { ...user, wallet: newBalance };
      setUser(updatedUser);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token, // Expose token
      login,
      logout,
      updateWallet,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
}