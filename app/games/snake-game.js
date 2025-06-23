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
  ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import Svg, { Line, Rect } from 'react-native-svg';

const { width } = Dimensions.get('window');
const BOARD_SIZE = 10;
const CELL_SIZE = (width - 40) / BOARD_SIZE;

// Snake and Ladder positions - 22 snakes total (7 in each 30 range)
const SNAKES = {
  // First 30 cells (1-30) - 7 snakes
  16: 6,
  23: 8,
  27: 12,
  11: 1,
  25: 4,
  19: 2,
  30: 15,
  
  // Second 30 cells (31-60) - 7 snakes
  47: 26,
  49: 35,
  56: 33,
  54: 31,
  58: 37,
  60: 41,
  52: 28,
  
  // Last 40 cells (61-100) - 8 snakes
  87: 24,
  93: 73,
  95: 75,
  98: 78,
  89: 67,
  91: 69,
  84: 62,
  96: 74,
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
  const router = useRouter();
  const { user, updateWallet } = useAuth();
  
  // Parse parameters
  const mode = params.mode ? JSON.parse(params.mode) : {};
  const stake = parseInt(params.stake) || 0;
  
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
  const [currentRoll, setCurrentRoll] = useState(0);
  const [isTransferring, setIsTransferring] = useState(false);
  const [transferType, setTransferType] = useState(null); // 'snake' or 'ladder'
  const [activeTransferPath, setActiveTransferPath] = useState(null);

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
    router.push('/'); // Adjust path to your home page
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

  const rollDice = () => {
    if (isRolling || gameStatus !== 'playing') return;

    setIsRolling(true);
    setCurrentRoll(currentRoll + 1);
    
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

    setTimeout(() => {
      const newDiceValue = Math.floor(Math.random() * 6) + 1;
      setDiceValue(newDiceValue);
      
      let newPosition = playerPosition + newDiceValue;
      
      // Check if player reaches or exceeds 100
      if (newPosition >= 100) {
        newPosition = 100;
        
        // Animate step by step to 100
        animateStepByStepMovement(playerPosition, newPosition - playerPosition, () => {
          setGameStatus('won');
          
          // Win logic
          const winAmount = stake * mode.multiplier;
          updateWallet(user.wallet + winAmount - stake);
          
          setTimeout(() => {
            Alert.alert(
              '🎉 Congratulations!',
              `You reached 100!\nYou won ₹${winAmount.toFixed(1)}!`,
              [
                { text: 'Home', onPress: goToHomePage },
                { text: 'Play Again', onPress: () => router.back() }
              ]
            );
          }, 1000);
          
          setIsRolling(false);
        });
        return;
      }
      
      // Check for snakes
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
            updateWallet(user.wallet - stake);
            
            setTimeout(() => {
              Alert.alert(
                '🐍 Snake Bite!',
                `You were bitten by a snake!\nGame Over!\nYou lost ₹${stake}`,
                [
                  { text: 'Home', onPress: goToHomePage },
                  { text: 'Try Again', onPress: () => router.back() }
                ]
              );
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
          // Check if max rolls reached without winning
          if (currentRoll + 1 >= mode.rolls && newPosition < 100) {
            setGameStatus('lost');
            updateWallet(user.wallet - stake);
            setTimeout(() => {
              Alert.alert(
                '⏰ Time Up!',
                `You didn't reach 100 in ${mode.rolls} rolls!\nYou lost ₹${stake}`,
                [
                  { text: 'Home', onPress: goToHomePage },
                  { text: 'Try Again', onPress: () => router.back() }
                ]
              );
            }, 1500);
          }
          
          setIsRolling(false);
        });
      }
    }, 900);
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

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
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
                backgroundColor: isRolling ? '#666' : 
                  gameStatus === 'won' ? '#00D4AA' :
                  gameStatus === 'lost' ? '#FF4757' : '#7C3AED'
              }
            ]}
            onPress={rollDice}
            disabled={isRolling || gameStatus !== 'playing' || isTransferring}
          >
            <Text style={styles.rollButtonText}>
              {isRolling ? 'Rolling...' : 
               isTransferring ? (transferType === 'snake' ? '🐍 Snake Bite!' : '🪜 Climbing...') :
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