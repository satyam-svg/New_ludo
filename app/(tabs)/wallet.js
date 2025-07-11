import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
  ActivityIndicator,
  Modal,
  Linking,
  BackHandler,
  TextInput,
  Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');
import config from '../../config';
const BASE_URL = config.BASE_URL;

// Predefined amounts
const DEPOSIT_AMOUNTS = [100, 200, 300, 500, 1000, 2000, 5000, 10000];
const WITHDRAW_AMOUNTS = [200, 500, 1000, 2000, 5000, 10000, 15000, 25000];

// UPI Apps with PNG assets
const UPI_APPS = [
  {
    id: 'phonepe',
    name: 'PhonePe',
    image: require('../../assets/phonepe.png'),
    color: '#6739B7'
  },
  {
    id: 'googlepay',
    name: 'Google Pay',
    image: require('../../assets/gpay.png'),
    color: '#4285F4'
  },
  {
    id: 'paytm',
    name: 'Paytm',
    image: require('../../assets/paytm.png'),
    color: '#00BAF2'
  }
];

export default function WalletScreen() {
  const { user, updateWallet } = useAuth();
  const [activeTab, setActiveTab] = useState('deposit');
  const phoneNumber = useRef(null);
  const [selectedAmount, setSelectedAmount] = useState(null);
  const [customAmount, setCustomAmount] = useState('');
  const [withdrawalUpiId, setWithdrawalUpiId] = useState('');
  const [balance, setBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(true);
  const [showPaymentPending, setShowPaymentPending] = useState(false);
  const [showWithdrawPending, setShowWithdrawPending] = useState(false);
  const [pendingTimer, setPendingTimer] = useState(60);
  const [processingPayment, setProcessingPayment] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

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

    return () => {
      pulseAnimation.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (showPaymentPending || showWithdrawPending) {
      const backHandler = BackHandler.addEventListener(
        'hardwareBackPress',
        () => true
      );
      return () => backHandler.remove();
    }
  }, [showPaymentPending, showWithdrawPending]);

  const fetchWalletBalance = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        setLoadingBalance(false);
        return;
      }
      
      const response = await fetch(`${BASE_URL}/api/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to fetch balance');
      
      const userData = await response.json();
      //console.log('User data received:', userData); // Debug log
      
      // Set phone number with fallback
      phoneNumber.current = userData.phoneNumber || userData.phone || user?.phoneNumber || 'N/A';
      //console.log('Phone number set to:', phoneNumber.current); // Debug log
      
      setBalance(userData.wallet);
      updateWallet(userData.wallet || 0);
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch wallet balance');
      console.error(error);
      setBalance(0);
    } finally {
      setLoadingBalance(false);
    }
  };

  useEffect(() => {
    fetchWalletBalance();
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const handleTabChange = (tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setActiveTab(tab);
    setSelectedAmount(null);
    setCustomAmount('');
    setWithdrawalUpiId('');
  };

  const handleAmountSelect = (amount) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedAmount(amount);
    setCustomAmount('');
  };

  const handleCustomAmountChange = (text) => {
    setCustomAmount(text);
    setSelectedAmount(null);
  };

  const getSelectedAmount = () => {
    return customAmount ? parseInt(customAmount) : selectedAmount;
  };

  const validateAmount = () => {
    const amount = getSelectedAmount();
    
    if (!amount || isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return false;
    }

    if (activeTab === 'withdraw') {
      if (amount < 200) {
        Alert.alert('Minimum Withdrawal', 'Minimum withdrawal amount is ₹200');
        return false;
      }
      if (amount > balance) {
        Alert.alert('Insufficient Balance', `You don't have enough balance. Available: ₹${balance}`);
        return false;
      }
      if (amount > 25000) {
        Alert.alert('Maximum Withdrawal', 'Maximum withdrawal amount is ₹25,000 per transaction');
        return false;
      }
    } else {
      if (amount < 100) {
        Alert.alert('Minimum Deposit', 'Minimum deposit amount is ₹100');
        return false;
      }
      if (amount > 50000) {
        Alert.alert('Maximum Deposit', 'Maximum deposit amount is ₹50,000 per transaction');
        return false;
      }
    }

    return true;
  };

  const generateUPIIntent = (amount, phoneNum) => {
    const upiId = 'valid-upi@ybl';
    const merchantName = 'Gaming Arena';
    const transactionId = `TXN${Date.now()}`;
    const note = `Recharge ${phoneNum || 'User'}`;
    const currency = 'INR';

    // Universal UPI intent that works with all UPI apps
    const query = `pa=${upiId}&pn=${encodeURIComponent(merchantName)}&am=${amount}&tid=${transactionId}&tn=${encodeURIComponent(note)}&cu=${currency}`;
    
    return `upi://pay?${query}`;
  };

  const handleUpiPayment = async () => {
    if (!validateAmount()) {
      return;
    }

    const amount = getSelectedAmount();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setProcessingPayment(true);

    try {
      // Ensure we have phone number before proceeding
      const currentPhoneNumber = phoneNumber.current || user?.phoneNumber || 'N/A';
      //console.log('Using phone number for payment:', currentPhoneNumber); // Debug log
      
      const upiIntent = generateUPIIntent(amount, currentPhoneNumber);
      
      if (!upiIntent) {
        throw new Error('Failed to generate payment link');
      }

      const canOpen = await Linking.canOpenURL(upiIntent);
      
      if (canOpen) {
        await Linking.openURL(upiIntent);
        
        try {
          const token = await AsyncStorage.getItem('authToken');
          const response = await fetch(`${BASE_URL}/api/payment/create-order`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              amount: amount,
              paymentMethod: 'UPI',
              identifier: currentPhoneNumber
            })
          });

          const data = await response.json();
          
          if (!response.ok) {
            throw new Error(data.error || 'Failed to create deposit request');
          }

          //console.log('✅ Pending deposit created:', data);
        } catch (backendError) {
          console.error('Backend error:', backendError);
          Alert.alert('Notice', 'Payment initiated but may need manual verification');
        }
        
        setShowPaymentPending(true);
        setPendingTimer(60);
        setTimeout(() => {
          startPendingTimer();
        }, 100);
      } else {
        Alert.alert(
          'No UPI Apps Found', 
          'No UPI payment apps are installed on your device. Please install any UPI app (PhonePe, Google Pay, Paytm, etc.) to continue.'
        );
      }
      
    } catch (error) {
      Alert.alert('Payment Error', error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProcessingPayment(false);
    }
  };

  const initiateWithdrawal = async () => {
    if (!validateAmount()) {
      return;
    }

    if (!withdrawalUpiId.trim()) {
      Alert.alert('UPI ID Required', 'Please enter your UPI ID or phone number for withdrawal');
      return;
    }

    const amount = getSelectedAmount();
    
    Alert.alert(
      'Confirm Withdrawal',
      `Are you sure you want to withdraw ₹${amount} to ${withdrawalUpiId}?\n\nThis amount will be processed within 24 hours.`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Confirm',
          style: 'default',
          onPress: () => processWithdrawal(amount)
        }
      ]
    );
  };

  const processWithdrawal = async (amount) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setProcessingPayment(true);

    try {
      // Ensure we have phone number for withdrawal
      const currentPhoneNumber = phoneNumber.current || user?.phoneNumber || 'N/A';
      //console.log('Using phone number for withdrawal:', currentPhoneNumber); // Debug log
      
      const token = await AsyncStorage.getItem('authToken');
      const response = await fetch(`${BASE_URL}/api/payment/create-withdrawl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: amount,
          withdrawalMethod: 'upi_transfer',
          accountDetails: {
            upiId: withdrawalUpiId,
            phoneNumber: currentPhoneNumber,
          }
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process withdrawal');
      }

      //console.log('✅ Withdrawal request created:', data);
      
      const newBalance = balance - amount;
      setBalance(newBalance);
      updateWallet(newBalance);
      
      setShowWithdrawPending(true);
      
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error) {
      Alert.alert('Withdrawal Error', error.message);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setProcessingPayment(false);
    }
  };

  const startPendingTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    timerRef.current = setInterval(() => {
      setPendingTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setTimeout(() => {
            setShowPaymentPending(false);
            redirectToHome();
          }, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const redirectToHome = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setSelectedAmount(null);
    setCustomAmount('');
    setWithdrawalUpiId('');
    setShowPaymentPending(false);
    setShowWithdrawPending(false);
    setPendingTimer(60);
    
    router.push('/');
  };

  const formatCurrency = (amount) => {
    return `₹${amount}`;
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentAmounts = () => {
    return activeTab === 'deposit' ? DEPOSIT_AMOUNTS : WITHDRAW_AMOUNTS;
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e']}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {activeTab === 'deposit' ? 'Add Money' : 'Withdraw Money'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <LinearGradient
            colors={['#FFD700', '#FFA500']}
            style={styles.balanceGradient}
          >
            <MaterialIcons name="account-balance-wallet" size={30} color="#1a1a2e" />
            <View style={styles.balanceInfo}>
              <Text style={styles.balanceLabel}>Current Balance</Text>
              {loadingBalance ? (
                <ActivityIndicator color="#1a1a2e" />
              ) : (
                <Text style={styles.balanceAmount}>
                  {formatCurrency(balance)}
                </Text>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'deposit' && styles.tabActive
            ]}
            onPress={() => handleTabChange('deposit')}
          >
            <MaterialIcons 
              name="add-circle" 
              size={20} 
              color={activeTab === 'deposit' ? '#1a1a2e' : '#888'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'deposit' && styles.tabTextActive
            ]}>
              Deposit
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'withdraw' && styles.tabActive
            ]}
            onPress={() => handleTabChange('withdraw')}
          >
            <MaterialIcons 
              name="remove-circle" 
              size={20} 
              color={activeTab === 'withdraw' ? '#1a1a2e' : '#888'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'withdraw' && styles.tabTextActive
            ]}>
              Withdraw
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount Selection */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: slideAnim,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.sectionTitle}>
            Select Amount {activeTab === 'withdraw' ? '(Min ₹200)' : '(Min ₹100)'}
          </Text>
          
          <View style={styles.amountsGrid}>
            {getCurrentAmounts().map((amount, index) => (
              <Animated.View
                key={amount}
                style={[
                  { transform: [{ scale: selectedAmount === amount ? pulseAnim : 1 }] }
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.amountCard,
                    selectedAmount === amount && styles.amountCardSelected,
                    activeTab === 'withdraw' && amount > balance && styles.amountCardDisabled
                  ]}
                  onPress={() => handleAmountSelect(amount)}
                  disabled={activeTab === 'withdraw' && amount > balance}
                >
                  <LinearGradient
                    colors={
                      selectedAmount === amount
                        ? activeTab === 'deposit' 
                          ? ['#4ECDC4', '#44A08D']
                          : ['#FF6B6B', '#FF8E53']
                        : ['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']
                    }
                    style={styles.amountCardGradient}
                  >
                    <Text style={[
                      styles.amountText,
                      selectedAmount === amount && styles.amountTextSelected,
                      activeTab === 'withdraw' && amount > balance && styles.amountTextDisabled
                    ]}>
                      ₹{amount}
                    </Text>
                    {selectedAmount === amount && (
                      <MaterialIcons name="check-circle" size={12} color="#fff" />
                    )}
                    {activeTab === 'withdraw' && amount > balance && (
                      <MaterialIcons name="lock" size={12} color="#666" />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>

          {/* Custom Amount Input - Only for Withdraw */}
          {activeTab === 'withdraw' && (
            <View style={styles.customAmountSection}>
              <Text style={styles.customAmountLabel}>Or enter custom amount:</Text>
              <View style={styles.customAmountContainer}>
                <Text style={styles.currencySymbol}>₹</Text>
                <TextInput
                  style={styles.customAmountInput}
                  placeholder="Min ₹200"
                  placeholderTextColor="#888"
                  value={customAmount}
                  onChangeText={handleCustomAmountChange}
                  keyboardType="numeric"
                  maxLength={6}
                />
              </View>
            </View>
          )}
        </Animated.View>

        {/* UPI ID Input for Withdrawal */}
        {activeTab === 'withdraw' && (selectedAmount || customAmount) && (
          <Animated.View 
            style={[
              styles.section,
              {
                opacity: slideAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.sectionTitle}>Enter UPI ID or Phone Number</Text>
            
            <View style={styles.upiInputContainer}>
              <MaterialIcons name="account-balance" size={20} color="#FF6B6B" />
              <TextInput
                style={styles.upiInput}
                placeholder="Enter UPI ID (e.g., 9876543210@paytm) or Phone Number"
                placeholderTextColor="#888"
                value={withdrawalUpiId}
                onChangeText={setWithdrawalUpiId}
                keyboardType="default"
                autoCapitalize="none"
              />
            </View>
          </Animated.View>
        )}

        {/* UPI Payment Options (Only for Deposits) */}
        {activeTab === 'deposit' && (selectedAmount || customAmount) && (
          <Animated.View 
            style={[
              styles.section,
              {
                opacity: slideAnim,
                transform: [
                  {
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.sectionTitle}>Choose Payment Method</Text>
            
            <View style={styles.upiAppsContainer}>
              {UPI_APPS.map((app) => (
                <TouchableOpacity
                  key={app.id}
                  style={styles.upiAppCard}
                  onPress={handleUpiPayment}
                  disabled={processingPayment}
                >
                  <LinearGradient
                    colors={[app.color, `${app.color}CC`]}
                    style={styles.upiAppGradient}
                  >
                    {processingPayment ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Image 
                          source={app.image} 
                          style={styles.upiAppImage}
                          resizeMode="contain"
                        />
                        <Text style={styles.upiAppName}>
                          {app.name}
                        </Text>
                        <Text style={styles.upiAppAmount}>
                          ₹{getSelectedAmount()}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </View>

            {/* Universal UPI Button */}
            <TouchableOpacity
              style={styles.universalUpiCard}
              onPress={handleUpiPayment}
              disabled={processingPayment}
            >
              <LinearGradient
                colors={['#4ECDC4', '#44A08D']}
                style={styles.universalUpiGradient}
              >
                <MaterialIcons name="account-balance" size={24} color="#fff" />
                <View style={styles.universalUpiContent}>
                  <Text style={styles.universalUpiTitle}>Other UPI Apps</Text>
                  <Text style={styles.universalUpiSubtitle}>
                    BHIM, Amazon Pay, and more
                  </Text>
                </View>
                <Text style={styles.universalUpiAmount}>₹{getSelectedAmount()}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Withdraw Button */}
        {activeTab === 'withdraw' && (selectedAmount || customAmount) && withdrawalUpiId.trim() && (
          <Animated.View 
            style={[
              styles.section,
              {
                opacity: slideAnim,
                transform: [{ scale: scaleAnim }]
              }
            ]}
          >
            <TouchableOpacity
              style={[
                styles.actionButton,
                processingPayment && styles.actionButtonDisabled
              ]}
              onPress={initiateWithdrawal}
              disabled={processingPayment}
            >
              <LinearGradient
                colors={['#FF6B6B', '#FF8E53']}
                style={styles.actionButtonGradient}
              >
                {processingPayment ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <MaterialIcons name="money-off" size={24} color="#fff" />
                )}
                <Text style={styles.actionButtonText}>
                  {processingPayment 
                    ? 'Processing...' 
                    : `Withdraw ₹${getSelectedAmount()}`
                  }
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <MaterialIcons 
              name={activeTab === 'deposit' ? 'security' : 'info'} 
              size={20} 
              color={activeTab === 'deposit' ? '#4ECDC4' : '#FF6B6B'} 
            />
            <Text style={styles.infoText}>
              {activeTab === 'deposit' 
                ? 'Your payments are 100% secure and encrypted. All major UPI apps are supported.'
                : 'Withdrawals are processed within 24 hours during business days'
              }
            </Text>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Payment Pending Modal */}
      <Modal
        visible={showPaymentPending}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pendingCard}>
            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              style={styles.pendingGradient}
            >
              <MaterialIcons name="hourglass-empty" size={48} color="#1a1a2e" />
              <Text style={styles.pendingTitle}>Payment Pending</Text>
              <Text style={styles.pendingMessage}>
                Your payment is being processed. Amount will be deposited in 5-10 minutes after verification.
              </Text>
              
              <View style={styles.timerContainer}>
                <MaterialIcons name="timer" size={20} color="#1a1a2e" />
                <Text style={styles.timerText}>
                  Redirecting in {formatTime(pendingTimer)}
                </Text>
              </View>

              <View style={styles.pendingActions}>
                <TouchableOpacity
                  style={styles.goHomeButton}
                  onPress={redirectToHome}
                >
                  <Text style={styles.goHomeText}>Go to Home</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>

      {/* Withdrawal Pending Modal */}
      <Modal
        visible={showWithdrawPending}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.pendingCard}>
            <LinearGradient
              colors={['#4ECDC4', '#44A08D']}
              style={styles.pendingGradient}
            >
              <MaterialIcons name="check-circle" size={48} color="#fff" />
              <Text style={styles.pendingTitle}>Withdrawal Initiated</Text>
              <Text style={styles.pendingMessage}>
                Your withdrawal request has been submitted successfully. 
                The amount will be transferred to your account within 24 hours.
              </Text>
              
              <View style={styles.withdrawalInfoContainer}>
                <View style={styles.withdrawalInfoRow}>
                  <MaterialIcons name="schedule" size={16} color="#fff" />
                  <Text style={styles.withdrawalInfoText}>Processing within 24 hours</Text>
                </View>
                <View style={styles.withdrawalInfoRow}>
                  <MaterialIcons name="security" size={16} color="#fff" />
                  <Text style={styles.withdrawalInfoText}>Secure transfer</Text>
                </View>
              </View>

              <View style={styles.pendingActions}>
                <TouchableOpacity
                  style={styles.goHomeButtonWithdraw}
                  onPress={redirectToHome}
                >
                  <Text style={styles.goHomeTextWithdraw}>Go to Home</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  balanceCard: {
    marginHorizontal: 20,
    marginBottom: 30,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  balanceGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  balanceInfo: {
    marginLeft: 15,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#1a1a2e',
    opacity: 0.8,
  },
  balanceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a2e',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 5,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFD700',
  },
  tabText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
  tabTextActive: {
    color: '#1a1a2e',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  amountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  amountCard: {
    width: (width - 60) / 4,
    marginBottom: 15,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  amountCardSelected: {
    elevation: 8,
    shadowOpacity: 0.4,
  },
  amountCardDisabled: {
    opacity: 0.5,
  },
  amountCardGradient: {
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 70,
    justifyContent: 'center',
  },
  amountText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginVertical: 4,
  },
  amountTextSelected: {
    color: '#fff',
  },
  amountTextDisabled: {
    color: '#666',
  },
  customAmountSection: {
    marginTop: 20,
  },
  customAmountLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  customAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginRight: 10,
  },
  customAmountInput: {
    flex: 1,
    height: 50,
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  upiInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  upiInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#fff',
    marginLeft: 10,
    fontWeight: '500',
  },
  upiAppsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  upiAppCard: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  upiAppGradient: {
    padding: 15,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  upiAppImage: {
    width: 32,
    height: 32,
    marginBottom: 8,
  },
  upiAppName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
  },
  upiAppAmount: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  universalUpiCard: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    marginTop: 10,
  },
  universalUpiGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
  },
  universalUpiContent: {
    flex: 1,
    marginLeft: 12,
  },
  universalUpiTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  universalUpiSubtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.8,
  },
  universalUpiAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  actionButton: {
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  infoSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 15,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4ECDC4',
  },
  infoText: {
    flex: 1,
    color: '#888',
    fontSize: 12,
    marginLeft: 10,
    lineHeight: 16,
  },
  bottomPadding: {
    height: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pendingCard: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  pendingGradient: {
    padding: 30,
    alignItems: 'center',
  },
  pendingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 15,
    marginBottom: 10,
  },
  pendingMessage: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
    opacity: 0.9,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 25,
  },
  timerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  withdrawalInfoContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 25,
  },
  withdrawalInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  withdrawalInfoText: {
    fontSize: 14,
    color: '#fff',
    marginLeft: 8,
    fontWeight: '500',
  },
  pendingActions: {
    width: '100%',
  },
  goHomeButton: {
    backgroundColor: 'rgba(26, 26, 46, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
  },
  goHomeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  goHomeButtonWithdraw: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    alignItems: 'center',
  },
  goHomeTextWithdraw: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});