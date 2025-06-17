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
  
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, finished
  const [playerSixes, setPlayerSixes] = useState(0);
  const [opponentSixes, setOpponentSixes] = useState(0);
  const [currentTurn, setCurrentTurn] = useState('player'); // player, opponent
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState(null);
  const [opponentName] = useState(`Player${Math.floor(Math.random() * 9999)}`);

  const diceRotation = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Determine first turn randomly
    const firstTurn = Math.random() > 0.5 ? 'player' : 'opponent';
    setCurrentTurn(firstTurn);
    setGameState('playing');

    // Start opponent turn if they go first
    if (firstTurn === 'opponent') {
      setTimeout(() => rollOpponentDice(), 1000);
    }

    // Handle back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    // Check for winner
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

  useEffect(() => {
    // Pulse animation for current turn
    if (gameState === 'playing') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }
  }, [currentTurn, gameState]);

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
    if (gameState !== 'playing' || currentTurn !== 'player' || isRolling) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsRolling(true);

    // Dice rolling animation
    const rotationAnimation = Animated.timing(diceRotation, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    });

    const scaleAnimation = Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 1.2,
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
      const newValue = Math.floor(Math.random() * 6) + 1;
      setDiceValue(newValue);
      
      if (newValue === 6) {
        setPlayerSixes(prev => prev + 1);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      setIsRolling(false);
      setCurrentTurn('opponent');
      diceRotation.setValue(0);

      // Opponent's turn after delay
      setTimeout(() => rollOpponentDice(), 1500);
    });
  };

  const rollOpponentDice = () => {
    if (gameState !== 'playing') return;

    setIsRolling(true);
    
    // Simulate opponent rolling
    setTimeout(() => {
      const newValue = Math.floor(Math.random() * 6) + 1;
      setDiceValue(newValue);
      
      if (newValue === 6) {
        setOpponentSixes(prev => prev + 1);
      }

      setIsRolling(false);
      setCurrentTurn('player');
    }, 1000);
  };

  const handleGameEnd = async (winner) => {
    const stakeAmount = parseInt(stake);
    
    if (winner === 'player') {
      const winAmount = stakeAmount * 2;
      await updateWallet(user.wallet + winAmount);
      
      // Save game history
      const gameHistory = {
        id: Date.now().toString(),
        game: 'Six King',
        stake: stakeAmount,
        result: 'won', 
        amount: winAmount,
        date: new Date().toISOString(),
        opponent: opponentName
      };
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      setTimeout(() => {
        Alert.alert(
          '🎉 Congratulations!',
          `You won ₹${winAmount}! Your new balance is ₹${user.wallet + winAmount}`,
          [{ text: 'Continue', onPress: () => router.back() }]
        );
      }, 1000);
    } else {
      await updateWallet(user.wallet - stakeAmount);
      
      const gameHistory = {
        id: Date.now().toString(),
        game: 'Six King',
        stake: stakeAmount,
        result: 'lost',
        amount: -stakeAmount,
        date: new Date().toISOString(),
        opponent: opponentName
      };
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      setTimeout(() => {
        Alert.alert(
          '😔 Better luck next time!',
          `You lost ₹${stakeAmount}. Your new balance is ₹${user.wallet - stakeAmount}`,
          [{ text: 'Continue', onPress: () => router.back() }]
        );
      }, 1000);
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
          <View
            key={index}
            style={[
              styles.sixBadge,
              count >= index ? styles.sixBadgeActive : styles.sixBadgeInactive
            ]}
          >
            <MaterialIcons 
              name="looks-6" 
              size={20} 
              color={count >= index ? '#FFD700' : '#666'} 
            />
          </View>
        ))}
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.gameTitle}>Six King Battle</Text>
        <View style={styles.stakeInfo}>
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
            currentTurn === 'opponent' && { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <MaterialIcons name="person" size={40} color="#FF6B6B" />
          <Text style={styles.playerName}>{opponentName}</Text>
          {renderSixesProgress(opponentSixes, false)}
          {currentTurn === 'opponent' && (
            <Text style={styles.turnIndicator}>Rolling...</Text>
          )}
        </Animated.View>

        {/* VS */}
        <View style={styles.vsContainer}>
          <Text style={styles.vsText}>VS</Text>
        </View>

        {/* Player */}
        <Animated.View 
          style={[
            styles.playerCard,
            styles.playerCard,
            currentTurn === 'player' && { transform: [{ scale: pulseAnim }] }
          ]}
        >
          <MaterialIcons name="person" size={40} color="#4ECDC4" />
          <Text style={styles.playerName}>You</Text>
          {renderSixesProgress(playerSixes, true)}
          {currentTurn === 'player' && !isRolling && (
            <Text style={styles.turnIndicator}>Your Turn!</Text>
          )}
        </Animated.View>
      </View>

      {/* Dice Section */}
      <View style={styles.diceSection}>
        <Animated.View
          style={[
            styles.diceContainer,
            {
              transform: [
                { scale: scaleAnim },
                {
                  rotate: diceRotation.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '360deg'],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={diceValue === 6 ? ['#FFD700', '#FFA500'] : ['#fff', '#f0f0f0']}
            style={styles.dice}
          >
            <MaterialIcons
              name={getDiceIcon(diceValue)}
              size={60}
              color={diceValue === 6 ? '#1a1a2e' : '#333'}
            />
          </LinearGradient>
        </Animated.View>

        {diceValue === 6 && (
          <Text style={styles.sixText}>🎉 SIX! 🎉</Text>
        )}
      </View>

      {/* Action Button */}
      <View style={styles.actionContainer}>
        {currentTurn === 'player' && gameState === 'playing' && (
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
                {isRolling ? 'Rolling...' : 'ROLL DICE'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {currentTurn === 'opponent' && gameState === 'playing' && (
          <View style={styles.waitingContainer}>
            <Text style={styles.waitingText}>Opponent is rolling...</Text>
          </View>
        )}
      </View>

      {/* Game Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          First to get 3 sixes wins ₹{parseInt(stake) * 2}!
        </Text>
      </View>
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
  playersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  playerCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    minWidth: 120,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  opponentCard: {
    borderColor: '#FF6B6B',
  },
  playerName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 10,
  },
  sixesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  sixBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
  },
  sixBadgeActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  sixBadgeInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  turnIndicator: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 8,
  },
  vsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  diceSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  diceContainer: {
    marginBottom: 20,
  },
  dice: {
    width: 100,
    height: 100,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
  sixText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
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
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  waitingText: {
    color: '#888',
    fontSize: 16,
  },
  statusContainer: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  statusText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  },
});