import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useLocalSearchParams , router} from 'expo-router';
import { useAuth } from '../../hooks/useAuth';

const { width } = Dimensions.get('window');

// Game modes configuration matching the design
const GAME_MODES = [
  { 
    rolls: 5, 
    multiplier: 2, 
    name: 'Easy Survivor', 
    description: 'Survive 5 consecutive rolls without hitting snakes',
    emoji: '🛡️',
    payoutColor: '#FFD700'
  },
  { 
    rolls: 8, 
    multiplier: 3, 
    name: 'Daredevil', 
    description: 'Survive 8 consecutive rolls without hitting snakes',
    emoji: '⚡',
    payoutColor: '#FFD700'
  },
  { 
    rolls: 12, 
    multiplier: 6, 
    name: 'Snake Master', 
    description: 'Survive 12 consecutive rolls without hitting snakes',
    emoji: '🔥',
    payoutColor: '#FFD700'
  },
  { 
    rolls: 15, 
    multiplier: 10, 
    name: 'Legendary', 
    description: 'Survive 15 consecutive rolls without hitting snakes',
    emoji: '💎',
    payoutColor: '#FFD700'
  },
];

export default function ModeSelectionScreen({ navigation }) {
  const { stake } = useLocalSearchParams();
  const { user, updateWallet } = useAuth();

  const selectMode = (mode) => {
    if (stake > user.wallet) {
      Alert.alert('Insufficient Balance', 'You don\'t have enough coins to place this bet.');
      return;
    }
    
    
    router.push({
        pathname: '/games/snake-game',
        params: {
            mode1: JSON.stringify(mode),
            stake: stake.toString(),
            wallet: user.wallet,
            updateWallet: updateWallet
        }
        });
    return;
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Dice Icon */}
        <View style={styles.diceContainer}>
          <Text style={styles.diceIcon}>🐍</Text>
        </View>

        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContainer}
        >
          {/* Wallet Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Your Wallet</Text>
            <Text style={styles.infoAmount}>₹{user.wallet}</Text>
          </View>

          {/* Stake Info */}
          <View style={styles.infoCard}>
            <Text style={styles.infoLabel}>Stake Amount</Text>
            <Text style={styles.stakeAmount}>₹{stake}</Text>
          </View>

          {/* Game Mode Cards */}
          <View style={styles.modesContainer}>
            {GAME_MODES.map((mode, index) => (
              <TouchableOpacity
                key={index}
                style={styles.modeCard}
                onPress={() => selectMode(mode)}
                activeOpacity={0.9}
              >
                <View style={styles.cardContent}>
                  <View style={styles.modeHeader}>
                    <Text style={styles.modeEmoji}>{mode.emoji}</Text>
                    <Text style={styles.modeName}>{mode.name}</Text>
                  </View>
                  
                  <Text style={styles.modeDescription}>{mode.description}</Text>
                  
                  <Text style={[styles.payoutText, { color: mode.payoutColor }]}>
                    {mode.multiplier}x Payout
                  </Text>
                  
                  <View style={styles.winAmountContainer}>
                    <Text style={styles.winLabel}>Potential Win:</Text>
                    <Text style={styles.winAmount}>₹{(stake * mode.multiplier).toFixed(1)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(20, 13, 38, 0.88)', // Purple background to match the design
  },
  safeArea: {
    flex: 1,
  },
  diceContainer: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  diceIcon: {
    fontSize: 50,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  scrollContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    alignItems: 'center',
    backdropFilter: 'blur(10px)',
  },
  infoLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 4,
  },
  infoAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  stakeAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  modesContainer: {
    gap: 16,
    marginTop: 8,
  },
  modeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardContent: {
    padding: 24,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modeEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  modeName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },
  modeDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
    lineHeight: 22,
  },
  payoutText: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  winAmountContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
  },
  winLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  winAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
});