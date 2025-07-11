// app/(tabs)/history.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../../config';

const { width } = Dimensions.get('window');
const API_BASE_URL = `${config.BASE_URL}/api`;

export default function HistoryScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all'); // all, games, wallet
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Fetch transaction history from API
  const fetchTransactionHistory = async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Fetch both game history and wallet history in parallel
      const [gameHistoryResponse, walletHistoryResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/users/games-history`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch(`${API_BASE_URL}/payment/transactions`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      let allTransactions = [];

      // Process game history
      if (gameHistoryResponse.ok) {
        const gameHistoryData = await gameHistoryResponse.json();
        const gameTransactions = formatGameTransactions(gameHistoryData.games || gameHistoryData || []);
        allTransactions = [...allTransactions, ...gameTransactions];
      }


      // Process wallet history
      if (walletHistoryResponse.ok) {
        const walletHistoryData = await walletHistoryResponse.json();
        const walletTransactions = formatWalletTransactions(walletHistoryData.transactions || walletHistoryData || []);
        allTransactions = [...allTransactions, ...walletTransactions];
      }

      // Sort by date (newest first)
      allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
      setTransactions(allTransactions);
    } catch (error) {
      console.error('Error fetching transaction history:', error);
      setError(error.message);
      Alert.alert('Error', 'Failed to load transaction history. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Format game transactions from API response
  const formatGameTransactions = (games) => {
    return games.map(game => {
      const isWin = game.result === 'win' || game.status === 'won' || game.won;
      let result;
      if (game.result === 'pending') {
        result = 'pending';
      } else {
        result = isWin ? 'won' : 'lost';
      }
      
      return {
        id: `game_${game.id || game.gameId || Math.random().toString()}`,
        type: 'game',
        game: getGameDisplayName(game.gameType || game.type),
        result: result,
        amount: isWin ? (game.winAmount || game.amount || game.stake * 2) : -(game.stake || game.amount),
        stake: game.stake || game.stakeAmount || 0,
        opponent: game.opponent || game.opponentName || 'Player',
        luckyNumber: game.luckyNumber,
        rolls: game.rollHistory ? (typeof game.rollHistory === 'string' ? game.rollHistory.split(',').map(Number) : game.rollHistory) : null,
        date: game.completedAt || game.createdAt || game.date || new Date().toISOString(),
        gameSpecificData: {
          gameType: game.gameType || game.type,
          rollHistory: game.rollHistory,
          luckyNumber: game.luckyNumber,
          winAmount: game.winAmount,
          rollsLeft: game.rollsLeft
        }
      };
    });
  };

  // Format wallet transactions from API response
  const formatWalletTransactions = (walletTransactions) => {
      return walletTransactions.map(transaction => {
        const isCredit = transaction.amount > 0;
        const transactionType = getWalletTransactionType(transaction.type);
        
        // Extract status from transaction type
        const extractStatus = (type) => {
          if (type.includes('_pending')) return 'pending';
          if (type.includes('_rejected')) return 'rejected';
          if (type.includes('_completed')) return 'completed';
          if (type === 'referral_bonus' || type === 'signup_bonus') return 'completed';
          return 'completed'; // default status
        };
        
        // Extract action type (deposit/withdrawal/bonus)
        const extractAction = (type, amount) => {
          if (type.startsWith('deposit')) return 'add';
          if (type.startsWith('withdrawal')) return 'withdraw';
          if (type.includes('bonus')) return 'bonus';
          return amount > 0 ? 'add' : 'withdraw';
        };
        return {
          id: `wallet_${transaction.id || Math.random().toString()}`,
          type: 'wallet',
          action: extractAction(transaction.type, transaction.amount),
          amount: transaction.amount,
          date: transaction.createdAt || transaction.date || new Date().toISOString(),
          status: extractStatus(transaction.type), // Fixed: extract actual status
          description: transaction.description || transactionType.description,
          transactionType: transaction.type,
          method: transaction.method || 'N/A',
          reference: transaction.reference || null,
          walletSpecificData: {
            originalType: transaction.type,
            description: transaction.description,
            gameId: transaction.gameId
          }
        };
      });
    };

  // Get wallet transaction type details
  const getWalletTransactionType = (type) => {
    const types = {
      // Deposit types
      'deposit_pending': { description: 'Deposit Pending', icon: 'hourglass-empty' },
      'deposit_completed': { description: 'Money Added', icon: 'add-circle' },
      'deposit_rejected': { description: 'Deposit Rejected', icon: 'cancel' },
      
      // Withdrawal types
      'withdrawal_pending': { description: 'Withdrawal Pending', icon: 'hourglass-empty' },
      'withdrawal_completed': { description: 'Money Withdrawn', icon: 'remove-circle' },
      'withdrawal_rejected': { description: 'Withdrawal Rejected', icon: 'cancel' },
      
      // Game related
      'game_win': { description: 'Game Win Bonus', icon: 'celebration' },
      'game_loss': { description: 'Game Stake Deducted', icon: 'remove' },
      
      // Bonus types
      'referral_bonus': { description: 'Referral Bonus', icon: 'card-giftcard' },
      'signup_bonus': { description: 'Welcome Bonus', icon: 'star' },
      
      // Legacy types (for backward compatibility)
      'deposit': { description: 'Money Added', icon: 'add-circle' },
      'withdrawal': { description: 'Money Withdrawn', icon: 'remove-circle' },
      'bonus': { description: 'Bonus Added', icon: 'star' }
    };
    
    return types[type] || { description: 'Transaction', icon: 'swap-horiz' };
  };

  // Get display name for different game types
  const getGameDisplayName = (gameType) => {
    switch (gameType) {
      case 'six_king':
      case 'sixKing':
        return 'Six King';
      case 'lucky_number':
      case 'luckyNumber':
        return 'Lucky Number';
      case 'matka':
      case 'matka_king':
        return 'Matka King';
      case 'snake_king':
      case 'snakeKing':
        return 'Snake King';
      default:
        return gameType || 'Game';
    }
  };

  // Fetch data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchTransactionHistory();
    }, [])
  );

  // Pull to refresh
  const onRefresh = () => {
    fetchTransactionHistory(true);
  };

  const handleTabChange = (tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveTab(tab);
  };

  const getFilteredTransactions = () => {
    switch (activeTab) {
      case 'games':
        return transactions.filter(t => t.type === 'game');
      case 'wallet':
        return transactions.filter(t => t.type === 'wallet');
      default:
        return transactions;
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    
    // Create IST formatters
    const istFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    
    const istTimeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const istDateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    // Get IST date strings for comparison
    const istDateStr = istFormatter.format(date);
    const istNowStr = istFormatter.format(now);
    
    // Calculate difference in UTC (more accurate)
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    // Check if it's the same day in IST
    const isSameDay = istDateStr === istNowStr;

    if (isSameDay) {
      return istTimeFormatter.format(date);
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return istDateFormatter.format(date);
    }
  };

  const formatCurrency = (amount) => {
    const prefix = amount >= 0 ? '+' : '';
    return `${prefix}₹${Math.abs(amount)}`;
  };

  const renderGameTransaction = (item) => {
    const isWin = item.result === 'won';
    const isPending = item.result === 'pending';
    const gameIcon = getGameIcon(item.game);

    const gradientColors = isPending
      ? ['#A9A9A9', '#C0C0C0'] // Grey gradient for pending
      : isWin
      ? ['#4ECDC4', '#44A08D']
      : ['#FF6B6B', '#FF8E53'];

    const resultText = isPending ? 'Pending' : isWin ? 'Won' : 'Lost';
    const resultColor = isPending ? '#A9A9A9' : isWin ? '#4ECDC4' : '#FF6B6B';

    return (
      <View style={styles.transactionCard}>
        <LinearGradient
          colors={gradientColors}
          style={styles.transactionIcon}
        >
          <MaterialIcons 
            name={gameIcon} 
            size={20} 
            color="#fff" 
          />
        </LinearGradient>
        
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionTitle}>{item.game}</Text>
          <Text style={styles.transactionSubtitle}>
            {resultText}
          </Text>
          <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
        </View>
        
        <View style={styles.transactionAmount}>
          <Text style={[
            styles.amountText,
            { color: resultColor }
          ]}>
            {formatCurrency(item.amount)}
          </Text>
          <Text style={styles.stakeText}>Stake: ₹{item.stake}</Text>
        </View>
      </View>
    );
  };


  const getGameIcon = (gameName) => {
    switch (gameName) {
      case 'Six King':
        return 'casino';
      case 'Lucky Number':
        return 'stars';
      case 'Matka King':
        return 'schedule';
      case 'Snake King':
        return 'bug-report';
      default:
        return 'games';
    }
  };

  const renderWalletTransaction = (item) => {
    const isCredit = item.amount > 0;
    const transactionTypeInfo = getWalletTransactionType(item.transactionType);
    
    return (
      <View style={styles.transactionCard}>
        <LinearGradient
          colors={isCredit ? ['#4ECDC4', '#44A08D'] : ['#FF6B6B', '#FF8E53']}
          style={styles.transactionIcon}
        >
          <MaterialIcons 
            name={transactionTypeInfo.icon} 
            size={20} 
            color="#fff" 
          />
        </LinearGradient>
        
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionTitle}>
            {transactionTypeInfo.description}
          </Text>
          <Text style={styles.transactionSubtitle}>
            {item.description || 'Wallet transaction'}
          </Text>
          <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
        </View>
        
        <View style={styles.transactionAmount}>
          <Text style={[
            styles.amountText,
            { color: isCredit ? '#4ECDC4' : '#FF6B6B' }
          ]}>
            {formatCurrency(item.amount)}
          </Text>
          {item.status && (
            <View style={[
              styles.statusBadge,
              { 
                backgroundColor: item.status === 'completed' ? '#4ECDC4' : 
                                item.status === 'pending' ? '#FFA500' : '#FF6B6B'
              }
            ]}>
              <Text style={styles.statusText}>
                {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  const renderTransaction = ({ item }) => {
    return item.type === 'game' ? renderGameTransaction(item) : renderWalletTransaction(item);
  };

  const getTabStats = () => {
    const gameTransactions = transactions.filter(t => t.type === 'game');
    const walletTransactions = transactions.filter(t => t.type === 'wallet');
    
    const gamesWon = gameTransactions.filter(t => t.result === 'won').length;
    const gamesLost = gameTransactions.filter(t => t.result === 'lost').length;
    const totalGameAmount = gameTransactions.reduce((sum, t) => sum + t.amount, 0);
    
    const walletAdded = walletTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const walletWithdrawn = walletTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      games: { won: gamesWon, lost: gamesLost, total: totalGameAmount },
      wallet: { added: walletAdded, withdrawn: walletWithdrawn }
    };
  };

  const stats = getTabStats();
  const filteredTransactions = getFilteredTransactions();

  // Loading state
  if (loading && !refreshing) {
    return (
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.container}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4ECDC4" />
          <Text style={styles.loadingText}>Loading transaction history...</Text>
        </View>
      </LinearGradient>
    );
  }

  // Error state
  if (error && transactions.length === 0) {
    return (
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.container}
      >
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={60} color="#FF6B6B" />
          <Text style={styles.errorTitle}>Failed to load history</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => fetchTransactionHistory()}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e']}
      style={styles.container}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transaction History</Text>
        
        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsCard}>
            <LinearGradient
              colors={['#4ECDC4', '#44A08D']}
              style={styles.statsGradient}
            >
              <MaterialIcons name="games" size={24} color="#fff" />
              <Text style={styles.statsNumber}>{stats.games.won + stats.games.lost}</Text>
              <Text style={styles.statsLabel}>Games Played</Text>
            </LinearGradient>
          </View>
          
          <View style={styles.statsCard}>
            <LinearGradient
              colors={stats.games.total >= 0 ? ['#4ECDC4', '#44A08D'] : ['#FF6B6B', '#FF8E53']}
              style={styles.statsGradient}
            >
              <MaterialIcons 
                name={stats.games.total >= 0 ? 'trending-up' : 'trending-down'} 
                size={24} 
                color="#fff" 
              />
              <Text style={styles.statsNumber}>
                {stats.games.total >= 0 ? '+' : ''}₹{Math.abs(stats.games.total)}
              </Text>
              <Text style={styles.statsLabel}>Game P&L</Text>
            </LinearGradient>
          </View>
        </View>
      </View>

      {/* Tab Selector */}
      <View style={styles.tabContainer}>
        {[
          { key: 'all', label: 'All', icon: 'list' },
          { key: 'games', label: 'Games', icon: 'games' },
          { key: 'wallet', label: 'Wallet', icon: 'account-balance-wallet' }
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tab,
              activeTab === tab.key && styles.tabActive
            ]}
            onPress={() => handleTabChange(tab.key)}
          >
            <MaterialIcons 
              name={tab.icon} 
              size={18} 
              color={activeTab === tab.key ? '#1a1a2e' : '#888'} 
            />
            <Text style={[
              styles.tabText,
              activeTab === tab.key && styles.tabTextActive
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transactions List */}
      <View style={styles.transactionsContainer}>
        {filteredTransactions.length > 0 ? (
          <FlatList
            data={filteredTransactions}
            renderItem={renderTransaction}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.transactionsList}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#4ECDC4']}
                tintColor="#4ECDC4"
              />
            }
          />
        ) : (
          <ScrollView
            contentContainerStyle={styles.emptyStateContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#4ECDC4']}
                tintColor="#4ECDC4"
              />
            }
          >
            <View style={styles.emptyState}>
              <MaterialIcons name="history" size={60} color="#666" />
              <Text style={styles.emptyStateTitle}>No transactions yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                {activeTab === 'games' 
                  ? 'Start playing games to see your game history here'
                  : activeTab === 'wallet'
                  ? 'Add or withdraw money to see wallet transactions'
                  : 'Your transaction history will appear here'
                }
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 15,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FF6B6B',
    marginTop: 15,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#4ECDC4',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statsCard: {
    flex: 1,
    marginHorizontal: 5,
    borderRadius: 15,
    overflow: 'hidden',
  },
  statsGradient: {
    padding: 15,
    alignItems: 'center',
  },
  statsNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
  },
  statsLabel: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.9,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 5,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFD700',
  },
  tabText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  tabTextActive: {
    color: '#1a1a2e',
  },
  transactionsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  transactionsList: {
    paddingBottom: 20,
  },
  emptyStateContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  transactionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  transactionSubtitle: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 11,
    color: '#666',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  stakeText: {
    fontSize: 11,
    color: '#888',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  statusText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
});