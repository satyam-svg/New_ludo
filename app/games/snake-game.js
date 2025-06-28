import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
  BackHandler,
  Modal,
  ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Line, Rect } from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');
const BOARD_SIZE = 10;
const CELL_SIZE = (width - 40) / BOARD_SIZE;

import config from '../../config';
const API_BASE_URL = `${config.BASE_URL}/api`;

// Snake and Ladder positions - 22 snakes total (7 in each 30 range)
const SNAKES = {
  // First 30 cells (1-30) - 7 snakes
  16: 1,
  23: 1,
  27: 1,
  11: 1,
  25: 1,
  19: 1,
  30: 1,
  
  // Second 30 cells (31-60) - 7 snakes
  47: 1,
  49: 1,
  56: 1,
  54: 1,
  58: 1,
  60: 1,
  52: 1,
  
  // Last 40 cells (61-100) - 8 snakes
  87: 1,
  93: 1,
  95: 1,
  98: 1,
  89: 1,
  91: 1,
  84: 1,
  96: 1,
   7: 1
};

const LADDERS = {
  // Lower section (1-25) - 3 ladders
  4: 17,
  18: 38,
  15: 26,
  
  // Mid-lower section (26-50) - 3 ladders
  28: 44,
  32: 51,
  42: 63,
  
  // Mid-upper section (51-75) - 3 ladders
  57: 76,
  62: 81,
  71: 90,
  37: 45,
  66: 74,
  64: 77,
  78: 82
  
  // Upper section (76-95) - 0 ladders (too close to finish)
};

// Realistic Ladder Component
const RealisticLadder = ({ start, end, isActive, opacity = 1 }) => {
  const startCenter = getCellCenter(start);
  const endCenter = getCellCenter(end);
  
  // Calculate ladder dimensions
  const ladderLength = Math.sqrt(
    Math.pow(endCenter.x - startCenter.x, 2) + 
    Math.pow(endCenter.y - startCenter.y, 2)
  );
  
  // Calculate angle
  const angle = Math.atan2(endCenter.y - startCenter.y, endCenter.x - startCenter.x) * 180 / Math.PI;
  
  // Number of rungs based on ladder length
  const numRungs = Math.floor(ladderLength / 15);
  const rungSpacing = ladderLength / (numRungs + 1);
  
  const strokeColor = isActive ? '#FFD700' : '#228B22'; // Green color for ladders
  const strokeWidth = isActive ? 3 : 2;
  
  return (
    <Svg
      style={StyleSheet.absoluteFillObject}
      width="100%"
      height="100%"
    >
      {/* Left rail */}
      <Line
        x1={startCenter.x - 3}
        y1={startCenter.y}
        x2={endCenter.x - 3}
        y2={endCenter.y}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={opacity}
        strokeLinecap="round"
      />
      
      {/* Right rail */}
      <Line
        x1={startCenter.x + 3}
        y1={startCenter.y}
        x2={endCenter.x + 3}
        y2={endCenter.y}
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        opacity={opacity}
        strokeLinecap="round"
      />
      
      {/* Rungs */}
      {Array.from({ length: numRungs }, (_, i) => {
        const progress = (i + 1) / (numRungs + 1);
        const rungX = startCenter.x + (endCenter.x - startCenter.x) * progress;
        const rungY = startCenter.y + (endCenter.y - startCenter.y) * progress;
        
        return (
          <Line
            key={i}
            x1={rungX - 6}
            y1={rungY}
            x2={rungX + 6}
            y2={rungY}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            opacity={opacity}
            strokeLinecap="round"
          />
        );
      })}
    </Svg>
  );
};

// Helper function to get cell center coordinates
function getCellCenter(number) {
  const board = generateBoard();
  for (let row = 0; row < BOARD_SIZE; row++) {
    for (let col = 0; col < BOARD_SIZE; col++) {
      if (board[row][col] === number) {
        return {
          x: col * CELL_SIZE + CELL_SIZE / 2,
          y: row * CELL_SIZE + CELL_SIZE / 2
        };
      }
    }
  }
  return { x: 0, y: 0 };
}

// Helper function to generate board
function generateBoard() {
  const board = [];
  for (let row = 0; row < BOARD_SIZE; row++) {
    const rowNumbers = [];
    for (let col = 0; col < BOARD_SIZE; col++) {
      if ((9 - row) % 2 === 0) {
        // Left to right for even rows (from bottom)
        rowNumbers.push((9 - row) * 10 + col + 1);
      } else {
        // Right to left for odd rows (from bottom)
        rowNumbers.push((9 - row) * 10 + (9 - col) + 1);
      }
    }
    board.push(rowNumbers);
  }
  return board;
}

export default function SnakeGameScreen() {
  const params = useLocalSearchParams();
  const { user, updateWallet } = useAuth();
  
  // Parse parameters
  const mode = params.mode1 ? JSON.parse(params.mode1) : {};
  const stake = parseInt(params.stake) || 0;
  
  // Backend Integration States
  const [gameState, setGameState] = useState('starting'); // starting, playing, finished
  const [gameId, setGameId] = useState(null);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [isFinalizingGame, setIsFinalizingGame] = useState(false);
  const [isLeavingGame, setIsLeavingGame] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [winAmount, setWinAmount] = useState(0);
  const gameIdRef = useRef(null);
  
  // Game state
  const [playerPosition, setPlayerPosition] = useState(0);
  const [diceValue, setDiceValue] = useState(1);
  const [isRolling, setIsRolling] = useState(false);
  
  // Dice face mapping
  const getDiceFace = (value) => {
    const diceFaces = {
      1: '⚀',
      2: '⚁',
      3: '⚂',
      4: '⚃',
      5: '⚄',
      6: '⚅'
    };
    return diceFaces[value] || '⚀';
  };
  const [gameStatus, setGameStatus] = useState('playing'); // playing, won, lost
  const [moveHistory, setMoveHistory] = useState([]);
  const [rollAnimation] = useState(new Animated.Value(0));
  const [transferAnimation] = useState(new Animated.Value(0));
  const [pathAnimation] = useState(new Animated.Value(0));
  const [resultAnim] = useState(new Animated.Value(0));
  const [currentRoll, setCurrentRoll] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferType, setTransferType] = useState(null); // 'snake' or 'ladder'
  const [activeTransferPath, setActiveTransferPath] = useState(null);

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

  // Back button handler
  const handleBackPress = () => {
    if (isLeavingGame) return true;
    
    // If game hasn't started yet, simply go back
    if (gameState === 'starting' && !gameId) {
      router.back();
      return true;
    }
    
    // If game has started, show confirmation alert
    if (gameId || gameState === 'playing' || gameState === 'finished' || isStartingGame) {
      Alert.alert(
        'Leave Game',
        'Are you sure you want to leave? You will lose your stake.',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Leave', style: 'destructive', onPress: () => leave_game() }
        ]
      );
      return true;
    }
    
    router.back();
    return true;
  };

  // Device back button handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, [gameState, gameId, isLeavingGame, isStartingGame]);

  // Start game automatically when component mounts
  useEffect(() => {
    startGame();
  }, []);

  const startGame = async () => {
    try {
      setIsStartingGame(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const response = await apiCall('/snake-game/start', 'POST', {
        stake: parseFloat(stake),
        mode: mode
      });

      if (response.success) {
        const newGameId = response.gameId;
        gameIdRef.current = newGameId; 
        setGameId(newGameId);
        setGameState('playing');
        setWinAmount(response.winAmount);
        setCurrentRoll(0);
        setPlayerPosition(0);
        setGameStatus('playing');
        setMoveHistory([]);
        
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        Alert.alert('Error', 'Failed to start game');
        router.back();
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to start game');
      console.error('Error starting game:', error);
      router.back();
    } finally {
      setIsStartingGame(false);
    }
  };

  const leave_game = async () => {
    try {
      setIsLeavingGame(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      const response = await apiCall('/snake-game/leave_game', 'POST', {
        gameId: gameIdRef.current
      });
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/");
      
    } catch (error) {
      setIsLeavingGame(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to leave game');
      console.error('Error leaving game:', error);
    }
  };

  const finalizeGame = async (gameResult) => {
    try {
      setIsFinalizingGame(true);

      const response = await apiCall('/snake-game/finalize', 'POST', {
        gameId: gameIdRef.current,
        result: gameResult
      });

      if (response.success) {
        // Update wallet from backend response
        await updateWallet(response.newBalance);
        
        Animated.timing(resultAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }).start();

        setShowResult(true);
        setGameState('finished');
      } else {
        Alert.alert('Error', 'Failed to finalize game');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to finalize game');
      console.error('Error finalizing game:', error);
    } finally {
      setIsFinalizingGame(false);
    }
  };

  const animateTransfer = (type, callback) => {
    setIsTransferring(true);
    setTransferType(type);
    
    // Set active transfer path for highlighting
    const currentPos = playerPosition;
    const targetPos = type === 'snake' ? SNAKES[currentPos] : LADDERS[currentPos];
    setActiveTransferPath({ from: currentPos, to: targetPos, type });
    
    // Animate the path
    Animated.sequence([
      Animated.timing(pathAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(transferAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(transferAnimation, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsTransferring(false);
      setTransferType(null);
      setActiveTransferPath(null);
      pathAnimation.setValue(0);
      callback();
    });
  };

  const goToHomePage = () => {
    router.replace('/');
  };

  // Generate board numbers (1 to 100, starting from bottom left)
  const generateBoard = () => {
    const board = [];
    for (let row = 0; row < BOARD_SIZE; row++) {
      const rowNumbers = [];
      for (let col = 0; col < BOARD_SIZE; col++) {
        if ((9 - row) % 2 === 0) {
          // Left to right for even rows (from bottom)
          rowNumbers.push((9 - row) * 10 + col + 1);
        } else {
          // Right to left for odd rows (from bottom)
          rowNumbers.push((9 - row) * 10 + (9 - col) + 1);
        }
      }
      board.push(rowNumbers);
    }
    return board;
  };

  const board = generateBoard();

  // Step-by-step movement animation for normal rolls
  const animateStepByStepMovement = (startPos, steps, callback) => {
    let currentStep = 0;
    
    const moveOneStep = () => {
      if (currentStep < steps) {
        setPlayerPosition(startPos + currentStep + 1);
        currentStep++;
        setTimeout(moveOneStep, 300); // 300ms delay between each step
      } else {
        callback();
      }
    };
    
    moveOneStep();
  };

  const rollDice = async () => {
    if (isRolling || gameStatus !== 'playing' || gameState !== 'playing' || !gameId) return;

    try {
      setIsRolling(true);
      setCurrentRoll(currentRoll + 1);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      
      // Animate dice
      Animated.sequence([
        Animated.timing(rollAnimation, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(rollAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Call backend to roll dice
      const response = await apiCall('/snake-game/roll', 'POST', {
        gameId: gameIdRef.current,
        currentPosition: playerPosition,
        rollNumber: currentRoll + 1
      });

      if (!response.success) {
        Alert.alert('Error', 'Failed to roll dice');
        setIsRolling(false);
        return;
      }

      setTimeout(() => {
        const newDiceValue = response.diceValue;
        setDiceValue(newDiceValue);
        
        let newPosition = playerPosition + newDiceValue;
        
        // Check if player reaches or exceeds 100 - INSTANT WIN
        if (newPosition >= 100) {
          newPosition = 100;
          
          // Animate step by step to 100
          animateStepByStepMovement(playerPosition, newPosition - playerPosition, () => {
            setGameStatus('won');
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            setTimeout(() => {
              finalizeGame({
                result: 'won',
                reason: 'reached_finish',
                finalPosition: 100,
                rollsUsed: currentRoll + 1
              });
            }, 1000);
            
            setIsRolling(false);
          });
          return;
        }
        
        // Check for snakes - IMMEDIATE LOSS
        if (SNAKES[newPosition]) {
          const snakeEnd = SNAKES[newPosition];
          setMoveHistory(prev => [...prev, {
            roll: currentRoll + 1,
            dice: newDiceValue,
            from: playerPosition,
            to: newPosition,
            snake: snakeEnd,
            type: 'snake'
          }]);
          
          // Move step by step to snake position, then animate transfer
          animateStepByStepMovement(playerPosition, newDiceValue, () => {
            animateTransfer('snake', () => {
              setPlayerPosition(snakeEnd);
              
              // Snake bite = immediate game over
              setGameStatus('lost');
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
              
              setTimeout(() => {
                finalizeGame({
                  result: 'lost',
                  reason: 'snake_bite',
                  finalPosition: snakeEnd,
                  rollsUsed: currentRoll + 1
                });
              }, 500);
              
              setIsRolling(false);
            });
          });
        }
        // Check for ladders
        else if (LADDERS[newPosition]) {
          const ladderEnd = LADDERS[newPosition];
          setMoveHistory(prev => [...prev, {
            roll: currentRoll + 1,
            dice: newDiceValue,
            from: playerPosition,
            to: newPosition,
            ladder: ladderEnd,
            type: 'ladder'
          }]);
          
          // Move step by step to ladder position, then animate transfer
          animateStepByStepMovement(playerPosition, newDiceValue, () => {
            animateTransfer('ladder', () => {
              setPlayerPosition(ladderEnd);
              
              // After ladder, check if we reached 100 - INSTANT WIN
              if (ladderEnd >= 100) {
                setGameStatus('won');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
                setTimeout(() => {
                  finalizeGame({
                    result: 'won',
                    reason: 'reached_finish',
                    finalPosition: 100,
                    rollsUsed: currentRoll + 1
                  });
                }, 1000);
              }
              // FIXED: Check if max rolls reached after ladder (survival win)
              else if (currentRoll + 1 >= mode.rolls) {
                setGameStatus('won');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                
                setTimeout(() => {
                  finalizeGame({
                    result: 'won',
                    reason: 'survived_all_rolls',
                    finalPosition: ladderEnd,
                    rollsUsed: currentRoll + 1
                  });
                }, 1000);
              }
              
              setIsRolling(false);
            });
          });
        }
        // Normal move
        else {
          setMoveHistory(prev => [...prev, {
            roll: currentRoll + 1,
            dice: newDiceValue,
            from: playerPosition,
            to: newPosition,
            type: 'normal'
          }]);
          
          // Move step by step for normal moves
          animateStepByStepMovement(playerPosition, newDiceValue, () => {
            // Check if max rolls reached - SURVIVAL WIN if no snake bite
            if (currentRoll + 1 >= mode.rolls) {
              setGameStatus('won'); // CHANGED: Now this is a WIN, not a loss
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              
              setTimeout(() => {
                finalizeGame({
                  result: 'won',
                  reason: 'survived_all_rolls',
                  finalPosition: newPosition,
                  rollsUsed: currentRoll + 1
                });
              }, 1500);
            }
            
            setIsRolling(false);
          });
        }
      }, 900);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to roll dice');
      console.error('Error rolling dice:', error);
      setIsRolling(false);
    }
  };

  const getCellPosition = (number) => {
    for (let row = 0; row < BOARD_SIZE; row++) {
      for (let col = 0; col < BOARD_SIZE; col++) {
        if (board[row][col] === number) {
          return { row, col };
        }
      }
    }
    return { row: 0, col: 0 };
  };

  // Get center coordinates of a cell for path drawing
  const getCellCenter = (number) => {
    const { row, col } = getCellPosition(number);
    return {
      x: col * CELL_SIZE + CELL_SIZE / 2,
      y: row * CELL_SIZE + CELL_SIZE / 2
    };
  };

  // Generate only ladder paths with realistic design
  const generatePaths = () => {
    const paths = [];
    
    // Only Ladder paths with realistic design
    Object.entries(LADDERS).forEach(([start, end]) => {
      const isActive = activeTransferPath?.from === parseInt(start) && activeTransferPath?.type === 'ladder';
      
      paths.push(
        <RealisticLadder
          key={`ladder-${start}-${end}`}
          start={parseInt(start)}
          end={parseInt(end)}
          isActive={isActive}
          opacity={isActive ? 1 : 0.8}
        />
      );
    });
    
    return paths;
  };

  const getDiceRotation = rollAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '720deg'],
  });

  const getTransferScale = transferAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.5, 1],
  });

  const getTransferOpacity = transferAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.7, 1],
  });

  const getPathPulse = pathAnimation.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.3, 1],
  });

  // Render result modal similar to Lucky Number game
  const renderResult = () => {
    return (
      <Modal
        visible={showResult}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.resultOverlay}>
          <LinearGradient
            colors={['rgba(0, 0, 0, 0.8)', 'rgba(26, 26, 46, 0.9)']}
            style={styles.resultModalContainer}
          >
            <Animated.View style={[
              styles.resultCard,
              { opacity: resultAnim }
            ]}>
              <LinearGradient
                colors={gameStatus === 'won' ? ['#4ECDC4', '#44A08D', '#2ECC71'] : ['#FF6B6B', '#FF8E53', '#FF6B35']}
                style={styles.resultCardGradient}
              >
                <View style={styles.resultHeader}>
                  <Text style={styles.resultEmoji}>
                    {gameStatus === 'won' ? '🎉' : '😔'}
                  </Text>
                  <Text style={styles.resultTitle}>
                    {gameStatus === 'won' ? 'VICTORY!' : 'GAME OVER!'}
                  </Text>
                </View>
                
                <View style={styles.resultAmountContainer}>
                  <Text style={styles.resultAmount}>
                    {gameStatus === 'won' ? `+₹${winAmount}` : `-₹${stake}`}
                  </Text>
                </View>
                
                <Text style={styles.resultSubtext}>
                  {gameStatus === 'won' 
                    ? playerPosition >= 100
                      ? `You reached position 100 in ${currentRoll} rolls! 🎯` 
                      : `You survived ${mode.rolls} rolls without snake bite! 🛡️`
                    : moveHistory[moveHistory.length - 1]?.type === 'snake'
                    ? `Snake bite at position ${playerPosition}! 🐍`
                    : `Unexpected game end at position ${playerPosition}! ⚠️`
                  }
                </Text>
                
                <View style={styles.resultButtons}>
                  <TouchableOpacity 
                    style={styles.exitButton}
                    onPress={goToHomePage}
                  >
                    <View style={styles.exitButtonInner}>
                      <MaterialIcons name="home" size={20} color="#fff" />
                      <Text style={styles.exitText}>Home</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </LinearGradient>
            </Animated.View>
          </LinearGradient>
        </View>
      </Modal>
    );
  };

  // Loading modal for starting game
  if (gameState === 'starting') {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={['rgba(20, 13, 38, 0.88)', 'rgba(26, 26, 46, 0.9)']}
          style={styles.loadingModalContainer}
        >
          <View style={styles.loadingCard}>
            <LinearGradient
              colors={['#1a1a2e', '#16213e', '#0f3460']}
              style={styles.loadingCardGradient}
            >
              <View style={styles.startIconContainer}>
                <Text style={styles.snakeEmoji}>🐍</Text>
              </View>
              
              <Text style={styles.loadingTitle}>Starting Snake Game...</Text>
              <Text style={styles.loadingSubtitle}>Setting up your adventure</Text>
              
              <View style={styles.spinnerContainer}>
                <ActivityIndicator 
                  size="large" 
                  color="#4ECDC4" 
                  style={styles.loadingSpinner}
                />
              </View>
              
              <View style={styles.warningContainer}>
                <MaterialIcons name="info" size={16} color="#4ECDC4" />
                <Text style={styles.warningText}>Stake: ₹{stake} • Mode: {mode.name}</Text>
              </View>
            </LinearGradient>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
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
                      <ActivityIndicator 
                        size="large" 
                        color="#FF6B6B" 
                        style={styles.loadingSpinner}
                      />
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

        {/* Result Modal */}
        {renderResult()}

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
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerInfo}>
            <Text style={styles.gameTitle}>Snake & Ladder</Text>
            <Text style={styles.modeText}>{mode.name}</Text>
          </View>
        </View>

        {/* Game Info */}
        <View style={styles.infoRow}>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Position</Text>
            <Text style={styles.positionValue}>{playerPosition}/100</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Rolls</Text>
            <Text style={styles.infoValue}>{currentRoll}/{mode.rolls}</Text>
          </View>
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Stake</Text>
            <Text style={styles.stakeValue}>₹{stake}</Text>
          </View>
        </View>

        {/* Game Board */}
        <View style={styles.boardContainer}>
          <View style={styles.boardWrapper}>
            <View style={styles.board}>
              {/* Path indicators overlay - Only ladders now */}
              <View style={styles.pathOverlay}>
                {generatePaths()}
              </View>
              
              {board.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.row}>
                  {row.map((number, colIndex) => {
                    const isPlayerHere = playerPosition === number;
                    const hasSnake = SNAKES[number];
                    const hasLadder = LADDERS[number];
                    const isActiveTransferStart = activeTransferPath?.from === number;
                    const isActiveTransferEnd = activeTransferPath?.to === number;
                    
                    return (
                      <View
                        key={number}
                        style={[
                          styles.cell,
                          hasSnake && styles.snakeCell,
                          hasLadder && styles.ladderCell,
                          isPlayerHere && styles.playerCell,
                          isActiveTransferStart && styles.activeTransferStartCell,
                          isActiveTransferEnd && styles.activeTransferEndCell,
                        ]}
                      >
                        <Text style={[
                          styles.cellNumber,
                          isPlayerHere && styles.playerCellNumber
                        ]}>
                          {number}
                        </Text>
                        {hasSnake && (
                          <View style={styles.iconContainer}>
                            <Text style={[
                              styles.snakeEmoji,
                              isActiveTransferStart && styles.activeIcon
                            ]}>🐍</Text>
                          </View>
                        )}
                        {hasLadder && (
                          <View style={styles.iconContainer}>
                            <Text style={[
                              styles.ladderEmoji,
                              isActiveTransferStart && styles.activeIcon
                            ]}>🪜</Text>
                          </View>
                        )}
                        {isPlayerHere && (
                          <Animated.View
                            style={[
                              styles.playerContainer,
                              isTransferring && {
                                transform: [{ scale: getTransferScale }],
                                opacity: getTransferOpacity,
                              }
                            ]}
                          >
                            <Text style={styles.playerEmoji}>🔴</Text>
                            {isTransferring && (
                              <Animated.Text 
                                style={[
                                  styles.transferText,
                                  { transform: [{ scale: getPathPulse }] }
                                ]}
                              >
                                {transferType === 'snake' ? '🐍' : '🪜'}
                              </Animated.Text>
                            )}
                          </Animated.View>
                        )}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Dice and Controls */}
        <View style={styles.controls}>
          <View style={styles.diceContainer}>
            <Animated.View
              style={[
                styles.dice,
                { transform: [{ rotate: getDiceRotation }] }
              ]}
            >
              <Text style={styles.diceText}>
                {getDiceFace(diceValue)}
              </Text>
            </Animated.View>
            <Text style={styles.diceValue}>Value: {diceValue}</Text>
          </View>
          
          <TouchableOpacity
            style={[
              styles.rollButton,
              {
                backgroundColor: isRolling || isFinalizingGame || isLeavingGame ? '#666' : 
                  gameStatus === 'won' ? '#00D4AA' :
                  gameStatus === 'lost' ? '#FF4757' : '#7C3AED'
              }
            ]}
            onPress={rollDice}
            disabled={isRolling || gameStatus !== 'playing' || isTransferring || isFinalizingGame || isLeavingGame}
          >
            <Text style={styles.rollButtonText}>
              {isRolling ? 'Rolling...' : 
               isTransferring ? (transferType === 'snake' ? '🐍 Snake Bite!' : '🪜 Climbing...') :
               isFinalizingGame ? 'Finalizing...' :
               gameStatus === 'won' ? '🎉 You Won!' :
               gameStatus === 'lost' ? '💀 Game Over' : '🎲 Roll Dice'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Move History */}
        {moveHistory.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.historyTitle}>Last Move:</Text>
            <Text style={styles.historyText}>
              {moveHistory[moveHistory.length - 1]?.type === 'snake' 
                ? `🐍 Snake! ${moveHistory[moveHistory.length - 1].to} → ${moveHistory[moveHistory.length - 1].snake}`
                : moveHistory[moveHistory.length - 1]?.type === 'ladder'
                ? `🪜 Ladder! ${moveHistory[moveHistory.length - 1].to} → ${moveHistory[moveHistory.length - 1].ladder}`
                : `Moved to ${playerPosition}`}
            </Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(20, 13, 38, 0.88)',
  },
  safeArea: {
    flex: 1,
  },
  
  // Loading styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
    borderColor: 'rgba(76, 205, 196, 0.3)',
  },
  startIconContainer: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 50,
    backgroundColor: 'rgba(76, 205, 196, 0.1)',
    borderWidth: 2,
    borderColor: 'rgba(76, 205, 196, 0.3)',
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
    textShadowColor: 'rgba(76, 205, 196, 0.5)',
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
  loadingSpinner: {
    transform: [{ scale: 1.2 }],
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 205, 196, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(76, 205, 196, 0.3)',
  },
  warningText: {
    fontSize: 12,
    color: '#4ECDC4',
    marginLeft: 6,
    fontWeight: '600',
  },

  // Result modal styles
  resultOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: width * 0.05,
  },
  resultModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  resultCard: {
    width: '90%',
    maxWidth: 380,
    borderRadius: 25,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 20,
  },
  resultCardGradient: {
    padding: 30,
    alignItems: 'center',
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
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 60,
    gap: 10,
    marginBottom: 5,
  },
  gameTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  modeText: {
    fontSize: 14,
    color: '#FFD700',
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 10,
    marginBottom: 5,
  },
  infoCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  positionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#00D4AA',
  },
  stakeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  boardWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  board: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 5,
    position: 'relative',
  },
  pathOverlay: {
    position: 'absolute',
    top: 5,
    left: 5,
    right: 5,
    bottom: 5,
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    zIndex: 2,
  },
  snakeCell: {
    backgroundColor: 'rgba(255, 71, 87, 0.3)',
  },
  ladderCell: {
    backgroundColor: 'rgba(0, 212, 170, 0.3)',
  },
  playerCell: {
    backgroundColor: 'rgba(255, 215, 0, 0.5)',
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  activeTransferStartCell: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  activeTransferEndCell: {
    backgroundColor: 'rgba(0, 255, 0, 0.3)',
    borderWidth: 2,
    borderColor: '#00FF00',
  },
  cellNumber: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
    position: 'absolute',
    top: 2,
    left: 2,
  },
  playerCellNumber: {
    color: '#000',
  },
  iconContainer: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  snakeEmoji: {
    fontSize: 12,
  },
  ladderEmoji: {
    fontSize: 12,
  },
  activeIcon: {
    fontSize: 14,
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 5,
  },
  playerEmoji: {
    fontSize: 16,
  },
  playerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  transferText: {
    fontSize: 12,
    position: 'absolute',
    top: -8,
  },
  controls: {
    padding: 20,
    alignItems: 'center',
  },
  diceContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  dice: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  diceText: {
    fontSize: 30,
  },
  diceValue: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  rollButton: {
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 40,
    minWidth: 200,
    alignItems: 'center',
  },
  rollButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  historyContainer: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    alignItems: 'center',
  },
  historyTitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  historyText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});