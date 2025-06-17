// app/games/lucky-number.js
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
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';

const { width, height } = Dimensions.get('window');

export default function LuckyNumberGame() {
  const { stake } = useLocalSearchParams();
  const { user, updateWallet } = useAuth();
  
  const [gameState, setGameState] = useState('selecting'); // selecting, rolling, finished
  const [luckyNumber, setLuckyNumber] = useState(null);
  const [rollsLeft, setRollsLeft] = useState(2);
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [hasWon, setHasWon] = useState(false);
  const [rollHistory, setRollHistory] = useState([]);
  const [showResult, setShowResult] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const [isCheckingResult, setIsCheckingResult] = useState(false);

  const diceRotation = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const confettiAnim = useRef(new Animated.Value(0)).current;
  const floatingAnim = useRef(new Animated.Value(0)).current;

  const floatingAnimX = useRef(new Animated.Value(0)).current;
  const floatingAnimY = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  // Confetti particles
  const confettiParticles = Array(20).fill(0).map((_, i) => ({
    id: i,
    translateX: new Animated.Value(Math.random() * width - width/2), // Center the range
    translateY: new Animated.Value(-10),
    rotation: new Animated.Value(Math.random() * 360),
    scale: new Animated.Value(0.8 + Math.random() * 0.7),
    opacity: new Animated.Value(0),
    color: ['#FFD700', '#4ECDC4', '#FF6B6B', '#FFFFFF'][Math.floor(Math.random() * 4)]
  }));

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if (gameState === 'selecting') {
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
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'rolling') {
      const floatingAnimation = Animated.loop(
        Animated.parallel([
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
          ]),
          Animated.sequence([
            Animated.timing(floatingAnimX, {
              toValue: 1,
              duration: 3500,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(floatingAnimX, {
              toValue: 0,
              duration: 3500,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      floatingAnimation.start();
      return () => floatingAnimation.stop();
    }
  }, [gameState]);

  useEffect(() => {
    if (hasWon) {
      confettiParticles.forEach(particle => {
        Animated.sequence([
          Animated.timing(particle.opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(particle.translateY, {
              toValue: height + 10,
              duration: 3000,
              easing: Easing.linear,
              useNativeDriver: true,
            }),
            Animated.timing(particle.rotation, {
              toValue: particle.rotation._value + 360,
              duration: 3000,
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
      });
    }
  }, [hasWon]);

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

  const selectLuckyNumber = (number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLuckyNumber(number);
    setGameState('rolling');
    setWinAmount(Math.floor(parseInt(stake) * 2.5));
  };

  const createBiasedDice = (luckyNum) => {
    const baseDice = [1, 2, 3, 4, 5, 6];
    const biasedDice = [...baseDice];
    
    if (luckyNum === 1) {
      biasedDice.push(2, 2);
    } else if (luckyNum === 6) {
      biasedDice.push(5, 5);
    } else {
      biasedDice.push(luckyNum - 1, luckyNum + 1);
    }
    
    return biasedDice;
  };

  const rollDice = () => {
    if (gameState !== 'rolling' || isRolling || rollsLeft <= 0) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRolling(true);
    setDiceValue(null); // Clear dice during roll

    const rotationAnimation = Animated.timing(diceRotation, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    });

    const scaleAnimation = Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.3,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]);

    Animated.parallel([rotationAnimation, scaleAnimation]).start(() => {
      const biasedDice = createBiasedDice(luckyNumber);
      const randomIndex = Math.floor(Math.random() * biasedDice.length);
      const newValue = biasedDice[randomIndex];
      
      setDiceValue(newValue);
      setRollHistory(prev => [...prev, newValue]);
      setRollsLeft(prev => prev - 1);
      
      if (newValue === luckyNumber) {
        setHasWon(true);
        handleGameEnd(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else if (rollsLeft - 1 <= 0) {
        // Add 1s delay before showing result after second roll
        setIsCheckingResult(true);
        setTimeout(() => {
          handleGameEnd(false);
          setIsCheckingResult(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }, 1000);
      }

      setIsRolling(false);
      diceRotation.setValue(0);
    });
  };

  const handleGameEnd = async (won) => {
    const stakeAmount = parseInt(stake);
    
    if (won) {
      await updateWallet(user.wallet + winAmount);
      Animated.timing(resultAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else {
      await updateWallet(user.wallet - stakeAmount);
      Animated.timing(resultAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
    
    setShowResult(true);
  };

  const resetGame = () => {
    setShowResult(false);
    setGameState('selecting');
    setLuckyNumber(null);
    setRollsLeft(2);
    setDiceValue(1);
    setHasWon(false);
    setRollHistory([]);
    resultAnim.setValue(0);
    confettiAnim.setValue(0);
    setIsCheckingResult(false);
  };

  const getDiceIcon = (value) => {
    const icons = ['', 'looks-one', 'looks-two', 'looks-3', 'looks-4', 'looks-5', 'looks-6'];
    return icons[value];
  };

  const renderNumberSelection = () => {
    return (
      <View style={styles.numberSelectionContainer}>
        <LinearGradient
          colors={['rgba(255, 215, 0, 0.2)', 'rgba(34, 0, 255, 0.1)']}
          style={styles.instructionCard}
        >
          <Text style={styles.instructionTitle}>🎯 Choose Your Lucky Number!</Text>
          <Text style={styles.instructionSubtext}>Pick the number you believe in ✨</Text>
        </LinearGradient>
        
        <View style={styles.numbersGrid}>
          {[1, 2, 3, 4, 5, 6].map((number) => (
            <Animated.View
              key={number}
              style={{ transform: [{ scale: pulseAnim }] }}
            >
              <TouchableOpacity
                style={styles.numberButton}
                onPress={() => selectLuckyNumber(number)}
              >
                <LinearGradient
                  colors={['#667eea', '#764ba2', '#f093fb']}
                  style={styles.numberButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <View style={styles.numberButtonInner}>
                    <Text style={styles.numberButtonText}>{number}</Text>
                    <View style={styles.numberShine} />
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <LinearGradient
          colors={['rgba(16, 17, 96, 0.15)', 'rgba(76, 205, 196, 0.1)']}
          style={styles.selectionInfoCard}
        >
          <View style={styles.infoRow}>
            <MaterialIcons name="casino" size={24} color="#4ECDC4" />
            <Text style={styles.infoText}>You get 2 chances to roll your number!</Text>
          </View>
          <View style={styles.infoRow}>
            <MaterialIcons name="monetization-on" size={24} color="#FFD700" />
            <Text style={styles.infoText}>Win ₹{Math.floor(parseInt(stake) * 2.5)} if you succeed!</Text>
          </View>
        </LinearGradient>
      </View>
    );
  };

  const renderDice = () => {
    return (
      <View style={styles.diceGameContainer}>
        {/* Animated background elements */}
        <Animated.View style={[
          styles.floatingOrb, 
          styles.orb1,
          {
            transform: [
              { 
                translateY: floatingAnimY.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -20]
                })
              },
              {
                translateX: floatingAnimX.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 10]
                })
              }
            ]
          }
        ]} />

        <Animated.View style={[
          styles.floatingOrb, 
          styles.orb2,
          {
            transform: [
              { 
                translateY: floatingAnimY.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 15]
                })
              },
              {
                translateX: floatingAnimX.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10]
                })
              }
            ]
          }
        ]} />

        {/* Main game status */}
        <View style={styles.gameStatusContainer}>
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.3)', 'rgba(76, 205, 196, 0.2)']}
            style={styles.gameStatusCard}
          >
            <View style={styles.statusRow}>
              <View style={styles.targetNumberDisplay}>
                <Text style={styles.targetLabel}>🎯 TARGET</Text>
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  style={styles.targetNumberBadge}
                >
                  <Text style={styles.targetNumber}>{luckyNumber}</Text>
                </LinearGradient>
              </View>
              
              <View style={styles.rollsDisplay}>
                <Text style={styles.rollsLabel}>🎲 ROLLS</Text>
                <View style={styles.rollIndicators}>
                  {[1, 2].map((roll) => (
                    <View
                      key={roll}
                      style={[
                        styles.rollIndicator,
                        rollsLeft >= roll ? styles.rollActive : styles.rollUsed
                      ]}
                    >
                      <MaterialIcons 
                        name="casino" 
                        size={16} 
                        color={rollsLeft >= roll ? "#4ECDC4" : "#666"} 
                      />
                    </View>
                  ))}
                </View>
              </View>

              <View style={styles.prizeDisplay}>
                <Text style={styles.prizeLabel}>💎 PRIZE</Text>
                <Text style={styles.prizeAmount}>₹{winAmount}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Enhanced dice area */}
        <View style={styles.diceArena}>
          <Animated.View style={[
            styles.diceGlowRing,
            {
              opacity: glowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.8]
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
                  { scale: scaleAnim },
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
            {/* Enhanced dice glow effect */}
            {diceValue === luckyNumber && (
              <Animated.View style={[
                styles.winGlow,
                {
                  opacity: glowAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1]
                  })
                }
              ]} />
            )}
            
            <LinearGradient
              colors={
                diceValue === luckyNumber
                  ? ['#FFD700', '#FFA500', '#FF6B35']
                  : isRolling
                  ? ['#8B5CF6', '#A855F7', '#C084FC']
                  : ['#4ECDC4', '#44A08D', '#2ECC71']
              }
              style={styles.dice}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.diceInner}>
                {diceValue && !isRolling && (
                  <MaterialIcons
                    name={getDiceIcon(diceValue)}
                    size={80}
                    color="#fff"
                    style={styles.diceIcon}
                  />
                )}
                {isRolling && (
                  <>
                    <MaterialIcons
                      name="autorenew"
                      size={80}
                      color="#fff"
                      style={[styles.diceIcon, styles.spinningIcon]}
                    />
                    <Text style={styles.rollingText}>ROLLING...</Text>
                  </>
                )}
              </View>
              <View style={styles.diceShine} />
            </LinearGradient>
            
            {/* Enhanced sparkles for winning dice */}
            {diceValue === luckyNumber && (
              <>
                <Animated.View style={[
                  styles.sparkle, 
                  { marginTop: -15, marginRight: 15, alignSelf: 'flex-end' },
                  {
                    transform: [{
                      rotate: floatingAnim.interpolate({
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
                  { marginBottom: -15, marginLeft: 15, alignSelf: 'flex-start' },
                  {
                    transform: [{
                      rotate: floatingAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['360deg', '0deg']
                      })
                    }]
                  }
                ]}>
                  <Text style={styles.sparkleText}>⭐</Text>
                </Animated.View>
                <Animated.View style={[
                  styles.sparkle, 
                  { marginTop: 20, marginLeft: -15, alignSelf: 'flex-start' },
                  {
                    transform: [{
                      scale: floatingAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.3]
                      })
                    }]
                  }
                ]}>
                  <Text style={styles.sparkleText}>💫</Text>
                </Animated.View>
              </>
            )}
          </Animated.View>

          {/* Roll result message */}
          {diceValue && !isRolling && (
            <Animated.View style={[
              styles.rollResultMessage,
              {
                opacity: scaleAnim.interpolate({
                  inputRange: [1, 1.3],
                  outputRange: [0, 1],
                  extrapolate: 'clamp'
                })
              }
            ]}>
              <LinearGradient
                colors={
                  diceValue === luckyNumber
                    ? ['rgba(255, 215, 0, 0.3)', 'rgba(255, 165, 0, 0.2)']
                    : ['rgba(255, 107, 107, 0.3)', 'rgba(255, 142, 83, 0.2)']
                }
                style={styles.resultMessageCard}
              >
                <Text style={styles.resultMessageText}>
                  {diceValue === luckyNumber 
                    ? `🎉 JACKPOT! You hit ${luckyNumber}!` 
                    : `💔 You rolled ${diceValue}, not ${luckyNumber}`
                  }
                </Text>
              </LinearGradient>
            </Animated.View>
          )}
        </View>

        {/* Enhanced roll history */}
        {rollHistory.length > 0 && (
          <View style={styles.rollHistoryContainer}>
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
              style={styles.rollHistoryCard}
            >
              <Text style={styles.rollHistoryTitle}>🎲 Your Journey</Text>
              <View style={styles.rollHistoryTrail}>
                {rollHistory.map((roll, index) => (
                  <React.Fragment key={index}>
                    <View
                      style={[
                        styles.historyDot,
                        roll === luckyNumber && styles.historyDotWin
                      ]}
                    >
                      <Text style={[
                        styles.historyDotText,
                        roll === luckyNumber && styles.historyDotTextWin
                      ]}>
                        {roll}
                      </Text>
                      {roll === luckyNumber && (
                        <View style={styles.winCrown}>
                          <Text style={styles.crownText}>👑</Text>
                        </View>
                      )}
                    </View>
                    {index < rollHistory.length - 1 && (
                      <MaterialIcons name="arrow-forward" size={20} color="#666" />
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
      <Animated.View style={[
        styles.resultContainer,
        { opacity: resultAnim }
      ]}>
        <LinearGradient
          colors={hasWon ? ['#4ECDC4', '#44A08D', '#2ECC71'] : ['#FF6B6B', '#FF8E53', '#FF6B35']}
          style={styles.resultCard}
        >
          <View style={styles.resultHeader}>
            <Text style={styles.resultEmoji}>
              {hasWon ? '🎉' : '😔'}
            </Text>
            <Text style={styles.resultTitle}>
              {hasWon ? 'JACKPOT!' : 'ALMOST THERE!'}
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
          
          <View style={styles.resultButtons}>
            <TouchableOpacity 
              style={styles.playAgainButton}
              onPress={resetGame}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)']}
                style={styles.resultButtonGradient}
              >
                <MaterialIcons name="refresh" size={20} color="#fff" />
                <Text style={styles.playAgainText}>Try Again</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.exitButton}
              onPress={() => router.back()}
            >
              <View style={styles.exitButtonInner}>
                <MaterialIcons name="exit-to-app" size={20} color="#fff" />
                <Text style={styles.exitText}>Exit</Text>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
      style={styles.container}
    >
      {/* Floating background elements */}
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
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg']
                  })
                },
                { scale: particle.scale }
              ],
              opacity: particle.opacity,
            }
          ]}
        />
      ))}

      {/* Enhanced Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.gameTitle}>LUCKY NUMBER</Text>
        </View>
        
        <View style={styles.stakeContainer}>
          <MaterialIcons name="monetization-on" size={20} color="#FFD700" />
          <Text style={styles.stakeText}>₹{stake}</Text>
        </View>
      </View>

      {/* Main Game Area */}
      <View style={styles.gameArea}>
        {gameState === 'selecting' && renderNumberSelection()}
        {gameState === 'rolling' && !showResult && renderDice()}
        {showResult && renderResult()}
      </View>

      {/* Enhanced Action Button */}
      {gameState === 'rolling' && rollsLeft > 0 && !showResult && !isCheckingResult && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.rollButton, isRolling && styles.rollButtonDisabled]}
            onPress={rollDice}
            disabled={isRolling}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#4ECDC4', '#44A08D', '#2ECC71']}
              style={styles.rollButtonGradient}
            >
              <View style={styles.rollButtonContent}>
                <MaterialIcons 
                  name={isRolling ? "autorenew" : "casino"} 
                  size={28} 
                  color="#fff" 
                />
                <View style={styles.rollButtonTextContainer}>
                  <Text style={styles.rollButtonText}>
                    {isRolling ? 'ROLLING...' : 'ROLL DICE'}
                  </Text>
                  <Text style={styles.rollButtonSubtext}>
                    {isRolling ? 'Good luck! 🤞' : `${rollsLeft} chance${rollsLeft > 1 ? 's' : ''} left`}
                  </Text>
                </View>
              </View>
              <View style={styles.rollButtonGlow} />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Enhanced Game Rules - only show on selection screen */}
      {gameState === 'selecting' && (
        <View style={styles.rulesContainer}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
            style={styles.rulesCard}
          >
            <MaterialIcons name="info" size={20} color="#4ECDC4" />
            <Text style={styles.rulesText}>
              Choose your lucky number and get 2 chances to roll it! Hit your number to win 2.5x your stake! 🎯
            </Text>
          </LinearGradient>
        </View>
      )}
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
    opacity: 0.05,
  },
  element1: {
    width: 200,
    height: 200,
    backgroundColor: '#4ECDC4',
    marginTop: -50,
    marginLeft: -50,
  },
  element2: {
    width: 150,
    height: 150,
    backgroundColor: '#FFD700',
    marginTop: 200,
    marginRight: -30,
    alignSelf: 'flex-end',
  },
  element3: {
    width: 180,
    height: 180,
    backgroundColor: '#8B5CF6',
    marginBottom: 100,
    marginLeft: -40,
    alignSelf: 'flex-end',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
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
    fontSize: 32,
    fontWeight: '900',
    color: '#4ECDC4',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.7)',
    textShadowOffset: { 
      width: 0, 
      height: 2
    },
    textShadowRadius: 25,
    letterSpacing: 2,
    fontStyle: 'italic',
    transform: [{ rotate: '-2deg' }],
    position: 'relative',
    paddingHorizontal: 1,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 15
  },
  stakeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    minWidth: 80,
    justifyContent: 'center',
  },
  stakeText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
  },
  gameArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Number Selection Screen Styles
  numberSelectionContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  instructionCard: {
    padding: 25,
    alignItems: 'center',
    marginBottom: 40,
    width: '100%',
  },
  instructionTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    textShadowColor: 'rgba(255, 215, 0, 1)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    letterSpacing: 1,
  },
  instructionSubtext: {
    fontSize: 16,
    color: '#FFD700',
    textAlign: 'center',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  numbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 35,
  },
  numberButton: {
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  numberButtonGradient: {
    width: 90,
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonInner: {
    width: '88%',
    height: '88%',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  numberButtonText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  numberShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  selectionInfoCard: {
    padding: 20,
    width: '100%'
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
    flex: 1,
  },

  // Dice Screen Styles
  diceGameContainer: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  floatingOrb: {
    position: 'absolute',
    borderRadius: 50,
    opacity: 0.1,
  },
  orb1: {
    width: 100,
    height: 100,
    backgroundColor: '#FFD700',
    marginTop: height * 0.2,
    marginLeft: width * 0.1,
  },
  orb2: {
    width: 80,
    height: 80,
    backgroundColor: '#4ECDC4',
    marginTop: height * 0.6,
    marginRight: width * 0.15,
    alignSelf: 'flex-end',
  },
  gameStatusContainer: {
    width: '100%',
    marginBottom: 30,
  },
  gameStatusCard: {
    padding: 20,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  targetNumberDisplay: {
    alignItems: 'center',
  },
  targetLabel: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: 1,
  },
  targetNumberBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
  },
  targetNumber: {
    color: '#1a1a2e',
    fontWeight: '900',
    fontSize: 24,
    textShadowColor: 'rgba(255, 255, 255, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  rollsDisplay: {
    alignItems: 'center',
  },
  rollsLabel: {
    color: '#4ECDC4',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: 1,
  },
  rollIndicators: {
    flexDirection: 'row',
    gap: 8,
  },
  rollIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  rollActive: {
    backgroundColor: 'rgba(76, 205, 196, 0.3)',
    borderColor: '#4ECDC4',
  },
  rollUsed: {
    backgroundColor: 'rgba(102, 102, 102, 0.3)',
    borderColor: '#666',
  },
  prizeDisplay: {
    alignItems: 'center',
  },
  prizeLabel: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
    letterSpacing: 1,
  },
  prizeAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textShadowColor: 'rgba(139, 92, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  diceArena: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
    position: 'relative',
    minHeight: 200,
  },
  diceGlowRing: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: 'rgba(76, 205, 196, 0.5)',
    backgroundColor: 'rgba(76, 205, 196, 0.1)',
  },
  diceContainer: {
    position: 'relative',
    zIndex: 2,
  },
  winGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 215, 0, 0.4)',
    top: -20,
    left: -20,
    zIndex: -1,
  },
  dice: {
    width: 140,
    height: 140,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    position: 'relative',
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
  spinningIcon: {
    // Add spinning animation if needed
  },
  rollingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  diceShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleText: {
    fontSize: 25,
    textShadowColor: 'rgba(255, 255, 255, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  rollResultMessage: {
    position: 'absolute',
    marginBottom: -60,
    width: '120%',
    alignItems: 'center',
    alignSelf: 'center',
  },
  resultMessageCard: {
    padding: 15,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
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
  rollHistoryContainer: {
    width: '100%',
    marginTop: 20,
  },
  rollHistoryCard: {
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rollHistoryTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 15,
    textShadowColor: 'rgba(139, 92, 246, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    letterSpacing: 1,
  },
  rollHistoryTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  historyDot: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 6,
  },
  historyDotWin: {
    backgroundColor: 'rgba(255, 215, 0, 0.4)',
    borderColor: '#FFD700',
    borderWidth: 3,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 10,
  },
  historyDotText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  historyDotTextWin: {
    color: '#FFD700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
  },
  winCrown: {
    position: 'absolute',
    marginTop: -12,
    marginRight: -8,
    alignSelf: 'flex-end',
  },
  crownText: {
    fontSize: 18,
  },

  // Result Screen Styles
  resultContainer: {
    width: '100%',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  resultCard: {
    borderRadius: 25,
    padding: 30,
    alignItems: 'center',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resultEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  resultAmountContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 15,
    marginBottom: 20,
  },
  resultAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  resultSubtext: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 25,
    opacity: 0.9,
  },
  resultButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: 15,
  },
  playAgainButton: {
    flex: 1,
    borderRadius: 15,
    overflow: 'hidden',
  },
  resultButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  playAgainText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },
  exitButton: {
    flex: 1,
    borderRadius: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  exitButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  exitText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 8,
  },

  // Action Button Styles
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
  rollButtonDisabled: {
    opacity: 0.7,
  },
  rollButtonGradient: {
    paddingVertical: 20,
    paddingHorizontal: 30,
    position: 'relative',
  },
  rollButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rollButtonTextContainer: {
    marginLeft: 15,
    alignItems: 'center',
  },
  rollButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  rollButtonSubtext: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  rollButtonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 25,
  },

  // Rules Container Styles
  rulesContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  rulesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
  },
  rulesText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginLeft: 10,
    flex: 1,
  },

  // Confetti Styles
  confetti: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    left: '50%',  // Start from center
    top: 0,
  },
});