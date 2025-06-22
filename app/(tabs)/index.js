import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const STAKES = [10, 30, 50, 100, 500, 1000];

export default function HomeScreen() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedStake, setSelectedStake] = useState(null);
  const [showGames, setShowGames] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [email, setEmail] = useState('');
  
  const { user, updateWallet } = useAuth();

  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  const games = [
    {
      id: 'six-king',
      title: '6 King',
      description: 'Battle with \nOnline Opponents\nFirst to get 3 sixes wins!',
      icon: 'casino',
      gradient: ['#FF6B6B', '#FF8E53'],
      multiplier: '2x'
    },
    {
      id: 'lucky-number',
      title: 'Lucky Number',
      description: 'Choose your lucky number\nRoll twice to win big!',
      icon: 'stars',
      gradient: ['#4ECDC4', '#44A08D'],
      multiplier: '2.5x'
    },
    // Add Matka King game option
    {
      id: 'matka-king',
      title: 'Matka King',
      description: 'Play in time slots\nWin 9.5x your stake!',
      icon: 'schedule',
      gradient: ['#8B5CF6', '#7C3AED'],
      multiplier: '9.5x'
    }
  ];

  useFocusEffect(
    React.useCallback(() => {
      const fetchUserData = async () => {
        try {
          setIsLoading(true);
          const token = await AsyncStorage.getItem('authToken');
          if (!token) {
            throw new Error('No authentication token found');
          }
          
          const response = await fetch('http://192.168.1.2:5000/api/users/me', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (!response.ok) throw new Error('Failed to fetch user data');
          
          const data = await response.json();
          setBalance(data.wallet);
          setEmail(data.email);
          
          // Update wallet in global context
          updateWallet(data.wallet);
        } catch (error) {
          console.error('User data fetch error:', error);
          Alert.alert('Error', error.message);
        } finally {
          setIsLoading(false);
        }
      };

      fetchUserData();
    }, [])
  );

  useEffect(() => {
    // Initialize with context data if available
    if (user) {
      setBalance(user.wallet || 0);
      setEmail(user.email || '');
    }
  }, [user]);

  const handleGameSelect = (game) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedGame(game);
    setSelectedStake(null);
    
    // Animate transition from games to stakes
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowGames(false);
    });
  };

  const handleStakeSelect = (stake) => {
    if (balance < stake) {
      Alert.alert('Insufficient Balance', `You need ₹${stake} to play this game. Please add money to your wallet.`);
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStake(stake);
  };

  const handlePlayGame = () => {
    if (!selectedGame || !selectedStake) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Animate before navigation
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start(() => {
      // Navigate to Matka King screen if selected
      if (selectedGame.id === 'matka-king') {
        router.push({
          pathname: '/games/matka-king',
          params: { stake: selectedStake }
        });
      } else {
        // For other games
        router.push({
          pathname: `/games/${selectedGame.id}`,
          params: { stake: selectedStake }
        });
      }
    });
  };

  const handleBackToGames = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGame(null);
    setSelectedStake(null);
    setShowGames(true);
    
    // Reset animation
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e']}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcomeText}>Welcome back!</Text>
          <Text style={styles.emailText}>{email}</Text>
          
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFD700" />
          ) : (
            <View style={styles.balanceContainer}>
              <MaterialIcons name="account-balance-wallet" size={20} color="#FFD700" />
              <Text style={styles.balanceText}>₹{balance}</Text>
            </View>
          )}
        </View>
        
        {/* Conditional Content Based on Flow */}
        {showGames ? (
          // Game Selection Screen
          <>
            {/* Hero Section */}
            <View style={styles.heroSection}>
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>Ready to Play?</Text>
                <Text style={styles.heroSubtitle}>Choose your game and start winning!</Text>
              </View>
            </View>

            {/* Game Selection */}
            <View style={styles.section}>
              <View style={styles.gamesContainer}>
                {games.map((game) => (
                  <TouchableOpacity
                    key={game.id}
                    style={styles.gameCard}
                    onPress={() => handleGameSelect(game)}
                  >
                    <LinearGradient
                      colors={game.gradient}
                      style={styles.gameCardGradient}
                    >
                      <View style={styles.gameCardContent}>
                        <MaterialIcons name={game.icon} size={40} color="#fff" />
                        <Text style={styles.gameTitle}>{game.title}</Text>
                        <Text style={styles.gameDescription}>{game.description}</Text>
                        <View style={styles.multiplierBadge}>
                          <Text style={styles.multiplierText}>{game.multiplier}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Features Section */}
            <View style={styles.featuresSection}>
              <Text style={styles.featuresTitle}>Why Play With Us?</Text>
              <View style={styles.featuresGrid}>
                <View style={styles.featureCard}>
                  <LinearGradient
                    colors={['rgba(255, 107, 107, 0.2)', 'rgba(255, 142, 83, 0.1)']}
                    style={styles.featureGradient}
                  >
                    <MaterialIcons name="flash-on" size={30} color="#FFD700" />
                    <Text style={styles.featureTitle}>Instant Wins</Text>
                    <Text style={styles.featureDescription}>Get paid instantly</Text>
                  </LinearGradient>
                </View>
                
                <View style={styles.featureCard}>
                  <LinearGradient
                    colors={['rgba(78, 205, 196, 0.2)', 'rgba(68, 160, 141, 0.1)']}
                    style={styles.featureGradient}
                  >
                    <MaterialIcons name="security" size={30} color="#FFD700" />
                    <Text style={styles.featureTitle}>100% Safe</Text>
                    <Text style={styles.featureDescription}>Secure gameplay</Text>
                  </LinearGradient>
                </View>
                
                <View style={styles.featureCard}>
                  <LinearGradient
                    colors={['rgba(255, 215, 0, 0.2)', 'rgba(255, 165, 0, 0.1)']}
                    style={styles.featureGradient}
                  >
                    <MaterialIcons name="trending-up" size={30} color="#FFD700" />
                    <Text style={styles.featureTitle}>High Rewards</Text>
                    <Text style={styles.featureDescription}>Win up to 9.5x</Text>
                  </LinearGradient>
                </View>
              </View>
            </View>

            {/* Stats Section */}
            <View style={styles.statsSection}>
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                style={styles.statsContainer}
              >
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>10K+</Text>
                  <Text style={styles.statLabel}>Players</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>₹50L+</Text>
                  <Text style={styles.statLabel}>Winnings</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNumber}>99.9%</Text>
                  <Text style={styles.statLabel}>Uptime</Text>
                </View>
              </LinearGradient>
            </View>

            {/* Call to Action */}
            <View style={styles.ctaSection}>
              <LinearGradient
                colors={['rgba(255, 215, 0, 0.1)', 'rgba(255, 165, 0, 0.05)']}
                style={styles.ctaContainer}
              >
                <MaterialIcons name="emoji-events" size={40} color="#FFD700" />
                <Text style={styles.ctaTitle}>Start Your Winning Journey!</Text>
                <Text style={styles.ctaSubtitle}>Select a game above to begin</Text>
              </LinearGradient>
            </View>
          </>
        ) : (
          // Stakes Selection Screen
          <Animated.View 
            style={[
              styles.stakesScreenContainer,
              {
                opacity: slideAnim,
                transform: [{
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0]
                  })
                }]
              }
            ]}
          >
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={handleBackToGames}>
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            {/* Selected Game Display */}
            <View style={styles.selectedGameSection}>
              <Text style={styles.selectedGameLabel}>Selected Game</Text>
              <View style={styles.selectedGameCard}>
                <LinearGradient
                  colors={selectedGame?.gradient || ['#FF6B6B', '#FF8E53']}
                  style={styles.selectedGameGradient}
                >
                  <MaterialIcons name={selectedGame?.icon} size={30} color="#fff" />
                  <Text style={styles.selectedGameTitle}>{selectedGame?.title}</Text>
                  <Text style={styles.selectedGameMultiplier}>{selectedGame?.multiplier}</Text>
                </LinearGradient>
              </View>
            </View>

            {/* Stake Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select Your Stake</Text>
              <View style={styles.stakesContainer}>
                {STAKES.map((stake) => (
                  <TouchableOpacity
                    key={stake}
                    style={[
                      styles.stakeCard,
                      selectedStake === stake && styles.stakeCardSelected,
                      balance < stake && styles.stakeCardDisabled
                    ]}
                    onPress={() => handleStakeSelect(stake)}
                    disabled={balance < stake}
                  >
                    <Text style={[
                      styles.stakeAmount,
                      selectedStake === stake && styles.stakeAmountSelected,
                      balance < stake && styles.stakeAmountDisabled
                    ]}>
                      ₹{stake}
                    </Text>
                    {selectedStake === stake && (
                      <MaterialIcons name="check-circle" size={16} color="#FFD700" />
                    )}
                    {balance < stake && (
                      <MaterialIcons name="lock" size={16} color="#888" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Play Button */}
            {selectedStake && (
              <Animated.View 
                style={[
                  styles.playButtonContainer,
                  { transform: [{ scale: scaleAnim }] }
                ]}
              >
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={handlePlayGame}
                >
                  <LinearGradient
                    colors={['#FFD700', '#FFA500']}
                    style={styles.playButtonGradient}
                  >
                    <MaterialIcons name="play-arrow" size={30} color="#1a1a2e" />
                    <Text style={styles.playButtonText}>
                      PLAY {selectedGame?.title.toUpperCase()}
                    </Text>
                    <Text style={styles.playButtonSubtext}>
                      Stake: ₹{selectedStake} | Win: ₹{Math.floor(selectedStake * parseFloat(selectedGame?.multiplier || '2'))}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}
          </Animated.View>
        )}

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
    padding: 20,
    paddingTop: 50,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  emailText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 15,
  },
  balanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  balanceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 8,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  gamesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap', // Added to wrap games on smaller screens
  },
  gameCard: {
    width: (width - 50) / 2,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    marginBottom: 20, // Added spacing between cards
  },
  gameCardGradient: {
    padding: 20,
    minHeight: 180,
  },
  gameCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
    marginBottom: 8,
  },
  gameDescription: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 10,
  },
  multiplierBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  multiplierText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  stakesScreenContainer: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 10,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  selectedGameSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  selectedGameLabel: {
    fontSize: 16,
    color: '#888',
    marginBottom: 10,
  },
  selectedGameCard: {
    width: 120,
    height: 80,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  selectedGameGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  selectedGameTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
    marginBottom: 2,
  },
  selectedGameMultiplier: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  stakesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  stakeCard: {
    width: (width - 60) / 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: 60,
    justifyContent: 'center',
  },
  stakeCardSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: '#FFD700',
  },
  stakeCardDisabled: {
    opacity: 0.5,
  },
  stakeAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  stakeAmountSelected: {
    color: '#FFD700',
  },
  stakeAmountDisabled: {
    color: '#888',
  },
  playButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  playButton: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  playButtonGradient: {
    paddingVertical: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  playButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginLeft: 10,
    marginRight: 10,
  },
  playButtonSubtext: {
    fontSize: 12,
    color: '#1a1a2e',
    position: 'absolute',
    bottom: 5,
  },
  bottomPadding: {
    height: 20,
  },
  // Hero Section Styles
  heroSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
    alignItems: 'center',
    position: 'relative',
  },
  heroContent: {
    alignItems: 'center',
    marginBottom: 20,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  // Features Section Styles
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: (width - 60) / 3,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  featureGradient: {
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
  },
  // Stats Section Styles
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  statsContainer: {
    flexDirection: 'row',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 15,
  },
  // CTA Section Styles
  ctaSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  ctaContainer: {
    alignItems: 'center',
    padding: 25,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    elevation: 3,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3.84,
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
    marginBottom: 5,
    textAlign: 'center',
  },
  ctaSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
});