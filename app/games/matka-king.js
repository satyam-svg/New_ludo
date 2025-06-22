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
  Easing,
  SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';

const { width } = Dimensions.get('window');

const MatkaKingGame = () => {
  const { user } = useAuth();
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [betAmount, setBetAmount] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [walletBalance, setWalletBalance] = useState(user?.wallet || 20);
  const [bets, setBets] = useState([]);
  const [results, setResults] = useState({});
  const [slotAnimations] = useState(() => 
    Array(4).fill(0).map(() => new Animated.Value(1))
  );
  const [numberAnimations] = useState(() => 
    Array(10).fill(0).map(() => new Animated.Value(1))
  );
  const [pulseAnim] = useState(new Animated.Value(1));
  const [hasBetInSlot, setHasBetInSlot] = useState({});

  // Generate time slots (9AM-12PM, 12PM-3PM, etc.)
  useEffect(() => {
    const updateSlots = () => {
      const slots = [];
      const now = new Date();
      const currentHour = now.getHours();
      
      for (let i = 9; i < 21; i += 3) {
  const startHour = i;
  const endHour = i + 3;

  // Set status always to 'open'
  const slotStatus = 'open';

  const slotId = `${startHour}-${endHour}`;
  const slotResult = results[slotId];

  slots.push({
    id: slotId,
    name: `${startHour}${startHour >= 12 ? 'PM' : 'AM'} - ${endHour}${endHour >= 12 ? 'PM' : 'AM'}`,
    status: slotStatus,
    winningNumber: slotResult ? slotResult.winningNumber : null,
    payout: slotResult ? slotResult.payout : null
  });
}

      
      setTimeSlots(slots);
    };
    
    updateSlots();
    const interval = setInterval(updateSlots, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [results]);

  // Track which slots have bets
  useEffect(() => {
    const betStatus = {};
    bets.forEach(bet => {
      betStatus[bet.slotId] = true;
    });
    setHasBetInSlot(betStatus);
  }, [bets]);

  // Start pulse animation
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    
    pulseAnimation.start();
    return () => pulseAnimation.stop();
  }, []);

  // Place a bet
  const placeBet = () => {
    if (!selectedNumber || !betAmount || !selectedSlot) return;
    
    const amount = parseFloat(betAmount);
    if (isNaN(amount)) return;
    if (amount > walletBalance) {
      alert('Insufficient balance!');
      return;
    }
    
    // Deduct from wallet
    const newBalance = walletBalance - amount;
    setWalletBalance(newBalance);
    
    // Add to bets
    const newBet = {
      id: Date.now().toString(),
      slotId: selectedSlot.id,
      number: selectedNumber,
      amount: amount,
      time: new Date().toLocaleTimeString()
    };
    
    setBets([...bets, newBet]);
    setModalVisible(false);
    setSelectedNumber(null);
    setBetAmount('');
  };

  // Declare results
  const declareResults = (slotId) => {
    const winningNumber = Math.floor(Math.random() * 10);
    
    setResults(prev => ({
      ...prev,
      [slotId]: {
        winningNumber,
        payout: 9.5
      }
    }));
  };

  // Animate slot when pressed
  const animateSlot = (index) => {
    Animated.sequence([
      Animated.timing(slotAnimations[index], {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slotAnimations[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();
  };

  // Animate number when pressed
  const animateNumber = (index) => {
    Animated.sequence([
      Animated.timing(numberAnimations[index], {
        toValue: 0.9,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(numberAnimations[index], {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();
  };

  // Calculate win amount
  const calculateWinAmount = (amount) => {
    const num = parseFloat(amount) || 0;
    return (num * 9.5).toFixed(2);
  };

  return (
    <SafeAreaView style={{ flex: 1}}>
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      {/* Animated Background Elements */}
      <View style={styles.backgroundElements}>
        <Animated.View style={[styles.floatingElement, styles.element1]} />
        <Animated.View style={[styles.floatingElement, styles.element2]} />
        <Animated.View style={[styles.floatingElement, styles.element3]} />
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>MATKA KING 👑</Text>
        <View style={styles.walletContainer}>
          <MaterialIcons name="account-balance-wallet" size={20} color="#FFD700" />
          <Text style={styles.walletText}>₹{walletBalance.toFixed(2)}</Text>
        </View>
      </View>

      {/* Time Slots Grid */}
      <ScrollView contentContainerStyle={styles.slotsContainer}>
        {timeSlots.map((slot, index) => (
          <Animated.View
            key={slot.id}
            style={[
              styles.slotCard,
              slot.status === 'open' && styles.openSlot,
              slot.status === 'closed' && styles.closedSlot,
              { transform: [{ scale: slotAnimations[index] }] }
            ]}
          >
            <View>
              <Text style={styles.slotTitle}>{slot.name}</Text>
              
              {slot.status === 'open' && (
                <TouchableOpacity
                  onPress={() => {
                    animateSlot(index);
                    setSelectedSlot(slot);
                    setModalVisible(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.slotStatusOpenContainer}>
                    <Text style={styles.slotStatusOpen}>OPEN - PLAY NOW!</Text>
                  </View>
                </TouchableOpacity>
              )}
              
              {slot.status === 'closed' && slot.winningNumber !== null && (
                <View style={styles.resultContainer}>
                  <View style={styles.winningContainer}>
                    <Text style={styles.winningNumber}>Winning Number: {slot.winningNumber}</Text>
                    <Text style={styles.payout}>Payout: 9.5x</Text>
                  </View>
                  
                  {/* Show if user won this slot */}
                  {hasBetInSlot[slot.id] && (
                    <View style={[
                      styles.resultBadge, 
                      bets.find(b => b.slotId === slot.id).number === slot.winningNumber 
                        ? styles.winBadge 
                        : styles.loseBadge
                    ]}>
                      <Text style={styles.resultBadgeText}>
                        {bets.find(b => b.slotId === slot.id).number === slot.winningNumber 
                          ? '🎉 YOU WON!' 
                          : '😔 YOU LOST'}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              
              {/* Only show pending if user has bet */}
              {slot.status === 'closed' && slot.winningNumber === null && hasBetInSlot[slot.id] && (
                <Text style={styles.slotStatusPending}>RESULTS PENDING</Text>
              )}
              
              {slot.status === 'upcoming' && (
                <Text style={styles.slotStatusUpcoming}>UPCOMING</Text>
              )}
              
              {/* Show user's bet for this slot if exists */}
              {hasBetInSlot[slot.id] && (
                <View style={styles.userBet}>
                  <Text style={styles.userBetText}>
                    Your Bet: {bets.find(b => b.slotId === slot.id).number}
                  </Text>
                </View>
              )}
              
              {/* Add bet button for closed slots without user bet */}
              {slot.status === 'closed' && !hasBetInSlot[slot.id] && (
                <TouchableOpacity
                  style={styles.addBetButton}
                  onPress={() => {
                    animateSlot(index);
                    setSelectedSlot(slot);
                    setModalVisible(true);
                  }}
                >
                  <Text style={styles.addBetButtonText}>ADD YOUR BET</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        ))}
      </ScrollView>

      {/* Betting Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <LinearGradient
            colors={['#2c3e50', '#4ca1af']}
            style={styles.modalContent}
          >
            <TouchableOpacity 
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <MaterialIcons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Text style={styles.modalTitle}>Place Your Bet</Text>
              <Text style={styles.slotTitle}>{selectedSlot?.name}</Text>
            </Animated.View>
            
            <Text style={styles.sectionTitle}>Select Your Lucky Number (0-9)</Text>
            <View style={styles.numbersGrid}>
              {[...Array(10).keys()].map((num, index) => (
                <Animated.View
                  key={num}
                  style={{ transform: [{ scale: numberAnimations[index] }] }}
                >
                  <TouchableOpacity
                    style={[
                      styles.numberButton,
                      selectedNumber === num && styles.selectedNumberButton
                    ]}
                    onPress={() => {
                      animateNumber(index);
                      setSelectedNumber(num);
                    }}
                  >
                    <Text style={styles.numberText}>{num}</Text>
                  </TouchableOpacity>
                </Animated.View>
              ))}
            </View>
            
            <Text style={styles.sectionTitle}>Enter Bet Amount</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="₹ Enter amount"
              placeholderTextColor="#aaa"
              value={betAmount}
              onChangeText={setBetAmount}
            />
            
            <Text style={styles.payoutInfo}>
              Win ₹{calculateWinAmount(betAmount)} if you win!
            </Text>
            
            <TouchableOpacity 
              style={styles.placeBetButton}
              onPress={placeBet}
              disabled={!selectedNumber || !betAmount}
            >
              <Text style={styles.placeBetText}>PLACE BET</Text>
            </TouchableOpacity>
          </LinearGradient>
        </KeyboardAvoidingView>
      </Modal>

      {/* Admin Controls */}
      {user?.isAdmin && (
        <View style={styles.adminPanel}>
          <Text style={styles.adminTitle}>Admin Controls</Text>
          <View style={styles.adminButtons}>
            {timeSlots.filter(s => s.status === 'closed' && s.winningNumber === null)
              .map(slot => (
                <TouchableOpacity
                  key={slot.id}
                  style={styles.declareButton}
                  onPress={() => declareResults(slot.id)}
                >
                  <Text style={styles.declareText}>Declare {slot.name}</Text>
                </TouchableOpacity>
              ))}
          </View>
        </View>
      )}
    </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginBottom: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 15,
    marginTop: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
    letterSpacing: 2,
  },
  walletContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  walletText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 16,
    marginLeft: 5,
  },
  slotsContainer: {
    paddingBottom: 20,
  },
  slotCard: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
    backgroundColor: 'rgba(30, 30, 50, 0.6)',
  },
  openSlot: {
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    borderColor: 'rgba(46, 204, 113, 0.5)',
  },
  closedSlot: {
    backgroundColor: 'rgba(231, 76, 60, 0.2)',
    borderColor: 'rgba(231, 76, 60, 0.5)',
  },
  slotTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  slotStatusOpenContainer: {
    backgroundColor: 'rgba(46, 204, 113, 0.2)',
    padding: 8,
    borderRadius: 10,
    marginTop: 5,
  },
  slotStatusOpen: {
    color: '#2ecc71',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 18,
    textShadowColor: 'rgba(46, 204, 113, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  slotStatusClosed: {
    color: '#e74c3c',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 10,
  },
  slotStatusUpcoming: {
    color: '#3498db',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 10,
  },
  slotStatusPending: {
    color: '#f39c12',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 16,
    marginTop: 10,
  },
  resultContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  winningContainer: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    marginBottom: 10,
  },
  winningNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  payout: {
    color: '#f1c40f',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 5,
    textAlign: 'center',
  },
  resultBadge: {
    padding: 8,
    borderRadius: 15,
    marginTop: 8,
  },
  winBadge: {
    backgroundColor: 'rgba(46, 204, 113, 0.3)',
    borderColor: '#2ecc71',
  },
  loseBadge: {
    backgroundColor: 'rgba(231, 76, 60, 0.3)',
    borderColor: '#e74c3c',
  },
  resultBadgeText: {
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  userBet: {
    marginTop: 15,
    padding: 8,
    backgroundColor: 'rgba(52, 152, 219, 0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.5)',
  },
  userBetText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  addBetButton: {
    backgroundColor: 'rgba(52, 152, 219, 0.3)',
    padding: 10,
    borderRadius: 8,
    marginTop: 15,
    borderWidth: 1,
    borderColor: 'rgba(52, 152, 219, 0.5)',
    alignItems: 'center',
  },
  addBetButtonText: {
    color: '#3498db',
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    width: width * 0.9,
    borderRadius: 20,
    padding: 25,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
    padding: 5,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    marginTop: 20,
    marginBottom: 10,
    fontWeight: '600',
    textAlign: 'center'
  },
  numbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginVertical: 10,
  },
  numberButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  selectedNumberButton: {
    backgroundColor: 'rgba(46, 204, 113, 0.3)',
    borderColor: '#2ecc71',
    borderWidth: 2,
  },
  numberText: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  input: {
    width: '80%',
    height: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    marginVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  payoutInfo: {
    color: '#f1c40f',
    fontSize: 16,
    fontWeight: 'bold',
    marginVertical: 15,
    textAlign: 'center',
  },
  placeBetButton: {
    backgroundColor: '#2ecc71',
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginTop: 10,
    shadowColor: '#2ecc71',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  placeBetText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  adminPanel: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.3)',
  },
  adminTitle: {
    color: '#e74c3c',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 10,
    textAlign: 'center',
  },
  adminButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  declareButton: {
    backgroundColor: 'rgba(231, 76, 60, 0.3)',
    padding: 10,
    borderRadius: 8,
    margin: 5,
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.5)',
  },
  declareText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default MatkaKingGame;