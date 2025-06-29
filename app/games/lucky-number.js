// app/games/lucky-number-game.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  BackHandler,
  Easing,
  Alert,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';

const { width, height } = Dimensions.get('window');

// Responsive scaling
const isSmallDevice = width < 380;
const isMediumDevice = width >= 380 && width < 414;
const scale = (size) => {
  if (isSmallDevice) return size * 0.85;
  if (isMediumDevice) return size * 0.95;
  return size;
};

import config from '../../config';
const API_BASE_URL = `${config.BASE_URL}/api`;

export default function LuckyNumberGame() {
  const { stake, luckyNumber } = useLocalSearchParams();
  const { user, updateWallet } = useAuth();
  
  const [gameState, setGameState] = useState('starting'); // starting, rolling, finished
  const [gameId, setGameId] = useState(null);
  const [rollsLeft, setRollsLeft] = useState(2);
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [rollHistory, setRollHistory] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [isFinalizingGame, setIsFinalizingGame] = useState(false);
  const [rollingDiceValue, setRollingDiceValue] = useState(1);
  const [isLeavingGame, setIsLeavingGame] = useState(false);
  const gameIdRef = useRef(null);

  // Animation refs
  const diceRotation = useRef(new Animated.Value(0)).current;
  const diceScale = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const floatingAnimY = useRef(new Animated.Value(0)).current;
  const slideInAnim = useRef(new Animated.Value(height)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Confetti particles
  const confettiParticles = Array(25).fill(0).map((_, i) => ({
    id: i,
    translateX: new Animated.Value(Math.random() * width - width/2),
    translateY: new Animated.Value(-50),
    rotation: new Animated.Value(Math.random() * 360),
    scale: new Animated.Value(0.8 + Math.random() * 0.7),
    opacity: new Animated.Value(0),
    color: ['#FFD700', '#4ECDC4', '#FF6B6B', '#8B5CF6', '#FFFFFF'][Math.floor(Math.random() * 5)]
  }));

  // API Helper Function
  const apiCall = async (endpoint, method = 'GET', body = null) => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const config = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      };

      if (body) {
        config.body = JSON.stringify(body);
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'API request failed');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // Initialize game on component mount
  useEffect(() => {
    initializeGame();
    
    // Entrance animation
    Animated.timing(slideInAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start();

    return () => {
      // Cleanup animations
      diceRotation.setValue(0);
      diceScale.setValue(1);
      glowAnim.setValue(0);
    };
  }, []);

  // Rolling dice animation effect
  useEffect(() => {
    let interval;
    if (isRolling) {
      interval = setInterval(() => {
        setRollingDiceValue(Math.floor(Math.random() * 6) + 1);
      }, 100);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRolling]);

  // Floating animation for dice area
  useEffect(() => {
    if (gameState === 'rolling') {
      const floatingAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(floatingAnimY, {
            toValue: 1,
            duration: 3000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(floatingAnimY, {
            toValue: 0,
            duration: 3000,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      floatingAnimation.start();
      return () => floatingAnimation.stop();
    }
  }, [gameState]);

  // Confetti animation
  useEffect(() => {
    if (hasWon) {
      confettiParticles.forEach((particle, index) => {
        setTimeout(() => {
          Animated.sequence([
            Animated.timing(particle.opacity, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.parallel([
              Animated.timing(particle.translateY, {
                toValue: height + 100,
                duration: 4000,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
              }),
              Animated.timing(particle.rotation, {
                toValue: particle.rotation._value + 720,
                duration: 4000,
                easing: Easing.linear,
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(particle.opacity, {
              toValue: 0,
              duration: 500,
              useNativeDriver: true,
            }),
          ]).start();
        }, index * 50);
      });
    }
  }, [hasWon]);

  // Back handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [gameState, gameId, isLeavingGame, showResult]);

  const initializeGame = async () => {
    try {
      const response = await apiCall('/lucky-number/start', 'POST', {
        stake: parseFloat(stake),
        luckyNumber: parseInt(luckyNumber)
      });

      if (response.success) {
        const newGameId = response.gameId;
        gameIdRef.current = newGameId;
        setGameId(newGameId);
        setGameState('rolling');
        setWinAmount(response.winAmount);
        setRollsLeft(response.rollsLeft);
      } else {
        Alert.alert('Error', 'Failed to start game');
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to start game');
      router.back();
    }
  };

  const handleBackPress = () => {
    if (isLeavingGame) return true;

    if (showResult) {
      router.replace('/');
      return true;
    }

    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave? You will lose your stake.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: leaveGame }
      ]
    );
    return true;
  };

  const leaveGame = async () => {
    try {
      setIsLeavingGame(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      await apiCall('/lucky-number/leave_game', 'POST', {
        gameId: gameIdRef.current
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    } catch (error) {
      setIsLeavingGame(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to leave game');
    }
  };

  const rollDice = async () => {
    if (gameState !== 'rolling' || isRolling || rollsLeft <= 0 || !gameId) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      setIsRolling(true);
      setDiceValue(null);

      // Start rolling animations
      const rollAnimation = Animated.loop(
        Animated.timing(diceRotation, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        })
      );

      const bounceAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(diceScale, {
            toValue: 1.2,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(diceScale, {
            toValue: 1,
            duration: 150,
            useNativeDriver: true,
          }),
        ])
      );

      rollAnimation.start();
      bounceAnimation.start();

      const startTime = Date.now();
      const minRollingTime = 2500;

      try {
        const response = await apiCall('/lucky-number/roll', 'POST', { gameId });
        
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minRollingTime - elapsedTime);

        if (remainingTime > 0) {
          await new Promise(resolve => setTimeout(resolve, remainingTime));
        }

        rollAnimation.stop();
        bounceAnimation.stop();

        if (response.success) {
          setIsRolling(false);
          setDiceValue(response.diceValue);
          setRollHistory(response.rollHistory);
          setRollsLeft(response.rollsLeft);

          // Final dice animation
          Animated.parallel([
            Animated.timing(diceRotation, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(diceScale, {
                toValue: 1.5,
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(diceScale, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
              }),
            ])
          ]).start(() => {
            if (response.diceValue === parseInt(luckyNumber)) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            } else {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }

            if (response.gameResult) {
              if (response.won) {
                setHasWon(true);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
                Animated.loop(
                  Animated.sequence([
                    Animated.timing(glowAnim, {
                      toValue: 1,
                      duration: 800,
                      useNativeDriver: true,
                    }),
                    Animated.timing(glowAnim, {
                      toValue: 0,
                      duration: 800,
                      useNativeDriver: true,
                    }),
                  ])
                ).start();
              } else {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              }
              
              setTimeout(() => {
                finalizeGame(response.gameResult);
              }, 300);
            }
          });
        } else {
          Alert.alert('Error', 'Failed to roll dice');
        }
      } catch (apiError) {
        rollAnimation.stop();
        bounceAnimation.stop();
        diceRotation.setValue(0);
        diceScale.setValue(1);
        setIsRolling(false);
        throw apiError;
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to roll dice');
      setIsRolling(false);
    }
  };

  const finalizeGame = async (gameResult) => {
    try {
      setIsFinalizingGame(true);

      const response = await apiCall('/lucky-number/finalize', 'POST', { gameId });

      if (response.success) {
        await updateWallet(response.newBalance);
        
        Animated.timing(resultAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }).start();

        setShowResult(true);
      } else {
        Alert.alert('Error', 'Failed to finalize game');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to finalize game');
    } finally {
      setIsFinalizingGame(false);
    }
  };

  const getDiceIcon = (value) => {
    const icons = ['', 'looks-one', 'looks-two', 'looks-3', 'looks-4', 'looks-5', 'looks-6'];
    return icons[value];
  };

  const renderGameArea = () => {
    if (gameState === 'starting') {
      return (
        <View style={styles.loadingContainer}>
          <View style={styles.loadingIconContainer}>
            <MaterialIcons name="stars" size={scale(60)} color="#FFD700" />
          </View>
          <Text style={styles.loadingTitle}>Preparing Your Game...</Text>
          <ActivityIndicator size="large" color="#4ECDC4" style={styles.loadingSpinner} />
        </View>
      );
    }

    return (
      <ScrollView style={styles.gameScrollContainer} showsVerticalScrollIndicator={false}>
        {/* Game Status Card */}
        <View style={styles.gameStatusSection}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.06)']}
            style={styles.gameStatusCard}
          >
            <Text style={styles.statusCardTitle}>Game Status</Text>
            
            <View style={styles.statusGrid}>
              {/* Target Number */}
              <View style={styles.statusGridItem}>
                <View style={styles.statusIconContainer}>
                  <Text style={styles.statusIcon}>🎯</Text>
                </View>
                <Text style={styles.statusLabel}>Target</Text>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.targetBadge}
                >
                  <Text style={styles.targetNumber}>{luckyNumber}</Text>
                </LinearGradient>
              </View>

              {/* Rolls Left */}
              <View style={styles.statusGridItem}>
                <View style={styles.statusIconContainer}>
                  <Text style={styles.statusIcon}>🎲</Text>
                </View>
                <Text style={styles.statusLabel}>Rolls Left</Text>
                <View style={styles.rollsIndicatorContainer}>
                  {[1, 2].map((roll) => (
                    <View
                      key={roll}
                      style={[
                        styles.rollIndicator,
                        rollsLeft >= roll ? styles.rollIndicatorActive : styles.rollIndicatorInactive
                      ]}
                    >
                      <MaterialIcons 
                        name="casino" 
                        size={scale(12)} 
                        color={rollsLeft >= roll ? "#4ECDC4" : "#666"} 
                      />
                    </View>
                  ))}
                </View>
              </View>

              {/* Prize Amount */}
              <View style={styles.statusGridItem}>
                <View style={styles.statusIconContainer}>
                  <Text style={styles.statusIcon}>💎</Text>
                </View>
                <Text style={styles.statusLabel}>Prize</Text>
                <Text style={styles.prizeAmount}>₹{winAmount}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Dice Arena */}
        <View style={styles.diceSection}>
          <View style={styles.diceArena}>
            {/* Glow Ring */}
            <Animated.View style={[
              styles.diceGlowRing,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.15, 0.4]
                }),
                transform: [{
                  scale: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.05]
                  })
                }]
              }
            ]} />

            {/* Dice Container */}
            <Animated.View
              style={[
                styles.diceContainer,
                {
                  transform: [
                    { scale: diceScale },
                    {
                      rotate: diceRotation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      }),
                    },
                    {
                      translateY: floatingAnimY.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -8]
                      })
                    }
                  ],
                },
              ]}
            >
              {/* Win Glow Effect */}
              {diceValue === parseInt(luckyNumber) && !isRolling && (
                <Animated.View style={[
                  styles.winGlow,
                  {
                    opacity: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.7]
                    })
                  }
                ]} />
              )}
              
              {/* Dice */}
              <LinearGradient
                colors={
                  diceValue === parseInt(luckyNumber) && !isRolling
                    ? ['#FFD700', '#FFA500', '#FF8C00']
                    : isRolling
                    ? ['#8B5CF6', '#A855F7', '#C084FC']
                    : ['#4ECDC4', '#44A08D', '#2ECC71']
                }
                style={styles.dice}
              >
                <View style={styles.diceInner}>
                  {isRolling ? (
                    <View style={styles.rollingContent}>
                      <MaterialIcons
                        name={getDiceIcon(rollingDiceValue)}
                        size={scale(60)}
                        color="#fff"
                        style={styles.diceIcon}
                      />
                      <Text style={styles.rollingText}>ROLLING</Text>
                    </View>
                  ) : diceValue ? (
                    <MaterialIcons
                      name={getDiceIcon(diceValue)}
                      size={scale(60)}
                      color="#fff"
                      style={styles.diceIcon}
                    />
                  ) : (
                    <MaterialIcons
                      name="casino"
                      size={scale(60)}
                      color="#fff"
                      style={styles.diceIcon}
                    />
                  )}
                </View>
                
                {/* Sparkles for winning */}
                {diceValue === parseInt(luckyNumber) && !isRolling && (
                  <>
                    <Animated.View style={[
                      styles.sparkle,
                      { top: scale(-8), right: scale(8) },
                      {
                        opacity: glowAnim,
                        transform: [{
                          rotate: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0deg', '360deg']
                          })
                        }]
                      }
                    ]}>
                      <Text style={styles.sparkleText}>✨</Text>
                    </Animated.View>
                    <Animated.View style={[
                      styles.sparkle,
                      { bottom: scale(-4), left: scale(8) },
                      {
                        opacity: glowAnim,
                        transform: [{
                          rotate: glowAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['180deg', '540deg']
                          })
                        }]
                      }
                    ]}>
                      <Text style={styles.sparkleText}>⭐</Text>
                    </Animated.View>
                  </>
                )}
              </LinearGradient>
            </Animated.View>

            {/* Result Message */}
          </View>
        </View>

        {/* Roll History */}
        {rollHistory.length > 0 && (
          <View style={styles.historySection}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']}
              style={styles.historyCard}
            >
              <Text style={styles.historyTitle}>🎲 Your Rolls</Text>
              <View style={styles.historyTrail}>
                {rollHistory.map((roll, index) => (
                  <React.Fragment key={index}>
                    <View
                      style={[
                        styles.historyDot,
                        roll === parseInt(luckyNumber) && styles.historyDotWin
                      ]}
                    >
                      <Text style={[
                        styles.historyDotText,
                        roll === parseInt(luckyNumber) && styles.historyDotTextWin
                      ]}>
                        {roll}
                      </Text>
                      {roll === parseInt(luckyNumber) && (
                        <View style={styles.winCrown}>
                          <Text style={styles.crownText}>👑</Text>
                        </View>
                      )}
                    </View>
                    {index < rollHistory.length - 1 && (
                      <MaterialIcons name="arrow-forward" size={scale(14)} color="#666" />
                    )}
                  </React.Fragment>
                ))}
              </View>
            </LinearGradient>
          </View>
        )}
      </ScrollView>
    );
  };

  const renderResult = () => {
    return (
      <Modal
        visible={showResult}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.resultOverlay}>
          <Animated.View style={[
            styles.resultContainer,
            { 
              opacity: resultAnim,
              transform: [{
                scale: resultAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1]
                })
              }]
            }
          ]}>
            <LinearGradient
              colors={hasWon ? ['#4ECDC4', '#44A08D', '#2ECC71'] : ['#FF6B6B', '#FF8E53', '#E74C3C']}
              style={styles.resultCard}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.resultEmoji}>
                  {hasWon ? '🎉' : '😔'}
                </Text>
                <Text style={styles.resultTitle}>
                  {hasWon ? 'JACKPOT!' : 'SO CLOSE!'}
                </Text>
              </View>
              
              <View style={styles.resultAmountContainer}>
                <Text style={styles.resultAmount}>
                  {hasWon ? `+₹${winAmount}` : `-₹${stake}`}
                </Text>
              </View>
              
              <Text style={styles.resultSubtext}>
                {hasWon 
                  ? `Your lucky number ${luckyNumber} came through! 🍀` 
                  : `You rolled: ${rollHistory.join(' → ')} 🎲`
                }
              </Text>
              
              <TouchableOpacity 
                style={styles.homeButton}
                onPress={() => router.replace('/')}
              >
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)']}
                  style={styles.homeButtonGradient}
                >
                  <MaterialIcons name="home" size={scale(24)} color="#fff" />
                  <Text style={styles.homeButtonText}>Back to Home</Text>
                </LinearGradient>
              </TouchableOpacity>
            </LinearGradient>
          </Animated.View>
        </View>
      </Modal>
    );
  };

  return (
    <LinearGradient
      colors={['#0f0c29', '#24243e', '#302b63', '#0f0c29']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Background Elements */}
        <View style={styles.backgroundElements}>
          <Animated.View style={[styles.floatingElement, styles.element1]} />
          <Animated.View style={[styles.floatingElement, styles.element2]} />
          <Animated.View style={[styles.floatingElement, styles.element3]} />
        </View>

        {/* Confetti */}
        {hasWon && confettiParticles.map(particle => (
          <Animated.View
            key={particle.id}
            style={[
              styles.confetti,
              {
                backgroundColor: particle.color,
                transform: [
                  { translateX: particle.translateX },
                  { translateY: particle.translateY },
                  { 
                    rotate: particle.rotation.interpolate({
                      inputRange: [0, 720],
                      outputRange: ['0deg', '720deg']
                    })
                  },
                  { scale: particle.scale }
                ],
                opacity: particle.opacity,
              }
            ]}
          />
        ))}

        {/* Loading Modal for Leave Game */}
        {isLeavingGame && (
          <Modal
            visible={isLeavingGame}
            transparent={true}
            animationType="fade"
            onRequestClose={() => {}}
          >
            <View style={styles.loadingOverlay}>
              <LinearGradient
                colors={['rgba(0, 0, 0, 0.8)', 'rgba(26, 26, 46, 0.9)']}
                style={styles.loadingModalContainer}
              >
                <View style={styles.loadingCard}>
                  <LinearGradient
                    colors={['#1a1a2e', '#16213e', '#0f3460']}
                    style={styles.loadingCardGradient}
                  >
                    <View style={styles.exitIconContainer}>
                      <MaterialIcons name="exit-to-app" size={scale(50)} color="#FF6B6B" />
                    </View>
                    
                    <Text style={styles.loadingTitle}>Leaving Game...</Text>
                    <Text style={styles.loadingSubtitle}>Processing your request</Text>
                    
                    <View style={styles.spinnerContainer}>
                      <ActivityIndicator size="large" color="#FF6B6B" />
                    </View>
                    
                    <View style={styles.warningContainer}>
                      <MaterialIcons name="warning" size={scale(14)} color="#FFA500" />
                      <Text style={styles.warningText}>Please don't close the app</Text>
                    </View>
                  </LinearGradient>
                </View>
              </LinearGradient>
            </View>
          </Modal>
        )}

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={[
              styles.backButton,
              isLeavingGame && { opacity: 0.5 }
            ]} 
            onPress={handleBackPress}
            disabled={isLeavingGame}
          >
            <MaterialIcons name="arrow-back" size={scale(20)} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.gameTitle}>Lucky Number</Text>
          </View>
          
          <View style={styles.stakeContainer}>
            <MaterialIcons name="diamond" size={scale(16)} color="#FFD700" />
            <Text style={styles.stakeText}>₹{stake}</Text>
          </View>
        </View>

        {/* Main Game Area */}
        <View style={styles.gameArea}>
          {renderGameArea()}
        </View>

        {/* Roll Button */}
        {gameState === 'rolling' && rollsLeft > 0 && !showResult && !isFinalizingGame && (
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[
                styles.rollButton,
                (isRolling || isFinalizingGame || isLeavingGame) && styles.rollButtonDisabled
              ]}
              onPress={rollDice}
              disabled={isRolling || isFinalizingGame || isLeavingGame}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#4ECDC4', '#44A08D', '#2ECC71']}
                style={styles.rollButtonGradient}
              >
                <View style={styles.rollButtonContent}>
                  <MaterialIcons 
                    name={isRolling ? "autorenew" : "casino"} 
                    size={scale(28)} 
                    color="#fff" 
                  />
                  <View style={styles.rollButtonTextContainer}>
                    <Text style={styles.rollButtonText}>
                      {isRolling ? 'ROLLING...' : 
                       isFinalizingGame ? 'FINALIZING...' : 
                       'ROLL DICE'}
                    </Text>
                    <Text style={styles.rollButtonSubtext}>
                      {isRolling ? 'Good luck! 🤞' : 
                       isFinalizingGame ? 'Updating wallet...' :
                       `${rollsLeft} chance${rollsLeft > 1 ? 's' : ''} left`}
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Result Modal */}
        {renderResult()}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  backgroundElements: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  floatingElement: {
    position: 'absolute',
    borderRadius: 100,
    opacity: 0.03,
  },
  element1: {
    width: scale(180),
    height: scale(180),
    backgroundColor: '#4ECDC4',
    top: scale(80),
    left: scale(-40),
  },
  element2: {
    width: scale(130),
    height: scale(130),
    backgroundColor: '#FFD700',
    top: scale(300),
    right: scale(-25),
  },
  element3: {
    width: scale(160),
    height: scale(160),
    backgroundColor: '#8B5CF6',
    bottom: scale(150),
    left: scale(-30),
  },
  confetti: {
    position: 'absolute',
    width: scale(6),
    height: scale(6),
    borderRadius: scale(3),
    left: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: scale(20),
    paddingTop: scale(10),
    paddingBottom: scale(15),
    minHeight: scale(60),
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  titleContainer: {
    marginTop:50,
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: scale(10),
  },
  gameTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    letterSpacing: 1,
  },
  stakeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: scale(15),
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    minWidth: scale(70),
    justifyContent: 'center',
  },
  stakeText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: scale(12),
    marginLeft: scale(3),
  },
  gameArea: {
    flex: 1,
  },
  gameScrollContainer: {
    flex: 1,
    paddingHorizontal: scale(20),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(20),
  },
  loadingIconContainer: {
    marginBottom: scale(20),
    padding: scale(15),
    borderRadius: scale(40),
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  loadingTitle: {
    fontSize: scale(20),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    marginBottom: scale(10),
  },
  loadingSpinner: {
    marginTop: scale(20),
  },
  gameStatusSection: {
    marginBottom: scale(25),
  },
  gameStatusCard: {
    padding: scale(20),
    borderRadius: scale(20),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginTop: scale(10),
  },
  statusCardTitle: {
    fontSize: scale(20),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: scale(15),
    opacity: 0.9,
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statusGridItem: {
    alignItems: 'center',
    flex: 1,
  },
  statusIconContainer: {
    marginBottom: scale(8),
  },
  statusIcon: {
    fontSize: scale(20),
    textAlign: 'center',
  },
  statusLabel: {
    fontSize: scale(18),
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: scale(8),
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  targetBadge: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  targetNumber: {
    fontSize: scale(18),
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  rollsIndicatorContainer: {
    flexDirection: 'row',
    gap: scale(6),
  },
  rollIndicator: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  rollIndicatorActive: {
    backgroundColor: 'rgba(76, 205, 196, 0.2)',
    borderColor: '#4ECDC4',
  },
  rollIndicatorInactive: {
    backgroundColor: 'rgba(102, 102, 102, 0.2)',
    borderColor: '#666',
  },
  prizeAmount: {
    fontSize: scale(14),
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(139, 92, 246, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  diceSection: {
    marginBottom: scale(25),
  },
  diceArena: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: scale(180),
    paddingVertical: scale(20),
  },
  diceGlowRing: {
    position: 'absolute',
    width: scale(140),
    height: scale(140),
    borderRadius: scale(70),
    borderWidth: 2,
    borderColor: '#4ECDC4',
    backgroundColor: 'rgba(76, 205, 196, 0.05)',
  },
  diceContainer: {
    position: 'relative',
    zIndex: 2,
  },
  winGlow: {
    position: 'absolute',
    width: scale(110),
    height: scale(110),
    borderRadius: scale(20),
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    top: scale(-5),
    left: scale(-5),
    zIndex: -1,
  },
  dice: {
    width: scale(100),
    height: scale(100),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  diceInner: {
    width: '88%',
    height: '88%',
    borderRadius: scale(16),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  diceIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  rollingContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rollingText: {
    color: '#fff',
    fontSize: scale(10),
    fontWeight: '900',
    marginTop: scale(4),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 0.5,
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleText: {
    fontSize: scale(16),
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  resultMessageContainer: {
    position: 'absolute',
    bottom: scale(-50),
    left: scale(-60),
    right: scale(-60),
    alignItems: 'center',
  },
  resultMessageCard: {
    padding: scale(12),
    borderRadius: scale(15),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minWidth: scale(200),
  },
  resultMessageText: {
    color: '#fff',
    fontSize: scale(13),
    fontWeight: '700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    lineHeight: scale(16),
  },
  historySection: {
    marginBottom: scale(10),
    // marginTop:100,
  },
  historyCard: {
    padding: scale(18),
    
    borderRadius: scale(18),
    marginBottom:80,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  historyTitle: {
    color: '#fff',
    fontSize: scale(18),
    fontWeight: '800',
    marginBottom: scale(12),
    textShadowColor: 'rgba(139, 92, 246, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
    letterSpacing: 0.3,
  },
  historyTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    flexWrap: 'wrap',
  },
  historyDot: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
    marginHorizontal: scale(2),
  },
  historyDotWin: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderColor: '#FFD700',
    borderWidth: 2.5,
    elevation: 6,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  historyDotText: {
    fontSize: scale(16),
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  historyDotTextWin: {
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
  },
  winCrown: {
    position: 'absolute',
    top: scale(-6),
    right: scale(-6),
  },
  crownText: {
    fontSize: scale(12),
  },
  actionContainer: {
    paddingHorizontal: scale(20),
    paddingBottom: scale(30),
    paddingTop: scale(10),
  },
  rollButton: {
    borderRadius: scale(22),
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  rollButtonDisabled: {
    opacity: 0.7,
  },
  rollButtonGradient: {
    position: 'relative',
  },
  rollButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(16),
    paddingHorizontal: scale(25),
    minHeight: scale(60),
  },
  rollButtonTextContainer: {
    marginLeft: scale(12),
    alignItems: 'center',
    flex: 1,
  },
  rollButtonText: {
    color: '#fff',
    fontSize: scale(16),
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    textAlign: 'center',
  },
  rollButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: scale(11),
    fontWeight: '600',
    marginTop: scale(2),
    textAlign: 'center',
  },
  // Result Modal Styles
  resultOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: scale(25),
  },
  resultContainer: {
    width: '100%',
    maxWidth: scale(320),
    borderRadius: scale(25),
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  resultCard: {
    padding: scale(30),
    alignItems: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: scale(20),
  },
  resultEmoji: {
    fontSize: scale(50),
    marginBottom: scale(12),
  },
  resultTitle: {
    fontSize: scale(24),
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  resultAmountContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: scale(20),
    paddingVertical: scale(10),
    borderRadius: scale(15),
    marginBottom: scale(20),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  resultAmount: {
    fontSize: scale(28),
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  resultSubtext: {
    fontSize: scale(14),
    color: '#fff',
    textAlign: 'center',
    marginBottom: scale(25),
    opacity: 0.9,
    lineHeight: scale(18),
    paddingHorizontal: scale(10),
  },
  homeButton: {
    borderRadius: scale(18),
    overflow: 'hidden',
    width: '100%',
  },
  homeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: scale(20),
  },
  homeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: scale(16),
    marginLeft: scale(8),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  // Loading Modal Styles
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  loadingModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  loadingCard: {
    width: '80%',
    maxWidth: scale(280),
    borderRadius: scale(20),
    overflow: 'hidden',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  loadingCardGradient: {
    padding: scale(30),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  exitIconContainer: {
    marginBottom: scale(15),
    padding: scale(12),
    borderRadius: scale(40),
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  loadingTitle: {
    fontSize: scale(18),
    fontWeight: '900',
    color: '#fff',
    marginBottom: scale(6),
    textAlign: 'center',
    textShadowColor: 'rgba(255, 107, 107, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  loadingSubtitle: {
    fontSize: scale(13),
    color: '#888',
    marginBottom: scale(20),
    textAlign: 'center',
    fontWeight: '500',
  },
  spinnerContainer: {
    marginBottom: scale(20),
    padding: scale(8),
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.3)',
  },
  warningText: {
    fontSize: scale(10),
    color: '#FFA500',
    marginLeft: scale(4),
    fontWeight: '600',
  },
});