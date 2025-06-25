import React, { useState } from 'react';
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
  SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../hooks/useAuth';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Add this import

const { width, height } = Dimensions.get('window');
const API_BASE_URL = 'http://192.168.1.2:5000/api/users';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // States for OTP flow
  const [showOtpField, setShowOtpField] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  const { login } = useAuth();

  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const slideAnim = React.useRef(new Animated.Value(50)).current;

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
    if (!email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
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
          email, 
          password
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to send OTP');
      }
      
      Alert.alert('OTP Sent', 'Check your email for the verification code');
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
        body: JSON.stringify({ email, otp }),
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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLoading(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
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
    if (!validateForm()) return;
    
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

  // Reset OTP flow when toggling
  const toggleAuthMode = () => {
    setIsSignUp(!isSignUp);
    setShowOtpField(false);
    setOtp('');
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
                  <MaterialIcons name="casino" size={40} color="#fff" />
                </LinearGradient>
              </View>
              <Text style={styles.title}>Gaming Arena</Text>
              <Text style={styles.subtitle}>Win Real Money • Play Fair • Have Fun</Text>
            </View>

            {/* Card Container */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {isSignUp 
                  ? (showOtpField ? 'Verify Your Email' : 'Create Account') 
                  : 'Welcome Back!'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {isSignUp 
                  ? (showOtpField 
                      ? 'Enter the OTP sent to your email' 
                      : 'Sign up to get started') 
                  : 'Sign in to continue playing'}
              </Text>

              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <MaterialIcons name="email" size={20} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#9ca3af"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!showOtpField}
                  />
                </View>
              </View>

              {/* Password Inputs (hidden during OTP verification) */}
              {!showOtpField && (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.inputContainer}>
                      <MaterialIcons name="lock" size={20} color="#9ca3af" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your password"
                        placeholderTextColor="#9ca3af"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                      />
                    </View>
                  </View>

                 
                  {isSignUp && (
                    <View style={styles.inputGroup}>
                      <Text style={styles.inputLabel}>Confirm Password</Text>
                      <View style={styles.inputContainer}>
                        <MaterialIcons name="lock-outline" size={20} color="#9ca3af" style={styles.inputIcon} />
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
                  )}
                </>
              )}

              {/* OTP Input (only shown during signup verification) */}
              {isSignUp && showOtpField && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Verification Code</Text>
                  <View style={styles.inputContainer}>
                    <MaterialIcons name="verified-user" size={20} color="#9ca3af" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor="#9ca3af"
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="number-pad"
                      maxLength={6}
                    />
                  </View>
                  <Text style={styles.otpHint}>
                    Check your email for the verification code
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
              <TouchableOpacity
                style={styles.toggleContainer}
                onPress={toggleAuthMode}
              >
                <Text style={styles.toggleText}>
                  {isSignUp 
                    ? 'Already have an account? Sign In' 
                    : "Don't have an account? Sign Up"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <Text style={styles.footer}>
              By continuing, you agree to our Terms of Service and Privacy Policy
            </Text>
          </Animated.View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  toggleContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleText: {
    color: '#667eea',
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 10,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
    fontWeight: '400',
  },
  inputGroup: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  otpHint: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    marginLeft: 4,
  },
  resendContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  resendText: {
    color: '#6b7280',
    fontSize: 14,
  },
  resendLink: {
    color: '#667eea',
    fontWeight: '600',
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 8,
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
    paddingVertical: 18,
    alignItems: 'center',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
    marginTop: 32,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});