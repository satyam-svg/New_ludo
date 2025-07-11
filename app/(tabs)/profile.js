// app/(tabs)/profile.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Dimensions,
  Share
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import config from '../../config';

const { width } = Dimensions.get('window');
const API_BASE_URL = `${config.BASE_URL}/api/users`;

export default function ProfileScreen() {
  const { user, logout, updateWallet } = useAuth();
  const [showReferralCode, setShowReferralCode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user data
  const fetchUserData = async () => {
    try {
      setIsLoading(true);
      const token = await AsyncStorage.getItem('authToken');
      
      const response = await fetch(`${API_BASE_URL}/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch user data');
      
      // Update global wallet balance
      updateWallet(data.wallet);
    } catch (error) {
      console.error('User data fetch error:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            logout();
          }
        }
      ]
    );
  };

  const handleShareReferral = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const shareMessage = `🎮 Join me on Gaming Arena and start winning real money!\n\nUse my referral code: ${user?.referralCode}\n\nDownload now and get bonus money to start playing! 💰\n\n#GamingArena #RealMoney #Gaming`;
      
      await Share.share({
        message: shareMessage,
        title: 'Join Gaming Arena'
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  const handleCopyReferralCode = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Clipboard.setStringAsync(user?.referralCode || '');
    Alert.alert('Copied!', 'Referral code copied to clipboard');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const profileOptions = [
    {
      title: 'Account Settings',
      icon: 'settings',
      onPress: () => Alert.alert('Coming Soon', 'Account settings will be available soon!'),
    },
    {
      title: 'Game Rules',
      icon: 'help',
      onPress: () => Alert.alert(
        'Game Rules',
        '🎲 Six King: First player to roll three 6s wins 2x stake\n\n⭐ Lucky Number: Choose a number (1-6), get 2 rolls to hit it, win 2.5x stake\n\n🐍 Snake King: Survive rolls without hitting snakes\n\n🎰 Matka King: Bet on numbers in time slots, win 10x stake'
      ),
    },
    {
      title: 'Privacy Policy',
      icon: 'privacy-tip',
      onPress: () => Alert.alert('Privacy Policy', 'Your privacy is important to us. All game data is secured and encrypted.'),
    },
    {
      title: 'Terms of Service',
      icon: 'description',
      onPress: () => Alert.alert('Terms of Service', 'Please read our terms and conditions for fair gameplay.'),
    },
    {
      title: 'Support',
      icon: 'support-agent',
      onPress: () => Alert.alert('Support', 'Contact us at support@gamingarena.com for any queries!'),
    },
  ];

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e']}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Profile Card - Option 3: Simple & Clean */}
        <View style={styles.profileCard}>
          <LinearGradient
            colors={['#FF6B6B', '#FF8E53']}
            style={styles.profileGradient}
          >
            <View style={styles.simpleProfileContent}>
              <View style={styles.profileIconRow}>
                <View style={styles.largeAvatarContainer}>
                  <MaterialIcons name="account-circle" size={80} color="#fff" />
                </View>
                <View style={styles.verifiedBadge}>
                  <MaterialIcons name="verified" size={20} color="#4ECDC4" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              </View>
              
              <View style={styles.profileDetails}>
                <Text style={styles.welcomeTitle}>Welcome Back!</Text>
                <Text style={styles.playerIdText}>
                  Player: ****{user?.phoneNumber?.slice(-4) || 'XXXX'}
                </Text>
                <Text style={styles.memberSince}>
                  🎯 Ready to play and win big!
                </Text>
                
                <View style={styles.quickStatsContainer}>
                  <View style={styles.quickStat}>
                    <MaterialIcons name="games" size={24} color="#fff" />
                    <Text style={styles.quickStatText}>Play Games</Text>
                  </View>
                  <View style={styles.quickStat}>
                    <MaterialIcons name="emoji-events" size={24} color="#FFD700" />
                    <Text style={styles.quickStatText}>Win Prizes</Text>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Referral Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.referralCard}
            onPress={() => setShowReferralCode(!showReferralCode)}
          >
            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              style={styles.referralGradient}
            >
              <View style={styles.referralHeader}>
                <MaterialIcons name="card-giftcard" size={30} color="#1a1a2e" />
                <View style={styles.referralInfo}>
                  <Text style={styles.referralTitle}>Refer & Earn</Text>
                  <Text style={styles.referralSubtitle}>
                    Invite friends and earn bonus money!
                  </Text>
                </View>
                <MaterialIcons 
                  name={showReferralCode ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} 
                  size={24} 
                  color="#1a1a2e" 
                />
              </View>
              
              {showReferralCode && (
                <View style={styles.referralContent}>
                  <View style={styles.referralCodeContainer}>
                    <Text style={styles.referralCodeLabel}>Your Referral Code:</Text>
                    <View style={styles.referralCodeBox}>
                      <Text style={styles.referralCode}>{user?.referralCode || 'LOADING...'}</Text>
                      <TouchableOpacity 
                        style={styles.copyButton}
                        onPress={handleCopyReferralCode}
                        disabled={!user?.referralCode}
                      >
                        <MaterialIcons name="content-copy" size={16} color="#1a1a2e" />
                      </TouchableOpacity>
                    </View>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.shareButton}
                    onPress={handleShareReferral}
                    disabled={!user?.referralCode}
                  >
                    <MaterialIcons name="share" size={18} color="#1a1a2e" />
                    <Text style={styles.shareButtonText}>Share with Friends</Text>
                  </TouchableOpacity>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Settings</Text>
          <View style={styles.optionsContainer}>
            {profileOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={styles.optionItem}
                onPress={option.onPress}
              >
                <View style={styles.optionLeft}>
                  <MaterialIcons name={option.icon} size={24} color="#4ECDC4" />
                  <Text style={styles.optionText}>{option.title}</Text>
                </View>
                <MaterialIcons name="chevron-right" size={20} color="#888" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <View style={styles.appInfoCard}>
            <Text style={styles.appName}>Gaming Arena</Text>
            <Text style={styles.appVersion}>Version 1.0.0</Text>
            <Text style={styles.appDescription}>
              Play exciting dice games and win real money! Fair gameplay guaranteed.
            </Text>
          </View>
        </View>

        {/* Logout Button */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LinearGradient
              colors={['#FF6B6B', '#FF8E53']}
              style={styles.logoutGradient}
            >
              <MaterialIcons name="logout" size={24} color="#fff" />
              <Text style={styles.logoutText}>Logout</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  profileCard: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  profileGradient: {
    // Remove flexDirection and alignItems for the new design
  },
  
  // New Profile Card Styles (Option 3)
  simpleProfileContent: {
    alignItems: 'center',
    padding: 20,
  },
  profileIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    position: 'relative',
  },
  largeAvatarContainer: {
    position: 'relative',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: -30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 10,
    color: '#4ECDC4',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  profileDetails: {
    alignItems: 'center',
    width: '100%',
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
    textAlign: 'center',
  },
  playerIdText: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
    marginBottom: 8,
  },
  memberSince: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.8,
    marginBottom: 15,
    textAlign: 'center',
  },
  quickStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 10,
  },
  quickStat: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 15,
    flex: 1,
    marginHorizontal: 5,
  },
  quickStatText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
    marginTop: 5,
    textAlign: 'center',
  },
  
  // Rest of the existing styles
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  referralCard: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  referralGradient: {
    padding: 20,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  referralInfo: {
    flex: 1,
    marginLeft: 15,
  },
  referralTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  referralSubtitle: {
    fontSize: 12,
    color: '#1a1a2e',
    opacity: 0.8,
  },
  referralContent: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(26, 26, 46, 0.2)',
  },
  referralCodeContainer: {
    marginBottom: 15,
  },
  referralCodeLabel: {
    fontSize: 12,
    color: '#1a1a2e',
    marginBottom: 5,
    opacity: 0.8,
  },
  referralCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 10,
  },
  referralCode: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a2e',
    letterSpacing: 2,
  },
  copyButton: {
    padding: 5,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 12,
    borderRadius: 10,
  },
  shareButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginLeft: 8,
  },
  optionsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 15,
  },
  appInfoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  appName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 5,
  },
  appVersion: {
    fontSize: 12,
    color: '#888',
    marginBottom: 10,
  },
  appDescription: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 20,
    opacity: 0.8,
  },
  logoutButton: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  logoutGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  bottomPadding: {
    height: 20,
  },
});