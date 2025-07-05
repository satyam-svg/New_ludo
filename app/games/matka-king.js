import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  BackHandler
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import config from '../../config';

const { width, height } = Dimensions.get('window');
const API_BASE_URL = `${config.BASE_URL}/api`;

const MatkaKingGame = () => {
  const { user, updateWallet } = useAuth();
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [placingBet, setPlacingBet] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userSessions, setUserSessions] = useState([]);
  const [showUserBets, setShowUserBets] = useState(false);
  
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', router.back);
    return () => {
      backHandler.remove();
    };
  }, []);

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

  // Fetch slots from backend
  const fetchSlots = async () => {
    try {
      setIsLoading(true);
      const response = await apiCall('/matka-king/slots');
      
      if (response.success) {
        setTimeSlots(response.slots);
      } else {
        Alert.alert('Error', 'Failed to load time slots');
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
      Alert.alert('Error', error.message || 'Failed to load time slots');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch user sessions
  const fetchUserSessions = async () => {
    try {
      const response = await apiCall('/matka-king/sessions');
      if (response.success) {
        setUserSessions(response.sessions);
      }
    } catch (error) {
      console.error('Error fetching user sessions:', error);
    }
  };

  // Refresh data
  const onRefresh = () => {
    setRefreshing(true);
    fetchSlots();
    fetchUserSessions();
  };

  // Focus effect to refresh data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchSlots();
      fetchUserSessions();
      
      // Set up interval to refresh data every minute (like backend cron job)
      const interval = setInterval(() => {
        fetchSlots();
      }, 60000);

      return () => clearInterval(interval);
    }, [])
  );

  // Place bet function with backend integration
  const placeBet = async () => {
    if (selectedNumber === null || !betAmount || !selectedSlot) return;
    
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount < 10) {
      Alert.alert('Invalid Amount', 'Minimum bet amount is ₹10');
      return;
    }
    
    if (amount > user.wallet) {
      Alert.alert('Insufficient Balance', 'You don\'t have enough balance!');
      return;
    }
    
    setPlacingBet(true);
    
    try {
      const response = await apiCall('/matka-king/place-bet', 'POST', {
        slotId: selectedSlot.id,
        number: selectedNumber,
        amount: amount
      });

      if (response.success) {
        // Update wallet balance
        updateWallet(response.newBalance);
        
        // Close modal and reset form
        setModalVisible(false);
        setSelectedNumber(null);
        setBetAmount('');
        
        // Refresh slots to show updated bet status
        await fetchSlots();
        await fetchUserSessions();
        
        Alert.alert('Success', 'Bet placed successfully!');
      } else {
        Alert.alert('Error', response.error || 'Failed to place bet');
      }
    } catch (error) {
      console.error('Error placing bet:', error);
      Alert.alert('Error', error.message || 'Failed to place bet. Please try again.');
    } finally {
      setPlacingBet(false);
    }
  };

  const calculateWinAmount = (amount) => {
    const num = parseFloat(amount) || 0;
    return (num * 10).toFixed(2);
  };

  const getSlotStatusColor = (status, hasUserBet = false) => {
    switch (status) {
      case 'open': 
        return hasUserBet 
          ? ['rgba(120, 120, 120, 0.6)', 'rgba(100, 100, 100, 0.4)'] // Grey for joined
          : ['#4ECDC4', '#44A08D']; // Normal open color
      case 'closed': return ['rgba(120, 120, 120, 0.6)', 'rgba(100, 100, 100, 0.4)']; // Grey
      case 'upcoming': return ['rgba(120, 120, 120, 0.6)', 'rgba(100, 100, 100, 0.4)']; // Grey
      default: return ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)'];
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'open': return 'play-circle-filled';
      case 'closed': return 'cancel';
      case 'upcoming': return 'schedule';
      default: return 'help';
    }
  };

  const formatTime = (timeFloat) => {
    const hours = Math.floor(timeFloat);
    const minutes = Math.round((timeFloat - hours) * 60);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const formatDate = (dateInput) => {
    // Handle both string and Date object
    let date;
    if (typeof dateInput === 'string') {
      // If it's a string, parse it properly
      if (dateInput.includes('T')) {
        // ISO string format
        date = new Date(dateInput);
      } else {
        // Date only format like "2024-01-15"
        date = new Date(dateInput + 'T00:00:00');
      }
    } else if (dateInput instanceof Date) {
      date = dateInput;
    } else {
      console.warn('Invalid date input:', dateInput);
      return 'Invalid Date';
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date after parsing:', dateInput);
      return 'Invalid Date';
    }
    
    // Always return the actual date instead of relative terms
    return date.toLocaleDateString('en-IN', { 
      day: 'numeric', 
      month: 'short',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    });
  };

  if (isLoading && !refreshing) {
    return (
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4ECDC4" />
            <Text style={styles.loadingText}>Loading time slots...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

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

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.titleContainer}>
            <Text style={styles.gameTitle}>MATKA KING</Text>
            <Text style={styles.subtitle}>Win 10x Your Stake!</Text>
          </View>
          
          <TouchableOpacity 
            style={styles.stakeContainer}
            onPress={() => setShowUserBets(!showUserBets)}
          >
            <MaterialIcons name="monetization-on" size={20} color="#FFD700" />
            <Text style={styles.stakeText}>₹{user?.wallet || 0}</Text>
          </TouchableOpacity>
        </View>

        {/* Toggle Button for User Bets */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, !showUserBets && styles.toggleButtonActive]}
            onPress={() => setShowUserBets(false)}
          >
            <Text style={[styles.toggleText, !showUserBets && styles.toggleTextActive]}>
              All Slots
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, showUserBets && styles.toggleButtonActive]}
            onPress={() => setShowUserBets(true)}
          >
            <Text style={[styles.toggleText, showUserBets && styles.toggleTextActive]}>
              My Bets ({userSessions.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.15)', 'rgba(255, 165, 0, 0.1)']}
            style={styles.infoBannerGradient}
          >
            <MaterialIcons name="info" size={20} color="#FFD700" />
            <Text style={styles.infoBannerText}>
              {showUserBets 
                ? "Your betting history and current bets"
                : "Choose your lucky number (0-9) • Minimum bet ₹10 • Win 10x your stake"
              }
            </Text>
          </LinearGradient>
        </View>

        {/* Content */}
        <ScrollView 
          style={styles.slotsScrollView}
          contentContainerStyle={styles.slotsContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4ECDC4']}
              tintColor="#4ECDC4"
            />
          }
        >
          {showUserBets ? (
            // User Bets View
            <>
              {userSessions.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="casino" size={60} color="#666" />
                  <Text style={styles.emptyStateTitle}>No Bets Yet</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    You haven't placed any bets yet
                  </Text>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={() => setShowUserBets(false)}
                  >
                    <LinearGradient
                      colors={['#4ECDC4', '#44A08D']}
                      style={styles.refreshButtonGradient}
                    >
                      <MaterialIcons name="casino" size={20} color="#fff" />
                      <Text style={styles.refreshButtonText}>Place First Bet</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              ) : (
                userSessions.map((session, index) => (
                  <Animated.View
                    key={session.gameId}
                    style={styles.betCard}
                  >
                    <LinearGradient
                      colors={
                        session.won 
                          ? ['rgba(78, 205, 196, 0.3)', 'rgba(68, 160, 141, 0.2)']
                          : session.gameState === 'active'
                          ? ['rgba(255, 193, 7, 0.3)', 'rgba(255, 152, 0, 0.2)']
                          : ['rgba(255, 107, 107, 0.3)', 'rgba(255, 142, 83, 0.2)']
                      }
                      style={styles.betCardGradient}
                    >
                      <View style={styles.betHeader}>
                        <View style={styles.betTitleContainer}>
                          <MaterialIcons 
                            name={
                              session.won ? "emoji-events" : 
                              session.gameState === 'active' ? "schedule" : "cancel"
                            } 
                            size={20} 
                            color={
                              session.won ? "#4ECDC4" : 
                              session.gameState === 'active' ? "#FFD700" : "#FF6B6B"
                            } 
                          />
                          <Text style={styles.betSlotName}>{session.slotName}</Text>
                        </View>
                        <View style={styles.betDateContainer}>
                          <Text style={styles.betDate}>
                            {formatDate(session.createdAt)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.betDetails}>
                        <View style={styles.betDetailRow}>
                          <Text style={styles.betDetailLabel}>Your Number:</Text>
                          <View style={styles.numberBadge}>
                            <Text style={styles.numberBadgeText}>{session.luckyNumber}</Text>
                          </View>
                        </View>
                        
                        <View style={styles.betDetailRow}>
                          <Text style={styles.betDetailLabel}>Stake Amount:</Text>
                          <Text style={styles.betDetailValue}>₹{session.stake}</Text>
                        </View>

                        {session.winningNumber !== null && (
                          <View style={styles.betDetailRow}>
                            <Text style={styles.betDetailLabel}>Winning Number:</Text>
                            <View style={[styles.numberBadge, styles.winningNumberBadge]}>
                              <Text style={styles.numberBadgeText}>{session.winningNumber}</Text>
                            </View>
                          </View>
                        )}
                      </View>

                      <View style={styles.betResult}>
                        <LinearGradient
                          colors={
                            session.won 
                              ? ['rgba(78, 205, 196, 0.4)', 'rgba(68, 160, 141, 0.3)']
                              : session.gameState === 'active'
                              ? ['rgba(255, 193, 7, 0.4)', 'rgba(255, 152, 0, 0.3)']
                              : ['rgba(255, 107, 107, 0.4)', 'rgba(255, 142, 83, 0.3)']
                          }
                          style={styles.betResultGradient}
                        >
                          <MaterialIcons 
                            name={
                              session.won ? "celebration" : 
                              session.gameState === 'active' ? "hourglass-empty" : "sentiment-dissatisfied"
                            } 
                            size={18} 
                            color={
                              session.won ? "#4ECDC4" : 
                              session.gameState === 'active' ? "#FFD700" : "#FF6B6B"
                            } 
                          />
                          <Text style={[
                            styles.betResultText,
                            { 
                              color: session.won ? "#4ECDC4" : 
                                    session.gameState === 'active' ? "#FFD700" : "#FF6B6B" 
                            }
                          ]}>
                            {session.gameState === 'active' 
                              ? "PENDING RESULT" 
                              : session.won 
                              ? `🎉 WON ₹${session.winAmount}!` 
                              : `💔 LOST ₹${session.stake}`
                            }
                          </Text>
                        </LinearGradient>
                      </View>
                    </LinearGradient>
                  </Animated.View>
                ))
              )}
            </>
          ) : (
            // Time Slots View
            <>
              {timeSlots.map((slot, index) => {
                const userBet = slot.userBet;
                const hasUserBet = !!userBet;
                const isWinner = hasUserBet && slot.winningNumber !== null && slot.winningNumber === userBet.number;
                
                return (
                  <Animated.View
                    key={slot.id}
                    style={styles.slotCard}
                  >
                    <LinearGradient
                      colors={getSlotStatusColor(slot.status, hasUserBet)}
                      style={styles.slotCardGradient}
                    >
                      <View style={styles.slotHeader}>
                        <View style={styles.slotTimeContainer}>
                          <MaterialIcons 
                            name={getStatusIcon(slot.status)} 
                            size={24} 
                            color="#fff" 
                          />
                          <View style={styles.slotTitleContainer}>
                            <Text style={styles.slotTime}>{slot.name}</Text>
                            <Text style={styles.slotDate}>{formatDate(new Date())}</Text>
                          </View>
                        </View>
                        
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusText}>
                            {slot.status === 'open' ? 'LIVE' : 
                             slot.status === 'closed' ? 'CLOSED' : 'UPCOMING'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.slotInfo}>
                        <View style={styles.participantsContainer}>
                          <MaterialIcons name="people" size={16} color="#fff" />
                          <Text style={styles.participantsText}>
                            {slot.participants} players
                          </Text>
                        </View>
                        
                        <View style={styles.payoutContainer}>
                          <MaterialIcons name="trending-up" size={16} color="#fff" />
                          <Text style={styles.payoutText}>{slot.payout}x payout</Text>
                        </View>
                      </View>

                      {/* Slot Timing Info */}
                      <View style={styles.timingInfo}>
                        <MaterialIcons name="schedule" size={14} color="#888" />
                        <Text style={styles.timingText}>
                          {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                        </Text>
                      </View>

                      {/* User Bet Info */}
                      {hasUserBet && (
                        <View style={styles.userBetInfo}>
                          <LinearGradient
                            colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)']}
                            style={styles.userBetGradient}
                          >
                            <MaterialIcons name="casino" size={16} color="#FFD700" />
                            <Text style={styles.userBetText}>
                              Your bet: {userBet.number} • ₹{userBet.amount}
                            </Text>
                            {slot.winningNumber !== null && (
                              <MaterialIcons 
                                name={isWinner ? "check-circle" : "cancel"} 
                                size={16} 
                                color={isWinner ? "#4ECDC4" : "#FF6B6B"} 
                              />
                            )}
                          </LinearGradient>
                        </View>
                      )}

                      {/* Result Display with Win/Loss */}
                      {slot.status === 'closed' && slot.winningNumber !== null && (
                        <View style={styles.resultSection}>
                          <View style={styles.resultDisplay}>
                            <LinearGradient
                              colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 165, 0, 0.2)']}
                              style={styles.resultGradient}
                            >
                              <MaterialIcons name="emoji-events" size={20} color="#FFD700" />
                              <Text style={styles.resultText}>
                                Winning Number: {slot.winningNumber}
                              </Text>
                            </LinearGradient>
                          </View>
                          
                          {/* Win/Loss Status for User */}
                          {hasUserBet && (
                            <View style={styles.winLossContainer}>
                              <LinearGradient
                                colors={
                                  isWinner 
                                    ? ['rgba(78, 205, 196, 0.3)', 'rgba(68, 160, 141, 0.2)']
                                    : ['rgba(255, 107, 107, 0.3)', 'rgba(255, 142, 83, 0.2)']
                                }
                                style={styles.winLossGradient}
                              >
                                <MaterialIcons 
                                  name={isWinner ? "celebration" : "sentiment-dissatisfied"} 
                                  size={18} 
                                  color={isWinner ? "#4ECDC4" : "#FF6B6B"} 
                                />
                                <Text style={[
                                  styles.winLossText,
                                  { color: isWinner ? "#4ECDC4" : "#FF6B6B" }
                                ]}>
                                  {isWinner 
                                    ? `🎉 YOU WON ₹${userBet.winAmount || (userBet.amount * 10)}!` 
                                    : `💔 YOU LOST ₹${userBet.amount}`
                                  }
                                </Text>
                              </LinearGradient>
                            </View>
                          )}
                        </View>
                      )}

                      {/* Action Button */}
                      {slot.status === 'open' && !hasUserBet && (
                        <TouchableOpacity
                          style={styles.joinButton}
                          onPress={() => {
                            setSelectedSlot(slot);
                            setModalVisible(true);
                          }}
                          activeOpacity={0.8}
                        >
                          <LinearGradient
                            colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.1)']}
                            style={styles.joinButtonGradient}
                          >
                            <MaterialIcons name="add-circle" size={20} color="#fff" />
                            <Text style={styles.joinButtonText}>JOIN NOW</Text>
                          </LinearGradient>
                        </TouchableOpacity>
                      )}

                      {/* Joined Status */}
                      {slot.status === 'open' && hasUserBet && (
                        <View style={styles.joinedStatus}>
                          <LinearGradient
                            colors={['rgba(78, 205, 196, 0.3)', 'rgba(68, 160, 141, 0.2)']}
                            style={styles.joinedStatusGradient}
                          >
                            <MaterialIcons name="check-circle" size={20} color="#4ECDC4" />
                            <Text style={styles.joinedStatusText}>JOINED</Text>
                          </LinearGradient>
                        </View>
                      )}
                    </LinearGradient>
                  </Animated.View>
                );
              })}

              {/* Empty State */}
              {timeSlots.length === 0 && !isLoading && (
                <View style={styles.emptyState}>
                  <MaterialIcons name="schedule" size={60} color="#666" />
                  <Text style={styles.emptyStateTitle}>No Slots Available</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    Time slots will appear here when they become available
                  </Text>
                  <TouchableOpacity
                    style={styles.refreshButton}
                    onPress={onRefresh}
                  >
                    <LinearGradient
                      colors={['#4ECDC4', '#44A08D']}
                      style={styles.refreshButtonGradient}
                    >
                      <MaterialIcons name="refresh" size={20} color="#fff" />
                      <Text style={styles.refreshButtonText}>Refresh</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Betting Modal */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => setModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={styles.modalKeyboard}
            >
              <LinearGradient
                colors={['#1a1a2e', '#16213e', '#0f3460']}
                style={styles.modalContent}
              >
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setModalVisible(false)}
                >
                  <MaterialIcons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                
                <View style={styles.modalHeader}>
                  <MaterialIcons name="casino" size={40} color="#4ECDC4" />
                  <Text style={styles.modalTitle}>Place Your Bet</Text>
                  <Text style={styles.modalSubtitle}>{selectedSlot?.name}</Text>
                  <Text style={styles.modalDate}>{formatDate(new Date())}</Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Select Lucky Number (0-9)</Text>
                  <View style={styles.numbersGrid}>
                    {[...Array(10).keys()].map((num) => (
                      <TouchableOpacity
                        key={num}
                        style={[
                          styles.numberButton,
                          selectedNumber === num && styles.selectedNumberButton
                        ]}
                        onPress={() => setSelectedNumber(num)}
                      >
                        <Text style={[
                          styles.numberText,
                          selectedNumber === num && styles.selectedNumberText
                        ]}>
                          {num}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.sectionTitle}>Enter Bet Amount</Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.currencySymbol}>₹</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="Minimum ₹10"
                      placeholderTextColor="#888"
                      value={betAmount}
                      onChangeText={setBetAmount}
                    />
                  </View>
                  
                  {betAmount && (
                    <View style={styles.winAmountContainer}>
                      <MaterialIcons name="trending-up" size={16} color="#4ECDC4" />
                      <Text style={styles.winAmountText}>
                        Potential Win: ₹{calculateWinAmount(betAmount)}
                      </Text>
                    </View>
                  )}

                  {/* Current Balance Display */}
                  <View style={styles.balanceInfo}>
                    <MaterialIcons name="account-balance-wallet" size={16} color="#FFD700" />
                    <Text style={styles.balanceText}>
                      Current Balance: ₹{user?.wallet || 0}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity 
                  style={[
                    styles.placeBetButton,
                    (selectedNumber === null || !betAmount || parseFloat(betAmount) < 10 || placingBet) && styles.placeBetButtonDisabled
                  ]}
                  onPress={placeBet}
                  disabled={selectedNumber === null || !betAmount || parseFloat(betAmount) < 10 || placingBet}
                >
                  <LinearGradient
                    colors={['#4ECDC4', '#44A08D']}
                    style={styles.placeBetButtonGradient}
                  >
                    {placingBet ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <MaterialIcons name="casino" size={24} color="#fff" />
                    )}
                    <Text style={styles.placeBetText}>
                      {placingBet ? 'PLACING BET...' : 'PLACE BET'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </LinearGradient>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 10,
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
    top: -50,
    left: -50,
  },
  element2: {
    width: 150,
    height: 150,
    backgroundColor: '#FFD700',
    top: 200,
    right: -30,
  },
  element3: {
    width: 180,
    height: 180,
    backgroundColor: '#8B5CF6',
    bottom: 100,
    left: -40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
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
    fontSize: 28,
    fontWeight: '900',
    color: '#4ECDC4',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 25,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginTop: 2,
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
  },
  stakeText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
  },
  toggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(78, 205, 196, 0.3)',
  },
  toggleText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleTextActive: {
    color: '#4ECDC4',
    fontWeight: 'bold',
  },
  infoBanner: {
    marginHorizontal: 20,
    marginBottom: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  infoBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  infoBannerText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 10,
    flex: 1,
    lineHeight: 16,
  },
  slotsScrollView: {
    flex: 1,
  },
  slotsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  slotCard: {
    marginBottom: 15,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  slotCardGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  slotTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  slotTitleContainer: {
    marginLeft: 8,
  },
  slotTime: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  slotDate: {
    fontSize: 12,
    color: '#4ECDC4',
    fontWeight: '600',
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  slotInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  participantsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantsText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.9,
  },
  payoutContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  payoutText: {
    color: '#fff',
    fontSize: 12,
    marginLeft: 4,
    opacity: 0.9,
  },
  timingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  timingText: {
    color: '#888',
    fontSize: 11,
    marginLeft: 6,
  },
  userBetInfo: {
    marginBottom: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  userBetGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  userBetText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  resultSection: {
    marginBottom: 10,
  },
  resultDisplay: {
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
  },
  resultGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.4)',
  },
  resultText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  winLossContainer: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  winLossGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  winLossText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    textAlign: 'center',
  },
  joinButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  joinButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  joinButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  joinedStatus: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  joinedStatusGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.5)',
  },
  joinedStatusText: {
    color: '#4ECDC4',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
  },
  // User Bets Styles
  betCard: {
    marginBottom: 15,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  betCardGradient: {
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  betHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  betTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  betSlotName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  betDateContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  betDate: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  betDetails: {
    marginBottom: 15,
  },
  betDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  betDetailLabel: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
  },
  betDetailValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  numberBadge: {
    backgroundColor: 'rgba(78, 205, 196, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.5)',
  },
  winningNumberBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
    borderColor: 'rgba(255, 215, 0, 0.5)',
  },
  numberBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  betResult: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  betResultGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  betResultText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 15,
    marginBottom: 5,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 40,
    marginBottom: 20,
  },
  refreshButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  refreshButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  modalKeyboard: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  modalContent: {
    width: width * 0.9,
    maxHeight: height * 0.8,
    borderRadius: 25,
    padding: 25,
    borderWidth: 2,
    borderColor: 'rgba(78, 205, 196, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 15,
  },
  closeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 10,
    marginBottom: 5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#4ECDC4',
    fontWeight: '600',
  },
  modalDate: {
    fontSize: 12,
    color: '#FFD700',
    fontWeight: '600',
    marginTop: 2,
  },
  modalSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  numbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  numberButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  selectedNumberButton: {
    backgroundColor: 'rgba(78, 205, 196, 0.3)',
    borderColor: '#4ECDC4',
  },
  numberText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  selectedNumberText: {
    color: '#4ECDC4',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginBottom: 10,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  winAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(78, 205, 196, 0.1)',
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(78, 205, 196, 0.3)',
    marginBottom: 10,
  },
  winAmountText: {
    color: '#4ECDC4',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  balanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  balanceText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  placeBetButton: {
    borderRadius: 15,
    overflow: 'hidden',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 10,
  },
  placeBetButtonDisabled: {
    opacity: 0.5,
  },
  placeBetButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 30,
  },
  placeBetText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
});

export default MatkaKingGame;