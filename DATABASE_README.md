# Pony-Up v4 - Database Integration Guide

## Overview

Pony-Up v4 adds comprehensive database functionality to the Web3 gaming platform using Supabase (PostgreSQL). This enables persistent user profiles, game history tracking, and custom game list features while maintaining all existing blockchain functionality.

## New Features Added

### 🆔 User Profiles & Authentication
- **Wallet-based Authentication**: Seamlessly links Web3 wallets to user profiles
- **Custom Usernames**: Players can set display names visible to other users
- **Auto-registration**: New users are automatically created when connecting wallets

### 📊 Game History & Statistics
- **Complete Game Tracking**: Records all game joins, wins, losses, and earnings
- **Performance Analytics**: Win rate, total games, earnings statistics
- **Historical Data**: Searchable game history with timestamps and details

### 📝 Custom Game Lists
- **Personal Collections**: Create named lists to organize favorite games
- **List Management**: Add, remove, edit, and delete custom game collections
- **Quick Access**: Easy game discovery through saved lists

## Database Schema

### Tables Created

#### `users`
- `id` (UUID, Primary Key)
- `wallet_address` (Text, Unique) - Ethereum wallet address
- `username` (Text, Nullable) - Display name
- `created_at`, `updated_at` (Timestamps)

#### `game_history`
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key → users.id)
- `game_code` (Text) - Game identifier
- `game_type` (Text) - Type of game (standard, etc.)
- `buy_in_amount` (Text) - Buy-in amount in Wei (string for precision)
- `result` (Enum: 'won', 'lost', 'active') - Game outcome
- `winnings` (Text, Nullable) - Winnings in Wei
- `created_at` (Timestamp)
- `block_number`, `transaction_hash` (Optional blockchain data)

#### `game_lists`
- `id` (UUID, Primary Key)
- `user_id` (UUID, Foreign Key → users.id)
- `name` (Text) - List name
- `description` (Text, Nullable) - Optional description
- `game_codes` (JSONB) - Array of game codes
- `created_at`, `updated_at` (Timestamps)

## Setup Instructions

### 1. Supabase Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Note your project URL and anon key

2. **Run Database Schema**
   - Open the SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `supabase-schema.sql`
   - Execute the script to create tables, indexes, and security policies

3. **Configure Environment**
   - The project is already configured with your credentials:
   ```env
   REACT_APP_SUPABASE_URL=https://gpajvkrjwrvojtfsyhcv.supabase.co
   REACT_APP_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### 2. Local Development

```bash
# Navigate to the project
cd /Users/nero/Projects/Cwale/pony-upv4

# Install dependencies (already done)
npm install --legacy-peer-deps

# Start development server
npm start
```

The app will run on `http://localhost:3000`

### 3. New UI Components

#### Username Modal
- Set/edit display names
- Automatic validation (3-20 characters)
- Seamless wallet integration

#### Game Lists Modal  
- Create, edit, delete custom game lists
- Add/remove games from lists
- Organize games by categories

#### Game History Modal
- View complete gaming history
- Performance statistics dashboard
- Win/loss tracking with earnings

## Integration Points

### GameDataContext Updates
- Added `recordGameJoin()` - Records when users join games
- Added `updateGameResult()` - Updates game outcomes and winnings
- Automatic database persistence for game activities

### User Context
- New `UserContext` provides user state management
- Automatic user creation/retrieval on wallet connection
- Username update functionality

### Database Service Layer
- `databaseService.user` - User profile operations
- `databaseService.gameHistory` - Game tracking operations  
- `databaseService.gameLists` - Custom list management
- Full TypeScript support with generated types

## Security Features

### Row Level Security (RLS)
- Users can only access their own data
- Wallet-based authentication ensures data privacy
- Automatic policy enforcement at the database level

### Data Validation
- Client-side validation for all user inputs
- Database constraints prevent invalid data
- Error handling with user-friendly messages

## Usage Examples

### Recording Game Activity
```typescript
// Automatically called when joining games
const { recordGameJoin, updateGameResult } = useGameData();

// Record game join
await recordGameJoin(gameCode, buyInAmount, 'standard');

// Update result when game ends
await updateGameResult(gameCode, 'won', winningsAmount);
```

### User Profile Management
```typescript
const { user, updateUsername } = useUser();

// Update username
const success = await updateUsername('MyGamertag');
```

### Custom Game Lists
```typescript
const { gameLists } = databaseService;

// Create new list
const newList = await gameLists.createGameList({
  user_id: userId,
  name: 'High Stakes Games',
  description: 'My favorite high-value games',
  game_codes: []
});

// Add game to list  
await gameLists.addGameToList(listId, gameCode);
```

## Performance Considerations

- **Efficient Queries**: Indexed database queries for fast data retrieval
- **Caching**: User data cached in React context to minimize API calls
- **Pagination**: Large datasets are paginated (50 games max per history load)
- **Error Handling**: Graceful fallbacks when database is unavailable

## Migration from v3

The v4 upgrade is fully backward compatible:
- All existing Web3 functionality remains unchanged
- New features are opt-in and don't affect existing workflows
- Users can continue playing without setting up profiles
- Database features enhance the experience but aren't required

## Troubleshooting

### Common Issues

1. **Environment Variables**: Ensure `.env` file has correct Supabase credentials
2. **CORS Issues**: Supabase project should allow your domain
3. **RLS Policies**: Database policies may need adjustment for your use case
4. **TypeScript Errors**: Run `npm install --legacy-peer-deps` if dependency issues occur

### Debug Mode
The application includes extensive console logging:
- User authentication events
- Database operations  
- Game state changes
- Error tracking

Check browser console for detailed debugging information.

## Future Enhancements

Potential future additions:
- Social features (friend lists, leaderboards)
- Advanced analytics and insights
- Game recommendations based on history
- Export/import functionality for game lists
- Integration with additional blockchain networks

---

## Support

For issues or questions:
1. Check browser console for error details
2. Verify Supabase project configuration
3. Ensure all environment variables are set correctly
4. Review the database schema matches the expected structure