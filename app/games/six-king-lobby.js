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
  TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { useWebSocket } from '../../hooks/useWebSocket';
import * as Haptics from 'expo-haptics';

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
      <Text style={[
        styles.stakeOptionText,
        selectedStake === item && styles.stakeOptionTextSelected
      ]}>
        ₹{item}
      </Text>
    </TouchableOpacity>
  );

  // Waiting screen
  if (lobbyState === 'waiting' || lobbyState === 'creating' || lobbyState === 'joining' || lobbyState === 'matched') {
    return (
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
        style={styles.container}
      >
        <View style={styles.waitingContainer}>
          <MaterialIcons 
            name={lobbyState === 'matched' ? 'check-circle' : 'hourglass-empty'} 
            size={80} 
            color={lobbyState === 'matched' ? '#4ECDC4' : '#FFD700'} 
          />
          
          <Text style={styles.waitingTitle}>
            {lobbyState === 'creating' ? 'Creating Game...' :
             lobbyState === 'joining' ? 'Joining Game...' :
             lobbyState === 'matched' ? 'Match Found!' :
             'Waiting for Players'}
          </Text>
          
          <Text style={styles.waitingMessage}>{waitingMessage}</Text>
          
          {createdGameCode && (
            <View style={styles.gameCodeContainer}>
              <Text style={styles.gameCodeLabel}>Room Code:</Text>
              <View style={styles.gameCodeBox}>
                <Text style={styles.gameCodeText}>{createdGameCode}</Text>
                <TouchableOpacity onPress={shareGameCode} style={styles.shareButton}>
                  <MaterialIcons name="share" size={24} color="#4ECDC4" />
                </TouchableOpacity>
              </View>
              <Text style={styles.shareHint}>Share this code with your opponent</Text>
              
              {connectedPlayers > 1 && (
                <TouchableOpacity 
                  style={styles.startGameButton}
                  onPress={startGame}
                >
                  <LinearGradient
                    colors={['#4ECDC4', '#44A08D']}
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
            <ActivityIndicator size="large" color="#FFD700" style={{ marginTop: 30 }} />
          )}

          <TouchableOpacity style={styles.cancelButton} onPress={cancelWaiting}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  // Main lobby screen
  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>🎲 Six King Multiplayer 👑</Text>
        <View style={styles.walletDisplay}>
          <MaterialIcons name="account-balance-wallet" size={20} color="#4ECDC4" />
          <Text style={styles.walletText}>₹{user.wallet}</Text>
        </View>
      </View>

      {/* Connection Status */}
      {!isConnected && (
        <View style={styles.connectionWarning}>
          <MaterialIcons name="wifi-off" size={20} color="#FF6B6B" />
          <Text style={styles.connectionWarningText}>
            {connectionError || 'Connecting to server...'}
          </Text>
        </View>
      )}

      <View style={styles.content}>
        {/* Stake Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Stake Amount</Text>
          
          <FlatList
            data={predefinedStakes}
            renderItem={renderStakeOption}
            keyExtractor={(item) => item.toString()}
            numColumns={3}
            style={styles.stakeGrid}
            contentContainerStyle={styles.stakeGridContent}
          />
          
          <View style={styles.customStakeContainer}>
            <Text style={styles.customStakeLabel}>Custom Amount:</Text>
            <TextInput
              style={styles.customStakeInput}
              placeholder="Enter amount"
              placeholderTextColor="#888"
              value={customStake}
              onChangeText={setCustomStake}
              keyboardType="numeric"
              maxLength={6}
            />
          </View>
        </View>

        {/* Game Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Game Mode</Text>
          
          {/* Quick Match */}
          <TouchableOpacity
            style={styles.gameOption}
            onPress={quickMatch}
            disabled={isLoading || !isConnected}
          >
            <LinearGradient
              colors={['#4ECDC4', '#44A08D']}
              style={styles.gameOptionGradient}
            >
              <MaterialIcons name="flash-on" size={28} color="#fff" />
              <View style={styles.gameOptionContent}>
                <Text style={styles.gameOptionTitle}>Quick Match</Text>
                <Text style={styles.gameOptionSubtitle}>
                  Find opponent instantly • ₹{getCurrentStake()}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Create Game */}
          <TouchableOpacity
            style={styles.gameOption}
            onPress={createGame}
            disabled={isLoading || !isConnected}
          >
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              style={styles.gameOptionGradient}
            >
              <MaterialIcons name="add-circle" size={28} color="#fff" />
              <View style={styles.gameOptionContent}>
                <Text style={styles.gameOptionTitle}>Create Private Game</Text>
                <Text style={styles.gameOptionSubtitle}>
                  Play with friends • ₹{getCurrentStake()}
                </Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>

          {/* Join Game */}
          <View style={styles.joinGameContainer}>
            <TextInput
              style={styles.gameCodeInput}
              placeholder="Enter room code"
              placeholderTextColor="#888"
              value={gameCode}
              onChangeText={setGameCode}
              autoCapitalize="characters"
              maxLength={6}
            />
            <TouchableOpacity
              style={styles.joinButton}
              onPress={joinGame}
              disabled={isLoading || !isConnected || !gameCode.trim()}
            >
              <LinearGradient
                colors={['#FF6B6B', '#FF8E8E']}
                style={styles.joinButtonGradient}
              >
                <MaterialIcons name="login" size={24} color="#fff" />
                <Text style={styles.joinButtonText}>Join</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Game Rules */}
      <View style={styles.rulesContainer}>
        <Text style={styles.rulesTitle}>🎯 Game Rules</Text>
        <Text style={styles.rulesText}>
          • First player to roll 3 sixes wins{'\n'}
          • Winner takes double the stake amount{'\n'}
          • Real-time multiplayer experience{'\n'}
          • Play against real opponents worldwide
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
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    flex: 1,
  },
  walletDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  walletText: {
    color: '#4ECDC4',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  connectionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    marginHorizontal: 20,
    borderRadius: 10,
  },
  connectionWarningText: {
    color: '#FF6B6B',
    marginLeft: 8,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  stakeGrid: {
    maxHeight: 120,
  },
  stakeGridContent: {
    justifyContent: 'space-between',
  },
  stakeOption: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    margin: 5,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  stakeOptionSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: '#FFD700',
  },
  stakeOptionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  stakeOptionTextSelected: {
    color: '#FFD700',
    fontWeight: 'bold',
  },
  customStakeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },
  customStakeLabel: {
    color: '#fff',
    fontSize: 16,
    marginRight: 10,
  },
  customStakeInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  gameOption: {
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  gameOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  gameOptionContent: {
    marginLeft: 15,
    flex: 1,
  },
  gameOptionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gameOptionSubtitle: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    marginTop: 2,
  },
  joinGameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  gameCodeInput: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    paddingHorizontal: 15,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  joinButton: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  joinButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  rulesContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    margin: 20,
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rulesTitle: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  rulesText: {
    color: '#fff',
    fontSize: 14,
    lineHeight: 20,
  },
  // Waiting screen styles
  waitingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  waitingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 20,
    marginBottom: 10,
  },
  waitingMessage: {
    fontSize: 16,
    color: '#BBB',
    textAlign: 'center',
    marginBottom: 20,
  },
  gameCodeContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  gameCodeLabel: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  gameCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: '#FFD700',
  },
  gameCodeText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginRight: 15,
  },
  shareButton: {
    padding: 5,
  },
  shareHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
  startGameButton: {
    marginTop: 20,
    borderRadius: 15,
    overflow: 'hidden',
  },
  startGameGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  startGameText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 10,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.3)',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  cancelButtonText: {
    color: '#FF6B6B',
    fontWeight: 'bold',
    fontSize: 16,
  },
});