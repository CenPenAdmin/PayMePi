# Auction Bidding System - MongoDB Structure & API Documentation

## Database Collections Created

### 1. **auction_bids** Collection
Stores all auction bids with the following structure:
```javascript
{
  _id: ObjectId,
  username: "user_pi_username",
  userUid: "pi_user_unique_id",
  itemId: "item1" | "item2" | "item3" | "item4" | "item5",
  bidAmount: 3.5, // Minimum 3 Pi
  timestamp: "2025-08-12T19:30:00.000Z",
  auctionId: "auction_1", // For future multiple auctions
  status: "active" | "winner" | "lost",
  createdAt: Date,
  ipAddress: "user_ip",
  userAgent: "browser_info"
}
```

### 2. **auction_results** Collection
Stores final auction results when auction closes:
```javascript
{
  _id: ObjectId,
  auctionId: "auction_1",
  winners: {
    item1: { winner: "username", winningBid: 5.5, userUid: "...", bidId: "..." },
    item2: { winner: "username", winningBid: 4.2, userUid: "...", bidId: "..." },
    // ... for all 5 items
  },
  closedAt: Date,
  status: "closed"
}
```

## API Endpoints

### 1. **GET /auction-status**
Returns current auction timing and status
```json
{
  "isActive": true,
  "status": "active",
  "message": "Auction is currently active",
  "startTime": "2025-08-12T00:00:00.000Z",
  "endTime": "2025-08-20T23:59:59.000Z",
  "timeRemaining": 681668482
}
```

### 2. **POST /place-auction-bid**
Places a bid on an auction item
**Request Body:**
```json
{
  "username": "this3is2ridiculous",
  "userUid": "59d406ea-6aa6-49b1-b437-3c1b9bb0cf59",
  "itemId": "item1",
  "bidAmount": 5.5,
  "timestamp": "2025-08-12T19:30:00.000Z"
}
```

**Validation Rules:**
- ✅ One bid per user per item
- ✅ Minimum bid amount: 3 Pi
- ✅ No duplicate bid amounts on same item
- ✅ Auction must be active
- ✅ All required fields must be provided

**Response:**
```json
{
  "success": true,
  "message": "Bid placed successfully",
  "bidId": "689bfad20942e2504bb6f9c9",
  "bidAmount": 5.5,
  "itemId": "item1"
}
```

### 3. **GET /auction-bids/:username**
Gets all bids for a specific user
```json
[
  {
    "_id": "689bfac50942e2504bb6f9c7",
    "username": "this3is2ridiculous",
    "itemId": "item1",
    "bidAmount": 5.5,
    "status": "active",
    "timestamp": "2025-08-12T19:30:00.000Z"
  }
]
```

### 4. **GET /auction-highest-bids**
Gets current highest bid for each auction item
```json
{
  "success": true,
  "highestBids": {
    "item1": {
      "username": "this3is2ridiculous",
      "bidAmount": 5.5,
      "userUid": "59d406ea-6aa6-49b1-b437-3c1b9bb0cf59"
    },
    "item2": {
      "bidAmount": 0,
      "username": null
    }
  }
}
```

### 5. **POST /close-auction** (Admin Only)
Closes the auction and determines winners
```json
{
  "success": true,
  "winners": {
    "item1": {
      "winner": "this3is2ridiculous",
      "winningBid": 5.5,
      "userUid": "59d406ea-6aa6-49b1-b437-3c1b9bb0cf59",
      "bidId": "689bfac50942e2504bb6f9c7"
    }
  }
}
```

## Auction Timing Configuration

Currently set in `getAuctionStatus()` function:
```javascript
const auctionStart = new Date('2025-08-12T00:00:00Z'); // Start date
const auctionEnd = new Date('2025-08-20T23:59:59Z');   // End date
```

## Auction Items

1. **item1**: Vincent van Gogh - "Starry Night Study"
2. **item2**: Pablo Picasso - "Abstract Portrait #47"
3. **item3**: Claude Monet - "Water Lilies Reflection"
4. **item4**: Georgia O'Keeffe - "Desert Bloom #12"
5. **item5**: Jackson Pollock - "Rhythm in Blue"

## Business Logic Implementation

### ✅ **One Bid Per User Per Item**
- Database check prevents multiple bids from same user on same item
- Frontend disables input after successful bid

### ✅ **Unique Bid Amounts**
- No two users can bid the same amount on the same item
- Forces competitive bidding with unique values

### ✅ **Auction Timing Control**
- Bids only accepted during active auction period
- Configurable start/end times

### ✅ **Winner Determination**
- Highest bid wins each item
- Automatic status updates when auction closes
- Winners tracked for payment confirmation

### ✅ **Activity Logging**
- All bids logged to `user_activities` collection
- Complete audit trail for all auction actions

## Testing Results

✅ **Auction Status**: Working - shows auction is currently active  
✅ **Place Bid**: Working - successfully places bids with validation  
✅ **Duplicate User Check**: Working - prevents multiple bids per user per item  
✅ **Duplicate Amount Check**: Working - prevents identical bid amounts  
✅ **Get User Bids**: Working - returns user's auction history  
✅ **Highest Bids**: Working - shows current leaders for each item  

## Next Steps

1. **Update config.js** with new ngrok URL when ready
2. **Test liveAuction.html** in Pi Browser with subscription system
3. **Set up payment confirmation** for auction winners
4. **Add real artwork images** to replace placeholders
5. **Configure actual auction start/end times**

The complete auction bidding system is now operational with MongoDB backend!
