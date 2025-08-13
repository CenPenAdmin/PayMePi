// Test script to verify ngrok connectivity and app functionality
console.log('🧪 Testing ngrok connectivity and app functionality...\n');

const BACKEND_URL = 'https://e0d2f85551ac.ngrok-free.app';

async function testConnectivity() {
    console.log('1. Testing basic connectivity...');
    
    try {
        const response = await fetch(`${BACKEND_URL}/debug/ping`, {
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });
        
        const result = await response.json();
        console.log('✅ Ping successful:', result.message);
        console.log('   Timestamp:', result.timestamp);
    } catch (error) {
        console.error('❌ Ping failed:', error.message);
        return false;
    }
    
    return true;
}

async function testSystemStatus() {
    console.log('\n2. Testing system status...');
    
    try {
        const response = await fetch(`${BACKEND_URL}/debug/system-status`, {
            headers: {
                'ngrok-skip-browser-warning': 'true'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ System status check successful');
            console.log('   Database connected:', result.status.database.connected);
            console.log('   Collections:', result.status.database.collections.join(', '));
            console.log('   Auction active:', result.status.auction.status?.isActive);
            console.log('   Active bids:', result.status.auction.activeBids);
            console.log('   Total users:', result.status.users.total);
            console.log('   Active subscriptions:', result.status.subscriptions.active);
        } else {
            console.error('❌ System status check failed:', result.error);
        }
    } catch (error) {
        console.error('❌ System status failed:', error.message);
    }
}

async function testSubscription() {
    console.log('\n3. Testing subscription creation...');
    
    try {
        const response = await fetch(`${BACKEND_URL}/debug/test-subscription`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Subscription test successful');
            console.log('   Test user:', result.testUser.username);
            console.log('   Subscription expires:', result.subscription.endDate);
        } else {
            console.error('❌ Subscription test failed:', result.error);
        }
    } catch (error) {
        console.error('❌ Subscription test failed:', error.message);
    }
}

async function testBidding() {
    console.log('\n4. Testing auction bidding...');
    
    try {
        const response = await fetch(`${BACKEND_URL}/debug/test-bidding`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Bidding test successful');
            console.log('   Test bids created:', result.results.length);
        } else {
            console.error('❌ Bidding test failed:', result.error);
        }
    } catch (error) {
        console.error('❌ Bidding test failed:', error.message);
    }
}

async function testPaymentCompletion() {
    console.log('\n5. Testing payment completion...');
    
    try {
        const response = await fetch(`${BACKEND_URL}/debug/test-payment-completion`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({
                paymentType: 'subscription',
                username: 'test_payment_user',
                amount: 1
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            console.log('✅ Payment completion test successful');
            console.log('   Payment type:', result.result.type);
            if (result.result.subscription) {
                console.log('   Subscription created for:', result.result.subscription.username);
            }
        } else {
            console.error('❌ Payment completion test failed:', result.error);
        }
    } catch (error) {
        console.error('❌ Payment completion test failed:', error.message);
    }
}

async function runAllTests() {
    console.log('🚀 Starting comprehensive app functionality tests...');
    console.log('================================================\n');
    
    const connected = await testConnectivity();
    
    if (connected) {
        await testSystemStatus();
        await testSubscription();
        await testBidding();
        await testPaymentCompletion();
        
        console.log('\n🎉 All tests completed!');
        console.log('================================================');
        console.log('\n📋 Next steps:');
        console.log('1. Open https://e0d2f85551ac.ngrok-free.app in your browser');
        console.log('2. Test the profile page: https://e0d2f85551ac.ngrok-free.app/profile.html');
        console.log('3. Test the auction page: https://e0d2f85551ac.ngrok-free.app/liveAuction.html');
        console.log('4. Check system status: https://e0d2f85551ac.ngrok-free.app/debug/system-status');
    } else {
        console.log('\n❌ Basic connectivity failed. Check:');
        console.log('1. Is your server running on port 3000?');
        console.log('2. Is ngrok tunnel active on https://e0d2f85551ac.ngrok-free.app?');
        console.log('3. Are there any firewall issues?');
    }
}

// Run the tests
runAllTests().catch(console.error);
