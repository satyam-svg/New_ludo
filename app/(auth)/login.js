import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Dimensions,
  SafeAreaView,
  Image,
  ScrollView,
  BackHandler
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../../config';

const { width, height } = Dimensions.get('window');
const API_BASE_URL = `${config.BASE_URL}/api/users`;

// Responsive scaling function
const scale = (size) => {
  const baseWidth = 375; // iPhone X width as base
  return (width / baseWidth) * size;
};

const verticalScale = (size) => {
  const baseHeight = 667; // iPhone X height as base  
  return (height / baseHeight) * size;
};

const moderateScale = (size, factor = 0.5) => {
  return size + (scale(size) - size) * factor;
};

export default function LoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState(''); // New referral code field
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // States for OTP flow
  const [showOtpField, setShowOtpField] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  const { login } = useAuth();

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

  // Handle hardware back button
  useEffect(() => {
    const backAction = () => {
      if (showOtpField) {
        // If on OTP screen, go back to signup form
        goBackToSignup();
        return true; // Prevent default back behavior
      } else if (isSignUp) {
        // If on signup screen, go back to login
        goBackToLogin();
        return true; // Prevent default back behavior
      }
      // If on login screen, allow default back behavior (exit app)
      return false;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [isSignUp, showOtpField]);

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const validateForm = () => {
    // Validate phone number (basic 10-digit validation)
    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
      Alert.alert('Error', 'Please enter a valid 10-digit mobile number');
      return false;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }

    if (isSignUp && password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    return true;
  };

  // Send OTP for signup
  const sendOtp = async () => {
    if (!validateForm()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          phoneNumber, 
          password,
          referralCode: referralCode.trim() || undefined // Include referral code if provided
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to send OTP');
      }
      
      Alert.alert('OTP Sent', 'Check your WhatsApp for the verification code');
      setShowOtpField(true);
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP and complete signup
  const verifyOtpAndSignup = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-digit OTP');
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setIsVerifying(true);
    
    try {
      // Verify OTP and create account
      const verifyResponse = await fetch(`${API_BASE_URL}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber, otp }),
      });

      const verifyData = await verifyResponse.json();
      if (!verifyResponse.ok) throw new Error(verifyData.message);
      
      // Store token in AsyncStorage
      await AsyncStorage.setItem('authToken', verifyData.token);
      
      // Login after successful signup
      const result = await login(verifyData.token);
      
      if (!result.success) {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle login
  const handleLogin = async () => {
    if (!validateForm()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber, password }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      // Store token in AsyncStorage
      await AsyncStorage.setItem('authToken', data.token);
      
      // Login after successful authentication
      const result = await login(data.token);
      
      if (!result.success) {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  // Unified auth handler
  const handleAuth = async () => {
    if (isSignUp) {
      if (!showOtpField) {
        // First step of signup: send OTP
        await sendOtp();
      } else {
        // Second step: verify OTP and signup
        await verifyOtpAndSignup();
      }
    } else {
      // Regular login
      await handleLogin();
    }
  };

  // Reset all fields and flows when toggling
  const toggleAuthMode = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSignUp(!isSignUp);
    setShowOtpField(false);
    setOtp('');
    setPhoneNumber('');
    setPassword('');
    setConfirmPassword('');
    setReferralCode('');
  };

  // Go back from OTP verification to signup form
  const goBackToSignup = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowOtpField(false);
    setOtp('');
  };

  // Go back from signup to login
  const goBackToLogin = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsSignUp(false);
    setShowOtpField(false);
    setOtp('');
    setPhoneNumber('');
    setPassword('');
    setConfirmPassword('');
    setReferralCode('');
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.background}
      >
        <KeyboardAvoidingView 
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView 
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View 
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.logoContainer}>
                  <LinearGradient
                    colors={['#ff6b6b', '#ee5a52']}
                    style={styles.logoGradient}
                  >
                    <Image 
                      source={require('../../assets/icon.png')} 
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </LinearGradient>
                </View>
                <Text style={styles.title}>BetBoss</Text>
                <Text style={styles.subtitle}>Win Real Money • Play Fair • Have Fun</Text>
              </View>

              {/* Card Container */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  {/* Back button for signup screen or OTP verification */}
                  {(isSignUp || showOtpField) && (
                    <TouchableOpacity 
                      style={styles.backButton}
                      onPress={showOtpField ? goBackToSignup : goBackToLogin}
                    >
                      <MaterialIcons name="arrow-back" size={moderateScale(24)} color="#667eea" />
                    </TouchableOpacity>
                  )}
                  
                  <View style={styles.cardTitleContainer}>
                    <Text style={styles.cardTitle}>
                      {isSignUp 
                        ? (showOtpField ? 'Verify Your Number' : 'Create Account') 
                        : 'Welcome Back!'}
                    </Text>
                    <Text style={styles.cardSubtitle}>
                      {isSignUp 
                        ? (showOtpField 
                            ? 'Enter the OTP sent to your mobile' 
                            : 'Sign up to get started') 
                        : 'Sign in to continue playing'}
                    </Text>
                  </View>
                </View>

                {/* Phone Number Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="smartphone" size={moderateScale(20)} color="#9ca3af" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter Your Mobile Number"
                      placeholderTextColor="#9ca3af"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      keyboardType="phone-pad"
                      autoCapitalize="none"
                      editable={!showOtpField}
                      maxLength={10}
                    />
                  </View>
                </View>

                {/* Password Inputs (hidden during OTP verification) */}
                {!showOtpField && (
                  <>
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Password</Text>
                      <View style={styles.inputContainer}>
                        <MaterialIcons name="lock" size={moderateScale(20)} color="#9ca3af" style={styles.inputIcon} />
                        <TextInput
                          style={styles.input}
                          placeholder="Enter Your Password"
                          placeholderTextColor="#9ca3af"
                          value={password}
                          onChangeText={setPassword}
                          secureTextEntry
                        />
                      </View>
                    </View>

                    {isSignUp && (
                      <>
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>Confirm Password</Text>
                          <View style={styles.inputContainer}>
                            <MaterialIcons name="lock-outline" size={moderateScale(20)} color="#9ca3af" style={styles.inputIcon} />
                            <TextInput
                              style={styles.input}
                              placeholder="Confirm your password"
                              placeholderTextColor="#9ca3af"
                              value={confirmPassword}
                              onChangeText={setConfirmPassword}
                              secureTextEntry
                            />
                          </View>
                        </View>

                        {/* Referral Code Input (Optional) */}
                        <View style={styles.inputGroup}>
                          <Text style={styles.inputLabel}>
                            Referral Code <Text style={styles.optionalText}>(Optional)</Text>
                          </Text>
                          <View style={styles.inputContainer}>
                            <MaterialIcons name="card-giftcard" size={moderateScale(20)} color="#9ca3af" style={styles.inputIcon} />
                            <TextInput
                              style={styles.input}
                              placeholder="Enter referral code"
                              placeholderTextColor="#9ca3af"
                              value={referralCode}
                              onChangeText={setReferralCode}
                              autoCapitalize="characters"
                              maxLength={10}
                            />
                          </View>
                          <Text style={styles.referralHint}>
                            Enter a friend's referral code to get bonus money
                          </Text>
                        </View>
                      </>
                    )}
                  </>
                )}

                {/* OTP Input (only shown during signup verification) */}
                {isSignUp && showOtpField && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Verification Code</Text>
                    <View style={styles.inputContainer}>
                      <MaterialIcons name="verified-user" size={moderateScale(20)} color="#9ca3af" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter 6-digit OTP"
                        placeholderTextColor="#9ca3af"
                        value={otp}
                        onChangeText={setOtp}
                        keyboardType="number-pad"
                        maxLength={6}
                        autoFocus={true}
                      />
                    </View>
                    <Text style={styles.otpHint}>
                      Check your mobile for the verification code
                    </Text>
                  </View>
                )}

                {/* Action Button */}
                <TouchableOpacity
                  style={[styles.button, (loading || isVerifying) && styles.buttonDisabled]}
                  onPress={handleAuth}
                  disabled={loading || isVerifying}
                >
                  <LinearGradient
                    colors={['#667eea', '#764ba2']}
                    style={styles.buttonGradient}
                  >
                    {(loading || isVerifying) ? (
                      <View style={styles.loadingContainer}>
                        <Text style={styles.buttonText}>Please wait...</Text>
                      </View>
                    ) : (
                      <Text style={styles.buttonText}>
                        {isSignUp
                          ? (showOtpField ? 'Verify & Sign Up' : 'Send OTP')
                          : 'Sign In'}
                      </Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Resend OTP option */}
                {isSignUp && showOtpField && (
                  <TouchableOpacity
                    style={styles.resendContainer}
                    onPress={sendOtp}
                    disabled={loading}
                  >
                    <Text style={styles.resendText}>
                      Didn't receive code? <Text style={styles.resendLink}>Resend OTP</Text>
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Toggle between Sign In/Sign Up */}
                {!showOtpField && !isSignUp && (
                  <TouchableOpacity
                    style={styles.toggleContainer}
                    onPress={toggleAuthMode}
                  >
                    <Text style={styles.toggleText}>
                      Don't have an account? Sign Up
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Footer */}
              <Text style={styles.footer}>
                By continuing, you agree to our Terms of Service and Privacy Policy
              </Text>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: height,
  },
  content: {
    flex: 1,
    paddingHorizontal: scale(24),
    paddingTop: verticalScale(40),
    paddingBottom: verticalScale(40),
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: verticalScale(30),
  },
  logoContainer: {
    marginBottom: verticalScale(20),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoGradient: {
    width: scale(70),
    height: scale(70),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: scale(40),
    height: scale(40),
  },
  title: {
    fontSize: moderateScale(28),
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: verticalScale(8),
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: moderateScale(14),
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: scale(20),
    padding: scale(24),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 10,
    marginBottom: verticalScale(20),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: verticalScale(24),
  },
  backButton: {
    padding: scale(8),
    marginRight: scale(12),
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: verticalScale(6),
  },
  cardSubtitle: {
    fontSize: moderateScale(14),
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '400',
  },
  inputGroup: {
    marginBottom: verticalScale(20),
  },
  inputLabel: {
    fontSize: moderateScale(13),
    fontWeight: '600',
    color: '#374151',
    marginBottom: verticalScale(8),
    marginLeft: scale(4),
  },
  optionalText: {
    color: '#9ca3af',
    fontWeight: '400',
    fontSize: moderateScale(12),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: scale(12),
    borderWidth: 2,
    borderColor: '#e5e7eb',
    paddingHorizontal: scale(14),
    height: verticalScale(50),
  },
  inputIcon: {
    marginRight: scale(10),
  },
  input: {
    flex: 1,
    fontSize: moderateScale(15),
    color: '#1f2937',
    fontWeight: '500',
  },
  otpHint: {
    fontSize: moderateScale(11),
    color: '#6b7280',
    marginTop: verticalScale(6),
    marginLeft: scale(4),
  },
  referralHint: {
    fontSize: moderateScale(11),
    color: '#9ca3af',
    marginTop: verticalScale(6),
    marginLeft: scale(4),
    fontStyle: 'italic',
  },
  resendContainer: {
    marginTop: verticalScale(12),
    alignItems: 'center',
  },
  resendText: {
    color: '#6b7280',
    fontSize: moderateScale(13),
  },
  resendLink: {
    color: '#667eea',
    fontWeight: '600',
  },
  button: {
    borderRadius: scale(12),
    overflow: 'hidden',
    marginTop: verticalScale(8),
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    paddingVertical: verticalScale(16),
    alignItems: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: moderateScale(15),
    fontWeight: '700',
  },
  toggleContainer: {
    marginTop: verticalScale(16),
    alignItems: 'center',
  },
  toggleText: {
    color: '#667eea',
    fontWeight: '600',
    fontSize: moderateScale(13),
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: moderateScale(11),
    lineHeight: verticalScale(16),
    paddingHorizontal: scale(16),
  },
});