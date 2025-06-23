import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams , router} from 'expo-router';
const { width, height } = Dimensions.get('window');

export default function SnakeGameScreen() {

  const { mode1, stake, wallet , updateWallet} = useLocalSearchParams();
  const [currentRoll, setCurrentRoll] = useState(0);
  const [gameStatus, setGameStatus] = useState('playing'); // playing, won, lost
  const [isRolling, setIsRolling] = useState(false);
  const [rollAnimation] = useState(new Animated.Value(0));
  const [lastRollResult, setLastRollResult] = useState(null);
  const [rollHistory, setRollHistory] = useState([]);

  const mode = JSON.parse(mode1);

  console.log(mode, stake, wallet);
  console.log(mode?.rolls);
  const rollDice = () => {
    if (isRolling || gameStatus !== 'playing') return;

    setIsRolling(true);
    
    // Animate the roll
    Animated.sequence([
      Animated.timing(rollAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(rollAnimation, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      const newRoll = currentRoll + 1;
      setCurrentRoll(newRoll);
      
      // Calculate bite probability (increases with each roll)
      const biteProbability = 0.12 + (newRoll * 0.04); // 12% base + 4% per roll
      const isBitten = Math.random() < biteProbability;
      
      // Generate random dice result (1-6)
      const diceResult = Math.floor(Math.random() * 6) + 1;
      setLastRollResult(diceResult);
      
      const newHistory = [...rollHistory, { roll: newRoll, dice: diceResult, safe: !isBitten }];
      setRollHistory(newHistory);

      if (isBitten) {
        setGameStatus('lost');
        updateWallet(wallet - stake);
        setTimeout(() => {
          Alert.alert(
            '🐍 Snake Bite!',
            `You were bitten on roll ${newRoll}!\nYou lost ₹${stake}`,
            // [{ text: 'Try Again', onPress: handleGoBack }]
          );
        }, 1500);
      } else if (newRoll >= mode.rolls) {
        setGameStatus('won');
        const winAmount = stake * mode.multiplier;
        updateWallet(wallet + winAmount - stake);
        setTimeout(() => {
          Alert.alert(
            '🎉 Victory!',
            `You survived all ${mode.rolls} rolls!\nYou won ₹${winAmount.toFixed(1)}!`,
            // [{ text: 'Play Again', onPress: handleGoBack }]
          );
        }, 1500);
      }
      
      setIsRolling(false);
    }, 1200);
  };

  const getProgressPercentage = () => {
    return (currentRoll / mode.rolls) * 100;
  };

  const getDiceRotation = rollAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  });

  const getDiceScale = rollAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.3, 1],
  });

  const getRiskLevel = () => {
    const percentage = (currentRoll / mode.rolls) * 100;
    if (percentage < 25) return { text: 'LOW RISK', color: '#00D4AA' };
    if (percentage < 50) return { text: 'MEDIUM RISK', color: '#FFD700' };
    if (percentage < 75) return { text: 'HIGH RISK', color: '#FF8C42' };
    return { text: 'EXTREME RISK', color: '#FF4757' };
  };

  const risk = getRiskLevel();

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            // onPress={handleGoBack}
          >
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.gameMode}>{mode.name}</Text>
            <Text style={styles.multiplier}>{mode.multiplier}x Payout</Text>
          </View>
        </View>

        {/* Game Info Cards */}
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Stake</Text>
            <Text style={styles.infoValue}>₹{stake}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Potential Win</Text>
            <Text style={styles.winValue}>₹{(stake * parseInt(mode.multiplier)).toFixed(1)}</Text>
          </View>
        </View>

        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>Roll {currentRoll} of {mode.rolls}</Text>
            <View style={[styles.riskBadge, { backgroundColor: risk.color }]}>
              <Text style={styles.riskText}>{risk.text}</Text>
            </View>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${getProgressPercentage()}%`,
                    backgroundColor:
                      gameStatus === 'won'
                        ? '#00D4AA'
                        : gameStatus === 'lost'
                        ? '#FF4757'
                        : risk.color,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressPercentage}>{Math.round(getProgressPercentage())}%</Text>
          </View>
        </View>

        {/* Game Area */}
        <View style={styles.gameArea}>
          {/* Dice */}
          <View style={styles.diceContainer}>
            <Animated.View
              style={[
                styles.dice,
                {
                  transform: [
                    { rotate: getDiceRotation },
                    { scale: getDiceScale }
                  ],
                },
              ]}
            >
              <Text style={styles.diceText}>🎲</Text>
            </Animated.View>
            {lastRollResult && !isRolling && (
              <Text style={styles.diceResult}>Rolled: {lastRollResult}</Text>
            )}
          </View>

          {/* Snake Danger Indicator */}
          {currentRoll > 0 && (
            <View style={styles.dangerZone}>
              <Text style={styles.snakeEmoji}>🐍</Text>
              <Text style={styles.dangerText}>
                Bite chance: {Math.round((0.12 + (currentRoll * 0.04)) * 100)}%
              </Text>
            </View>
          )}
        </View>

        {/* Roll History */}
        {rollHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Roll History</Text>
            <View style={styles.historyRow}>
              {rollHistory.slice(-5).map((roll, index) => (
                <View
                  key={index}
                  style={[
                    styles.historyItem,
                    { backgroundColor: roll.safe ? '#00D4AA' : '#FF4757' }
                  ]}
                >
                  <Text style={styles.historyRoll}>{roll.roll}</Text>
                  <Text style={styles.historyDice}>{roll.dice}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Roll Button */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.rollButton,
              {
                backgroundColor:
                  isRolling
                    ? '#666'
                    : gameStatus === 'won'
                    ? '#00D4AA'
                    : gameStatus === 'lost'
                    ? '#FF4757'
                    : '#7C3AED',
              },
            ]}
            onPress={rollDice}
            disabled={isRolling || gameStatus !== 'playing'}
          >
            <Text style={styles.rollButtonText}>
              {isRolling
                ? 'Rolling...'
                : gameStatus === 'won'
                ? '🎉 You Won!'
                : gameStatus === 'lost'
                ? '💀 Game Over'
                : `🎲 Roll Dice`}
            </Text>
            {gameStatus === 'playing' && !isRolling && (
              <Text style={styles.rollSubtext}>
                {mode.rolls - currentRoll} rolls remaining
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#7C3AED',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  backText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  headerInfo: {
    flex: 1,
    alignItems: 'center',
  },
  gameMode: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  multiplier: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  infoCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  winValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  progressSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  riskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  riskText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    minWidth: 40,
  },
  gameArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  diceContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  dice: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    marginBottom: 12,
  },
  diceText: {
    fontSize: 40,
  },
  diceResult: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dangerZone: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 71, 87, 0.2)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 71, 87, 0.5)',
  },
  snakeEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  dangerText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  historyContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 8,
  },
  historyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  historyItem: {
    width: 50,
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyRoll: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  historyDice: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  controls: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  rollButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  rollButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  rollSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  errorText: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 50,
  },
});