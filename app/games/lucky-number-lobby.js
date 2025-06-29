// app/games/lucky-number-lobby.js
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  BackHandler,
  Alert,
  ScrollView,
  Modal
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';

const { width, height } = Dimensions.get('window');

export default function LuckyNumberLobby() {
  const { stake } = useLocalSearchParams();
  const { user } = useAuth();
  
  const [selectedNumber, setSelectedNumber] = useState(null);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [showLoadingModal, setShowLoadingModal] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const loadingRotation = useRef(new Animated.Value(0)).current;
  const loadingScale = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();

    // Pulse animation for numbers (when not loading)
    let pulseAnimation;
    if (!isStartingGame) {
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
    }

    return () => {
      if (pulseAnimation) pulseAnimation.stop();
    };
  }, [isStartingGame]);

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      router.back();
      return true;
    });
    return () => backHandler.remove();
  }, []);

  const selectLuckyNumber = (number) => {
    if (isStartingGame) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedNumber(number);
  };

  const startGame = async () => {
    if (!selectedNumber || isStartingGame) return;
    
    setIsStartingGame(true);
    setShowLoadingModal(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Start loading animations
    Animated.parallel([
      Animated.timing(loadingScale, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(loadingRotation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      )
    ]).start();
    
    try {
      // Start timing for minimum 5 seconds
      const startTime = Date.now();
      const minLoadingTime = 0; // 5 seconds minimum
      
      // Calculate remaining time to ensure minimum 5 seconds
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
      
      // Wait for remaining time if needed
      if (remainingTime > 0) {
        await new Promise(resolve => setTimeout(resolve, remainingTime));
      }
      
      // Hide loading modal with animation
      Animated.timing(loadingScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowLoadingModal(false);
        setIsStartingGame(false);
        
        // Navigate to actual game with selected number
        router.push({
          pathname: '/games/lucky-number',
          params: { 
            stake: stake,
            luckyNumber: selectedNumber.toString()
          }
        });
      });
      
    } catch (error) {
      console.error('Error starting game:', error);
      
      // Hide loading modal and show error
      Animated.timing(loadingScale, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShowLoadingModal(false);
        setIsStartingGame(false);
        Alert.alert('Error', 'Failed to start game. Please try again.');
      });
    }
  };

  const renderNumberButton = (number) => {
    const isSelected = selectedNumber === number;
    
    return (
      <Animated.View
        key={number}
        style={[
          { transform: [{ scale: isSelected ? 1.1 : pulseAnim }] },
          styles.numberButtonWrapper
        ]}
      >
        <TouchableOpacity
          style={[
            styles.numberButton,
            isSelected && styles.numberButtonSelected,
            isStartingGame && styles.numberButtonDisabled
          ]}
          onPress={() => selectLuckyNumber(number)}
          disabled={isStartingGame}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              isSelected 
                ? ['#FFD700', '#FFA500', '#FF8C00']
                : ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']
            }
            style={styles.numberButtonGradient}
          >
            <View style={styles.numberButtonInner}>
              <Text style={[
                styles.numberButtonText,
                isSelected && styles.numberButtonTextSelected
              ]}>
                {number}
              </Text>
              {isSelected && (
                <View style={styles.selectedIndicator}>
                  <MaterialIcons name="check-circle" size={20} color="#FFF" />
                </View>
              )}
            </View>
            
            {/* Shine effect for selected */}
            {isSelected && <View style={styles.numberShine} />}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <LinearGradient
      colors={['#0f0c29', '#24243e', '#302b63', '#0f0c29']}
      style={styles.container}
    >
      {/* Animated Background Elements */}
      <View style={styles.backgroundElements}>
        <Animated.View style={[styles.floatingElement, styles.element1]} />
        <Animated.View style={[styles.floatingElement, styles.element2]} />
        <Animated.View style={[styles.floatingElement, styles.element3]} />
      </View>

      {/* Header */}
      <Animated.View style={[
        styles.header,
        { opacity: fadeAnim }
      ]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
          disabled={isStartingGame}
        >
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.titleContainer}>
          <Text style={styles.gameTitle}>Lucky Number</Text>
          {/* <Text style={styles.gameSubtitle}>Choose Your Destiny</Text> */}
        </View>
        
        <View style={styles.stakeContainer}>
          <MaterialIcons name="diamond" size={18} color="#FFD700" />
          <Text style={styles.stakeText}>₹{stake}</Text>
        </View>
      </Animated.View>

      {/* Scrollable Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[
          styles.content,
          { 
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={['rgba(255, 215, 0, 0.1)', 'rgba(255, 165, 0, 0.05)']}
              style={styles.heroCard}
            >
              {/* <View style={styles.heroIconContainer}> */}
                {/* <MaterialIcons name="stars" size={10} color="#FFD700" /> */}
              {/* </View> */}
              <Text style={styles.heroTitle}>🎯 Choose Your Lucky Number!</Text>
              <Text style={styles.heroDescription}>
                Pick the number that speaks to your soul.{'\n'}
                You'll get 2 magical rolls to make it happen! ✨
              </Text>
            </LinearGradient>
          </View>

          {/* Number Selection Grid */}
          <View style={styles.numbersSection}>
            {/* <Text style={styles.sectionTitle}>Select Your Number</Text> */}
            <View style={styles.numbersGrid}>
              {[1, 2, 3, 4, 5, 6].map(number => renderNumberButton(number))}
            </View>
          </View>

          {/* Start Game Button */}
          <View style={styles.startButtonContainer}>
            <TouchableOpacity
              style={[
                styles.startButton,
                (!selectedNumber || isStartingGame) && styles.startButtonDisabled
              ]}
              onPress={startGame}
              disabled={!selectedNumber || isStartingGame}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={
                  selectedNumber 
                    ? ['#4ECDC4', '#44A08D', '#2ECC71']
                    : ['#666', '#555', '#444']
                }
                style={styles.startButtonGradient}
              >
                <View style={styles.startButtonContent}>
                  {isStartingGame ? (
                    <>
                      <MaterialIcons name="autorenew" size={28} color="#fff" />
                      {/* <View style={styles.startButtonTextContainer}>
                        <Text style={styles.startButtonText}>Starting Game...</Text>
                        <Text style={styles.startButtonSubtext}>
                          Preparing your lucky number is {selectedNumber}
                        </Text>
                      </View> */}
                    </>
                  ) : selectedNumber ? (
                    <>
                      <MaterialIcons name="play-arrow" size={32} color="#fff" />
                      <View style={styles.startButtonTextContainer}>
                        <Text style={styles.startButtonText}>Start Game</Text>
                        <Text style={styles.startButtonSubtext}>
                          Lucky Number: {selectedNumber} • Stake: ₹{stake}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="touch-app" size={28} color="#888" />
                      <View style={styles.startButtonTextContainer}>
                        <Text style={[styles.startButtonText, styles.disabledText]}>
                          Select a Number
                        </Text>
                        <Text style={[styles.startButtonSubtext, styles.disabledText]}>
                          Choose your lucky number to continue
                        </Text>
                      </View>
                    </>
                  )}
                </View>
                
                {/* Animated glow effect and loading spinner */}
                {selectedNumber && (
                  <Animated.View style={[
                    styles.buttonGlow,
                    {
                      opacity: isStartingGame ? 1 : pulseAnim.interpolate({
                        inputRange: [1, 1.05],
                        outputRange: [0.5, 0.8]
                      })
                    }
                  ]} />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Game Info */}
          <View style={styles.gameInfoSection}>
            <LinearGradient
              colors={['rgba(76, 205, 196, 0.1)', 'rgba(68, 160, 141, 0.05)']}
              style={styles.infoCard}
            >
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <MaterialIcons name="casino" size={24} color="#4ECDC4" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoTitle}>2 Chances to Win</Text>
                  <Text style={styles.infoSubtext}>Roll your lucky number within 2 tries</Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <MaterialIcons name="emoji-events" size={24} color="#FFD700" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoTitle}>Win ₹{Math.floor(parseFloat(stake) * 2.5)}</Text>
                  <Text style={styles.infoSubtext}>2.5x your stake amount</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoIconContainer}>
                  <MaterialIcons name="security" size={24} color="#8B5CF6" />
                </View>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoTitle}>Fair & Transparent</Text>
                  <Text style={styles.infoSubtext}>Provably fair random generation</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        </Animated.View>
      </ScrollView>

      {/* Loading Modal */}
      {/* <Modal
        visible={showLoadingModal}
        transparent={true}
        animationType="none"
        onRequestClose={() => {}}
      >
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f3460', '#533483']}
          style={styles.loadingOverlay}
        >
          <Animated.View style={[
            styles.loadingCard,
            {
              transform: [{ scale: loadingScale }]
            }
          ]}>
            <LinearGradient
              colors={['#0f0c29', '#24243e', '#302b63']}
              style={styles.loadingCardGradient}
            >
              <View style={styles.loadingNumberContainer}>
                <Animated.View style={[
                  styles.loadingNumber,
                  {
                    transform: [{
                      rotate: loadingRotation.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0deg', '360deg']
                      })
                    }]
                  }
                ]}>
                  <LinearGradient
                    colors={['#FFD700', '#FFA500', '#FF8C00']}
                    style={styles.loadingNumberGradient}
                  >
                    <Text style={styles.loadingNumberText}>{selectedNumber}</Text>
                  </LinearGradient>
                </Animated.View>
              </View>

              <View style={styles.loadingTextContainer}>
                <Text style={styles.loadingTitle}>Preparing Your Game</Text>
                <Text style={styles.loadingSubtitle}>
                  Your Lucky Number {selectedNumber}
                </Text>
                <Text style={styles.loadingStake}>Stake: ₹{stake}</Text>
              </View>

              <View style={styles.loadingDotsContainer}>
                <Animated.View style={[
                  styles.loadingDot,
                  {
                    opacity: loadingRotation.interpolate({
                      inputRange: [0, 0.33, 0.66, 1],
                      outputRange: [1, 0.3, 0.3, 1]
                    })
                  }
                ]} />
                <Animated.View style={[
                  styles.loadingDot,
                  {
                    opacity: loadingRotation.interpolate({
                      inputRange: [0, 0.33, 0.66, 1],
                      outputRange: [0.3, 1, 0.3, 0.3]
                    })
                  }
                ]} />
                <Animated.View style={[
                  styles.loadingDot,
                  {
                    opacity: loadingRotation.interpolate({
                      inputRange: [0, 0.33, 0.66, 1],
                      outputRange: [0.3, 0.3, 1, 0.3]
                    })
                  }
                ]} />
              </View>
            </LinearGradient>
          </Animated.View>
        </LinearGradient>
      </Modal> */}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    opacity: 0.03,
  },
  element1: {
    width: 200,
    height: 200,
    backgroundColor: '#4ECDC4',
    top: 100,
    left: -50,
  },
  element2: {
    width: 150,
    height: 150,
    backgroundColor: '#FFD700',
    top: 300,
    right: -30,
  },
  element3: {
    width: 180,
    height: 180,
    backgroundColor: '#8B5CF6',
    bottom: 200,
    left: -40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  gameTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(255, 215, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
    letterSpacing: 1,
  },
  gameSubtitle: {
    fontSize: 14,
    color: '#FFD700',
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
    opacity: 0.9,
  },
  stakeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  stakeText: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    marginBottom: 30,
  },
  heroCard: {
    padding: 25,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  heroIconContainer: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 15,
    textShadowColor: 'rgba(255, 215, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroDescription: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 24,
  },
  numbersSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 25,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  numbersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  numberButtonWrapper: {
    width: (width - 80) / 3,
    marginBottom: 20,
  },
  numberButton: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  numberButtonSelected: {
    elevation: 15,
    shadowColor: '#FFD700',
    shadowOpacity: 0.6,
  },
  numberButtonDisabled: {
    opacity: 0.6,
  },
  numberButtonGradient: {
    height: 90,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  numberButtonInner: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  numberButtonText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  numberButtonTextSelected: {
    color: '#fff',
    fontSize: 36,
  },
  selectedIndicator: {
    position: 'absolute',
    top: -15,
    right: -15,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 15,
    padding: 2,
  },
  numberShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
  },
  gameInfoSection: {
    marginBottom: 30,
  },
  infoCard: {
    padding: 25,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(76, 205, 196, 0.2)',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  infoSubtext: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  startButtonContainer: {
    marginBottom: 20,
  },
  startButton: {
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  startButtonDisabled: {
    opacity: 0.7,
    elevation: 5,
    shadowOpacity: 0.2,
  },
  startButtonGradient: {
    position: 'relative',
  },
  startButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 25,
  },
  startButtonTextContainer: {
    marginLeft: 15,
    alignItems: 'center',
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  startButtonSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
    fontWeight: '600',
  },
  disabledText: {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  buttonGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  // Loading Modal Styles
  loadingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    width: '85%',
    maxWidth: 320,
    borderRadius: 25,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
  },
  loadingCardGradient: {
    padding: 40,
    alignItems: 'center',
    position: 'relative',
  },
  loadingNumberContainer: {
    marginBottom: 30,
  },
  loadingNumber: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
  },
  loadingNumberGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingNumberText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
  },
  loadingTextContainer: {
    alignItems: 'center',
    marginBottom: 25,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 5,
  },
  loadingStake: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingDotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ECDC4',
    marginHorizontal: 4,
  },
});