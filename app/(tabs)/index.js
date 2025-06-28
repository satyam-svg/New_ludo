import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator,
  BackHandler,
  FlatList
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../../config';

const { width } = Dimensions.get('window');

const STAKES = [10, 30, 50, 100, 500, 1000];

// Game Rules Data
const gameRules = [
  {
    id: 'six-king',
    title: '6 King Multiplayer',
    icon: 'casino',
    gradient: ['#FF6B6B', '#FF8E53'],
    rules: [
      '🎯 Play against real opponents',
      '🎲 First turn is randomly decided',
      '👑 First to get 3 sixes wins',
      '💰 Winner takes 2x stake',
      '⚡ Instant matchmaking'
    ],
    badge: 'LIVE',
    badgeColor: '#2ECC71'
  },
  {
    id: 'lucky-number',
    title: 'Lucky Number',
    icon: 'stars',
    gradient: ['#4ECDC4', '#44A08D'],
    rules: [
      '🔢 Choose your lucky number (1-6)',
      '🎲 Get 2 chances to roll it',
      '🍀 Higher chances of success',
      '💎 Win 2.5x your stake',
      '⭐ Single player game'
    ],
    badge: 'SOLO',
    badgeColor: '#4ECDC4'
  },
  {
    id: 'matka-king',
    title: 'Matka King',
    icon: 'schedule',
    gradient: ['#8B5CF6', '#7C3AED'],
    rules: [
      '⏰ Play in specific time slots',
      '🔢 Pick a number (0-9)',
      '🏆 10x payout if you win',
      '📅 Multiple slots daily',
      '👥 Minimum 25 players required'
    ],
    badge: 'SLOTS',
    badgeColor: '#8B5CF6'
  },
  {
    id: 'snake-king',
    title: 'Snake King',
    icon: 'bug-report',
    gradient: ['#4E9525', '#2B5E20'],
    rules: [
      '🐍 Avoid snakes on the board',
      '🪜 Ladders boost your winnings',
      '💸 Easy money in just 5-15 rolls',
      '🔥 Win up to 15x your stake!',
      '⚡ Pick your risk, pick your reward'

    ],
    badge: 'BOARD',
    badgeColor: '#4E9525'
  }
];

export default function HomeScreen() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedStake, setSelectedStake] = useState(null);
  const [showGames, setShowGames] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [email, setEmail] = useState('');
  const [currentRuleIndex, setCurrentRuleIndex] = useState(0);
  
  const { user, updateWallet } = useAuth();
  const rulesCarouselRef = useRef(null);

  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackToGames);
    return () => {
      backHandler.remove();
    };
  }, []);

  const games = [
    {
      id: 'six-king',
      title: '6 King',
      description: 'Battle with \nOnline Opponents\nFirst to get 3 sixes wins!',
      icon: 'casino',
      gradient: ['#FF6B6B', '#FF8E53'],
      multiplier: '2x',
      isMultiplayer: true,
      badge: 'MULTIPLAYER'
    },
    {
      id: 'lucky-number',
      title: 'Lucky Number',
      description: 'Choose your lucky number\nRoll twice to win big!',
      icon: 'stars',
      gradient: ['#4ECDC4', '#44A08D'],
      multiplier: '2.5x'
    },
    {
      id: 'matka-king',
      title: 'Matka King',
      description: 'Play in time slots\nWin 10x your stake!',
      icon: 'schedule',
      gradient: ['#8B5CF6', '#7C3AED'],
      multiplier: '10x'
    },
    {
      id: 'snake-king',
      title: 'Snake King',
      description: 'Beat snakes \nWin upto 15x your stake!',
      icon: 'bug-report',
      gradient: ['#4E9525', '#2B5E20'],
      multiplier: '2x - 15x'
    }
  ];

  // Create cyclic data for infinite scroll
  const cyclicGameRules = [
    ...gameRules.slice(-1), // Last item at beginning
    ...gameRules,           // Original items
    ...gameRules.slice(0, 1) // First item at end
  ];

  // Auto-scroll effect for rules carousel
  useEffect(() => {
    const interval = setInterval(() => {
      if (rulesCarouselRef.current && showGames) {
        const nextIndex = (currentRuleIndex + 1) % gameRules.length;
        const scrollIndex = nextIndex + 1; // Account for the prepended item
        
        rulesCarouselRef.current.scrollToIndex({
          index: scrollIndex,
          animated: true,
        });
        setCurrentRuleIndex(nextIndex);
      }
    }, 4000); // Auto-scroll every 4 seconds

    return () => clearInterval(interval);
  }, [currentRuleIndex, showGames]);

  // Handle manual scroll
  const handleRulesScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const cardWidth = width * 0.85 + 15; // Card width + separator
    const index = Math.round(scrollPosition / cardWidth);
    
    // Handle cyclic logic
    if (index === 0) {
      // Scrolled to the duplicate last item at beginning
      setTimeout(() => {
        rulesCarouselRef.current?.scrollToIndex({
          index: gameRules.length,
          animated: false,
        });
      }, 100);
      setCurrentRuleIndex(gameRules.length - 1);
    } else if (index === cyclicGameRules.length - 1) {
      // Scrolled to the duplicate first item at end
      setTimeout(() => {
        rulesCarouselRef.current?.scrollToIndex({
          index: 1,
          animated: false,
        });
      }, 100);
      setCurrentRuleIndex(0);
    } else {
      // Normal scroll within bounds
      setCurrentRuleIndex(index - 1);
    }
  };

  // Game Rules Card Component with enhanced styling
  const GameRuleCard = ({ game, index }) => {
    const isActive = (index % gameRules.length) === currentRuleIndex;
    
    return (
      <Animated.View style={[
        styles.ruleCard,
        {
          transform: [{
            scale: isActive ? 1 : 0.95
          }],
          opacity: isActive ? 1 : 0.8
        }
      ]}>
        <LinearGradient
          colors={[...game.gradient, 'rgba(0, 0, 0, 0.1)']}
          style={styles.ruleCardGradient}
        >
          {/* Header */}
          <View style={styles.ruleCardHeader}>
            <View style={styles.ruleIconContainer}>
              <MaterialIcons name={game.icon} size={24} color="#fff" />
            </View>
            <View style={styles.ruleHeaderText}>
              <Text style={styles.ruleCardTitle}>{game.title}</Text>
              <View style={[styles.ruleBadge, { backgroundColor: game.badgeColor }]}>
                <Text style={styles.ruleBadgeText}>{game.badge}</Text>
              </View>
            </View>
          </View>

          {/* Rules List */}
          <View style={styles.rulesList}>
            {game.rules.map((rule, ruleIndex) => (
              <Animated.View 
                key={ruleIndex} 
                style={[
                  styles.ruleItem,
                  {
                    transform: [{
                      translateX: isActive ? 0 : -10
                    }],
                    opacity: isActive ? 1 : 0.7
                  }
                ]}
              >
                <Text style={styles.ruleText}>{rule}</Text>
              </Animated.View>
            ))}
          </View>

          {/* Play Button */}
          <TouchableOpacity 
            style={styles.rulePlayButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (game.id === 'six-king') {
                router.push('/games/six-king-lobby');
              } else if (game.id === 'matka-king') {
                router.push('/games/matka-king');
              } else {
                handleGameSelect(games.find(g => g.id === game.id));
              }
            }}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)']}
              style={styles.rulePlayGradient}
            >
              <MaterialIcons name="play-arrow" size={18} color="#fff" />
              <Text style={styles.rulePlayText}>Play Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    );
  };

  useFocusEffect(
    React.useCallback(() => {
      const fetchUserData = async () => {
        try {
          setIsLoading(true);
          const token = await AsyncStorage.getItem('authToken');
          if (!token) {
            throw new Error('No authentication token found');
          }
          
          const response = await fetch(`${config.BASE_URL}/api/users/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (!response.ok) throw new Error('Failed to fetch user data');
          
          const data = await response.json();
          // console.log(data);
          const wallet = data.wallet;
          setBalance(wallet);
          setEmail(data.email);
          
          updateWallet(wallet);
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
    if (user) {
      setBalance(user.wallet || 0);
      setEmail(user.email || '');
    }
  }, [user]);

  const handleGameSelect = (game) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedGame(game);
    setSelectedStake(null);
    
    if (game.id === 'six-king') {
      router.push('/games/six-king-lobby');
      return;
    }
    
    if (game.id === 'matka-king') {
      router.push('/games/matka-king');
      return;
    }

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
      if (selectedGame.id === 'matka-king') {
        router.push({
          pathname: '/games/matka-king',
          params: { stake: selectedStake }
        });
      }
      else if (selectedGame.id == 'snake-king'){
        router.push({
          pathname: '/games/snake-king-lobby',
          params: { stake: selectedStake }
        });
      }
       else {
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
    
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    return true;
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
                        {game.badge && (
                          <View style={[
                            styles.gameBadge,
                            game.isMultiplayer ? styles.multiplayerBadge : styles.soloBadge
                          ]}>
                            <MaterialIcons 
                              name={game.isMultiplayer ? "people" : "person"} 
                              size={12} 
                              color="#fff" 
                            />
                            <Text style={styles.badgeText}>{game.badge}</Text>
                          </View>
                        )}
                        
                        <MaterialIcons name={game.icon} size={40} color="#fff" />
                        <Text style={styles.gameTitle}>{game.title}</Text>
                        <Text style={styles.gameDescription}>{game.description}</Text>
                        
                        <View style={styles.gameFooter}>
                          <View style={styles.multiplierBadge}>
                            <Text style={styles.multiplierText}>{game.multiplier}</Text>
                          </View>
                          
                          {game.isMultiplayer && (
                            <View style={styles.onlineIndicator}>
                              <View style={styles.onlineDot} />
                              <Text style={styles.onlineText}>LIVE</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Game Rules Section - Enhanced with Cyclic Mode */}
            <View style={styles.gameRulesSection}>
              <View style={styles.rulesHeader}>
                <MaterialIcons name="rule" size={24} color="#FFD700" />
                <Text style={styles.rulesTitle}>Game Rules & How to Play</Text>
              </View>
              <Text style={styles.rulesSubtitle}>
                 Swipe to explore each game
              </Text>
              
              <FlatList
                ref={rulesCarouselRef}
                data={cyclicGameRules}
                renderItem={({ item, index }) => <GameRuleCard game={item} index={index} />}
                keyExtractor={(item, index) => `${item.id}-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={width * 0.85 + 15}
                snapToAlignment="start"
                decelerationRate="fast"
                contentContainerStyle={styles.rulesCardsContainer}
                ItemSeparatorComponent={() => <View style={{ width: 15 }} />}
                initialScrollIndex={1} // Start from the first real item
                getItemLayout={(data, index) => ({
                  length: width * 0.85 + 15,
                  offset: (width * 0.85 + 15) * index,
                  index,
                })}
                onMomentumScrollEnd={handleRulesScroll}
                onScrollToIndexFailed={(info) => {
                  const wait = new Promise(resolve => setTimeout(resolve, 500));
                  wait.then(() => {
                    rulesCarouselRef.current?.scrollToIndex({ 
                      index: info.index, 
                      animated: true 
                    });
                  });
                }}
              />
              
              {/* Pagination Dots */}
              <View style={styles.paginationContainer}>
                {gameRules.map((_, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.paginationDot,
                      currentRuleIndex === index && styles.paginationDotActive
                    ]}
                    onPress={() => {
                      const scrollIndex = index + 1; // Account for the prepended item
                      rulesCarouselRef.current?.scrollToIndex({
                        index: scrollIndex,
                        animated: true,
                      });
                      setCurrentRuleIndex(index);
                    }}
                  />
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
                    <Text style={styles.featureDescription}>Win up to 15x</Text>
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
            <TouchableOpacity style={styles.backButton} onPress={handleBackToGames}>
              <MaterialIcons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <View style={styles.selectedGameSection}>
              <Text style={styles.selectedGameLabel}>Selected Game</Text>
              <View style={styles.selectedGameCard}>
                <LinearGradient
                  colors={selectedGame?.gradient || ['#4ECDC4', '#44A08D']}
                  style={styles.selectedGameGradient}
                >
                  <MaterialIcons name={selectedGame?.icon} size={30} color="#fff" />
                  <Text style={styles.selectedGameTitle}>{selectedGame?.title}</Text>
                  <Text style={styles.selectedGameMultiplier}>{selectedGame?.multiplier}</Text>
                </LinearGradient>
              </View>
            </View>

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
    flexWrap: 'wrap',
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
    marginBottom: 20,
  },
  gameCardGradient: {
    padding: 20,
    minHeight: 250,
  },
  gameCardContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    position: 'relative',
  },
  gameBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 1,
  },
  multiplayerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  soloBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 4,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
    marginBottom: 8,
    textAlign: 'center',
  },
  gameDescription: {
    fontSize: 12,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 15,
  },
  gameFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
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
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2ECC71',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  
  // New Game Rules Section Styles
  gameRulesSection: {
    marginBottom: 30,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  rulesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
    textAlign: 'center',
  },
  rulesSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  rulesCardsContainer: {
    paddingHorizontal: 20,
  },
  ruleCard: {
    width: width * 0.85,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  ruleCardGradient: {
    padding: 20,
    minHeight: 280,
  },
  ruleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  ruleIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  ruleHeaderText: {
    flex: 1,
  },
  ruleCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  ruleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ruleBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  rulesList: {
    flex: 1,
    marginBottom: 20,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ruleText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    flex: 1,
  },
  rulePlayButton: {
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  rulePlayGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rulePlayText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },

  // Pagination Dots Styles
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#FFD700',
    width: 20,
  },

  stakesScreenContainer: {
    flex: 1,
    paddingTop: 60,
  },
  backButton: {
    position: 'absolute',
    top: 60,
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
    marginBottom: 30,
    alignItems: 'center',
  },
  selectedGameLabel: {
    fontSize: 16,
    color: '#888',
    marginBottom: 10,
  },
  selectedGameCard: {
    width: 150,
    height: 100,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
    marginBottom: 2,
  },
  selectedGameMultiplier: {
    fontSize: 14,
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
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: 70,
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
    fontSize: 18,
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
    marginTop: 20,
    marginBottom: 30,
  },
  playButton: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  playButtonGradient: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  playButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginLeft: 10,
  },
  playButtonSubtext: {
    fontSize: 12,
    color: '#1a1a2e',
    position: 'absolute',
    bottom: 10,
  },
  bottomPadding: {
    height: 20,
  },
  heroSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
    alignItems: 'center',
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
    flexWrap: 'wrap',
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
    marginBottom: 15,
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
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
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