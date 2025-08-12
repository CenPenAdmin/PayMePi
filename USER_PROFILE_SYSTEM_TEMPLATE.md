# User Profile & Activity Tracking System - Template

## Overview

This document describes the user profile and activity tracking system for the Pay Me Pi application. This is a **backend-only** system designed for developer analytics and data management.

## New MongoDB Collections

### 1. `user_profiles` Collection
Stores comprehensive user profiles with aggregated stats:

```javascript
{
  "_id": ObjectId("..."),
  "username": "example_user",
  "userUid": "pi_user_uid_here",
  "profile": {
    "firstSeen": ISODate("..."),
    "lastSeen": ISODate("..."),
    "totalLogins": 0,
    "totalPayments": 0,
    "totalAmountPaid": 0,
    "lastPayment": ISODate("..."),
    "ipAddresses": ["xxx.xxx.xxx.xxx"],
    "userAgents": ["Pi Browser/x.x"]
  },
  "created": ISODate("..."),
  "updated": ISODate("...")
}
```

### 2. `user_activities` Collection
Logs every user action in chronological order:

```javascript
{
  "_id": ObjectId("..."),
  "username": "example_user",
  "userUid": "pi_user_uid_here",
  "activityType": "authentication", // authentication, payment_approval, payment_completion
  "timestamp": ISODate("..."),
  "details": {
    "ip": "xxx.xxx.xxx.xxx",
    "userAgent": "Pi Browser/x.x",
    // Additional fields based on activity type
  }
}
```

## API Endpoints

### View All User Profiles
```
GET /user-profiles
```

### View User Activities
```
GET /user-activities
GET /user-activities?username=[username]
GET /user-activities?limit=50
```

### View Specific User
```
GET /user/[username]
GET /user/[username]?activityLimit=100
```

### Manual Migration
```
POST /migrate-data
```

## Testing Endpoints

Replace `[username]` with actual usernames from your database:

- http://localhost:3000/user-profiles
- http://localhost:3000/user-activities
- http://localhost:3000/user/[username]

## Security Notes

⚠️ **Important**: This documentation template contains no sensitive data. The actual USER_PROFILE_SYSTEM.md file should be added to .gitignore to prevent accidental commits of real user data.

## Features

### Automatic Tracking
- User profiles created/updated on authentication
- Payment activities logged automatically
- Profile statistics maintained in real-time

### Data Migration
- Existing payment data migrated to new structure
- Original collections preserved for backward compatibility
- Migration runs automatically on server startup

### Developer Analytics
- Complete user behavior tracking
- Payment patterns and statistics
- Technical data for security and debugging
- All data remains backend-only

## Implementation Status

✅ User profile management functions
✅ Activity logging system
✅ Database migration
✅ API endpoints
✅ Backward compatibility
✅ Security measures (backend-only data)
