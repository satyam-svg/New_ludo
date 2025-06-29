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
  BackHandler,
  Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';

const { width, height } = Dimensions.get('window');

// Responsive dimensions
const isSmallDevice = width < 380;
const isMediumDevice = width >= 380 && width < 414;
const isLargeDevice = width >= 414;

// Scale function for responsive sizing
const scale = (size) => {
  if (isSmallDevice) return size * 0.85;
  if (isMediumDevice) return size * 0.95;
  return size;
};

// Timer constants
const ROLL_TIMEOUT_SECONDS = 120; // 1 minute timeout
const WARNING_THRESHOLD = 20; // Show warning when 15 seconds left

export default function SixKingGame() {
  const { stake, gameId, firstPlayer, players, gameStarted } = useLocalSearchParams();
  const { user, updateWallet } = useAuth();
  
  // Game state
  const [gameState, setGameState] = useState('waiting'); // waiting, playing, finished
  const [playerSixes, setPlayerSixes] = useState(0);
  const [opponentSixes, setOpponentSixes] = useState(0);
  const [currentTurn, setCurrentTurn] = useState(null);
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  const [winner, setWinner] = useState(null);
  const [opponentName, setOpponentName] = useState('Opponent');
  const [rollCount, setRollCount] = useState(0);
  const [isProcessingTurn, setIsProcessingTurn] = useState(false);
  
  // state
  const [timeLeft, setTimeLeft] = useState(ROLL_TIMEOUT_SECONDS);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const timerRef = useRef(null);
  const timeoutRef = useRef(null);
  
  // Track who is currently rolling
  const [currentRollingPlayer, setCurrentRollingPlayer] = useState(null);

  // Game end modal state
  const [showGameEndModal, setShowGameEndModal] = useState(false);
  const [gameEndResult, setGameEndResult] = useState(null); // { isWinner: boolean, amount: number }

  // Multiplayer state
  const [roomCode, setRoomCode] = useState(gameId || null);
  const [waitingForOpponent, setWaitingForOpponent] = useState(true);
  const [gameReady, setGameReady] = useState(false);
  const [opponentId, setOpponentId] = useState(null);
  const [matchStatus, setMatchStatus] = useState(''); // For showing match status without popup

  // WebSocket connection (update connection for game)
  const { socket, isConnected, sendMessage } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onConnect: () => {
      console.log('🔌 Game WebSocket connected');
      
      // If we have game data from navigation, update the backend connection
      if (gameStarted === 'true' && roomCode && user.id) {
        console.log('🔄 Updating backend WebSocket connection for game');
        sendMessage('update_connection', {
          gameId: roomCode,
          playerId: user.id
        });
      }
    },
    onDisconnect: () => {
      console.log('🔌 Game WebSocket disconnected');
      clearTimer();
    }
  });

  // Animations
  const diceRotation = useRef(new Animated.Value(0)).current;
  const diceScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const sparkleAnim = useRef(new Animated.Value(0)).current;
  const timerPulse = useRef(new Animated.Value(1)).current;

  // Timer functions
  const startTimer = (playerId) => {
    console.log(`⏰ Starting timer for player: ${playerId}`);
    clearTimer(); // Clear any existing timer
    
    setTimeLeft(ROLL_TIMEOUT_SECONDS);
    setIsTimerActive(true);
    setShowTimeoutWarning(false);
    
    // Start countdown
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1;
        
        // Show warning when time is running low
        if (newTime <= WARNING_THRESHOLD && newTime > 0) {
          setShowTimeoutWarning(true);
          // Start timer pulse animation
          Animated.loop(
            Animated.sequence([
              Animated.timing(timerPulse, {
                toValue: 1.2,
                duration: 500,
                useNativeDriver: true,
              }),
              Animated.timing(timerPulse, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
              }),
            ])
          ).start();
        }
        
        // Time up!
        if (newTime <= 0) {
          handleTimeUp(playerId);
          return 0;
        }
        
        return newTime;
      });
    }, 1000);
  };

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsTimerActive(false);
    setShowTimeoutWarning(false);
    setTimeLeft(ROLL_TIMEOUT_SECONDS);
    timerPulse.setValue(1);
  };

  const handleTimeUp = (playerId) => {
      console.log(`⏰ Time up for player: ${playerId}`);
      clearTimer();
      
      const currentPlayerId = user.id || initializePlayerId();
      const isMyTimeout = String(playerId) === String(currentPlayerId);
      
      if (isMyTimeout) {
        // I timed out - I lose
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setMatchStatus('Time up! You lose...');
        
        // Show game end modal FIRST
        setTimeout(() => {
          setGameEndResult({
            isWinner: false,
            amount: parseInt(stake),
            stake: parseInt(stake),
            reason: 'timeout'
          });
          setShowGameEndModal(true);
          setGameState('finished');
        }, 500);
        
      } else {
        // Opponent timed out - I win
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setMatchStatus('Opponent timed out! You win!');
        
        // Show game end modal FIRST (FIXED: Don't send leave_game immediately)
        setTimeout(() => {
          setGameEndResult({
            isWinner: true,
            amount: parseInt(stake) * 2,
            stake: parseInt(stake),
            reason: 'opponent_timeout'
          });
          setShowGameEndModal(true);
          setGameState('finished');
        }, 500);
      }
    };

  // Format timer display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check for forwarded messages from lobby
  useEffect(() => {
    const checkForForwardedMessages = () => {
      if (global.lastGameMessage) {
        const { type, data } = global.lastGameMessage;
        console.log('📨 Processing forwarded message from lobby:', type, data);
        
        switch (type) {
          case 'dice_rolled':
            handleDiceRolled(data);
            break;
          case 'turn_changed':
            handleTurnChanged(data);
            break;
          case 'game_ended':
            handleGameEnded(data);
            break;
        }
        
        // Clear the message after processing
        global.lastGameMessage = null;
      }
    };

    // Check for messages every 100ms
    const interval = setInterval(checkForForwardedMessages, 100);
    
    return () => clearInterval(interval);
  }, []);

  // Initialize player ID immediately - don't wait for useEffect
  const initializePlayerId = () => {
    if (!user.id) {
      const playerId = user?.id || `player_${Date.now()}`;
      console.log('🆔 My Player ID set to:', playerId);
      return playerId;
    }
    return user.id;
  };

  // Initialize player ID and check if game already started from navigation
  useEffect(() => {
    const playerId = initializePlayerId();
    console.log('🆔 useEffect - My Player ID:', playerId);
    
    // Check if we came from lobby with game already started
    if (gameStarted === 'true' && firstPlayer && players) {
      
      try {
        const gamePlayersData = JSON.parse(players);
        
        // Set up the game immediately
        setGameState('playing');
        setCurrentTurn(firstPlayer);
        setWaitingForOpponent(false);
        setGameReady(true);
        setRoomCode(gameId);
        
        // Set opponent info
        const opponent = gamePlayersData.find(p => String(p.id) !== String(playerId));
        if (opponent) {
          setOpponentName(opponent.name);
          setOpponentId(opponent.id);
          console.log(`👤 Opponent from nav: ${opponent.name} (${opponent.id})`);
        }
        
        // Start timer for first player
        startTimer(firstPlayer);
        
        setMatchStatus('Game Started!');
        setTimeout(() => setMatchStatus(''), 1000);
        
      } catch (error) {
        console.error('Error parsing navigation game data:', error);
        // Fallback to normal flow
        setGameState('waiting');
        setWaitingForOpponent(true);
      }
    } else {
      // Normal flow - no game data from navigation
      setGameState('waiting');
      setWaitingForOpponent(true);
    }
  }, [user, gameStarted, firstPlayer, players, gameId]);

  // WebSocket message handler
  function handleWebSocketMessage(message) {
    const { type, data } = message;

    // Ensure we have a player ID before processing messages
    const currentPlayerId = user.id || initializePlayerId();

    switch (type) {
      case 'connected':
        console.log('Game WebSocket connected message');
        break;
      case 'connection_updated':
        console.log('✅ Backend WebSocket connection updated for game');
        break;
      case 'dice_rolled':
        handleDiceRolled(data, currentPlayerId);
        break;
      case 'turn_changed':
        handleTurnChanged(data);
        break;
      case 'game_ended':
        handleGameEnded(data, currentPlayerId);
        break;
      case 'player_left':
        handlePlayerLeft(data);
        break;
      case 'error':
        handleError(data);
        break;
    }
  }

  function handleDiceRolled(data) {
    const { playerId, diceValue: rolledValue, newSixCount } = data;
    
    // Clear timer when dice is rolled
    clearTimer();
    
    setRollCount(prev => prev + 1);
    
    // Set who is currently rolling based on the playerId who rolled
    setCurrentRollingPlayer(playerId);
    
    // Animate dice roll
    animateDiceRoll(rolledValue, () => {
      // Show six effects IMMEDIATELY after animation completes
      if (rolledValue === 6) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      // Update six counts AFTER a delay
      setTimeout(() => {
        if (String(playerId) === String(user.id)) {
          setPlayerSixes(newSixCount);
        } else {
          setOpponentSixes(newSixCount);
        }
      }, 300);
      
      // Clear rolling state
      setTimeout(() => {
        setCurrentRollingPlayer(null);
      }, 1000);
    });
  }

  function handleTurnChanged(data) {
    setCurrentTurn(data.nextPlayer);
    setIsProcessingTurn(false);
    
    // Start timer for the new turn
    startTimer(data.nextPlayer);
  }

  function handleGameEnded(data) {
    clearTimer(); // Clear timer when game ends
    
    const rolledValue = 6;
    animateDiceRoll(rolledValue, () => {
      // Haptic feedback immediately
      if (rolledValue === 6) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      
      // Crown updates after 1 second
      setTimeout(() => {
        if (String(data.winner) === String(user.id)) {
          setPlayerSixes(3);
        } else {
          setOpponentSixes(3);
        }
        
        // THEN end game after crown updates complete
        setTimeout(() => {
          setWinner(data.winner);
          setGameState('finished');
          const isPlayerWinner = String(data.winner) === String(user.id);
          handleGameEnd(isPlayerWinner ? 'player' : 'opponent');
          setMatchStatus("Game Ended...");
        }, 1000);
        
      }, 1000);
      
      // Clear rolling state
      setTimeout(() => {
        setCurrentRollingPlayer(null);
      }, 1000);
    });
  }

  function handlePlayerLeft(data) {
      clearTimer();
      
      // Check if this was due to a timeout scenario
      if (gameState === 'playing' && !showGameEndModal) {
        // If game was still playing and we haven't shown end modal yet,
        // this might be opponent leaving due to timeout
        setMatchStatus('Opponent left the game - You win!');
        
        // Show win modal for remaining player
        setTimeout(() => {
          setGameEndResult({
            isWinner: true,
            amount: parseInt(stake) * 2,
            stake: parseInt(stake),
            reason: 'opponent_left'
          });
          setShowGameEndModal(true);
          setGameState('finished');
        }, 500);
      } else {
        // Normal player left scenario
        setMatchStatus('Opponent left the game');
        setTimeout(() => {
          router.replace('/');
        }, 500);
      }
    }

  function handleError(data) {
    console.error('❌ WebSocket error:', data);
    clearTimer();
    setMatchStatus(`Error: ${data.message}`);
    if (data.code === 'GAME_NOT_FOUND' || data.code === 'GAME_FULL') {
      setTimeout(() => {
        router.replace('/');
      }, 2000);
    }
  }

  // Game actions
  const rollDice = () => {
    const currentPlayerId = user.id || initializePlayerId();
    const canRoll = String(currentTurn) === String(currentPlayerId) && 
                   gameState === 'playing' && 
                   !isRolling && 
                   !isProcessingTurn && 
                   !waitingForOpponent;

    if (!canRoll) {
      console.log('❌ Cannot roll dice - conditions not met');
      return;
    }

    // Clear timer when rolling
    clearTimer();
    
    setIsProcessingTurn(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    console.log('📤 Sending roll_dice message');
    sendMessage('roll_dice', {
      gameId: roomCode,
      playerId: currentPlayerId
    });
  };

  // Animate dice roll
  function animateDiceRoll(finalValue, onComplete) {
    setIsRolling(true);
    setDiceValue(1);

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

    let rollCounter = 0;
    const rollInterval = setInterval(() => {
      const tempValue = Math.floor(Math.random() * 5) + 1; // 1-5 only
      setDiceValue(tempValue);
      rollCounter++;
      
      if (rollCounter >= 10) {
        clearInterval(rollInterval);
        setTimeout(() => {
          setDiceValue(finalValue);
        }, 100);
      }
    }, 120);

    // Ensure the callback runs only after ALL animations complete
    Animated.parallel([rotationAnimation, scaleAnimation]).start(() => {
      setIsRolling(false);
      diceRotation.setValue(0);
      
      // Add a small delay before calling onComplete
      setTimeout(() => {
        console.log('🎲 Animation completed, now updating crown badges');
        onComplete();
      }, 200);
    });
  }

  // Game end handler
  const handleGameEnd = async (winner) => {
    clearTimer(); // Ensure timer is cleared
    const stakeAmount = parseInt(stake);
    if (winner === 'player') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Show game end modal after 1 second
      setTimeout(() => {
        setGameEndResult({
          isWinner: true,
          amount: stakeAmount*2,
          stake: stakeAmount
        });
        setShowGameEndModal(true);
      }, 1000);
    } else {
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Show game end modal after 1 second
      setTimeout(() => {
        setGameEndResult({
          isWinner: false,
          amount: stakeAmount,
          stake: stakeAmount
        });
        setShowGameEndModal(true);
      }, 1000);
    }
  };

  // Handle game end modal actions
  const handleTryAgain = () => {
    setShowGameEndModal(false);
    // Navigate to stake selection page
    router.replace('games/six-king-lobby');
  };

  const handleExit = () => {
    setShowGameEndModal(false);
    
    // Send leave_game message when manually exiting
    if (socket && roomCode && user.id) {
      sendMessage('leave_game', { 
        gameId: roomCode, 
        playerId: user.id, 
        opponentId: opponentId, 
        stake: stake 
      });
    }
    
    // Navigate to home page
    router.replace('/');
  };

  // Back press handler
  const handleBackPress = () => {
    Alert.alert(
      "Leave Game?",
      `Are you sure you want to leave? You will lose your stake of ₹${stake}.`,
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            // Do nothing - stay in game
          }
        },
        {
          text: "OK",
          style: "destructive",
          onPress: () => {
            // User confirmed - proceed with leaving
            clearTimer();
            setMatchStatus('Leaving game...');
            if (socket && roomCode && user.id) {
              sendMessage('leave_game', { gameId: roomCode, playerId: user.id , opponentId: opponentId, stake: stake});
            }
            setTimeout(() => router.replace('/'), 100);
          }
        }
      ],
      { cancelable: false } // Prevents dismissing by tapping outside
    );
    
    return true; // Prevent default back behavior
  };

  // Helper functions
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
              size={scale(16)} 
              color={count >= index ? '#FFD700' : '#666'} 
            />
          </Animated.View>
        ))}
      </View>
    );
  };

  // UI state helpers
  const canPlayerRoll = () => {
    const currentPlayerId = user.id || (user?.id || `player_${Date.now()}`);
    return String(currentTurn) === String(currentPlayerId) && 
           gameState === 'playing' && 
           !isRolling && 
           !isProcessingTurn &&
           !waitingForOpponent &&
           !currentRollingPlayer;
  };

  const isMyTurn = () => {
    const currentPlayerId = user.id || (user?.id || `player_${Date.now()}`);
    return String(currentTurn) === String(currentPlayerId);
  };

  const getDisabledButtonText = () => {
    if (waitingForOpponent) {
      return 'WAITING FOR OPPONENT...';
    }
    
    // Show correct rolling state based on who is rolling
    if (currentRollingPlayer) {
      if (String(currentRollingPlayer) === String(user.id)) {
        return 'ROLLING...';
      } else {
        return 'OPPONENT ROLLING...';
      }
    }
    
    if (isRolling) {
      return isMyTurn() ? 'ROLLING...' : 'OPPONENT ROLLING...';
    }
    
    return isMyTurn() ? 'PROCESSING...' : 'OPPONENT TURN...';
  };

  const getDebugInfo = () => {
    return `Turn: ${currentTurn} | Me: ${user.id} | MyTurn: ${isMyTurn()} | State: ${gameState} | Waiting: ${waitingForOpponent} | Rolling: ${currentRollingPlayer} | NavGameStarted: ${gameStarted}`;
  };

  // Setup effects
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => {
      backHandler.remove();
      clearTimer();
      if (socket && roomCode && user.id) {
        sendMessage('leave_game', { gameId: roomCode, playerId: user.id });
      }
    };
  }, [socket, roomCode, user.id]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, []);

  // Animation effects
  useEffect(() => {
    let pulseAnimation;
    
    if (gameState === 'playing' && !waitingForOpponent) {
      pulseAnimation = Animated.loop(
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
    }

    return () => {
      if (pulseAnimation) {
        pulseAnimation.stop();
      }
    };
  }, [currentTurn, gameState, waitingForOpponent, currentRollingPlayer, pulseAnim]);

  // Six highlighting only when not rolling and dice value is 6
  useEffect(() => {
    let glowAnimation;
    
    if (diceValue === 6 && !isRolling && !currentRollingPlayer) {
      glowAnimation = Animated.loop(
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
    } else {
      glowAnim.setValue(0);
    }

    return () => {
      if (glowAnimation) {
        glowAnimation.stop();
      }
    };
  }, [diceValue, isRolling, currentRollingPlayer, glowAnim]);

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
      style={styles.container}
    >
      {/* Background elements */}
      <View style={styles.backgroundElements}>
        <Animated.View style={[styles.floatingElement, styles.element1]} />
        <Animated.View style={[styles.floatingElement, styles.element2]} />
        <Animated.View style={[styles.floatingElement, styles.element3]} />
      </View>

      {/* Timer Display */}
      {isTimerActive && gameState === 'playing' && !waitingForOpponent && (
        <Animated.View 
          style={[
            styles.timerContainer,
            showTimeoutWarning && {
              transform: [{ scale: timerPulse }]
            }
          ]}
        >
          <LinearGradient
            colors={
              timeLeft <= WARNING_THRESHOLD 
                ? ['#FF6B6B', '#EE5A24', '#E74C3C'] 
                : ['#4ECDC4', '#44A08D', '#2ECC71']
            }
            style={styles.timerGradient}
          >
            <MaterialIcons 
              name="timer" 
              size={scale(16)} 
              color="#fff" 
            />
            <Text style={styles.timerText}>
              {formatTime(timeLeft)}
            </Text>
            {timeLeft <= WARNING_THRESHOLD && (
              <MaterialIcons 
                name="warning" 
                size={scale(14)} 
                color="#fff" 
              />
            )}
          </LinearGradient>
        </Animated.View>
      )}

      {/* Game End Modal */}
      <Modal
        visible={showGameEndModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.gameEndCard}>
            <LinearGradient
              colors={
                gameEndResult?.isWinner 
                  ? ['#4ECDC4', '#44A08D', '#2ECC71'] 
                  : ['#FF6B6B', '#EE5A24', '#E74C3C']
              }
              style={styles.gameEndCardGradient}
            >
              {/* Result Icon */}
              <View style={styles.resultIconContainer}>
                {gameEndResult?.isWinner ? (
                  <MaterialIcons name="celebration" size={scale(60)} color="#fff" />
                ) : (
                  <MaterialIcons name="sentiment-dissatisfied" size={scale(60)} color="#fff" />
                )}
              </View>

              {/* Result Text */}
              <Text style={styles.gameEndTitle}>
                {gameEndResult?.isWinner ? '🎉 YOU WON! 🎉' : '💔 YOU LOST'}
              </Text>
              
              {/* Show reason for game end */}
              {gameEndResult?.reason && (
                <Text style={styles.gameEndReason}>
                  {gameEndResult.reason === 'timeout' && 'Time ran out!'}
                  {gameEndResult.reason === 'opponent_timeout' && 'Opponent timed out!'}
                </Text>
              )}
              
              <Text style={styles.gameEndAmount}>
                {gameEndResult?.isWinner 
                  ? `+₹${gameEndResult?.amount}` 
                  : `-₹${gameEndResult?.amount}`
                }
              </Text>
              
              <Text style={styles.gameEndMessage}>
                {gameEndResult?.isWinner 
                  ? 'Congratulations! Keep playing to win more!' 
                  : "Don't give up! Victory is just one game away!"
                }
              </Text>

              {/* Action Buttons */}
              <View style={styles.gameEndActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleExit}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={['#6c757d', '#495057']}
                    style={styles.actionButtonGradient}
                  >
                    <MaterialIcons name="home" size={scale(20)} color="#fff" />
                    <Text style={styles.actionButtonText}>EXIT</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Match Status Banner */}
      {matchStatus ? (
        <View style={styles.matchStatusBanner}>
          <LinearGradient
            colors={
              matchStatus.includes('WON') || matchStatus.includes('win') 
                ? ['#4ECDC4', '#44A08D', '#2ECC71'] 
                : matchStatus.includes('Lost') || matchStatus.includes('lose') || matchStatus.includes('timed out')
                ? ['#FF6B6B', '#EE5A24'] 
                : matchStatus.includes("Don't give up") || matchStatus.includes('Keep playing')
                ? ['#8B5CF6', '#EC4899']
                : ['#4ECDC4', '#44A08D']
            }
            style={styles.matchStatusGradient}
          >
            <MaterialIcons 
              name={
                matchStatus.includes('WON') || matchStatus.includes('win')
                  ? "celebration" 
                  : matchStatus.includes('Lost') || matchStatus.includes('lose') || matchStatus.includes('timed out')
                  ? "sentiment-dissatisfied"
                  : matchStatus.includes("Don't give up") || matchStatus.includes('Keep playing')
                  ? "rocket-launch"
                  : "celebration"
              } 
              size={scale(18)} 
              color="#fff" 
            />
            <Text style={styles.matchStatusText}>{matchStatus}</Text>
          </LinearGradient>
        </View>
      ) : null}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
          <MaterialIcons name="arrow-back" size={scale(20)} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.gameTitle}>🎲 SIX KING 👑</Text>
          <Text style={styles.rollCounter}>
            Room: {roomCode}
          </Text>
        </View>
        
        <View style={styles.stakeContainer}>
          <MaterialIcons name="monetization-on" size={scale(18)} color="#FFD700" />
          <Text style={styles.stakeText}>₹{stake}</Text>
        </View>
      </View>

      {/* Players Section */}
      <View style={styles.playersContainer}>
        {/* Player - Always on LEFT */}
        <Animated.View 
          style={[
            styles.playerCard,
            styles.playerCardSelf,
            // Show player highlighting only when player is playing/rolling
            ((isMyTurn() && gameState === 'playing' && !waitingForOpponent && !currentRollingPlayer) ||
             (currentRollingPlayer && String(currentRollingPlayer) === String(user.id))) && { 
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
            {/* Show turn indicator for player when it's their turn or they're rolling */}
            {((isMyTurn() && !waitingForOpponent && !currentRollingPlayer) ||
              (currentRollingPlayer && String(currentRollingPlayer) === String(user.id))) && (
              <View style={styles.turnIndicator}>
                <MaterialIcons name="flash-on" size={scale(14)} color="#FFD700" />
                <Text style={styles.turnIndicatorText}>
                  {currentRollingPlayer && String(currentRollingPlayer) === String(user.id) 
                    ? 'Rolling...' 
                    : 'Your Turn!'}
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

        {/* Opponent - Always on RIGHT */}
        <Animated.View 
          style={[
            styles.playerCard,
            styles.opponentCard,
            // Show opponent highlighting only when opponent is playing/rolling
            ((!isMyTurn() && gameState === 'playing' && !waitingForOpponent && !currentRollingPlayer) ||
             (currentRollingPlayer && String(currentRollingPlayer) !== String(user.id))) && { 
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
            {/* Show turn indicator for opponent when it's their turn or they're rolling */}
            {((!isMyTurn() && gameState === 'playing' && !waitingForOpponent && !currentRollingPlayer) ||
              (currentRollingPlayer && String(currentRollingPlayer) !== String(user.id))) && (
              <View style={styles.turnIndicator}>
                <MaterialIcons name="flash-on" size={scale(14)} color="#FFD700" />
                <Text style={styles.turnIndicatorText}>
                  {currentRollingPlayer && String(currentRollingPlayer) !== String(user.id) 
                    ? 'Rolling...' 
                    : 'Playing...'}
                </Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>
      </View>

      {/* Dice Section - Show when game is playing */}
      {(gameState === 'playing' && !waitingForOpponent) && (
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
            {/* Only show glow effects when dice shows 6 AND not rolling AND no one is currently rolling */}
            {diceValue === 6 && !isRolling && !currentRollingPlayer && (
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
            
            <LinearGradient
              colors={diceValue === 6 && !isRolling && !currentRollingPlayer
                ? ['#FFD700', '#FF6B35', '#F7931E'] 
                : ['#667eea', '#764ba2', '#f093fb']
              }
              style={styles.dice}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.diceInnerBorder}>
                <MaterialIcons
                  name={getDiceIcon(diceValue)}
                  size={55}
                  color="#FFFFFF"
                  style={styles.diceIcon}
                />
              </View>
              
              <LinearGradient
                colors={['rgba(255,255,255,0.3)', 'transparent', 'rgba(255,255,255,0.1)']}
                style={styles.diceShine}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
            </LinearGradient>
            
            {/* Only show sparkles when dice shows 6 AND not rolling AND no one is currently rolling */}
            {diceValue === 6 && !isRolling && !currentRollingPlayer && (
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

          {/* Only show crown text when dice shows 6 AND not rolling AND no one is currently rolling */}
          {diceValue === 6 && !isRolling && !currentRollingPlayer && (playerSixes < 3 && opponentSixes < 3) && (
            <View style={styles.sixTextContainer}>
              <Text style={styles.sixText}>Crown Earned! 👑</Text>
            </View>
          )}
        </View>
      )}

      {/* Action Container */}
      <View style={styles.actionContainer}>
        {canPlayerRoll() ? (
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
                size={scale(24)} 
                color="#fff" 
              />
              <Text style={styles.rollButtonText}>
                ROLL DICE
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <View style={styles.disabledButtonContainer}>
            <LinearGradient
              colors={['#6c757d', '#495057', '#343a40']}
              style={styles.rollButtonGradient}
            >
              <MaterialIcons 
                name={waitingForOpponent ? "hourglass-empty" : 
                     (currentRollingPlayer || isRolling) ? "autorenew" : "pause"} 
                size={scale(24)} 
                color="#adb5bd" 
              />
              <Text style={styles.disabledButtonText}>
                {getDisabledButtonText()}
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
            {waitingForOpponent 
              ? (matchStatus || 'Waiting for opponent to join...') 
              : `Roll a 6 to earn a crown • ${rollCount} rolls played`
            }
          </Text>
        </LinearGradient>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // ===== CONTAINER & LAYOUT =====
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

  // ===== TIMER STYLES =====
  timerContainer: {
    position: 'absolute',
    bottom: height * 0.22, // Positioned above the roll dice button
    alignSelf: 'center',
    left: 0,
    right: 0,
    marginHorizontal: width * 0.4,
    zIndex: 1000,
    borderRadius: scale(20),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  timerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
  },
  timerText: {
    color: '#fff',
    fontSize: scale(14),
    fontWeight: 'bold',
    marginHorizontal: scale(8),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // ===== GAME END MODAL STYLES =====
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: width * 0.1,
  },
  gameEndCard: {
    width: '100%',
    maxWidth: 350,
    borderRadius: scale(25),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 20,
  },
  gameEndCardGradient: {
    padding: scale(30),
    alignItems: 'center',
  },
  resultIconContainer: {
    marginBottom: scale(20),
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameEndTitle: {
    fontSize: scale(24),
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: scale(10),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  gameEndReason: {
    fontSize: scale(14),
    color: '#fff',
    textAlign: 'center',
    marginBottom: scale(10),
    opacity: 0.8,
    fontStyle: 'italic',
  },
  gameEndAmount: {
    fontSize: scale(32),
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    marginBottom: scale(15),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  gameEndMessage: {
    fontSize: scale(16),
    color: '#fff',
    textAlign: 'center',
    marginBottom: scale(30),
    lineHeight: scale(22),
    opacity: 0.9,
  },
  gameEndActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    gap: scale(15),
  },
  actionButton: {
    flex: 1,
    borderRadius: scale(15),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: scale(14),
    paddingHorizontal: scale(20),
  },
  actionButtonText: {
    color: '#fff',
    fontSize: scale(14),
    fontWeight: 'bold',
    marginLeft: scale(8),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // ===== STATUS BANNER STYLES =====
  matchStatusBanner: {
    position: 'absolute',
    top: height * 0.12,
    left: width * 0.05,
    right: width * 0.05,
    zIndex: 1000,
    borderRadius: scale(20),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 12,
  },
  matchStatusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(18),
    paddingHorizontal: scale(24),
  },
  matchStatusText: {
    color: '#fff',
    fontSize: scale(16),
    fontWeight: 'bold',
    marginLeft: scale(12),
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    flexShrink: 1,
  },

  // ===== HEADER STYLES =====
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: width * 0.05,
    paddingTop: height * 0.06,
    paddingBottom: height * 0.025,
  },
  backButton: {
    padding: scale(12),
    borderRadius: scale(15),
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    width: scale(50),
    height: scale(50),
  },
  titleContainer: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: scale(15),
  },
  gameTitle: {
    fontSize: scale(24),
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 1.5,
  },
  rollCounter: {
    fontSize: scale(12),
    color: '#FFD700',
    marginTop: scale(4),
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  debugText: {
    fontSize: scale(8),
    color: '#FF6B6B',
    marginTop: scale(2),
    textAlign: 'center',
    opacity: 0.7,
  },
  stakeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: scale(14),
    paddingVertical: scale(8),
    borderRadius: scale(20),
    borderWidth: 1.5,
    borderColor: 'rgba(255, 215, 0, 0.4)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  stakeText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: scale(13),
    marginLeft: scale(6),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // ===== PLAYER CARD STYLES =====
  playersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: width * 0.05,
    marginTop: height * 0.03,
    marginBottom: height * 0.02,
  },
  playerCard: {
    borderRadius: scale(25),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 10,
    width: width * 0.35,
    maxWidth: 140,
  },
  opponentCard: {
    borderWidth: 2.5,
    borderColor: 'rgba(255, 107, 107, 0.6)',
  },
  playerCardSelf: {
    borderWidth: 2.5,
    borderColor: 'rgba(78, 205, 196, 0.6)',
  },
  playerCardGradient: {
    padding: scale(20),
    alignItems: 'center',
    minHeight: scale(180),
    justifyContent: 'space-between',
  },
  playerAvatar: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(8),
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarEmoji: {
    fontSize: scale(28),
  },
  playerName: {
    color: '#fff',
    fontSize: scale(15),
    fontWeight: 'bold',
    marginBottom: scale(12),
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    textAlign: 'center',
  },
  sixesContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: scale(8),
  },
  crownBadge: {
    width: scale(30),
    height: scale(30),
    borderRadius: scale(15),
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: scale(2),
    borderWidth: 2,
  },
  crownBadgeActive: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderColor: '#FFD700',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.6,
    shadowRadius: 5,
    elevation: 6,
  },
  crownBadgeInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: scale(6),
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: scale(6),
    paddingVertical: scale(3),
    borderRadius: scale(10),
    alignSelf: 'center',
  },
  turnIndicatorText: {
    color: '#FFD700',
    fontSize: scale(10),
    fontWeight: 'bold',
    marginLeft: scale(3),
  },
  vsContainer: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: scale(10),
  },
  vsText: {
    color: '#fff',
    fontSize: scale(16),
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },

  // ===== DICE STYLES =====
  diceSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: height * 0.02,
  },
  diceContainer: {
    position: 'relative',
    marginBottom: scale(20),
  },
  diceGlowOuter: {
    position: 'absolute',
    width: scale(140),
    height: scale(140),
    borderRadius: scale(25),
    backgroundColor: '#FF6B35',
    top: scale(-10),
    left: scale(-10),
  },
  diceGlowInner: {
    position: 'absolute',
    width: scale(130),
    height: scale(130),
    borderRadius: scale(22),
    backgroundColor: '#FFD700',
    top: scale(-5),
    left: scale(-5),
  },
  dice: {
    width: scale(120),
    height: scale(120),
    borderRadius: scale(20),
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
    borderRadius: scale(16),
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
    borderRadius: scale(20),
  },
  diceIcon: {
    fontSize: scale(50),
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  sparkle: {
    position: 'absolute',
  },
  sparkleEmoji: {
    fontSize: scale(14),
  },
  sixTextContainer: {
    alignItems: 'center',
    marginTop: scale(10),
  },
  sixText: {
    fontSize: scale(14),
    fontWeight: 'bold',
    color: '#FFD700',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },

  // ===== ACTION BUTTON STYLES =====
  actionContainer: {
    paddingHorizontal: width * 0.05,
    marginBottom: height * 0.03,
  },
  rollButton: {
    borderRadius: scale(25),
    overflow: 'hidden',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  disabledButtonContainer: {
    borderRadius: scale(25),
    overflow: 'hidden',
    opacity: 0.8,
  },
  rollButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: scale(16),
    paddingHorizontal: scale(24),
    minHeight: scale(55),
  },
  rollButtonText: {
    color: '#fff',
    fontSize: scale(16),
    fontWeight: 'bold',
    marginLeft: scale(10),
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  disabledButtonText: {
    color: '#adb5bd',
    fontSize: scale(14),
    fontWeight: '600',
    marginLeft: scale(10),
  },

  // ===== STATUS STYLES =====
  statusContainer: {
    alignItems: 'center',
    paddingHorizontal: width * 0.05,
    paddingBottom: height * 0.04,
  },
  statusCard: {
    borderRadius: scale(15),
    padding: scale(16),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    width: '100%',
    maxWidth: 350,
  },
  statusText: {
    color: '#fff',
    fontSize: scale(14),
    textAlign: 'center',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
    lineHeight: scale(20),
  },
  statusSubText: {
    color: '#BBB',
    fontSize: scale(11),
    textAlign: 'center',
    marginTop: scale(4),
  },

  // ===== SPECIAL EFFECTS STYLES =====
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
    fontSize: scale(32),
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
});