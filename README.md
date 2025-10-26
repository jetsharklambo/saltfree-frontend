# 🧂 SaltFree - Get Paid Without The Drama

> *Because winners deserve their money without the salt*

🚀 **NOW LIVE ON BASE MAINNET** with Fully Gasless Transactions!

## 🚀 What Is SaltFree?

SaltFree is a Web3 platform for trustless wagering on games - online or IRL. Instead of trusting your friends to pay up after losing at poker, FIFA, or beer pong, everyone puts crypto into a smart contract first. When the game's over, winners get paid automatically. No salt, no "I'll Venmo you later," just cold hard crypto.

### 🔥 Key Features

- **⚡ Fully Gasless** - All game actions are gasless via ERC2771 meta-transactions (10 free transactions per day)
- **💰 Decentralized Escrow** - Smart contract holds the pot, not your friends
- **🪙 Multi-Token Support** - ETH, USDC, and any custom ERC-20 token
- **🧑‍⚖️ Judge System** - Neutral refs settle disputes with final authority
- **🗳️ Democratic Voting** - Players can vote on winners when there's no judge
- **🏆 Multi-Winner Payouts** - 1st, 2nd, 3rd place splits like a real tournament
- **🔒 Game Locking** - Stop randos from joining your private games
- **📱 Mobile Ready** - Play and collect from anywhere
- **🎯 Game Codes** - Share simple codes like "ABC-123" instead of contract addresses
- **🔗 On-Chain Transparency** - Every decision recorded on Base blockchain

## 💰 How It Works

1. **Start a Game** 🎲
   - Set the buy-in amount and token (ETH, USDC, or custom)
   - Pick max players (2-8)
   - Get your game code (e.g., "ABC-123")
   - **Gasless!** Backend pays the gas

2. **Players Join** 👥
   - Share code with friends
   - They join and pay buy-in
   - Lock game when ready

3. **Play Your Game** 🎯
   - Go play poker, chess, beer pong, whatever
   - Have fun!

4. **Report Winners** 🏆
   - Host or judge reports winners in rank order
   - **Gasless!** Backend pays the gas

5. **Claim Winnings** 💵
   - Winners claim their share
   - **Gasless!** Backend pays the gas
   - 1% UI fee on claims (helps keep the platform running)

## ⚡ Gasless Transactions

All core game actions are gasless via ERC2771 meta-transactions:

- **Create Game** - Start games without paying gas
- **Lock Game** - Lock games without paying gas
- **Report Winners** - Report results without paying gas
- **Claim Winnings** - Claim your share without paying gas (1% UI fee applies)

**Rate Limit:** 10 gasless transactions per wallet per day (resets at midnight UTC)

**How it works:**
1. You sign a meta-transaction (one click)
2. Backend submits to forwarder contract (pays gas)
3. Contract sees you as the transaction sender
4. You pay nothing!

## 🔧 Setup (For Developers)

```bash
# Clone the repo
git clone https://github.com/jetsharklambo/saltfree-frontend.git
cd saltfree-frontend

# Install dependencies (React 18 requires legacy peer deps)
npm install --legacy-peer-deps

# Start development server
npm start

# Build for production
npm run build
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Thirdweb Configuration
REACT_APP_THIRDWEB_CLIENT_ID=your_thirdweb_client_id

# Backend API (for gasless transactions)
REACT_APP_RELAY_API_URL=https://your-backend-url.com/api/gasless

# Optional: Analytics
REACT_APP_ENABLE_ANALYTICS=false
```

## ⚡ Tech Stack

- **Frontend:** React 18 + TypeScript
- **Web3:** Thirdweb v5 SDK
- **Smart Contracts:** OpenPoolsV36 (Base Mainnet)
- **Gasless:** ERC2771 meta-transactions via MinimalForwarder
- **UI:** Modern glass morphism design
- **Network:** Base Mainnet (Chain ID: 8453)
- **Backend:** Node.js + Express (runs on separate VPS)

## 🧑‍⚖️ Judge System

Games can have designated judges with final authority:

- **Appointment:** Host picks judge(s) when creating game
- **Authority:** Judge's decision is final
- **Transparency:** All decisions recorded on-chain
- **UI Badges:** Clear visual indicators of judge status

Perfect for tournaments that need neutral arbitration.

## 🏆 Prize Distribution

Flexible tournament-style payouts:

- **Multi-Winners:** Support for 1st, 2nd, 3rd place (and more)
- **Custom Splits:** 70/30, 50/30/20, 40/30/20/10, etc.
- **Validation:** Must total 10,000 basis points (100%)
- **Auto-Payouts:** Contract handles all the math

## 🎯 Perfect For

- **Poker Tournaments** - Proper payouts with arbitration
- **Sports Betting** - Settle disputes with judges
- **Gaming Tourneys** - COD, FIFA, any competitive game
- **Trading Contests** - See who performs best
- **Beer Pong Championships** - Peak degeneracy with escrow
- **Any Competition** - If you can compete, you can wager

## 🚨 Important Information

- **REAL MONEY** - Base Mainnet with real ETH and tokens
- **Smart Contracts** - Understand the risks of blockchain transactions
- **Judge Authority** - Judges have final say on winners
- **Consensus Required** - Games need winner agreement to distribute funds
- **Token Approval** - ERC-20 tokens (USDC, etc.) require approval before joining
- **1% UI Fee** - Applied when claiming winnings to support platform

## 📞 Support

Having issues? Check these first:

- Are you on Base Mainnet? (Chain ID: 8453)
- Do you have enough ETH/tokens for buy-ins?
- Did you approve token spending for ERC-20 games?
- Did you hit the gasless transaction limit? (10/day)
- Is your wallet connected?

Still stuck? Open a GitHub issue with details.

## 🤝 Contributing

Contributions are welcome!

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**⚠️ DISCLAIMER:** This platform is for entertainment and educational purposes. Use at your own risk. Always DYOR (Do Your Own Research). Not financial advice.

---

**Live Site:** https://saltfree.vercel.app/

Built with ❤️ by the SaltFree team
