// app/games/six-king.js
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  Alert,
  BackHandler
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';

const { width, height } = Dimensions.get('window');

export default function SixKingGame() {
  const { stake } = useLocalSearchParams();
  const { user, updateWallet } = useAuth();
  
  const [gameState, setGameState] = useState('waiting');
  const [playerSixes, setPlayerSixes] = useState(0);
  const [opponentSixes, setOpponentSixes] = useState(0);
  const [currentTurn, setCurrentTurn] = useState('player');
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState(null);
  const [opponentName] = useState(`Player${Math.floor(Math.random() * 9999)}`);
  const [showSixEffect, setShowSixEffect] = useState(false);
  const [rollCount, setRollCount] = useState(0);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false); // New state to prevent multiple turns

  // Animations
  const diceRotation = useRef(new Animated.Value(0)).current;
  const diceScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sixEffectAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const firstTurn = Math.random() > 0.5 ? 'player' : 'opponent';
    setCurrentTurn(firstTurn);
    setGameState('playing');

    if (firstTurn === 'opponent') {
      setTimeout(() => rollOpponentDice(), 1000);
    }

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, []);

  // Simplified opponent turn handler
  useEffect(() => {
    if (currentTurn === 'opponent' && gameState === 'playing' && !isRolling && !isProcessingTurn) {
      const timer = setTimeout(() => {
        if (currentTurn === 'opponent' && !isRolling && !isProcessingTurn) {
          rollOpponentDice();
        }
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [currentTurn, gameState, isRolling, isProcessingTurn]);

  useEffect(() => {
    if (playerSixes >= 3) {
      setWinner('player');
      setGameState('finished');
      handleGameEnd('player');
    } else if (opponentSixes >= 3) {
      setWinner('opponent');
      setGameState('finished');
      handleGameEnd('opponent');
    }
  }, [playerSixes, opponentSixes]);

  // Pulse animation for current turn
  useEffect(() => {
    if (gameState === 'playing') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [currentTurn, gameState]);

  // Reduced six effect animation (only for final 6)
  useEffect(() => {
    if (showSixEffect) {
      Animated.sequence([
        Animated.timing(sixEffectAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(sixEffectAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showSixEffect]);

  // Dice glow effect for six (only when not rolling)
  useEffect(() => {
    if (diceValue === 6 && !isRolling) {
      const glowAnimation = Animated.loop(
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
      );
      glowAnimation.start();
      return () => glowAnimation.stop();
    } else {
      glowAnim.setValue(0);
    }
  }, [diceValue, isRolling]);

  const handleBackPress = () => {
    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave? You will lose your stake.',
      [
        { text: 'Stay', style: 'cancel' },
        { text: 'Leave', style: 'destructive', onPress: () => router.back() }
      ]
    );
    return true;
  };

  const rollDice = () => {
    if (gameState !== 'playing' || currentTurn !== 'player' || isRolling || isProcessingTurn) return;

    setIsProcessingTurn(true); // Prevent multiple rolls
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRolling(true);
    setRollCount(prev => prev + 1);
    
    // Reset dice to white before rolling
    setDiceValue(1);

    // Enhanced rolling animation
    const rotationAnimation = Animated.timing(diceRotation, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    });

    const scaleAnimation = Animated.sequence([
      Animated.timing(diceScale, {
        toValue: 1.3,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(diceScale, {
        toValue: 0.9,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(diceScale, {
        toValue: 1.1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(diceScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]);

    // Generate final value first
    // const finalValue = Math.floor(Math.random() * 6) + 1;
    const finalValue = 6;
    // Simulate rolling with multiple value changes
    let rollCounter = 0;
    const rollInterval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      rollCounter++;
      
      if (rollCounter >= 10) {
        clearInterval(rollInterval);
        // Smoothly transition to final value
        setTimeout(() => {
          setDiceValue(finalValue);
        }, 100);
      }
    }, 120);

    Animated.parallel([rotationAnimation, scaleAnimation]).start(() => {
      setIsRolling(false);
      diceRotation.setValue(0);
      
      // Process result after animation completes
      setTimeout(() => {
        if (finalValue === 6) {
          setPlayerSixes(prev => {
            const newCount = prev + 1;
            // Only show celebration for the final winning 6
            if (newCount >= 3) {
              setShowSixEffect(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setTimeout(() => setShowSixEffect(false), 1000);
            } else {
              // Just a subtle haptic for regular 6
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }
            return newCount;
          });
        }
        
        // Always change turn after processing result
        setTimeout(() => {
          setCurrentTurn('opponent');
          setIsProcessingTurn(false);
        }, finalValue === 6 ? 1000 : 500);
      }, 200);
    });
  };

  const rollOpponentDice = () => {
    if (gameState !== 'playing' || currentTurn !== 'opponent' || isRolling || isProcessingTurn) {
      return;
    }

    setIsProcessingTurn(true); // Prevent multiple rolls
    setIsRolling(true);
    setRollCount(prev => prev + 1);
    
    // Reset dice to white before rolling
    setDiceValue(1);
    
    // Enhanced opponent rolling animation
    const rotationAnimation = Animated.timing(diceRotation, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    });

    const scaleAnimation = Animated.sequence([
      Animated.timing(diceScale, {
        toValue: 1.3,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(diceScale, {
        toValue: 0.9,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(diceScale, {
        toValue: 1.1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(diceScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]);

    // Generate final value first
    const finalValue = Math.floor(Math.random() * 6) + 1;

    // Simulate rolling with multiple value changes for opponent
    let rollCounter = 0;
    const rollInterval = setInterval(() => {
      setDiceValue(Math.floor(Math.random() * 6) + 1);
      rollCounter++;
      
      if (rollCounter >= 10) {
        clearInterval(rollInterval);
        // Smoothly transition to final value
        setTimeout(() => {
          setDiceValue(finalValue);
        }, 100);
      }
    }, 120);

    Animated.parallel([rotationAnimation, scaleAnimation]).start(() => {
      setIsRolling(false);
      diceRotation.setValue(0);
      
      // Process opponent result after animation completes
      setTimeout(() => {
        if (finalValue === 6) {
          setOpponentSixes(prev => {
            const newCount = prev + 1;
            // Only show celebration for the final winning 6
            if (newCount >= 3) {
              setShowSixEffect(true);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setTimeout(() => setShowSixEffect(false), 1000);
            } else {
              // Just a subtle haptic for regular 6
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            return newCount;
          });
        }
        
        // Always change turn back to player after processing
        setTimeout(() => {
          setCurrentTurn('player');
          setIsProcessingTurn(false);
        }, finalValue === 6 ? 1000 : 500);
      }, 200);
    });
  };

  const handleGameEnd = async (winner) => {
    const stakeAmount = parseInt(stake);
    
    if (winner === 'player') {
      const winAmount = stakeAmount * 2;
      await updateWallet(user.wallet + winAmount);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setTimeout(() => {
        Alert.alert(
          '🎉 Congratulations!',
          `You are the Six King! Amazing victory!`,
          [{ text: 'Continue', onPress: () => router.back() }]
        );
      }, 2000);
    } else {
      await updateWallet(user.wallet - stakeAmount);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      setTimeout(() => {
        Alert.alert(
          '😔 Better luck next time!',
          `The opponent claimed the crown this time. Try again!`,
          [{ text: 'Continue', onPress: () => router.back() }]
        );
      }, 2000);
    }
  };

  const getDiceIcon = (value) => {
    const icons = ['', 'looks-one', 'looks-two', 'looks-3', 'looks-4', 'looks-5', 'looks-6'];
    return icons[value];
  };

  const renderSixesProgress = (count, isPlayer) => {
    return (
      <View style={styles.sixesContainer}>
        {[1, 2, 3].map((index) => (
          <Animated.View
            key={index}
            style={[
              styles.crownBadge,
              count >= index ? styles.crownBadgeActive : styles.crownBadgeInactive,
              count >= index && {
                transform: [{
                  scale: sparkleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.2],
                  })
                }]
              }
            ]}
          >
            <MaterialIcons 
              name="military-tech" 
              size={18} 
              color={count >= index ? '#FFD700' : '#666'} 
            />
          </Animated.View>
        ))}
      </View>
    );
  };

  // Helper function to determine if player can roll
  const canPlayerRoll = () => {
    return currentTurn === 'player' && 
           gameState === 'playing' && 
           !isRolling && 
           !isProcessingTurn;
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
      style={styles.container}
    >
      {/* Animated Background Elements */}
      <View style={styles.backgroundElements}>
        <Animated.View style={[styles.floatingElement, styles.element1]} />
        <Animated.View style={[styles.floatingElement, styles.element2]} />
        <Animated.View style={[styles.floatingElement, styles.element3]} />
      </View>

      {/* Six Effect Overlay - Only for winning */}
      {showSixEffect && (
        <Animated.View 
          style={[
            styles.sixEffectOverlay,
            {
              opacity: sixEffectAnim,
              transform: [{
                scale: sixEffectAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1.5],
                })
              }]
            }
          ]}
        >
          <Text style={styles.sixEffectText}>
            {winner === 'player' ? '🎉 YOU WON! 🎉' : '😔 OPPONENT WINS! 😔'}
          </Text>
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.3)', 'transparent']}
            style={styles.sixEffectGlow}
          />
        </Animated.View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.gameTitle}>🎲 SIX KING 👑</Text>
          <Text style={styles.rollCounter}>Roll #{rollCount}</Text>
        </View>
        
        <View style={styles.stakeContainer}>
          <MaterialIcons name="monetization-on" size={20} color="#FFD700" />
          <Text style={styles.stakeText}>₹{stake}</Text>
        </View>
      </View>

      {/* Players Section */}
      <View style={styles.playersContainer}>
        {/* Opponent */}
        <Animated.View 
          style={[
            styles.playerCard,
            styles.opponentCard,
            currentTurn === 'opponent' && { 
              transform: [{ scale: pulseAnim }],
              shadowOpacity: 0.6,
            }
          ]}
        >
          <LinearGradient
            colors={['rgba(255, 107, 107, 0.3)', 'rgba(255, 107, 107, 0.1)']}
            style={styles.playerCardGradient}
          >
            <View style={styles.playerAvatar}>
              <Text style={styles.avatarEmoji}>🤖</Text>
            </View>
            <Text style={styles.playerName}>{opponentName}</Text>
            {renderSixesProgress(opponentSixes, false)}
            {currentTurn === 'opponent' && (
              <View style={styles.turnIndicator}>
                <MaterialIcons name="flash-on" size={16} color="#FFD700" />
                <Text style={styles.turnIndicatorText}>
                  {isRolling ? 'Rolling...' : 'Thinking...'}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* VS Badge */}
        <LinearGradient
          colors={['#8B5CF6', '#EC4899']}
          style={styles.vsContainer}
        >
          <Text style={styles.vsText}>VS</Text>
        </LinearGradient>

        {/* Player */}
        <Animated.View 
          style={[
            styles.playerCard,
            styles.playerCardSelf,
            currentTurn === 'player' && { 
              transform: [{ scale: pulseAnim }],
              shadowOpacity: 0.6,
            }
          ]}
        >
          <LinearGradient
            colors={['rgba(78, 205, 196, 0.3)', 'rgba(78, 205, 196, 0.1)']}
            style={styles.playerCardGradient}
          >
            <View style={styles.playerAvatar}>
              <Text style={styles.avatarEmoji}>👤</Text>
            </View>
            <Text style={styles.playerName}>You</Text>
            {renderSixesProgress(playerSixes, true)}
            {currentTurn === 'player' && !isRolling && !isProcessingTurn && (
              <View style={styles.turnIndicator}>
                <MaterialIcons name="flash-on" size={16} color="#FFD700" />
                <Text style={styles.turnIndicatorText}>Your Turn!</Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Dice Section */}
      <View style={styles.diceSection}>
        <Animated.View
          style={[
            styles.diceContainer,
            {
              transform: [
                { scale: diceScale },
                {
                  rotate: diceRotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '720deg'],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Rainbow glow effect for six */}
          {diceValue === 6 && !isRolling && (
            <>
              <Animated.View 
                style={[
                  styles.diceGlowOuter,
                  {
                    opacity: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.4, 0.8],
                    }),
                  }
                ]}
              />
              <Animated.View 
                style={[
                  styles.diceGlowInner,
                  {
                    opacity: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  }
                ]}
              />
            </>
          )}
          
          {/* Colorful dice with enhanced design */}
          <LinearGradient
            colors={diceValue === 6 && !isRolling 
              ? ['#FFD700', '#FF6B35', '#F7931E'] 
              : ['#667eea', '#764ba2', '#f093fb']
            }
            style={styles.dice}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Inner border for premium look */}
            <View style={styles.diceInnerBorder}>
              <MaterialIcons
                name={getDiceIcon(diceValue)}
                size={55}
                color={diceValue === 6 && !isRolling ? '#FFFFFF' : '#FFFFFF'}
                style={styles.diceIcon}
              />
            </View>
            
            {/* Shine effect */}
            <LinearGradient
              colors={['rgba(255,255,255,0.3)', 'transparent', 'rgba(255,255,255,0.1)']}
              style={styles.diceShine}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </LinearGradient>
          
          {/* Sparkle effects for six */}
          {diceValue === 6 && !isRolling && (
            <>
              <Animated.View 
                style={[
                  styles.sparkle,
                  { top: -10, right: 10 },
                  {
                    opacity: glowAnim,
                    transform: [{
                      rotate: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg'],
                      })
                    }]
                  }
                ]}
              >
                <Text style={styles.sparkleEmoji}>✨</Text>
              </Animated.View>
              <Animated.View 
                style={[
                  styles.sparkle,
                  { bottom: -5, left: 15 },
                  {
                    opacity: glowAnim,
                    transform: [{
                      rotate: glowAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['180deg', '540deg'],
                      })
                    }]
                  }
                ]}
              >
                <Text style={styles.sparkleEmoji}>⭐</Text>
              </Animated.View>
            </>
          )}
        </Animated.View>

        {/* Simplified six text - only show for regular 6s, not winning ones */}
        {diceValue === 6 && !isRolling && (playerSixes < 3 && opponentSixes < 3) && (
          <View style={styles.sixTextContainer}>
            <Text style={styles.sixText}>Crown Earned! 👑</Text>
          </View>
        )}
      </View>

      {/* Action Container */}
      <View style={styles.actionContainer}>
        {canPlayerRoll() && (
          <TouchableOpacity
            style={styles.rollButton}
            onPress={rollDice}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#4ECDC4', '#44A08D', '#2ECC71']}
              style={styles.rollButtonGradient}
            >
              <MaterialIcons 
                name="casino" 
                size={28} 
                color="#fff" 
              />
              <Text style={styles.rollButtonText}>
                ROLL DICE
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {!canPlayerRoll() && gameState === 'playing' && (
          <View style={styles.disabledButtonContainer}>
            <LinearGradient
              colors={['#6c757d', '#495057', '#343a40']}
              style={styles.rollButtonGradient}
            >
              <MaterialIcons 
                name={isRolling ? "autorenew" : currentTurn === 'opponent' ? "hourglass-empty" : "pause"} 
                size={28} 
                color="#adb5bd" 
              />
              <Text style={styles.disabledButtonText}>
                {isRolling && currentTurn === 'player'
                  ? 'ROLLING...' 
                  : currentTurn === 'opponent' && isRolling
                  ? 'OPPONENT ROLLING...' 
                  : currentTurn === 'opponent'
                  ? 'OPPONENT TURN...'
                  : 'WAITING...'}
              </Text>
            </LinearGradient>
          </View>
        )}
      </View>

      {/* Game Status */}
      <View style={styles.statusContainer}>
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
          style={styles.statusCard}
        >
          <Text style={styles.statusText}>
            🎯 First to collect 3 crowns wins ₹{parseInt(stake) * 2}!
          </Text>
          <Text style={styles.statusSubText}>
            Roll a 6 to earn a crown
          </Text>
        </LinearGradient>
      </View>
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
    opacity: 0.1,
  },
  element1: {
    width: 200,
    height: 200,
    backgroundColor: '#8B5CF6',
    top: -50,
    left: -50,
  },
  element2: {
    width: 150,
    height: 150,
    backgroundColor: '#EC4899',
    top: 200,
    right: -30,
  },
  element3: {
    width: 180,
    height: 180,
    backgroundColor: '#06D6A0',
    bottom: 100,
    left: -40,
  },
  sixEffectOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  sixEffectText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  sixEffectGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },
  backButton: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    width: 60,
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 15,
  },
  gameTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    marginTop: 14,
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    letterSpacing: 1,
    background: 'linear-gradient(45deg, #FFD700, #FF6B35, #8B5CF6)',
  },
  rollCounter: {
    fontSize: 14,
    color: '#FFD700',
    marginTop: 4,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  rollCounter: {
    fontSize: 14,
    color: '#FFD700',
    marginTop: 2,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  stakeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)'
  },
  stakeText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  playersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  playerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  opponentCard: {
    borderWidth: 2,
    borderColor: 'rgba(255, 107, 107, 0.5)',
  },
  playerCardSelf: {
    borderWidth: 2,
    borderColor: 'rgba(78, 205, 196, 0.5)',
  },
  playerCardGradient: {
    padding: 20,
    alignItems: 'center',
    minWidth: 130,
  },
  playerAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarEmoji: {
    fontSize: 28,
  },
  playerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  sixesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 8,
  },
  crownBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    borderWidth: 1,
  },
  crownBadgeActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  crownBadgeInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: '#666',
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  turnIndicatorText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  vsContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  vsText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  diceSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diceContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  diceGlowOuter: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 25,
    backgroundColor: '#FF6B35',
    top: -15,
    left: -15,
  },
  diceGlowInner: {
    position: 'absolute',
    width: 135,
    height: 135,
    borderRadius: 22,
    backgroundColor: '#FFD700',
    top: -7.5,
    left: -7.5,
  },
  dice: {
    width: 120,
    height: 120,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 15,
    overflow: 'hidden',
  },
  diceInnerBorder: {
    width: '90%',
    height: '90%',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  diceShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
  },
  diceIcon: {
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleEmoji: {
    fontSize: 16,
  },
  sixTextContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  sixText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  sixSubText: {
    fontSize: 14,
    color: '#FFF8DC',
    textAlign: 'center',
    marginTop: 4,
  },
  actionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  rollButton: {
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  disabledButtonContainer: {
    borderRadius: 25,
    overflow: 'hidden',
    opacity: 0.8,
  },
  rollButtonDisabled: {
    opacity: 0.7,
  },
  rollButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  rollButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  disabledButtonText: {
    color: '#adb5bd',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
  },
  waitingText: {
    color: '#888',
    fontSize: 16,
    marginLeft: 8,
  },
  statusContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  statusCard: {
    borderRadius: 15,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  statusSubText: {
    color: '#BBB',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});