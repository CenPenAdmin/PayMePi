// Configuration for Pi Payment App
const CONFIG = {
    // Backend API URL - Update this with your actual backend URL
    BACKEND_URL: 'https://888d175c9d19.ngrok-free.app', // ngrok tunnel

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
