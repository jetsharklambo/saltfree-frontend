# Pony Up v2 (PU2) - Enhanced Web3 Gaming Platform

PU2 is a significant upgrade to the Pony Up gaming platform, introducing advanced game management, prize distribution, and enhanced judge systems for decentralized poker/wagering games on Ethereum Sepolia.

## 🆕 New Features in PU2

### 1. Game Locking System
- **Host Control**: Hosts can lock games to prevent new players from joining
- **Visual Indicators**: Lock status is clearly displayed on game cards and in game details
- **Workflow Integration**: Games must be locked before winners can be reported
- **Smart Contract**: `lockGame(string code)` function

### 2. Custom Prize Distribution
- **Multi-Winner Support**: Support for up to 3 winners with custom prize splits
- **Flexible Splits**: Configure prize percentages (e.g., 50%/30%/20% or 60%/40%)
- **Winner-Take-All**: Default behavior when no splits are configured
- **Visual Interface**: Intuitive prize configuration modal with presets
- **Smart Contract**: `setPrizeSplits(string code, uint256[] splits)` function

### 3. Enhanced Judge Management
- **Dynamic Judge Addition**: Players can add judges during gameplay (not just pre-game)
- **Unanimous Consensus**: Only judges trusted by all players can be added
- **In-Game Restrictions**: Judges cannot win prizes and are automatically marked as such
- **Smart Contract**: `addJudge(string code, address judge)` function

### 4. Ranked Winner System
- **Order Matters**: Winners are reported in rank order (1st, 2nd, 3rd)
- **Visual Ranking**: Medal indicators (🥇🥈🥉) show winner positions
- **Prize Calculation**: Prize amounts calculated based on rank and configured splits
- **Database Tracking**: Winner ranks stored for historical analysis

### 5. Enhanced Game Dashboard
- **Lock Status Filters**: Filter games by locked/unlocked status
- **Prize Indicators**: Show when games have custom prize distributions
- **Improved UX**: Better visual hierarchy and information display
- **Real-time Updates**: Dynamic counters and status indicators

## 🔧 Technical Architecture

### Smart Contract (PU2)
- **Address**: `0x5dB94ea6159a8B90887637B82464BD04D9B2961b` (Sepolia)
- **Enhanced Functions**:
  - `lockGame(string code)` - Lock game to prevent new joins
  - `setPrizeSplits(string code, uint256[] splits)` - Configure custom prize distribution
  - `addJudge(string code, address judge)` - Add judges during gameplay
  - Updated `getGameInfo()` - Returns `isLocked` and `prizeSplits`

### Database Schema Updates
- **New Columns**: 
  - `is_locked` - Game lock status
  - `prize_splits` - Custom prize distribution (JSONB)
  - `winner_rank` - Winner ranking (1st, 2nd, 3rd)
- **Migration**: Run `database-migration-pu2.sql` to update existing databases

### Enhanced UI Components
- **PrizeSplitsModal**: Configure custom prize distributions
- **Enhanced GameDetailModal**: Lock controls, ranked winner selection, judge management
- **Updated Dashboard**: Filtering, status indicators, prize previews

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- Ethereum wallet (MetaMask, Rainbow, etc.)
- Sepolia testnet ETH for transactions

### Installation
```bash
cd PU2
npm install --legacy-peer-deps
```

### Development
```bash
npm start
```

### Environment Variables
```bash
REACT_APP_SUPABASE_URL=https://gpajvkrjwrvojtfsyhcv.supabase.co
REACT_APP_SUPABASE_ANON_KEY=[your-supabase-key]
```

## 📱 Game Flow

### 1. Game Creation
1. Click "Create Game"
2. Set buy-in amount and max players
3. **Optional**: Configure custom prize splits
4. Game created with auto-generated code (e.g., ABC-123)

### 2. Player Management
1. Players join with buy-in payment
2. **New**: Players can add trusted judges during gameplay
3. Host can lock the game when ready

### 3. Game Resolution
1. **Required**: Host must lock the game first
2. Report winners in rank order (1st, 2nd, 3rd)
3. **New**: Prize amounts calculated based on configured splits
4. Winners claim their ranked prizes

## 🎮 User Interface Enhancements

### Game Cards
- **Lock Status**: Red lock icon when game is locked
- **Custom Prizes**: Trophy icon with tooltip showing prize splits
- **Filter Controls**: All/Open/Locked game filters with counts

### Game Detail Modal
- **Lock Button**: Host-only control to lock games
- **Prize Preview**: Shows configured prize distribution
- **Ranked Selection**: Medal icons (🥇🥈🥉) for winner selection
- **Judge Management**: Quick-add buttons for trusted judges

## 🔒 Security Features

- **Judge Consensus**: Only unanimously trusted judges can be added
- **Lock Enforcement**: Winners cannot be reported on unlocked games
- **Rank Validation**: Maximum 3 winners, proper rank ordering
- **Prize Validation**: Splits must sum to exactly 100%

## 🗄️ Database Integration

### Supabase Tables
- **users**: User profiles and wallet associations
- **game_history**: Enhanced with lock status, prize splits, winner ranks
- **game_lists**: Custom game organization (from v4)

### Migration Required
Run the SQL migration script to add new columns:
```sql
-- See database-migration-pu2.sql for complete migration
ALTER TABLE game_history 
ADD COLUMN is_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN prize_splits JSONB DEFAULT NULL,
ADD COLUMN winner_rank INTEGER DEFAULT NULL;
```

## 🎯 Upgrade Benefits

1. **Better Game Control**: Hosts have more control over game timing and participation
2. **Fairer Prize Distribution**: Support multiple winners with transparent splits
3. **Enhanced Trust**: Dynamic judge system builds confidence
4. **Improved UX**: Better visual feedback and organization
5. **Data Rich**: More detailed game history and analytics

## 🔗 Contract Integration

### Thirdweb Configuration
- **Client ID**: `[Environment Variable: REACT_APP_THIRDWEB_CLIENT_ID]`
- **Network**: Ethereum Sepolia
- **Gasless**: ERC-4337 account abstraction support

### RPC Endpoints (Fallback)
1. `ethereum-sepolia.publicnode.com`
2. `sepolia.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161`
3. `rpc.sepolia.ethpandaops.io`
4. `eth-sepolia.g.alchemy.com/v2/demo`

## 📈 Future Roadmap

- Tournament bracket system
- Advanced analytics dashboard
- Mobile app (React Native)
- Multi-chain deployment
- NFT integration for achievements

## 🤝 Contributing

PU2 is part of the Cwale project ecosystem. Follow the existing code conventions and test thoroughly before submitting changes.

---

**Note**: PU2 represents a major upgrade from previous versions. Ensure you understand the new features and contract interactions before deployment to production environments.