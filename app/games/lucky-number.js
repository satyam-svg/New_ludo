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
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../hooks/useAuth';

const { width, height } = Dimensions.get('window');

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
        }, index * 50); // Stagger the confetti
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
          <MaterialIcons name="stars" size={60} color="#FFD700" />
          <Text style={styles.loadingTitle}>Preparing Your Game...</Text>
          <ActivityIndicator size="large" color="#4ECDC4" style={{ marginTop: 20 }} />
        </View>
      );
    }

    return (
      <View style={styles.gameContainer}>
        {/* Game Status */}
        <View style={styles.gameStatusContainer}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
            style={styles.gameStatusCard}
          >
            <View style={styles.statusRow}>
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>🎯 TARGET</Text>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.targetBadge}
                >
                  <Text style={styles.targetNumber}>{luckyNumber}</Text>
                </LinearGradient>
              </View>
              
              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>🎲 ROLLS LEFT</Text>
                <View style={styles.rollsContainer}>
                  {[1, 2].map((roll) => (
                    <View
                      key={roll}
                      style={[
                        styles.rollDot,
                        rollsLeft >= roll ? styles.rollDotActive : styles.rollDotUsed
                      ]}
                    >
                      <MaterialIcons 
                        name="casino" 
                        size={14} 
                        color={rollsLeft >= roll ? "#4ECDC4" : "#666"} 
                      />
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.statusItem}>
                <Text style={styles.statusLabel}>💎 WIN</Text>
                <Text style={styles.prizeAmount}>₹{winAmount}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Dice Arena */}
        <View style={styles.diceArena}>
          <Animated.View style={[
            styles.diceGlowRing,
            {
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.2, 0.6]
              }),
              transform: [{
                scale: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.1]
                })
              }]
            }
          ]} />

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
                      outputRange: [0, -10]
                    })
                  }
                ],
              },
            ]}
          >
            {diceValue === parseInt(luckyNumber) && !isRolling && (
              <Animated.View style={[
                styles.winGlow,
                {
                  opacity: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 0.8]
                  })
                }
              ]} />
            )}
            
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
                  <>
                    <MaterialIcons
                      name={getDiceIcon(rollingDiceValue)}
                      size={80}
                      color="#fff"
                      style={styles.diceIcon}
                    />
                    <Text style={styles.rollingText}>ROLLING...</Text>
                  </>
                ) : diceValue ? (
                  <MaterialIcons
                    name={getDiceIcon(diceValue)}
                    size={80}
                    color="#fff"
                    style={styles.diceIcon}
                  />
                ) : (
                  <MaterialIcons
                    name="casino"
                    size={80}
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
                    { top: -10, right: 10 },
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
                    { bottom: -5, left: 10 },
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
        </View>

        {/* Roll History */}
        {rollHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.08)', 'rgba(255, 255, 255, 0.03)']}
              style={styles.historyCard}
            >
              <Text style={styles.historyTitle}>🎲 Your Journey</Text>
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
                      <MaterialIcons name="arrow-forward" size={16} color="#666" />
                    )}
                  </React.Fragment>
                ))}
              </View>
            </LinearGradient>
          </View>
        )}
      </View>
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
                  <MaterialIcons name="home" size={24} color="#fff" />
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
                    <MaterialIcons name="exit-to-app" size={60} color="#FF6B6B" />
                  </View>
                  
                  <Text style={styles.loadingTitle}>Leaving Game...</Text>
                  <Text style={styles.loadingSubtitle}>Processing your request</Text>
                  
                  <View style={styles.spinnerContainer}>
                    <ActivityIndicator size="large" color="#FF6B6B" />
                  </View>
                  
                  <View style={styles.warningContainer}>
                    <MaterialIcons name="warning" size={16} color="#FFA500" />
                    <Text style={styles.warningText}>Please don't close the app</Text>
                  </View>
                </LinearGradient>
              </View>
            </LinearGradient>
          </View>
        </Modal>
      )}

      {/* Header */}
      <Animated.View style={[
        styles.header,
        { transform: [{ translateY: slideInAnim }] }
      ]}>
        <TouchableOpacity 
          style={[
            styles.backButton,
            isLeavingGame && { opacity: 0.5 }
          ]} 
          onPress={handleBackPress}
          disabled={isLeavingGame}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.gameTitle}>Lucky Number</Text>
          <Text style={styles.gameSubtitle}>Roll Your Destiny</Text>
        </View>
        
        <View style={styles.stakeContainer}>
          <MaterialIcons name="diamond" size={18} color="#FFD700" />
          <Text style={styles.stakeText}>₹{stake}</Text>
        </View>
      </Animated.View>

      {/* Main Game Area */}
      <Animated.View style={[
        styles.gameArea,
        { transform: [{ translateY: slideInAnim }] }
      ]}>
        {renderGameArea()}
      </Animated.View>

      {/* Roll Button */}
      {gameState === 'rolling' && rollsLeft > 0 && !showResult && !isFinalizingGame && (
        <Animated.View style={[
          styles.actionContainer,
          { transform: [{ translateY: slideInAnim }] }
        ]}>
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
                  size={32} 
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
        </Animated.View>
      )}

      {/* Result Modal */}
      {renderResult()}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
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
    width: 200,
    height: 200,
    backgroundColor: '#4ECDC4',
    top: 100,
    left: -50,
  },
  element2: {
    width: 150,
    height: 150,
    backgroundColor: '#FFD700',
    top: 400,
    right: -30,
  },
  element3: {
    width: 180,
    height: 180,
    backgroundColor: '#8B5CF6',
    bottom: 200,
    left: -40,
  },
  confetti: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    left: '50%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
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
  gameSubtitle: {
    fontSize: 14,
    color: '#4ECDC4',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
    opacity: 0.9,
  },
  stakeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  stakeText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
  },
  gameArea: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  gameContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  gameStatusContainer: {
    marginBottom: 40,
  },
  gameStatusCard: {
    padding: 25,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusItem: {
    flex: 1,
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '900',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  targetBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  targetNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  rollsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  rollDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  rollDotActive: {
    backgroundColor: 'rgba(76, 205, 196, 0.2)',
    borderColor: '#4ECDC4',
  },
  rollDotUsed: {
    backgroundColor: 'rgba(102, 102, 102, 0.2)',
    borderColor: '#666',
  },
  prizeAmount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(139, 92, 246, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  diceArena: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 40,
    position: 'relative',
    minHeight: 250,
  },
  diceGlowRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
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
    width: 180,
    height: 180,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    top: -15,
    left: -15,
    zIndex: -1,
  },
  dice: {
    width: 150,
    height: 150,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  diceInner: {
    width: '90%',
    height: '90%',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  diceIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  rollingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleText: {
    fontSize: 20,
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  resultMessage: {
    position: 'absolute',
    bottom: -80,
    left: -50,
    right: -50,
    alignItems: 'center',
  },
  resultMessageCard: {
    padding: 15,
    borderRadius: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  resultMessageText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  historyContainer: {
    marginTop: 20,
  },
  historyCard: {
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  historyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 15,
    textShadowColor: 'rgba(139, 92, 246, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
    letterSpacing: 0.5,
  },
  historyTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  historyDot: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
  },
  historyDotWin: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderColor: '#FFD700',
    borderWidth: 3,
    elevation: 8,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  historyDotText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  historyDotTextWin: {
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
  },
  winCrown: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  crownText: {
    fontSize: 16,
  },
  actionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  rollButton: {
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 15,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
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
    paddingVertical: 20,
    paddingHorizontal: 30,
  },
  rollButtonTextContainer: {
    marginLeft: 15,
    alignItems: 'center',
  },
  rollButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  rollButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  // Result Modal Styles
  resultOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  resultContainer: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 30,
    overflow: 'hidden',
    elevation: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
  },
  resultCard: {
    padding: 40,
    alignItems: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 25,
  },
  resultEmoji: {
    fontSize: 70,
    marginBottom: 15,
  },
  resultTitle: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
    letterSpacing: 1,
  },
  resultAmountContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  resultAmount: {
    fontSize: 40,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  resultSubtext: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
    opacity: 0.9,
    lineHeight: 22,
  },
  homeButton: {
    borderRadius: 20,
    overflow: 'hidden',
    width: '100%',
  },
  homeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 25,
  },
  homeButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 10,
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
    width: '85%',
    maxWidth: 320,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
  },
  loadingCardGradient: {
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  exitIconContainer: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 107, 107, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 30,
    textAlign: 'center',
    fontWeight: '500',
  },
  spinnerContainer: {
    marginBottom: 25,
    padding: 10,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 165, 0, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 165, 0, 0.3)',
  },
  warningText: {
    fontSize: 12,
    color: '#FFA500',
    marginLeft: 6,
    fontWeight: '600',
  },
});