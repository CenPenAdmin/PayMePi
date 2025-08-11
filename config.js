// Configuration for Pi Payment App
const CONFIG = {
    // Backend API URL - Update this with your actual backend URL
    BACKEND_URL: 'https://e628701c0bd0.ngrok-free.app', // Your current ngrok URL

    // Pi SDK Configuration
    PI_SDK: {
        version: "2.0",
        sandbox: true // true for testnet, false for mainnet
    },
    
    // Payment Configuration
    PAYMENT: {
        amount: 1,
        memo: "Test payment for learning",
        defaultMetadata: {
            itemName: "Test Payment"
        }
    }
};

// Export for use in other files (if using modules)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}
