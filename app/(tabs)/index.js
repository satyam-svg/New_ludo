import * as Clipboard from 'expo-clipboard';
import { Share, Modal } from 'react-native'; // Added Modal import
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  Alert,
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../../config';

const { width } = Dimensions.get('window');

const STAKES = [10, 30, 50, 100, 500, 1000];

// Game Rules Data
const gameRules = [
  {
    id: 'six-king',
    title: '6 King Multiplayer',
    icon: 'casino',
    gradient: ['#FF6B6B', '#FF8E53'],
    rules: [
      '🎯 असली खिलाड़‍ियों के साथ मुकाबला',
      '🎲 पहला चाल किसे मिलेगी तय होगा किस्मत से',
      '👑 जो पहले 3 बार 6 ले आए वही बनेगा किंग',
      '💰 जीतने पर मिलेगा दुगना पैसा (2x)',
      '⚡ मैच तुरंत शुरू हो जाता है'
    ],
    badge: 'लाइव',
    badgeColor: '#2ECC71'
  },
  {
    id: 'lucky-number',
    title: 'Lucky Number',
    icon: 'stars',
    gradient: ['#4ECDC4', '#44A08D'],
    rules: [
      '🔢 1 से 6 तक कोई एक नंबर चुनो',
      '🎲 नंबर लाने के मिलेंगे 2 मौके',
      '🍀 जीतने के ज्यादा चांस',
      '💎 जीतने पर 2.5 गुना पैसा मिलेगा',
      '⭐ अकेले खेलो, खुद की किस्मत आज़माओ'
    ],
    badge: 'अकेला',
    badgeColor: '#4ECDC4'
  },
  {
    id: 'matka-king',
    title: 'Matka King',
    icon: 'schedule',
    gradient: ['#8B5CF6', '#7C3AED'],
    rules: [
      '⏰ तय समय पर ही खेल होगा',
      '🔢 0 से 9 तक कोई एक नंबर चुनो',
      '🏆 सही नंबर आया तो 10 गुना इनाम!',
      '📅 हर दिन कई बार खेलने का मौका',
      '👥 कम से कम 25 खिलाड़ी ज़रूरी'
    ],
    badge: 'स्लॉट',
    badgeColor: '#8B5CF6'
  },
  {
    id: 'snake-king',
    title: 'Snake King',
    icon: 'bug-report',
    gradient: ['#4E9525', '#2B5E20'],
    rules: [
      '🐍 बोर्ड पर सांप से बचो वरना नीचे गिरोगे',
      '🪜 सीढ़ियाँ मिलेंगी तो ऊपर जाओगे',
      '💸 सिर्फ़ 5-15 रोल में जीत का मौका',
      '🔥 16 गुना तक जीत सकते हो!',
      '⚡ खतरा तुम्हारा, इनाम भी तुम्हारा'
    ],
    badge: 'बोर्ड',
    badgeColor: '#4E9525'
  }
];

export default function HomeScreen() {
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedStake, setSelectedStake] = useState(null);
  const [showGames, setShowGames] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [balance, setBalance] = useState(0);
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [currentRuleIndex, setCurrentRuleIndex] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showReferral, setShowReferral] = useState(false);
  
  const { user, updateWallet, logout } = useAuth();
  const rulesCarouselRef = useRef(null);
  const menuSlideAnim = useRef(new Animated.Value(-width)).current;

  const scaleAnim = React.useRef(new Animated.Value(1)).current;
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackToGames);
    return () => {
      backHandler.remove();
    };
  }, []);

  // MOVED: Referral Modal Component definition outside of useEffect
  const ReferralModal = () => {
    return (
      <Modal
        visible={showReferral}
        transparent={true}
        animationType="slide"
        onRequestClose={closeReferralModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.referralModal}>
            <LinearGradient
              colors={['#FFD700', '#FFA500', '#FF8C00']}
              style={styles.referralModalGradient}
            >
              {/* Header */}
              <View style={styles.referralHeader}>
                <MaterialIcons name="card-giftcard" size={30} color="#1a1a2e" />
                <Text style={styles.referralTitle}>रेफर करें और कमाएं</Text>
                <TouchableOpacity style={styles.closeReferralButton} onPress={closeReferralModal}>
                  <MaterialIcons name="close" size={24} color="#1a1a2e" />
                </TouchableOpacity>
              </View>

              {/* Benefits */}
              <View style={styles.referralBenefits}>
                <View style={styles.benefitItem}>
                  <MaterialIcons name="person-add" size={20} color="#1a1a2e" />
                  <Text style={styles.benefitText}>दोस्तों को BetBoss में Invite करें</Text>
                </View>
                <View style={styles.benefitItem}>
                  <MaterialIcons name="monetization-on" size={20} color="#1a1a2e" />
                  <Text style={styles.benefitText}>उन्हें Signup पर ₹50 बोनस मिलेगा</Text>
                </View>
                <View style={styles.benefitItem}>
                  <MaterialIcons name="celebration" size={20} color="#1a1a2e" />
                  <Text style={styles.benefitText}>जब वे Deposit करें तो आपको ₹50 मिलेगा</Text>
                </View>
              </View>

              {/* Referral Code */}
              <View style={styles.referralCodeSection}>
                <Text style={styles.referralCodeLabel}>Your Referral Code:</Text>
                <View style={styles.referralCodeContainer}>
                  <Text style={styles.referralCodeText}>{referralCode || 'Loading...'}</Text>
                  <TouchableOpacity 
                    style={styles.copyCodeButton}
                    onPress={copyReferralCode}
                    disabled={!referralCode}
                  >
                    <MaterialIcons name="content-copy" size={20} color="#1a1a2e" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Share Button */}
              <TouchableOpacity
                style={styles.shareReferralButton}
                onPress={shareReferral}
                disabled={!referralCode}
              >
                <MaterialIcons name="share" size={20} color="#FFD700" />
                <Text style={styles.shareReferralText}>Share with Friends</Text>
              </TouchableOpacity>

              {/* How it works */}
              {/* <View style={styles.howItWorks}>
                <Text style={styles.howItWorksTitle}>How it works:</Text>
                <Text style={styles.howItWorksText}>
                  1. Share your code with friends{'\n'}
                  2. They sign up using your code{'\n'}
                  3. Both get ₹50 when they make first deposit{'\n'}
                  4. Start playing and earning together!
                </Text>
              </View> */}
            </LinearGradient>
          </View>
        </View>
      </Modal>
    );
  };

  // Updated games data with better content organization
  const games = [
    {
      id: 'six-king',
      title: '6 King',
      description: '3 बार 6 लाओ, बाज़ी जीतो! 🎲👑',
      icon: 'casino',
      gradient: ['#FF6B6B', '#FF8E53'],
      multiplier: '2x',
      multiplierHint: '2 गुना पैसा! 💰',
      isMultiplayer: true,
      badge: 'मल्टीप्लेयर',
      players: '500+ खिलाड़ी ऑनलाइन'
    },
    {
      id: 'lucky-number',
      title: 'Lucky Number',
      description: 'लकी नंबर चुनो, बड़ा इनाम पाओ! 🍀🎯',
      icon: 'stars',
      gradient: ['#4ECDC4', '#44A08D'],
      multiplier: '2.5x',
      multiplierHint: '2.5 गुना कमाई! 💸',
      badge: 'सोलो',
      players: 'अकेले खेलें'
    },
    {
      id: 'matka-king',
      title: 'Matka King',
      description: 'सही नंबर चुना तो सीधा 10 गुना! 💥💰',
      icon: 'schedule',
      gradient: ['#8B5CF6', '#7C3AED'],
      multiplier: '10x',
      multiplierHint: 'सीधा 10 गुना पैसा! 🔥',
      isMultiplayer: true,
      badge: 'टाइम स्लॉट',
      players: 'हर घंटे नया गेम'
    },
    {
      id: 'snake-king',
      title: 'Snake King',
      description: 'सांप से बचो, सीढ़ी से चढ़ो, जीत पक्की! 🐍🪜',
      icon: 'bug-report',
      gradient: ['#4E9525', '#2B5E20'],
      multiplier: '2x - 16x',
      multiplierHint: 'कम से कम डबल, ज़्यादा से ज़्यादा 16 गुना! 😲',
      badge: 'एडवेंचर',
      players: 'रोमांच भरा गेम'
    }
  ];

  // Create cyclic data for infinite scroll
  const cyclicGameRules = [
    ...gameRules.slice(-1), // Last item at beginning
    ...gameRules,           // Original items
    ...gameRules.slice(0, 1) // First item at end
  ];

  // Menu bar items
 // Updated menuItems array with detailed Hindi rules
const menuItems = [
  {
    id: 'profile',
    icon: 'person',
    label: 'Profile',
    action: () => router.push('/(tabs)/profile')
  },
  {
    id: 'rules',
    icon: 'rule',
    label: 'Game Rules',
    action: () => Alert.alert(
      'Game Rules - खेल के नियम',

      `     🎲 6 King Multiplayer:
      • असली खिलाड़ियों के साथ मुकाबला
      • पहला चाल किसे मिलेगी तय होगा किस्मत से
      • जो पहले 3 बार 6 ले आए वही बनेगा किंग
      • जीतने पर मिलेगा दुगना पैसा (2x)
      • मैच तुरंत शुरू हो जाता है

      ⭐ Lucky Number:
      • 1 से 6 तक कोई एक नंबर चुनो
      • नंबर लाने के मिलेंगे 2 मौके
      • जीतने के ज्यादा चांस
      • जीतने पर 2.5 गुना पैसा मिलेगा
      • अकेले खेलो, खुद की किस्मत आज़माओ

      🎰 Matka King:
      • तय समय पर ही खेल होगा
      • 0 से 9 तक कोई एक नंबर चुनो
      • सही नंबर आया तो 10 गुना इनाम!
      • हर दिन कई बार खेलने का मौका
      • कम से कम 25 खिलाड़ी ज़रूरी

      🐍 Snake King:
      • बोर्ड पर सांप से बचो वरना नीचे गिरोगे
      • सीढ़ियाँ मिलेंगी तो ऊपर जाओगे
      • सिर्फ़ 5-15 रोल में जीत का मौका
      • 16 गुना तक जीत सकते हो!
      • खतरा तुम्हारा, इनाम भी तुम्हारा`,
      [{ text: 'ok', style: 'default' }]
    )
  },
  {
    id: 'wallet',
    icon: 'account-balance-wallet',
    label: 'Wallet',
    action: () => router.push('/(tabs)/wallet')
  },
  {
    id: 'history',
    icon: 'history',
    label: 'History',
    action: () => router.push('/(tabs)/history')
  },
  {
    id: 'refer',
    icon: 'card-giftcard',
    label: 'Refer & Earn',
    action: () => showReferralModal()
  },
  {
    id: 'privacy',
    icon: 'privacy-tip',
    label: 'Privacy Policy',
    action: () => Alert.alert(
      'Privacy Policy',
      'Your privacy is important to us. We collect and use your information to provide gaming services, process transactions, and improve user experience. We never share your personal data with third parties without consent. All game data is encrypted and securely stored. For detailed privacy policy, visit our website.'
    )
  },
  {
    id: 'support',
    icon: 'support-agent',
    label: 'Support',
    action: () => Alert.alert('Support', 'Contact us at support@betboss.com for any queries!')
  },
  {
    id: 'logout',
    icon: 'logout',
    label: 'Logout',
    action: () => Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            logout();
          }
        }
      ]
    )
  }
];

  // Auto-scroll effect for rules carousel
  useEffect(() => {
    const interval = setInterval(() => {
      if (rulesCarouselRef.current && showGames) {
        const nextIndex = (currentRuleIndex + 1) % gameRules.length;
        const scrollIndex = nextIndex + 1; // Account for the prepended item
        
        rulesCarouselRef.current.scrollToIndex({
          index: scrollIndex,
          animated: true,
        });
        setCurrentRuleIndex(nextIndex);
      }
    }, 30000); // Auto-scroll every 4 seconds

    return () => clearInterval(interval);
  }, [currentRuleIndex, showGames]);

  // Handle manual scroll
  const handleRulesScroll = (event) => {
    const scrollPosition = event.nativeEvent.contentOffset.x;
    const cardWidth = width * 0.85 + 15; // Card width + separator
    const index = Math.round(scrollPosition / cardWidth);
    
    // Handle cyclic logic
    if (index === 0) {
      // Scrolled to the duplicate last item at beginning
      setTimeout(() => {
        rulesCarouselRef.current?.scrollToIndex({
          index: gameRules.length,
          animated: false,
        });
      }, 100);
      setCurrentRuleIndex(gameRules.length - 1);
    } else if (index === cyclicGameRules.length - 1) {
      // Scrolled to the duplicate first item at end
      setTimeout(() => {
        rulesCarouselRef.current?.scrollToIndex({
          index: 1,
          animated: false,
        });
      }, 100);
      setCurrentRuleIndex(0);
    } else {
      // Normal scroll within bounds
      setCurrentRuleIndex(index - 1);
    }
  };

  // Menu toggle functions
  const openMenu = () => {
    setIsMenuOpen(true);
    Animated.timing(menuSlideAnim, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = () => {
    Animated.timing(menuSlideAnim, {
      toValue: -width,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setIsMenuOpen(false);
    });
  };

  const handleMenuItemPress = (item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeMenu();
    setTimeout(() => {
      item.action();
    }, 250);
  };

  // Referral functions
  const showReferralModal = () => {
    setShowReferral(true);
  };

  const closeReferralModal = () => {
    setShowReferral(false);
  };

  const copyReferralCode = async () => {
    if (referralCode) {
      await Clipboard.setStringAsync(referralCode);
      Alert.alert('Copied!', 'Referral code copied to clipboard');
    }
  };

  const shareReferral = async () => {
    if (!referralCode) return;
    
    try {
      const shareMessage = `🎮 Join me on BetBoss and start winning real money!\n\nUse my referral code: ${referralCode}\n\nYou'll get ₹50 bonus on your first deposit! 💰\n\nDownload now and let's play together! 🚀\n\n#BetBoss #RealMoney #Gaming`;
      
      await Share.share({
        message: shareMessage,
        title: 'Join BetBoss - Get ₹50 Bonus!'
      });
    } catch (error) {
      console.log('Error sharing:', error);
    }
  };

  // Game Card Component with removed icons and adjusted layout
  const GameCardComponent = ({ game }) => {
    return (
      <TouchableOpacity
        style={styles.gameCard}
        onPress={() => handleGameSelect(game)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[...game.gradient, 'rgba(0, 0, 0, 0.1)']}
          style={styles.gameCardGradient}
        >
          <View style={styles.gameCardContent}>
            {/* Header Section - No Icon Container */}
            <View style={styles.gameHeader}>
              <Text style={styles.gameTitle}>{game.title}</Text>
            </View>
            
            {/* Description */}
            <Text style={styles.gameDescription}>{game.description}</Text>
            
            {/* Middle Section - Multiplier */}
            <View style={styles.gameMiddleSection}>
              <View style={styles.multiplierContainer}>
                <Text style={styles.multiplierText}>{game.multiplier}</Text>
              </View>
              <Text style={styles.multiplierHint}>{game.multiplierHint}</Text>
            </View>
            
            {/* Footer Section */}
            <View style={styles.gameFooter}>
              <Text style={styles.playersInfo}>{game.players}</Text>
              
              {game.isMultiplayer && (
                <View style={styles.onlineIndicator}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>LIVE</Text>
                </View>
              )}
              
              {/* Quick Play Button - FIXED: Removed TouchableOpacity, now just a styled View */}
              <View style={styles.quickPlayButton}>
                <Text style={styles.quickPlayText}>खेलें →</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Game Rules Card Component with enhanced styling
  const GameRuleCard = ({ game, index }) => {
    const isActive = (index % gameRules.length) === currentRuleIndex;
    
    return (
      <Animated.View style={[
        styles.ruleCard,
        {
          transform: [{
            scale: isActive ? 1 : 0.95
          }],
          opacity: isActive ? 1 : 0.8
        }
      ]}>
        <LinearGradient
          colors={[...game.gradient, 'rgba(0, 0, 0, 0.1)']}
          style={styles.ruleCardGradient}
        >
          {/* Header */}
          <View style={styles.ruleCardHeader}>
            <View style={styles.ruleIconContainer}>
              <MaterialIcons name={game.icon} size={24} color="#fff" />
            </View>
            <View style={styles.ruleHeaderText}>
              <Text style={styles.ruleCardTitle}>{game.title}</Text>
              <View style={[styles.ruleBadge, { backgroundColor: game.badgeColor }]}>
                <Text style={styles.ruleBadgeText}>{game.badge}</Text>
              </View>
            </View>
          </View>

          {/* Rules List */}
          <View style={styles.rulesList}>
            {game.rules.map((rule, ruleIndex) => (
              <Animated.View 
                key={ruleIndex} 
                style={[
                  styles.ruleItem,
                  {
                    transform: [{
                      translateX: isActive ? 0 : -10
                    }],
                    opacity: isActive ? 1 : 0.7
                  }
                ]}
              >
                <Text style={styles.ruleText}>{rule}</Text>
              </Animated.View>
            ))}
          </View>

          {/* Play Button */}
          <TouchableOpacity 
            style={styles.rulePlayButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              if (game.id === 'six-king') {
                router.push('/games/six-king-lobby');
              } else if (game.id === 'matka-king') {
                router.push('/games/matka-king');
              } else {
                handleGameSelect(games.find(g => g.id === game.id));
              }
            }}
          >
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.2)', 'rgba(255, 255, 255, 0.1)']}
              style={styles.rulePlayGradient}
            >
              <MaterialIcons name="play-arrow" size={18} color="#fff" />
              <Text style={styles.rulePlayText}>Play Now</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    );
  };

  // Menu Bar Component
  const SideMenu = () => {
    if (!isMenuOpen) return null;
    
    return (
      <>
        {/* Overlay */}
        <TouchableOpacity 
          style={styles.menuOverlay} 
          activeOpacity={1} 
          onPress={closeMenu}
        />
        
        {/* Side Menu */}
        <Animated.View 
          style={[
            styles.sideMenu,
            {
              transform: [{ translateX: menuSlideAnim }]
            }
          ]}
        >
          <View style={styles.sideMenuContent}>
            {/* Menu Header */}
            <View style={styles.menuHeader}>
              <View style={styles.menuUserInfo}>
                <View style={styles.menuAvatar}>
                 <Image 
                      source={require('../../assets/icon.png')} 
                      style={styles.menuAvatarImage}
                      resizeMode="contain"
                    />
                </View>
                <View style={styles.menuUserDetails}>
                  <Text style={styles.menuUserName}>Welcome!</Text>
                  <Text style={styles.menuUserEmail}>{phoneNumber || 'Player'}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.closeMenuButton} onPress={closeMenu}>
                <MaterialIcons name="close" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Balance Display */}
            <View style={styles.menuBalance}>
              <View style={styles.menuBalanceContent}>
                <MaterialIcons name="account-balance-wallet" size={16} color="#FFD700" />
                <Text style={styles.menuBalanceText}>₹{balance}</Text>
              </View>
            </View>

            {/* Menu Items */}
            <View style={styles.menuItems}>
              {menuItems.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.menuItem,
                    index === menuItems.length - 1 && styles.logoutItem
                  ]}
                  onPress={() => handleMenuItemPress(item)}
                  activeOpacity={0.7}
                >
                  <View style={[
                    styles.menuItemIconContainer,
                    index === menuItems.length - 1 && styles.logoutIconContainer
                  ]}>
                    <MaterialIcons 
                      name={item.icon} 
                      size={20} 
                      color={index === menuItems.length - 1 ? '#FF6B6B' : '#4ECDC4'} 
                    />
                  </View>
                  <Text style={[
                    styles.menuItemText,
                    index === menuItems.length - 1 && styles.logoutText
                  ]}>
                    {item.label}
                  </Text>
                  {/* <MaterialIcons 
                    name="chevron-right" 
                    size={16} 
                    color={index === menuItems.length - 1 ? '#FF6B6B' : '#888'} 
                  /> */}
                </TouchableOpacity>
              ))}
            </View>

            {/* App Info */}
            <View style={styles.menuFooter}>
              <Text style={styles.menuAppName}>BetBoss v1.0.0</Text>
              <Text style={styles.menuAppTagline}>Play • Win • Rule</Text>
            </View>
          </View>
        </Animated.View>
      </>
    );
  };

  useFocusEffect(
    React.useCallback(() => {
      const fetchUserData = async () => {
        try {
          setIsLoading(true);
          const token = await AsyncStorage.getItem('authToken');
          if (!token) {
            throw new Error('No authentication token found');
          }
          
          const response = await fetch(`${config.BASE_URL}/api/users/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (!response.ok) throw new Error('Failed to fetch user data');
          
          const data = await response.json();
          const wallet = data.wallet;
          setBalance(wallet);
          setEmail(data.email);
          setPhoneNumber(data.phoneNumber);
          setReferralCode(data.referralCode);
          
          updateWallet(wallet);
        } catch (error) {
          console.error('User data fetch error:', error);
          Alert.alert('Error', error.message);
        } finally {
          setIsLoading(false);
        }
      };

      fetchUserData();
    }, [])
  );

  useEffect(() => {
    if (user) {
      setBalance(user.wallet || 0);
      setEmail(user.email || '');
      setPhoneNumber(user.phoneNumber || '');
      setReferralCode(user.referralCode || '');
    }
  }, [user]);

  const handleGameSelect = (game) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedGame(game);
    setSelectedStake(null);
    
    if (game.id === 'six-king') {
      router.push('/games/six-king-lobby');
      return;
    }
    
    if (game.id === 'matka-king') {
      router.push('/games/matka-king');
      return;
    }

    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowGames(false);
    });
  };

  const handleStakeSelect = (stake) => {
    if (balance < stake) {
      Alert.alert('Insufficient Balance', `You need ₹${stake} to play this game. Please add money to your wallet.`);
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedStake(stake);
  };

  const handlePlayGame = () => {
    if (!selectedGame || !selectedStake) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
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
    ]).start(() => {
      if (selectedGame.id === 'matka-king') {
        router.push({
          pathname: '/games/matka-king',
          params: { stake: selectedStake }
        });
      }
      else if (selectedGame.id === 'snake-king'){
        router.push({
          pathname: '/games/snake-king-lobby',
          params: { stake: selectedStake }
        });
      }
      else if (selectedGame.id === 'lucky-number'){
        router.push({
          pathname: `/games/lucky-number-lobby`,
          params: { stake: selectedStake }
        });
      }
       else {
        router.push({
          pathname: `/games/${selectedGame.id}`,
          params: { stake: selectedStake }
        });
      }
    });
  };

  const handleBackToGames = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedGame(null);
    setSelectedStake(null);
    setShowGames(true);
    
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
    return true;
  };

  return (
    <View style={styles.mainContainer}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e']}
        style={styles.container}
      >
        <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <TouchableOpacity style={styles.hamburgerButton} onPress={openMenu}>
                <MaterialIcons name="menu" size={24} color="#fff" />
              </TouchableOpacity>
              
              <View style={styles.appBranding}>
                <Image 
                  source={require('../../assets/icon.png')} // Put your image file here
                  style={styles.appIcon}
                  resizeMode="contain"
                />
                <Text style={styles.appName}>BetBoss</Text>
              </View>
              
              {isLoading ? (
                <ActivityIndicator size="small" color="#FFD700" />
              ) : (
                <TouchableOpacity style={styles.walletContainer}>
                  <MaterialIcons name="account-balance-wallet" size={18} color="#FFD700" />
                  <Text style={styles.balanceText}>₹{balance}</Text>
                </TouchableOpacity>
              )}
            </View>
            
            <Text style={styles.tagline}>🎯 खेलो, जीतो और राज करो! 👑</Text>
          </View>
          
          {/* Conditional Content Based on Flow */}
          {showGames ? (
            <>
              {/* Hero Section */}
              <View style={styles.heroSection}>
                <View style={styles.heroContent}>
                  <Text style={styles.heroTitle}>Game चुनो, पैसा बनाओ! 💰</Text>
                </View>
              </View>

              {/* Game Selection */}
              <View style={styles.section}>
                <View style={styles.gamesContainer}>
                  {games.map((game) => (
                    <GameCardComponent key={game.id} game={game} />
                  ))}
                </View>
              </View>

              {/* Game Rules Section - Enhanced with Cyclic Mode */}
              <View style={styles.gameRulesSection}>
                <View style={styles.rulesHeader}>
                  <MaterialIcons name="rule" size={24} color="#FFD700" />
                  <Text style={styles.rulesTitle}>Game Rules & How to Play</Text>
                </View>
                <Text style={styles.rulesSubtitle}>
                   Swipe to explore each game
                </Text>
                
                <FlatList
                  ref={rulesCarouselRef}
                  data={cyclicGameRules}
                  renderItem={({ item, index }) => <GameRuleCard game={item} index={index} />}
                  keyExtractor={(item, index) => `${item.id}-${index}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={width * 0.85 + 15}
                  snapToAlignment="start"
                  decelerationRate="fast"
                  contentContainerStyle={styles.rulesCardsContainer}
                  ItemSeparatorComponent={() => <View style={{ width: 15 }} />}
                  initialScrollIndex={1} // Start from the first real item
                  getItemLayout={(data, index) => ({
                    length: width * 0.85 + 15,
                    offset: (width * 0.85 + 15) * index,
                    index,
                  })}
                  onMomentumScrollEnd={handleRulesScroll}
                  onScrollToIndexFailed={(info) => {
                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                    wait.then(() => {
                      rulesCarouselRef.current?.scrollToIndex({ 
                        index: info.index, 
                        animated: true 
                      });
                    });
                  }}
                />
                
                {/* Pagination Dots */}
                <View style={styles.paginationContainer}>
                  {gameRules.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.paginationDot,
                        currentRuleIndex === index && styles.paginationDotActive
                      ]}
                      onPress={() => {
                        const scrollIndex = index + 1; // Account for the prepended item
                        rulesCarouselRef.current?.scrollToIndex({
                          index: scrollIndex,
                          animated: true,
                        });
                        setCurrentRuleIndex(index);
                      }}
                    />
                  ))}
                </View>
              </View>

              {/* Features Section */}
              <View style={styles.featuresSection}>
                <Text style={styles.featuresTitle}>Why Play With Us?</Text>
                <View style={styles.featuresGrid}>
                  <View style={styles.featureCard}>
                    <LinearGradient
                      colors={['rgba(255, 107, 107, 0.2)', 'rgba(255, 142, 83, 0.1)']}
                      style={styles.featureGradient}
                    >
                      <MaterialIcons name="flash-on" size={30} color="#FFD700" />
                      <Text style={styles.featureTitle}>Instant Wins</Text>
                      <Text style={styles.featureDescription}>Get paid instantly</Text>
                    </LinearGradient>
                  </View>
                  
                  <View style={styles.featureCard}>
                    <LinearGradient
                      colors={['rgba(78, 205, 196, 0.2)', 'rgba(68, 160, 141, 0.1)']}
                      style={styles.featureGradient}
                    >
                      <MaterialIcons name="security" size={30} color="#FFD700" />
                      <Text style={styles.featureTitle}>100% Safe</Text>
                      <Text style={styles.featureDescription}>Secure gameplay</Text>
                    </LinearGradient>
                  </View>
                  
                  <View style={styles.featureCard}>
                    <LinearGradient
                      colors={['rgba(255, 215, 0, 0.2)', 'rgba(255, 165, 0, 0.1)']}
                      style={styles.featureGradient}
                    >
                      <MaterialIcons name="trending-up" size={30} color="#FFD700" />
                      <Text style={styles.featureTitle}>High Rewards</Text>
                      <Text style={styles.featureDescription}>Win up to 15x</Text>
                    </LinearGradient>
                  </View>
                </View>
              </View>

              {/* Stats Section */}
              <View style={styles.statsSection}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                  style={styles.statsContainer}
                >
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>10K+</Text>
                    <Text style={styles.statLabel}>Players</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>₹50L+</Text>
                    <Text style={styles.statLabel}>Winnings</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statNumber}>99.9%</Text>
                    <Text style={styles.statLabel}>Uptime</Text>
                  </View>
                </LinearGradient>
              </View>

              {/* Call to Action */}
              <View style={styles.ctaSection}>
                <LinearGradient
                  colors={['rgba(255, 215, 0, 0.1)', 'rgba(255, 165, 0, 0.05)']}
                  style={styles.ctaContainer}
                >
                  <MaterialIcons name="emoji-events" size={40} color="#FFD700" />
                  <Text style={styles.ctaTitle}>Start Your Winning Journey!</Text>
                  <Text style={styles.ctaSubtitle}>Select a game above to begin</Text>
                </LinearGradient>
              </View>
            </>
          ) : (
            // Stakes Selection Screen
            <Animated.View 
              style={[
                styles.stakesScreenContainer,
                {
                  opacity: slideAnim,
                  transform: [{
                    translateY: slideAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0]
                    })
                  }]
                }
              ]}
            >
              <TouchableOpacity style={styles.backButton} onPress={handleBackToGames}>
                <MaterialIcons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>

              <View style={styles.selectedGameSection}>
                <Text style={styles.selectedGameLabel}>Selected Game</Text>
                <View style={styles.selectedGameCard}>
                  <LinearGradient
                    colors={selectedGame?.gradient || ['#4ECDC4', '#44A08D']}
                    style={styles.selectedGameGradient}
                  >
                    <MaterialIcons name={selectedGame?.icon} size={30} color="#fff" />
                    <Text style={styles.selectedGameTitle}>{selectedGame?.title}</Text>
                    <Text style={styles.selectedGameMultiplier}>{selectedGame?.multiplier}</Text>
                  </LinearGradient>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Select Your Stake</Text>
                <View style={styles.stakesContainer}>
                  {STAKES.map((stake) => (
                    <TouchableOpacity
                      key={stake}
                      style={[
                        styles.stakeCard,
                        selectedStake === stake && styles.stakeCardSelected,
                        balance < stake && styles.stakeCardDisabled
                      ]}
                      onPress={() => handleStakeSelect(stake)}
                      disabled={balance < stake}
                    >
                      <Text style={[
                        styles.stakeAmount,
                        selectedStake === stake && styles.stakeAmountSelected,
                        balance < stake && styles.stakeAmountDisabled
                      ]}>
                        ₹{stake}
                      </Text>
                      {selectedStake === stake && (
                        <MaterialIcons name="check-circle" size={16} color="#FFD700" />
                      )}
                      {balance < stake && (
                        <MaterialIcons name="lock" size={16} color="#888" />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {selectedStake && (
                <Animated.View 
                  style={[
                    styles.playButtonContainer,
                    { transform: [{ scale: scaleAnim }] }
                  ]}
                >
                  <TouchableOpacity
                    style={styles.playButton}
                    onPress={handlePlayGame}
                  >
                    <LinearGradient
                      colors={['#FFD700', '#FFA500']}
                      style={styles.playButtonGradient}
                    >
                      <MaterialIcons name="play-arrow" size={30} color="#1a1a2e" />
                      <Text style={styles.playButtonText}>
                        PLAY {selectedGame?.title.toUpperCase()}
                      </Text>
                      <Text style={styles.playButtonSubtext}>
                        Stake: ₹{selectedStake} | Win: ₹{Math.floor(selectedStake * parseFloat(selectedGame?.multiplier || '2'))}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              )}
            </Animated.View>
          )}

          <View style={styles.bottomPadding} />
        </ScrollView>
      </LinearGradient>
      
      {/* Side Menu */}
      <SideMenu />
      
      {/* Referral Modal */}
      <ReferralModal />
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  hamburgerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  appBranding: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIcon: {
    width: 50,
    height: 50,
    marginRight: 0,
  },
  appName: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 4,
  },
  walletContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  balanceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 6,
  },
  tagline: {
    fontSize: 16,
    color: '#fff',
    textAlign: 'center',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  
  // Updated Game Cards Styles
  gamesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  gameCard: {
    width: (width - 60) / 2, // Adjusted for better spacing
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gameCardGradient: {
    padding: 20,
    minHeight: 300,
    justifyContent: 'space-between',
  },
  gameCardContent: {
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
    position: 'relative',
  },
  
  // Badge Styles
  gameBadge: {
    position: 'absolute',
    top: -15,
    right: -15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    zIndex: 1,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  multiplayerBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  soloBadge: {
    backgroundColor: 'rgba(255, 215, 0, 0.9)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginLeft: 4,
  },
  
  // Game Content Sections
  gameHeader: {
    alignItems: 'center',
    marginBottom: 5,
    marginTop: -5,
  },
  gameTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'center',
  },
  gameDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  gameMiddleSection: {
    alignItems: 'center',
    marginBottom: 15,
  },
  multiplierContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  multiplierText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  multiplierHint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  gameFooter: {
    alignItems: 'center',
    width: '100%',
  },
  playersInfo: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 8,
  },
  onlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(46, 204, 113, 0.3)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.5)',
    marginBottom: 8,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#2ECC71',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#2ECC71',
  },
  quickPlayButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  quickPlayText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  
  // Game Rules Section Styles
  gameRulesSection: {
    marginBottom: 30,
  },
  rulesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  rulesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
    textAlign: 'center',
  },
  rulesSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  rulesCardsContainer: {
    paddingHorizontal: 20,
  },
  ruleCard: {
    width: width * 0.85,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  ruleCardGradient: {
    padding: 20,
    minHeight: 280,
  },
  ruleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  ruleIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  ruleHeaderText: {
    flex: 1,
  },
  ruleCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  ruleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ruleBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  rulesList: {
    flex: 1,
    marginBottom: 20,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  ruleText: {
    fontSize: 14,
    color: '#fff',
    lineHeight: 20,
    flex: 1,
  },
  rulePlayButton: {
    borderRadius: 12,
    overflow: 'hidden',
    alignSelf: 'stretch',
  },
  rulePlayGradient: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rulePlayText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },

  // Pagination Dots Styles
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#FFD700',
    width: 20,
  },

  // Stakes Selection Screen Styles
  stakesScreenContainer: {
    flex: 1,
    paddingTop: 60,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  selectedGameSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
    alignItems: 'center',
  },
  selectedGameLabel: {
    fontSize: 16,
    color: '#888',
    marginBottom: 10,
  },
  selectedGameCard: {
    width: 150,
    height: 100,
    borderRadius: 15,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  selectedGameGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
  },
  selectedGameTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 5,
    marginBottom: 2,
  },
  selectedGameMultiplier: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  stakesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  stakeCard: {
    width: (width - 60) / 3,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    minHeight: 70,
    justifyContent: 'center',
  },
  stakeCardSelected: {
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    borderColor: '#FFD700',
  },
  stakeCardDisabled: {
    opacity: 0.5,
  },
  stakeAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  stakeAmountSelected: {
    color: '#FFD700',
  },
  stakeAmountDisabled: {
    color: '#888',
  },
  playButtonContainer: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 30,
  },
  playButton: {
    borderRadius: 15,
    overflow: 'hidden',
  },
  playButtonGradient: {
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  playButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginLeft: 10,
  },
  playButtonSubtext: {
    fontSize: 12,
    color: '#1a1a2e',
    position: 'absolute',
    bottom: 10,
  },
  
  // Hero Section
  heroSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  heroContent: {
    alignItems: 'center',
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  
  // Features Section
  featuresSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
    textAlign: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  featureCard: {
    width: (width - 60) / 3,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    marginBottom: 15,
  },
  featureGradient: {
    padding: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  featureTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 8,
    marginBottom: 4,
    textAlign: 'center',
  },
  featureDescription: {
    fontSize: 10,
    color: '#888',
    textAlign: 'center',
  },
  
  // Stats Section
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  statsContainer: {
    flexDirection: 'row',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    marginHorizontal: 15,
  },
  
  // Call to Action Section
  ctaSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  ctaContainer: {
    alignItems: 'center',
    padding: 25,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  ctaTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginTop: 10,
    marginBottom: 5,
    textAlign: 'center',
  },
  ctaSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  
  // Side Menu Styles
  menuOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 998,
  },
  sideMenu: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 0.75,
    height: '100%',
    zIndex: 999,
  },
  sideMenuContent: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingTop: 50,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  menuUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    // backgroundColor: 'rgba(255, 215, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    // borderWidth: 2,
    // borderColor: '#FFD700',
  },
  menuAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
  },
  menuUserDetails: {
    flex: 1,
  },
  menuUserName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  menuUserEmail: {
    fontSize: 18,
    color: '#888',
  },
  closeMenuButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuBalance: {
    margin: 7,
    // borderRadius: 12,
    overflow: 'hidden',
  },
  menuBalanceContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    borderRadius: 12,
  },
  menuBalanceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 8,
  },
  menuItems: {
    flex: 1,
    paddingHorizontal: 15,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginVertical: 2,
    // borderRadius: 10,
    // backgroundColor: 'rgba(255, 255, 255, 0.08)',
    // borderWidth: 1,
    // borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoutItem: {
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderColor: 'rgba(255, 107, 107, 0.4)',
    marginTop: 8,
  },
  menuItemIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(78, 205, 196, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoutIconContainer: {
    backgroundColor: 'rgba(255, 107, 107, 0.25)',
  },
  menuItemText: {
    flex: 1,
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  logoutText: {
    color: '#FF6B6B',
    fontWeight: 'bold',
  },
  menuFooter: {
    padding: 15,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 5,
  },
  menuAppName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 3,
  },
  menuAppTagline: {
    fontSize: 11,
    color: '#888',
  },
  menuAvatarImage: {
    width: 50,
    height: 50,
    // borderRadius: 15,
  },
  
  // Bottom Padding
  bottomPadding: {
    height: 20,
  },

  // Referral Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  referralModal: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  referralModalGradient: {
    padding: 25,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  referralTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1a1a2e',
    flex: 1,
    textAlign: 'center',
    marginLeft: -24, // Offset for close button
  },
  closeReferralButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(26, 26, 46, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralBenefits: {
    marginBottom: 25,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  benefitText: {
    fontSize: 14,
    color: '#1a1a2e',
    marginLeft: 10,
    fontWeight: '600',
  },
  referralCodeSection: {
    marginBottom: 20,
  },
  referralCodeLabel: {
    fontSize: 14,
    color: '#1a1a2e',
    fontWeight: 'bold',
    marginBottom: 8,
    opacity: 0.8,
  },
  referralCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.15)',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26, 26, 46, 0.3)',
  },
  referralCodeText: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a2e',
    letterSpacing: 2,
  },
  copyCodeButton: {
    padding: 5,
  },
  shareReferralButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  shareReferralText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFD700',
    marginLeft: 8,
  },
  howItWorks: {
    backgroundColor: 'rgba(26, 26, 46, 0.1)',
    padding: 15,
    borderRadius: 12,
  },
  howItWorksTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  howItWorksText: {
    fontSize: 12,
    color: '#1a1a2e',
    lineHeight: 18,
    opacity: 0.8,
  },
});