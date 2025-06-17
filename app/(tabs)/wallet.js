import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  Animated,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';

const { width } = Dimensions.get('window');

const QUICK_AMOUNTS = [100, 500, 1000, 2000, 5000];

export default function WalletScreen() {
  const { user, updateWallet } = useAuth();
  const [activeTab, setActiveTab] = useState('add'); // add, withdraw
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleTabChange = (tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
    setAmount('');
  };

  const handleQuickAmount = (quickAmount) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAmount(quickAmount.toString());
  };

  const handleTransaction = async () => {
    const transactionAmount = parseInt(amount);
    
    if (!transactionAmount || transactionAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }

    if (activeTab === 'withdraw' && transactionAmount > user.wallet) {
      Alert.alert('Insufficient Balance', 'You don\'t have enough balance to withdraw this amount');
      return;
    }

    if (activeTab === 'withdraw' && transactionAmount < 100) {
      Alert.alert('Minimum Withdrawal', 'Minimum withdrawal amount is ₹100');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setLoading(true);

    // Animate button
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      })
    ]).start();

    // Mock transaction processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newBalance = activeTab === 'add' 
      ? user.wallet + transactionAmount
      : user.wallet - transactionAmount;

    await updateWallet(newBalance);

    // Save transaction history (in a real app, this would be saved to a database)
    const transaction = {
      id: Date.now().toString(),
      type: activeTab,
      amount: activeTab === 'add' ? transactionAmount : -transactionAmount,
      date: new Date().toISOString(),
      status: 'completed'
    };

    setLoading(false);
    setAmount('');

    Alert.alert(
      'Transaction Successful',
      `₹${transactionAmount} ${activeTab === 'add' ? 'added to' : 'withdrawn from'} your wallet.\nNew balance: ₹${newBalance}`,
      [{ text: 'OK' }]
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e']}
      style={styles.container}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Wallet</Text>
          <View style={styles.balanceCard}>
            <LinearGradient
              colors={['#FFD700', '#FFA500']}
              style={styles.balanceGradient}
            >
              <MaterialIcons name="account-balance-wallet" size={30} color="#1a1a2e" />
              <View style={styles.balanceInfo}>
                <Text style={styles.balanceLabel}>Current Balance</Text>
                <Text style={styles.balanceAmount}>
                  {formatCurrency(user?.wallet || 0)}
                </Text>
              </View>
            </LinearGradient>
          </View>
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'add' && styles.tabActive
            ]}
            onPress={() => handleTabChange('add')}
          >
            <MaterialIcons 
              name="add" 
              size={20} 
              color={activeTab === 'add' ? '#1a1a2e' : '#888'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === 'add' && styles.tabTextActive
            ]}>
              Add Money
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
              name="remove" 
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

        {/* Amount Input Section */}
        <Animated.View 
          style={[
            styles.inputSection,
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
            {activeTab === 'add' ? 'Add Money to Wallet' : 'Withdraw Money'}
          </Text>
          
          {/* Custom Amount Input */}
          <View style={styles.amountInputContainer}>
            <Text style={styles.currencySymbol}>₹</Text>
            <TextInput
              style={styles.amountInput}
              placeholder="Enter amount"
              placeholderTextColor="#888"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              maxLength={6}
            />
          </View>

          {/* Quick Amount Buttons */}
          <View style={styles.quickAmountsContainer}>
            <Text style={styles.quickAmountsLabel}>Quick Select:</Text>
            <View style={styles.quickAmountsGrid}>
              {QUICK_AMOUNTS.map((quickAmount) => (
                <TouchableOpacity
                  key={quickAmount}
                  style={[
                    styles.quickAmountButton,
                    amount === quickAmount.toString() && styles.quickAmountButtonSelected
                  ]}
                  onPress={() => handleQuickAmount(quickAmount)}
                >
                  <Text style={[
                    styles.quickAmountText,
                    amount === quickAmount.toString() && styles.quickAmountTextSelected
                  ]}>
                    ₹{quickAmount}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Transaction Button */}
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              style={[
                styles.transactionButton,
                (!amount || loading) && styles.transactionButtonDisabled
              ]}
              onPress={handleTransaction}
              disabled={!amount || loading}
            >
              <LinearGradient
                colors={
                  activeTab === 'add' 
                    ? ['#4ECDC4', '#44A08D']
                    : ['#FF6B6B', '#FF8E53']
                }
                style={styles.transactionButtonGradient}
              >
                <MaterialIcons 
                  name={activeTab === 'add' ? 'add-circle' : 'remove-circle'} 
                  size={24} 
                  color="#fff" 
                />
                <Text style={styles.transactionButtonText}>
                  {loading 
                    ? 'Processing...' 
                    : activeTab === 'add' 
                      ? 'Add Money' 
                      : 'Withdraw'
                  }
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>

          {/* Transaction Info */}
          <View style={styles.transactionInfo}>
            {activeTab === 'add' && (
              <View style={styles.infoCard}>
                <MaterialIcons name="info" size={16} color="#4ECDC4" />
                <Text style={styles.infoText}>
                  Money will be added instantly to your wallet
                </Text>
              </View>
            )}
            
            {activeTab === 'withdraw' && (
              <View style={styles.infoCard}>
                <MaterialIcons name="info" size={16} color="#FF6B6B" />
                <Text style={styles.infoText}>
                  Minimum withdrawal: ₹100. Processing time: 1-2 business days
                </Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Payment Methods */}
        <View style={styles.paymentMethodsSection}>
          <Text style={styles.sectionTitle}>Payment Methods</Text>
          <View style={styles.paymentMethods}>
            <View style={styles.paymentMethod}>
              <MaterialIcons name="credit-card" size={24} color="#4ECDC4" />
              <Text style={styles.paymentMethodText}>Credit/Debit Card</Text>
              <MaterialIcons name="check-circle" size={20} color="#4ECDC4" />
            </View>
            
            <View style={styles.paymentMethod}>
              <MaterialIcons name="account-balance" size={24} color="#4ECDC4" />
              <Text style={styles.paymentMethodText}>Net Banking</Text>
              <MaterialIcons name="check-circle" size={20} color="#4ECDC4" />
            </View>
            
            <View style={styles.paymentMethod}>
              <MaterialIcons name="phone-android" size={24} color="#4ECDC4" />
              <Text style={styles.paymentMethodText}>UPI</Text>
              <MaterialIcons name="check-circle" size={20} color="#4ECDC4" />
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  balanceCard: {
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
  inputSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  amountInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 15,
    marginBottom: 20,
  },
  currencySymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginRight: 10,
  },
  amountInput: {
    flex: 1,
    height: 50,
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  quickAmountsContainer: {
    marginBottom: 30,
  },
  quickAmountsLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
  quickAmountsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAmountButton: {
    width: (width - 60) / 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  quickAmountButtonSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: '#FFD700',
  },
  quickAmountText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  quickAmountTextSelected: {
    color: '#FFD700',
  },
  transactionButton: {
    borderRadius: 15,
    overflow: 'hidden',
    marginBottom: 20,
  },
  transactionButtonDisabled: {
    opacity: 0.5,
  },
  transactionButtonGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
  },
  transactionButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  transactionInfo: {
    marginTop: 10,
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
  paymentMethodsSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  paymentMethods: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 5,
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  paymentMethodText: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 15,
  },
  bottomPadding: {
    height: 20,
  },
});