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
  Easing
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

  // Confetti particles
  const confettiParticles = Array(20).fill(0).map((_, i) => ({
    id: i,
    left: new Animated.Value(Math.random() * width),
    top: new Animated.Value(-10),
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
    if (hasWon) {
      // Start confetti animation
      confettiParticles.forEach(particle => {
        Animated.sequence([
          Animated.timing(particle.opacity, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.parallel([
            Animated.timing(particle.top, {
              toValue: height,
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
        <Text style={styles.instructionText}>Choose Your Lucky Number</Text>
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
                  colors={['#4ECDC4', '#44A08D']}
                  style={styles.numberButtonGradient}
                >
                  <Text style={styles.numberButtonText}>{number}</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>
        <Text style={styles.biasText}>
          The dice is slightly biased towards your lucky number!
        </Text>
      </View>
    );
  };

  const renderDice = () => {
    return (
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
        <LinearGradient
          colors={
            diceValue === luckyNumber
              ? ['#FFD700', '#FFA500']
              : ['#fff', '#f0f0f0']
          }
          style={styles.dice}
        >
          {diceValue && (
            <Text style={[
              styles.diceNumber,
              diceValue === luckyNumber && styles.diceNumberWin
            ]}>
              {diceValue}
            </Text>
          )}
        </LinearGradient>
      </Animated.View>
    );
  };

  const renderResult = () => {
    return (
      <Animated.View style={[
        styles.resultContainer,
        { opacity: resultAnim }
      ]}>
        <LinearGradient
          colors={hasWon ? ['#4ECDC4', '#44A08D'] : ['#FF6B6B', '#FF8E53']}
          style={styles.resultCard}
        >
          <Text style={styles.resultTitle}>
            {hasWon ? '🎉 You Won! 🎉' : '😔 Try Again'}
          </Text>
          <Text style={styles.resultAmount}>
            {hasWon ? `+₹${winAmount}` : `-₹${stake}`}
          </Text>
          <Text style={styles.resultSubtext}>
            {hasWon 
              ? `Your lucky number was ${luckyNumber}!` 
              : `You rolled: ${rollHistory.join(', ')}`
            }
          </Text>
          
          <View style={styles.resultButtons}>
            <TouchableOpacity 
              style={styles.playAgainButton}
              onPress={resetGame}
            >
              <Text style={styles.playAgainText}>Play Again</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.exitButton}
              onPress={() => router.back()}
            >
              <Text style={styles.exitText}>Exit</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      {/* Confetti */}
      {hasWon && confettiParticles.map(particle => (
        <Animated.View
          key={particle.id}
          style={[
            styles.confetti,
            {
              left: particle.left,
              top: particle.top,
              backgroundColor: particle.color,
              transform: [
                { rotate: particle.rotation.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', '360deg']
                })},
                { scale: particle.scale }
              ],
              opacity: particle.opacity,
            }
          ]}
        />
      ))}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.gameTitle}>Lucky Number</Text>
        <View style={styles.stakeInfo}>
          <Text style={styles.stakeText}>₹{stake}</Text>
        </View>
      </View>

      {/* Game Info */}
      {luckyNumber && !showResult && (
        <View style={styles.gameInfo}>
          <View style={styles.luckyNumberDisplay}>
            <Text style={styles.luckyNumberLabel}>Lucky Number:</Text>
            <View style={styles.luckyNumberBadge}>
              <Text style={styles.luckyNumberText}>{luckyNumber}</Text>
            </View>
          </View>
          
          <View style={styles.rollsInfo}>
            <Text style={styles.rollsLabel}>Rolls Left:</Text>
            <View style={styles.rollsDots}>
              {[1, 2].map((roll) => (
                <View
                  key={roll}
                  style={[
                    styles.rollDot,
                    rollsLeft >= roll ? styles.rollDotActive : styles.rollDotInactive
                  ]}
                />
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Main Game Area */}
      <View style={styles.gameArea}>
        {gameState === 'selecting' && renderNumberSelection()}
        
        {gameState === 'rolling' && !showResult && (
          <View style={styles.diceSection}>
            {renderDice()}

            {rollHistory.length > 0 && (
              <View style={styles.rollHistory}>
                <Text style={styles.rollHistoryLabel}>Your Rolls:</Text>
                <View style={styles.rollHistoryNumbers}>
                  {rollHistory.map((roll, index) => (
                    <View
                      key={index}
                      style={[
                        styles.historyNumber,
                        roll === luckyNumber && styles.historyNumberWin
                      ]}
                    >
                      <Text style={styles.historyNumberText}>{roll}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {showResult && renderResult()}
      </View>

      {/* Action Button */}
      {gameState === 'rolling' && rollsLeft > 0 && !showResult && !isCheckingResult && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={[styles.rollButton, isRolling && styles.rollButtonDisabled]}
            onPress={rollDice}
            disabled={isRolling}
          >
            <LinearGradient
              colors={['#4ECDC4', '#44A08D']}
              style={styles.rollButtonGradient}
            >
              <MaterialIcons name="casino" size={24} color="#fff" />
              <Text style={styles.rollButtonText}>
                {isRolling ? 'Rolling...' : `Roll Dice (${rollsLeft} left)`}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Game Rules */}
      {!showResult && !isCheckingResult && (
        <View style={styles.rulesContainer}>
          <Text style={styles.rulesText}>
            {gameState === 'selecting' 
              ? 'Choose a number from 1-6. You get 2 rolls to hit it!'
              : `Roll your lucky number ${luckyNumber} to win ₹${winAmount}!`
            }
          </Text>
        </View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  stakeInfo: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  stakeText: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  gameInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  luckyNumberDisplay: {
    alignItems: 'center',
  },
  luckyNumberLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 5,
  },
  luckyNumberBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FFD700',
    justifyContent: 'center',
    alignItems: 'center',
  },
  luckyNumberText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 18,
  },
  rollsInfo: {
    alignItems: 'center',
  },
  rollsLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 5,
  },
  rollsDots: {
    flexDirection: 'row',
  },
  rollDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  rollDotActive: {
    backgroundColor: '#4ECDC4',
  },
  rollDotInactive: {
    backgroundColor: '#666',
  },
  gameArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberSelectionContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  instructionText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 30,
  },
  numbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
  },
  numberButton: {
    borderRadius: 15,
    overflow: 'hidden',
    margin: 5,
    elevation: 5,
  },
  numberButtonGradient: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numberButtonText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  biasText: {
    color: '#FFD700',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  diceSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    width: '100%',
  },
  diceContainer: {
    marginBottom: 20,
  },
  dice: {
    width: 120,
    height: 120,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  diceNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#333',
  },
  diceNumberWin: {
    color: '#1a1a2e',
  },
  rollHistory: {
    alignItems: 'center',
    marginTop: 20,
    width: '100%',
  },
  rollHistoryLabel: {
    color: '#888',
    fontSize: 16,
    marginBottom: 10,
  },
  rollHistoryNumbers: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  historyNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 5,
  },
  historyNumberWin: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  historyNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  resultContainer: {
    position: 'absolute',
    width: '100%',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  resultCard: {
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    elevation: 10,
  },
  resultTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 10,
  },
  resultAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  resultSubtext: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  resultButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 10,
  },
  playAgainButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    flex: 1,
    marginRight: 10,
  },
  playAgainText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  exitButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
    flex: 1,
  },
  exitText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  actionContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  rollButton: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  rollButtonDisabled: {
    opacity: 0.7,
  },
  rollButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  rollButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  rulesContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  rulesText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  checkingResultOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  checkingResultText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});