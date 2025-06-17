// app/(tabs)/history.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';

const { width } = Dimensions.get('window');

export default function HistoryScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all'); // all, games, wallet
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    // Mock transaction data - in a real app, this would come from an API
    const mockTransactions = [
      {
        id: '1',
        type: 'game',
        game: 'Six King',
        result: 'won',
        amount: 200,
        stake: 100,
        opponent: 'Player1234',
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        type: 'wallet',
        action: 'add',
        amount: 1000,
        date: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      },
      {
        id: '3',
        type: 'game',
        game: 'Lucky Number',
        result: 'lost',
        amount: -50,
        stake: 50,
        luckyNumber: 4,
        rolls: [2, 6],
        date: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '4',
        type: 'wallet',
        action: 'withdraw',
        amount: -500,
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        status: 'completed'
      },
      {
        id: '5',
        type: 'game',
        game: 'Six King',
        result: 'won',
        amount: 100,
        stake: 50,
        opponent: 'Player5678',
        date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];
    setTransactions(mockTransactions);
  }, []);

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
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const formatCurrency = (amount) => {
    const prefix = amount >= 0 ? '+' : '';
    return `${prefix}₹${Math.abs(amount)}`;
  };

  const renderGameTransaction = (item) => {
    const isWin = item.result === 'won';
    return (
      <View style={styles.transactionCard}>
        <LinearGradient
          colors={isWin ? ['#4ECDC4', '#44A08D'] : ['#FF6B6B', '#FF8E53']}
          style={styles.transactionIcon}
        >
          <MaterialIcons 
            name={item.game === 'Six King' ? 'casino' : 'stars'} 
            size={20} 
            color="#fff" 
          />
        </LinearGradient>
        
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionTitle}>{item.game}</Text>
          <Text style={styles.transactionSubtitle}>
            {isWin ? `Won against ${item.opponent || 'opponent'}` : 
             item.game === 'Lucky Number' ? 
             `Lucky number: ${item.luckyNumber}, Rolls: [${item.rolls?.join(', ')}]` :
             `Lost against ${item.opponent || 'opponent'}`}
          </Text>
          <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
        </View>
        
        <View style={styles.transactionAmount}>
          <Text style={[
            styles.amountText,
            { color: isWin ? '#4ECDC4' : '#FF6B6B' }
          ]}>
            {formatCurrency(item.amount)}
          </Text>
          <Text style={styles.stakeText}>Stake: ₹{item.stake}</Text>
        </View>
      </View>
    );
  };

  const renderWalletTransaction = (item) => {
    const isAdd = item.action === 'add';
    return (
      <View style={styles.transactionCard}>
        <LinearGradient
          colors={isAdd ? ['#4ECDC4', '#44A08D'] : ['#FF6B6B', '#FF8E53']}
          style={styles.transactionIcon}
        >
          <MaterialIcons 
            name={isAdd ? 'add-circle' : 'remove-circle'} 
            size={20} 
            color="#fff" 
          />
        </LinearGradient>
        
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionTitle}>
            {isAdd ? 'Money Added' : 'Money Withdrawn'}
          </Text>
          <Text style={styles.transactionSubtitle}>
            {isAdd ? 'Added to wallet' : 'Withdrawn from wallet'}
          </Text>
          <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
        </View>
        
        <View style={styles.transactionAmount}>
          <Text style={[
            styles.amountText,
            { color: isAdd ? '#4ECDC4' : '#FF6B6B' }
          ]}>
            {formatCurrency(item.amount)}
          </Text>
          <View style={[
            styles.statusBadge,
            { backgroundColor: item.status === 'completed' ? '#4ECDC4' : '#FFA500' }
          ]}>
            <Text style={styles.statusText}>
              {item.status === 'completed' ? 'Completed' : 'Pending'}
            </Text>
          </View>
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
      .filter(t => t.action === 'add')
      .reduce((sum, t) => sum + t.amount, 0);
    const walletWithdrawn = walletTransactions
      .filter(t => t.action === 'withdraw')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    return {
      games: { won: gamesWon, lost: gamesLost, total: totalGameAmount },
      wallet: { added: walletAdded, withdrawn: walletWithdrawn }
    };
  };

  const stats = getTabStats();
  const filteredTransactions = getFilteredTransactions();

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
          />
        ) : (
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
        )}
      </View>
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