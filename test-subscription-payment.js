const { MongoClient } = require('mongodb');

async function testSubscriptionPayment() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('pay_me_pi');
    
    console.log('🧪 Testing subscription payment completion...');
    
    // Simulate a subscription payment completion
    const testPaymentData = {
        paymentId: 'test_sub_' + Date.now(),
        txId: 'test_tx_' + Date.now(),
        amount: 1, // 1 Pi = subscription
        memo: 'Monthly subscription payment to Appraisells',
        user: {
            username: 'testuser_' + Date.now(),
            uid: 'test_uid_' + Date.now()
        },
        metadata: {
            paymentType: 'monthly_subscription'
        },
        status: {
            transaction_verified: true
        }
    };
    
    console.log('💳 Test payment data:', testPaymentData);
    
    // Test the subscription creation directly
    try {
        console.log('📊 Before test - checking existing subscriptions...');
        const existingSubscriptions = await db.collection('user_subscriptions').find({}).toArray();
        console.log(`Found ${existingSubscriptions.length} existing subscriptions`);
        
        // Simulate what happens in the payment completion endpoint
        const isSubscriptionPayment = 
            (testPaymentData.amount === 1) || 
            (testPaymentData.memo && testPaymentData.memo.toLowerCase().includes('subscription')) ||
            (testPaymentData.metadata && testPaymentData.metadata.paymentType === 'monthly_subscription');
        
        console.log(`🔍 Is subscription payment: ${isSubscriptionPayment}`);
        
        if (isSubscriptionPayment) {
            // Create subscription using the server's function logic
            const startDate = new Date();
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 30); // Add 30 days
            
            const subscription = {
                username: testPaymentData.user.username,
                userUid: testPaymentData.user.uid,
                subscriptionType: "monthly",
                startDate,
                endDate,
                paymentId: testPaymentData.paymentId,
                txId: testPaymentData.txId,
                status: "active",
                piAmount: 1,
                paymentData: testPaymentData,
                created: new Date(),
                lastVerified: new Date()
            };
            
            // Insert subscription record
            const subResult = await db.collection('user_subscriptions').insertOne(subscription);
            console.log('✅ Subscription created:', subResult.insertedId);
            
            // Create user profile if it doesn't exist
            const existingProfile = await db.collection('user_profiles').findOne({ 
                username: testPaymentData.user.username 
            });
            
            if (!existingProfile) {
                await db.collection('user_profiles').insertOne({
                    username: testPaymentData.user.username,
                    userUid: testPaymentData.user.uid,
                    profile: {
                        firstSeen: new Date(),
                        lastSeen: new Date(),
                        totalLogins: 1,
                        totalPayments: 1,
                        totalAmountPaid: 1,
                        lastPayment: new Date()
                    },
                    subscription: {
                        active: true,
                        type: "monthly",
                        startDate: startDate,
                        endDate: endDate,
                        daysRemaining: 30
                    },
                    created: new Date(),
                    updated: new Date(),
                    source: 'test_payment'
                });
                console.log('✅ User profile created');
            } else {
                // Update existing profile
                await db.collection('user_profiles').updateOne(
                    { username: testPaymentData.user.username },
                    { 
                        $set: { 
                            subscription: {
                                active: true,
                                type: "monthly",
                                startDate: startDate,
                                endDate: endDate,
                                daysRemaining: 30
                            },
                            updated: new Date()
                        },
                        $inc: {
                            'profile.totalPayments': 1,
                            'profile.totalAmountPaid': 1
                        }
                    }
                );
                console.log('✅ User profile updated');
            }
            
            console.log(`🎫 Test subscription created for: ${testPaymentData.user.username}`);
            console.log(`📅 Expires: ${endDate.toISOString()}`);
            
            // Test subscription verification
            const verificationResult = await db.collection('user_subscriptions').findOne({
                username: testPaymentData.user.username,
                status: "active",
                endDate: { $gt: new Date() }
            });
            
            if (verificationResult) {
                const daysRemaining = Math.ceil((verificationResult.endDate - new Date()) / (1000 * 60 * 60 * 24));
                console.log(`✅ Subscription verification passed! Days remaining: ${daysRemaining}`);
            } else {
                console.log('❌ Subscription verification failed');
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
    
    await client.close();
    console.log('🧪 Test completed');
}

testSubscriptionPayment().catch(console.error);
