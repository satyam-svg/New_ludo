// Add this import at the top
import { CFPaymentGatewayService } from 'react-native-cashfree-pg-sdk';

// Add this function inside your WalletScreen component
const initiateCashfreePayment = async (amount) => {
  setLoading(true);
  try {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch('http://192.168.1.2:5000/api/payment/create-order', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ amount })
    });

    if (!response.ok) throw new Error('Failed to create payment order');

    const { order_id, payment_token } = await response.json();

    // Launch Cashfree payment UI
    const session = CFPaymentGatewayService.buildSession({
      orderId: order_id,
      orderToken: payment_token,
      environment: 'TEST', // Change to 'PRODUCTION' for live
    });

    session.on(CFPaymentGatewayService.EVENT_ON_SUCCESS, async (data) => {
      console.log('Payment Success:', data);
      await verifyPaymentStatus(order_id);
    });

    session.on(CFPaymentGatewayService.EVENT_ON_FAILURE, (data) => {
      console.log('Payment Failure:', data);
      Alert.alert('Payment Failed', 'Transaction was not completed');
      setLoading(false);
    });

    session.on(CFPaymentGatewayService.EVENT_ON_ERROR, (data) => {
      console.log('Payment Error:', data);
      Alert.alert('Error', 'Payment process encountered an error');
      setLoading(false);
    });

    session.startPayment();
  } catch (error) {
    Alert.alert('Error', error.message);
    setLoading(false);
  }
};

// Add this verification function
const verifyPaymentStatus = async (orderId) => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    const response = await fetch(`http://192.168.1.2:5000/api/payment/verify/${orderId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Payment verification failed');
    
    const result = await response.json();
    if (result.status === 'SUCCESS') {
      Alert.alert('Success', 'Money added to wallet successfully!');
      await fetchWalletBalance();
    } else {
      Alert.alert('Payment Failed', 'Transaction not verified');
    }
  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
};

// Modify handleTransaction function
const handleTransaction = async () => {
  if (activeTab === 'withdraw') {
    // Existing withdrawal logic
  } else {
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount');
      return;
    }
    await initiateCashfreePayment(parseFloat(amount));
  }
};