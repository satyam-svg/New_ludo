// app/_layout.js
import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider } from '../hooks/useAuth';
import { ActivityIndicator, View } from 'react-native';

export default function RootLayout() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuthToken = async () => {
      try {
        const token = await AsyncStorage.getItem('authToken'); // your token key
        if (token) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error('Error checking token:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuthToken();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style="light" backgroundColor="#1a1a2e" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name={isAuthenticated ? '(tabs)' : '(auth)'} />
        <Stack.Screen name="games" />
      </Stack>
    </AuthProvider>
  );
}
