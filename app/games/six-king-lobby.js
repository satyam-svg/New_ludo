// app/games/six-king-lobby.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  FlatList,
  ActivityIndicator,
  Share,
  TextInput,
  BackHandler,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

export default function SixKingLobby() {
  const { user } = useAuth();
  const [selectedStake, setSelectedStake] = useState(100);
  const [customStake, setCustomStake] = useState('');
  const [gameCode, setGameCode] = useState('');
  const [lobbyState, setLobbyState] = useState('menu'); // menu, creating, joining, waiting, matched
  const [isLoading, setIsLoading] = useState(false);
  const [waitingMessage, setWaitingMessage] = useState('');
  const [createdGameCode, setCreatedGameCode] = useState('');
  const [connectedPlayers, setConnectedPlayers] = useState(0);

  const predefinedStakes = [50, 100, 250, 500, 1000, 2500];
  useEffect(() => {
  const backHandler = BackHandler.addEventListener('hardwareBackPress', router.back);
      return () => {
        backHandler.remove();
      };
    }, []);

  const { isConnected, sendMessage, disconnect, connectionError } = useWebSocket({
    onMessage: handleWebSocketMessage,
    onConnect: handleSocketConnect,
    onDisconnect: handleSocketDisconnect
  });
  function handleSocketConnect() {
    console.log('✅ Connected to Six King lobby');
    setLobbyState('menu');
  }

  function handleSocketDisconnect() {
    setLobbyState('menu');
    setIsLoading(false);
    Alert.alert('Connection Lost', 'Lost connection to game server.');
  }

  function handleWebSocketMessage(message) {
  const { type, data } = message;
  console.log('📨 Lobby message received:', type, data);

  switch (type) {
    case 'connected':
      console.log('Welcome message:', data.message);
      break;
      
    case 'game_created':
      handleGameCreated(data);
      break;
      
    case 'game_joined':
      handleGameJoined(data);
      break;
      
    case 'player_joined':
      handlePlayerJoined(data);
      break;
      
    case 'game_matched':
      handleGameMatched(data);
      break;
      
    case 'game_started':
      handleGameStarted(data);
      break;
      
    case 'queued':
      handleQueued(data);
      break;
      
    case 'error':
      handleError(data);
      break;
      
    // Game messages - forward to global state for game screen
    case 'dice_rolled':
    case 'turn_changed':
    case 'game_ended':
      console.log(`Game message ${type} received in lobby - will be handled by game screen`);
      // Game screen will receive this message too via the shared WebSocket
      break;
      
    default:
      console.log('Unknown message type:', type);
  }
}

  function handleGameStarted(data) {
    console.log('🎮 Game started from lobby, navigating immediately...', data);
    setLobbyState('matched');
    
    
    // disconnect();
    // Navigate immediately with complete game data - NO POPUP!
    router.push({
      pathname: '/games/six-king',
      params: { 
        stake: data.stake.toString(),
        gameId: data.gameId,
        firstPlayer: data.firstPlayer,
        players: JSON.stringify(data.players),
        gameStarted: 'true'
      }
    });
  }

  function handleGameMatched(data) {
    console.log('🎯 Match found from lobby:', data);
    setLobbyState('matched');
    setWaitingMessage(`Matched with ${data.opponent.name}!`);
    setIsLoading(false);
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Don't navigate here, wait for game_started
    // No popup - just update the waiting message
  }

  function handlePlayerJoined(data) {
    setWaitingMessage(`${data.player.name} joined the game!`);
    setConnectedPlayers(2);
    
    // Auto-start game when both players are present
    setTimeout(() => {
      if (createdGameCode) {
        startGame();
      }
    }, 1000);
  }


  function handleQueued(data) {
    setLobbyState('waiting');
    setWaitingMessage(data.message);
    setIsLoading(false);
  }

  function handleError(data) {
    setIsLoading(false);
    setLobbyState('menu');
    
    let errorMessage = data.message || 'An error occurred';
    
    if (data.code === 'GAME_NOT_FOUND') {
      errorMessage = 'Game not found. Please check the room code.';
    } else if (data.code === 'GAME_FULL') {
      errorMessage = 'This game is already full.';
    } else if (data.code === 'STAKE_MISMATCH') {
      errorMessage = 'Your stake amount doesn\'t match the game stake.';
    }
    
    Alert.alert('Error', errorMessage);
  }

  const getCurrentStake = () => {
    return customStake ? parseInt(customStake) : selectedStake;
  };

  const validateStake = () => {
    const stake = getCurrentStake();
    if (!stake || stake < 10) {
      Alert.alert('Invalid Stake', 'Minimum stake is ₹10');
      return false;
    }
    if (stake > user.wallet) {
      Alert.alert('Insufficient Balance', `You need ₹${stake} to play this game.`);
      return false;
    }
    return true;
  };

  const createGame = () => {
    if (!validateStake()) return;
    if (!isConnected) {
      Alert.alert('Connection Error', 'Please check your internet connection');
      return;
    }

    setIsLoading(true);
    setLobbyState('creating');
    sendMessage('create_game', {
      playerId: user.id,
      playerName: user.name || `Player${user.id}`,
      stake: getCurrentStake(),
      gameType: 'six_king'
    });
  };

  const joinGame = () => {
    if (!gameCode.trim()) {
      Alert.alert('Invalid Code', 'Please enter a valid game code');
      return;
    }
    if (!validateStake()) return;
    if (!isConnected) {
      Alert.alert('Connection Error', 'Please check your internet connection');
      return;
    }

    setIsLoading(true);
    setLobbyState('joining');

    sendMessage('join_game', {
      gameId: gameCode.trim().toUpperCase(),
      playerId: user.id,
      playerName: user.name || "You",
      stake: getCurrentStake()
    });
  };

  const quickMatch = () => {
    if (!validateStake()) return;
    if (!isConnected) {
      Alert.alert('Connection Error', 'Please check your internet connection');
      return;
    }

    setIsLoading(true);
    setLobbyState('waiting');
    setWaitingMessage('Looking for an opponent...');

    sendMessage('join_queue', {
      playerId: user.id,
      playerName: user.name || "Opponent",
      stake: getCurrentStake()
    });
  };

  const startGame = () => {
    if (createdGameCode) {
      sendMessage('start_game', {
        gameId: createdGameCode,
        playerId: user.id
      });
    }
  };

  const shareGameCode = async () => {
    if (!createdGameCode) return;

    try {
      await Share.share({
        message: `Join my Six King game! Room Code: ${createdGameCode}\nStake: ₹${getCurrentStake()}\n\nDownload the app and use this code to join!`,
        title: 'Six King Game Invitation'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const cancelWaiting = () => {
    if (isConnected) {
      sendMessage('leave_game', {
        gameId: createdGameCode,
        playerId: user.id
      });
    }
    
    setLobbyState('menu');
    setIsLoading(false);
    setCreatedGameCode('');
    setWaitingMessage('');
    setConnectedPlayers(0);
  };

  const renderStakeOption = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.stakeOption,
        selectedStake === item && styles.stakeOptionSelected
      ]}
      onPress={() => {
        setSelectedStake(item);
        setCustomStake('');
      }}
    >
      <LinearGradient
        colors={selectedStake === item ? ['#6366F1', '#8B5CF6'] : ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)']}
        style={styles.stakeOptionGradient}
      >
        <Text style={[
          styles.stakeOptionText,
          selectedStake === item && styles.stakeOptionTextSelected
        ]}>
          ₹{item}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );

  // Waiting screen
  if (lobbyState === 'waiting' || lobbyState === 'creating' || lobbyState === 'joining' || lobbyState === 'matched') {
    return (
      <LinearGradient
        colors={['#0F0C29', '#24243e', '#302B63', '#0F0C29']}
        style={styles.container}
      >
        <View style={styles.waitingContainer}>
          <View style={styles.waitingIconContainer}>
            <LinearGradient
              colors={lobbyState === 'matched' ? ['#10B981', '#059669'] : ['#F59E0B', '#D97706']}
              style={styles.waitingIconGradient}
            >
              <MaterialIcons 
                name={lobbyState === 'matched' ? 'check-circle' : 'hourglass-empty'} 
                size={50} 
                color="#fff" 
              />
            </LinearGradient>
          </View>
          
          <Text style={styles.waitingTitle}>
            {lobbyState === 'creating' ? 'Creating Game...' :
             lobbyState === 'joining' ? 'Joining Game...' :
             lobbyState === 'matched' ? 'Match Found!' :
             'Finding Players'}
          </Text>
          
          <Text style={styles.waitingMessage}>{waitingMessage}</Text>
          
          {createdGameCode && (
            <View style={styles.gameCodeContainer}>
              <Text style={styles.gameCodeLabel}>Room Code</Text>
              <View style={styles.gameCodeBox}>
                <LinearGradient
                  colors={['rgba(99, 102, 241, 0.2)', 'rgba(139, 92, 246, 0.2)']}
                  style={styles.gameCodeBoxGradient}
                >
                  <Text style={styles.gameCodeText}>{createdGameCode}</Text>
                  <TouchableOpacity onPress={shareGameCode} style={styles.shareButton}>
                    <LinearGradient
                      colors={['#6366F1', '#8B5CF6']}
                      style={styles.shareButtonGradient}
                    >
                      <MaterialIcons name="share" size={20} color="#fff" />
                    </LinearGradient>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
              <Text style={styles.shareHint}>Share this code with your opponent</Text>
              
              {connectedPlayers > 1 && (
                <TouchableOpacity 
                  style={styles.startGameButton}
                  onPress={startGame}
                >
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    style={styles.startGameGradient}
                  >
                    <MaterialIcons name="play-arrow" size={24} color="#fff" />
                    <Text style={styles.startGameText}>Start Game</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}

          {lobbyState !== 'matched' && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#6366F1" />
              <View style={styles.loadingDots}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={cancelWaiting}>
            <LinearGradient
              colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']}
              style={styles.cancelButtonGradient}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // Main lobby screen
  return (
    <LinearGradient
      colors={['#0F0C29', '#24243e', '#302B63', '#0F0C29']}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <LinearGradient
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
            style={styles.backButtonGradient}
          >
            <MaterialIcons name="arrow-back" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Six King</Text>
          <Text style={styles.titleEmoji}>👑</Text>
        </View>
        
        <View style={styles.walletDisplay}>
          <LinearGradient
            colors={['#10B981', '#059669']}
            style={styles.walletGradient}
          >
            <MaterialIcons name="account-balance-wallet" size={16} color="#fff" />
            <Text style={styles.walletText}>₹{user.wallet}</Text>
          </LinearGradient>
        </View>
      </View>

      {/* Connection Status */}
      {!isConnected && (
        <View style={styles.connectionWarning}>
          <LinearGradient
            colors={['rgba(239, 68, 68, 0.2)', 'rgba(220, 38, 38, 0.2)']}
            style={styles.connectionWarningGradient}
          >
            <MaterialIcons name="wifi-off" size={20} color="#EF4444" />
            <Text style={styles.connectionWarningText}>
              {connectionError || 'Connecting to server...'}
            </Text>
          </LinearGradient>
        </View>
      )}

      <View style={styles.content}>
        {/* Stake Selection */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="monetization-on" size={24} color="#6366F1" />
            <Text style={styles.sectionTitle}>Select Stake</Text>
          </View>
          
          <View style={styles.stakeContainer}>
            <FlatList
              data={predefinedStakes}
              renderItem={renderStakeOption}
              keyExtractor={(item) => item.toString()}
              numColumns={3}
              style={styles.stakeGrid}
              contentContainerStyle={styles.stakeGridContent}
              scrollEnabled={false}
            />
          </View>
        </View>

        {/* Game Mode */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="sports-esports" size={24} color="#8B5CF6" />
            <Text style={styles.sectionTitle}>Game Mode</Text>
          </View>
          
          <TouchableOpacity
            style={styles.gameOption}
            onPress={quickMatch}
            disabled={isLoading || !isConnected}
          >
            <LinearGradient
              colors={['#6366F1', '#8B5CF6']}
              style={styles.gameOptionGradient}
            >
              <View style={styles.gameOptionIcon}>
                <MaterialIcons name="flash-on" size={32} color="#fff" />
              </View>
              <View style={styles.gameOptionContent}>
                <Text style={styles.gameOptionTitle}>Quick Match</Text>
                <Text style={styles.gameOptionSubtitle}>
                  Find opponent instantly
                </Text>
                <View style={styles.stakeDisplay}>
                  <MaterialIcons name="monetization-on" size={16} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.stakeAmount}>₹{getCurrentStake()}</Text>
                </View>
              </View>
              <MaterialIcons name="arrow-forward-ios" size={20} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Game Rules */}
        <View style={styles.rulesSection}>
          <LinearGradient
            colors={['rgba(139, 92, 246, 0.1)', 'rgba(99, 102, 241, 0.1)']}
            style={styles.rulesContainer}
          >
            <View style={styles.rulesHeader}>
              <MaterialIcons name="info" size={20} color="#8B5CF6" />
              <Text style={styles.rulesTitle}>Game Rules</Text>
            </View>
            <View style={styles.rulesList}>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleBullet}>🎯</Text>
                <Text style={styles.ruleText}>First to roll 3 sixes wins</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleBullet}>💰</Text>
                <Text style={styles.ruleText}>Winner takes double stake</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleBullet}>🎲</Text>
                <Text style={styles.ruleText}>Random first turn</Text>
              </View>
              <View style={styles.ruleItem}>
                <Text style={styles.ruleBullet}>👥</Text>
                <Text style={styles.ruleText}>Real-time multiplayer</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
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
    borderRadius: 12,
    overflow: 'hidden',
  },
  backButtonGradient: {
    padding: 12,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 1,
  },
  titleEmoji: {
    fontSize: 28,
    marginLeft: 8,
  },
  walletDisplay: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  walletGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  walletText: {
    color: '#fff',
    fontWeight: '700',
    marginLeft: 6,
    fontSize: 14,
  },
  connectionWarning: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  connectionWarningGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  connectionWarningText: {
    color: '#EF4444',
    marginLeft: 8,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 12,
  },
  stakeContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  stakeGrid: {
    maxHeight: 140,
  },
  stakeGridContent: {
    justifyContent: 'space-between',
  },
  stakeOption: {
    flex: 1,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  stakeOptionGradient: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 12,
  },
  stakeOptionSelected: {
    transform: [{ scale: 1.05 }],
  },
  stakeOptionText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    fontSize: 16,
  },
  stakeOptionTextSelected: {
    color: '#fff',
    fontWeight: '800',
  },
  gameOption: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  gameOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
  },
  gameOptionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOptionContent: {
    marginLeft: 20,
    flex: 1,
  },
  gameOptionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  gameOptionSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginBottom: 8,
  },
  stakeDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stakeAmount: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    marginLeft: 4,
    fontSize: 16,
  },
  rulesSection: {
    marginTop: 20,
  },
  rulesContainer: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.3)',
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  rulesTitle: {
    color: '#8B5CF6',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  rulesList: {
    gap: 12,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleBullet: {
    fontSize: 16,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  ruleText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  // Waiting screen styles
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  waitingIconContainer: {
    borderRadius: 50,
    overflow: 'hidden',
    marginBottom: 32,
  },
  waitingIconGradient: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waitingTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  waitingMessage: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  gameCodeContainer: {
    alignItems: 'center',
    marginVertical: 24,
    width: '100%',
  },
  gameCodeLabel: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  gameCodeBox: {
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 280,
  },
  gameCodeBoxGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.5)',
  },
  gameCodeText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 3,
    flex: 1,
    textAlign: 'center',
  },
  shareButton: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  shareButtonGradient: {
    padding: 8,
  },
  shareHint: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  startGameButton: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 200,
  },
  startGameGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  startGameText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
    marginLeft: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 32,
  },
  loadingDots: {
    flexDirection: 'row',
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
    marginHorizontal: 4,
  },
  dot1: {
    opacity: 0.4,
  },
  dot2: {
    opacity: 0.7,
  },
  dot3: {
    opacity: 1,
  },
  cancelButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 32,
    minWidth: 120,
  },
  cancelButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.5)',
  },
  cancelButtonText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
});