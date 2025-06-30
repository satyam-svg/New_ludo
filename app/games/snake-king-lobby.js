import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  Dimensions,
  ScrollView,
  BackHandler,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams , router} from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Game modes configuration with enhanced styling
const GAME_MODES = [
  { 
    rolls: 5, 
    multiplier: 2, 
    name: 'Easy Survivor', 
    description: 'Perfect for beginners • Quick 5-roll challenge',
    descriptionHindi: '5 चाल चले, साँप ने नहीं काटा? जीत गए और 2 गुना ले जाओ!',
    emoji: '🛡️',
    gradient: ['rgba(78, 205, 196, 0.8)', 'rgba(68, 160, 141, 0.9)', 'rgba(26, 26, 46, 0.3)'],
    difficulty: 'EASY',
    difficultyColor: '#4ECDC4'
  },
  { 
    rolls: 8, 
    multiplier: 4, 
    name: 'Daredevil', 
    description: 'For brave players • 8 rolls of excitement',
    descriptionHindi: '8 चालों तक साँप से बचे? 4 गुना इनाम आपका!',
    emoji: '⚡',
    gradient: ['rgba(255, 215, 0, 0.7)', 'rgba(255, 165, 0, 0.8)', 'rgba(26, 26, 46, 0.4)'],
    difficulty: 'MEDIUM',
    difficultyColor: '#FFD700'
  },
  { 
    rolls: 12, 
    multiplier: 8, 
    name: 'Snake Master', 
    description: 'High risk, high reward • 12-roll marathon',
    descriptionHindi: '12 चालें बिना डसे गए? आप हो असली Snake Master • 8 गुना जीत पक्की!',
    emoji: '🔥',
    gradient: ['rgba(255, 107, 107, 0.7)', 'rgba(255, 142, 83, 0.8)', 'rgba(26, 26, 46, 0.4)'],
    difficulty: 'HARD',
    difficultyColor: '#FF6B6B'
  },
  { 
    rolls: 15, 
    multiplier: 16, 
    name: 'Legendary', 
    description: 'Only for the fearless • Ultimate 15-roll test',
    descriptionHindi: '15 बार चले और एक बार भी साँप ने नहीं काटा? आप लिजेंड हैं! 16 गुना जीत लो!',
    emoji: '💎',
    gradient: ['rgba(139, 92, 246, 0.7)', 'rgba(236, 72, 153, 0.8)', 'rgba(26, 26, 46, 0.4)'],
    difficulty: 'EXTREME',
    difficultyColor: '#8B5CF6'
  },
];

export default function ModeSelectionScreen({ navigation }) {
  const { stake } = useLocalSearchParams();
  const { user, updateWallet } = useAuth();

  // Handle back button press
  const handleBack = () => {
    router.back();
    return true;
  };

  // Device back button handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => {
      backHandler.remove();
    };
  }, []);

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

  const ModeCard = ({ mode, index }) => (
    <TouchableOpacity
      style={styles.modeCard}
      onPress={() => selectMode(mode)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={mode.gradient}
        style={styles.modeCardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Difficulty Badge */}
        <View style={[styles.difficultyBadge, { backgroundColor: mode.difficultyColor }]}>
          <Text style={styles.difficultyText}>{mode.difficulty}</Text>
        </View>

        {/* Mode Content */}
        <View style={styles.modeContent}>
          <View style={styles.modeHeader}>
            <Text style={styles.modeEmoji}>{mode.emoji}</Text>
            <View style={styles.modeInfo}>
              <Text style={styles.modeName}>{mode.name}</Text>
              <Text style={styles.rollsInfo}>{mode.rolls} Rolls Challenge</Text>
            </View>
          </View>
          
          <Text style={styles.modeDescription}>{mode.description}</Text>
          <Text style={styles.modeDescription}>{mode.descriptionHindi}</Text>

          
          <View style={styles.modeFooter}>
            <View style={styles.multiplierContainer}>
              <Text style={styles.multiplierLabel}>Win</Text>
              <Text style={styles.multiplierValue}>{mode.multiplier}x</Text>
            </View>
            
            <View style={styles.winAmountContainer}>
              <Text style={styles.winAmountLabel}>Potential</Text>
              <Text style={styles.winAmount}>₹{(stake * mode.multiplier).toFixed(0)}</Text>
            </View>
          </View>
        </View>

        {/* Decorative Elements */}
        <View style={styles.decorativeCircle1} />
        <View style={styles.decorativeCircle2} />
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <LinearGradient
      colors={['#1a1a2e', '#16213e', '#0f3460']}
      style={styles.container}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>🐍 Snake King</Text>
            <Text style={styles.headerSubtitle}>Choose Your Challenge</Text>
          </View>
        </View>

        {/* Wallet & Stake Info */}
        <View style={styles.infoSection}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
            style={styles.infoContainer}
          >
            <View style={styles.infoItem}>
              <MaterialIcons name="account-balance-wallet" size={20} color="#4ECDC4" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Wallet</Text>
                <Text style={styles.infoValue}>₹{user.wallet}</Text>
              </View>
            </View>
            
            <View style={styles.infoDivider} />
            
            <View style={styles.infoItem}>
              <MaterialIcons name="monetization-on" size={20} color="#FFD700" />
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>Stake</Text>
                <Text style={styles.stakeValue}>₹{stake}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Game Modes */}
        <ScrollView 
          showsVerticalScrollIndicator={false} 
          contentContainerStyle={styles.scrollContainer}
        >
          <View style={styles.modesContainer}>
            {GAME_MODES.map((mode, index) => (
              <ModeCard key={index} mode={mode} index={index} />
            ))}
          </View>

          {/* Game Tips */}
          <View style={styles.tipsSection}>
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.1)', 'rgba(236, 72, 153, 0.05)']}
              style={styles.tipsContainer}
            >
              <View style={styles.tipsHeader}>
                <MaterialIcons name="lightbulb" size={20} color="#FFD700" />
                <Text style={styles.tipsTitle}>Pro Tips</Text>
              </View>
              <Text style={styles.tipsText}>
                • Higher rolls = bigger rewards{'\n'}
                • Ladders help you advance faster{'\n'}
                • Avoid snakes to keep your streak alive{'\n'}
                • Choose difficulty based on your confidence!
              </Text>
            </LinearGradient>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 25,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    fontWeight: '500',
  },
  infoSection: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  infoContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoTextContainer: {
    marginLeft: 10,
  },
  infoLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  stakeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  infoDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 20,
  },
  scrollContainer: {
    paddingBottom: 30,
  },
  modesContainer: {
    paddingHorizontal: 20,
  },
  modeCard: {
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modeCardGradient: {
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  difficultyBadge: {
    position: 'absolute',
    top: 15,
    right: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 2,
  },
  difficultyText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  modeContent: {
    zIndex: 1,
  },
  modeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modeEmoji: {
    fontSize: 32,
    marginRight: 15,
  },
  modeInfo: {
    flex: 1,
  },
  modeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  rollsInfo: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  modeDescription: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    marginBottom: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  modeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  multiplierContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  multiplierLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  multiplierValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  winAmountContainer: {
    alignItems: 'flex-end',
  },
  winAmountLabel: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  winAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  decorativeCircle1: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    top: -20,
    right: -20,
  },
  decorativeCircle2: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    bottom: -10,
    left: -10,
  },
  tipsSection: {
    paddingHorizontal: 20,
    marginTop: 10,
  },
  tipsContainer: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.2)',
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 8,
  },
  tipsText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 22,
    opacity: 0.9,
  },
});