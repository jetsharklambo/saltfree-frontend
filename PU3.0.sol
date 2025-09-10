// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/// @title PokerGameMultiTokenSupport
/// @notice Enhanced version supporting multiple tokens for buy-ins on Base chain
/// @dev Supports ETH (address(0)) and any ERC20 token payments, with Thirdweb Bridge integration

contract PokerGameMultiTokenSupport is ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    bytes constant _SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    uint8 private constant _CODE_LENGTH = 6;

    struct Game {
        string gameCode;
        address host;
        address buyInToken;      // Address of token (0x0 for ETH)
        uint256 buyInAmount;     // Amount in token's native decimals
        uint256 maxPlayers;

        address[] players;       // All joined/paid players
        address[] judges;        // Judges set at creation (free, never pay)
        mapping(address => bool) isJudge;
        mapping(address => bool) joined;
        mapping(address => bool) hasClaimed;

        // Token balances per player (for mixed token support if needed)
        mapping(address => uint256) playerBalances;
        
        // Consensus tracking
        mapping(address => bytes32) lastReportHash;
        mapping(bytes32 => uint256) reportSupport;
        bytes32 confirmedWinnerSet;
        address[] confirmedWinners;

        // Game state
        bool isLocked;
        uint256[] prizeSplits;
        uint256 totalPot;        // Total amount collected in buy-in token
    }
    
    mapping(string => Game) private games;
    mapping(string => bool) private codeUsed;
    uint256 public randomSalt;

    // Supported tokens whitelist (optional - can be managed by admin)
    mapping(address => bool) public allowedTokens;
    address public owner;
    
    // Common Base tokens for easy integration
    address public constant USDC_BASE = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address public constant USDT_BASE = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2;
    address public constant DAI_BASE = 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb;
    
    // Events
    event GameStarted(string code, address indexed host, address token, uint256 buyIn, uint256 maxPlayers, address[] judges);
    event JudgeSet(string code, address indexed judge);
    event PlayerJoined(string code, address indexed player, address token, uint256 amount);
    event PlayerRemoved(string code, address indexed participant);
    event GameLocked(string code);
    event PrizeSplitsSet(string code, uint256[] splits);
    event PotAdded(string code, address indexed sender, address token, uint256 amount);
    event WinnersReported(string code, address indexed reporter, address[] winners);
    event WinnerSetConfirmed(string code, address[] winners);
    event WinningsClaimed(string code, address indexed winner, address token, uint256 amount);
    event TokenWhitelisted(address indexed token, bool allowed);

    modifier validCode(string memory code) {
        bytes memory b = bytes(code);
        require(b.length == 7 && b[3] == "-", "Game code invalid");
        _;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Owner only");
        _;
    }

    constructor() {
        owner = msg.sender;
        // Pre-approve common Base tokens
        allowedTokens[address(0)] = true; // ETH
        allowedTokens[USDC_BASE] = true;
        allowedTokens[USDT_BASE] = true;
        allowedTokens[DAI_BASE] = true;
    }

    // --------- Game Creation / Setup ---------
    function _generateCode() internal returns (string memory) {
        for (uint256 tryCount = 0; tryCount < 10; ++tryCount) {
            bytes memory buffer = new bytes(_CODE_LENGTH + 1);
            for (uint256 i = 0; i < 3; i++) {
                buffer[i] = _SYMBOLS[uint8(uint256(
                    keccak256(abi.encodePacked(
                        block.timestamp, msg.sender, randomSalt, tryCount, i
                    ))) % 36)];
            }
            buffer[3] = "-";
            for (uint256 i = 4; i < 7; i++) {
                buffer[i] = _SYMBOLS[uint8(uint256(
                    keccak256(abi.encodePacked(
                        msg.sender, block.number, block.timestamp, randomSalt, tryCount, i
                    ))) % 36)];
            }
            string memory code = string(buffer);
            randomSalt++;
            if (!codeUsed[code]) {
                codeUsed[code] = true;
                return code;
            }
        }
        revert("Could not generate code");
    }

    /// @notice Create a new game with specified token for buy-ins
    /// @param buyInAmount Amount required to join (0 for free games)
    /// @param buyInToken Token contract address (0x0 for ETH)
    /// @param maxPlayers Maximum number of players
    /// @param judgeList Array of judge addresses (optional)
    function startGameWithToken(
        uint256 buyInAmount,
        address buyInToken,
        uint256 maxPlayers,
        address[] calldata judgeList
    ) public returns (string memory code) {
        require(maxPlayers > 1, "At least two players required");
        
        // Validate token if not ETH and not zero buy-in
        if (buyInToken != address(0) && buyInAmount > 0) {
            require(allowedTokens[buyInToken], "Token not whitelisted");
            // Verify token contract exists
            require(_isContract(buyInToken), "Invalid token contract");
        }
        
        code = _generateCode();
        Game storage g = games[code];
        g.gameCode = code;
        g.host = msg.sender;
        g.buyInAmount = buyInAmount;
        g.buyInToken = buyInToken;
        g.maxPlayers = maxPlayers;
        g.isLocked = false;
        g.totalPot = 0;
        
        // Set judges (free entry, voting rights only)
        for (uint256 i = 0; i < judgeList.length; i++) {
            address judge = judgeList[i];
            require(judge != address(0), "Judge zero address");
            g.judges.push(judge);
            g.isJudge[judge] = true;
            emit JudgeSet(code, judge);
        }
        
        emit GameStarted(code, msg.sender, buyInToken, buyInAmount, maxPlayers, judgeList);
    }

    /// @notice Legacy function for ETH-only games (backward compatibility)
    function startGame(
        uint256 buyIn,
        uint256 maxPlayers,
        address[] calldata judgeList
    ) external returns (string memory code) {
        return startGameWithToken(buyIn, address(0), maxPlayers, judgeList);
    }

    /// @notice Join game with the required token payment
    function joinGame(string memory code) external payable validCode(code) nonReentrant {
        Game storage g = games[code];
        require(!g.isLocked, "Game is locked");
        require(g.host != address(0), "No game found");
        require(!g.joined[msg.sender], "Already joined as player");
        require(g.players.length < g.maxPlayers, "Game full");
        
        // Handle payment based on token type
        if (g.buyInToken == address(0)) {
            // ETH payment
            require(msg.value == g.buyInAmount, "Incorrect ETH amount");
            g.totalPot += msg.value;
        } else if (g.buyInAmount > 0) {
            // ERC20 token payment
            require(msg.value == 0, "No ETH needed for token payment");
            IERC20(g.buyInToken).safeTransferFrom(msg.sender, address(this), g.buyInAmount);
            g.totalPot += g.buyInAmount;
        }
        // Free games (buyInAmount = 0) require no payment
        
        g.players.push(msg.sender);
        g.joined[msg.sender] = true;
        g.playerBalances[msg.sender] = g.buyInAmount;
        
        emit PlayerJoined(code, msg.sender, g.buyInToken, g.buyInAmount);
    }

    /// @notice Add additional funds to game pot
    function addPot(string memory code, uint256 amount) external payable validCode(code) nonReentrant {
        Game storage g = games[code];
        require(g.host != address(0), "Game does not exist");
        
        if (g.buyInToken == address(0)) {
            require(msg.value > 0, "Send ETH to add to pot");
            g.totalPot += msg.value;
            emit PotAdded(code, msg.sender, address(0), msg.value);
        } else {
            require(amount > 0, "Amount must be greater than 0");
            require(msg.value == 0, "No ETH needed for token payment");
            IERC20(g.buyInToken).safeTransferFrom(msg.sender, address(this), amount);
            g.totalPot += amount;
            emit PotAdded(code, msg.sender, g.buyInToken, amount);
        }
    }

    /// @notice Claim winnings in the game's token
    function claimWinnings(string memory code) external validCode(code) nonReentrant {
        Game storage g = games[code];
        require(g.isLocked, "Game not locked");
        require(!g.hasClaimed[msg.sender], "Already claimed");
        require(g.confirmedWinnerSet != bytes32(0), "No winners confirmed");
        require(g.joined[msg.sender], "Only paid-in players can claim");

        uint256 eligible = g.confirmedWinners.length;
        if (eligible > 3) eligible = 3;
        uint256 place = 0;
        for (uint256 i = 0; i < eligible; i++) {
            if (g.confirmedWinners[i] == msg.sender) {
                place = i + 1;
                break;
            }
        }
        require(place > 0, "Not in winning ranks");
        
        uint256 pot = g.totalPot;
        uint256 amount = 0;
        if (g.prizeSplits.length == 0) {
            if (place == 1) amount = pot;
        } else {
            if (place <= g.prizeSplits.length) {
                amount = pot * g.prizeSplits[place - 1] / 1000;
            }
        }
        require(amount > 0, "No prize for this rank/claim");
        
        g.hasClaimed[msg.sender] = true;
        
        // Transfer in the game's token
        if (g.buyInToken == address(0)) {
            (bool sent, ) = payable(msg.sender).call{value: amount}("");
            require(sent, "ETH transfer failed");
        } else {
            IERC20(g.buyInToken).safeTransfer(msg.sender, amount);
        }
        
        emit WinningsClaimed(code, msg.sender, g.buyInToken, amount);
    }

    // -------- Winner Consensus and Voting --------
    function reportWinners(string memory code, address[] calldata winners) external validCode(code) {
        Game storage g = games[code];
        require(g.isLocked, "Game not locked");
        if (g.confirmedWinnerSet != bytes32(0)) revert("Winners already confirmed");
        require(winners.length > 0 && winners.length <= g.players.length, "No valid winners");
        
        for (uint256 i = 0; i < winners.length; i++) {
            require(g.joined[winners[i]], "Winner not a paid-in player");
        }
        bytes32 setHash = keccak256(abi.encode(winners));

        if (g.judges.length > 0) {
            require(g.isJudge[msg.sender], "Only judge may report when judges are set");
            uint256 n = g.judges.length;
            uint256 thresh = (n / 2) + 1;
            bytes32 last = g.lastReportHash[msg.sender];
            if (last != bytes32(0) && g.reportSupport[last] > 0) {
                g.reportSupport[last] -= 1;
            }
            g.lastReportHash[msg.sender] = setHash;
            g.reportSupport[setHash] += 1;
            emit WinnersReported(code, msg.sender, winners);
            if (g.reportSupport[setHash] >= thresh) {
                g.confirmedWinnerSet = setHash;
                delete g.confirmedWinners;
                for (uint256 i = 0; i < winners.length; i++) {
                    g.confirmedWinners.push(winners[i]);
                }
                emit WinnerSetConfirmed(code, winners);
            }
        } else {
            require(g.joined[msg.sender], "Only player can report when no judges");
            uint256 n = g.players.length;
            uint256 thresh = (n / 2) + 1;
            bytes32 last = g.lastReportHash[msg.sender];
            if (last != bytes32(0) && g.reportSupport[last] > 0) {
                g.reportSupport[last] -= 1;
            }
            g.lastReportHash[msg.sender] = setHash;
            g.reportSupport[setHash] += 1;
            emit WinnersReported(code, msg.sender, winners);
            if (g.reportSupport[setHash] >= thresh) {
                g.confirmedWinnerSet = setHash;
                delete g.confirmedWinners;
                for (uint256 i = 0; i < winners.length; i++) {
                    g.confirmedWinners.push(winners[i]);
                }
                emit WinnerSetConfirmed(code, winners);
            }
        }
    }

    // -------- Game Management Functions --------
    function lockGame(string memory code) external validCode(code) {
        Game storage g = games[code];
        require(msg.sender == g.host, "Host only");
        require(!g.isLocked, "Already locked");
        g.isLocked = true;
        emit GameLocked(code);
    }

    function setPrizeSplits(string memory code, uint256[] memory splits) external validCode(code) {
        Game storage g = games[code];
        require(msg.sender == g.host, "Host only");
        require(!g.isLocked, "Locked");
        require(splits.length <= 3, "Max 3 splits");
        uint256 total = 0;
        for (uint256 i = 0; i < splits.length; i++) {
            total += splits[i];
        }
        require(total == 1000 || splits.length == 0, "Splits must sum to 1000");
        delete g.prizeSplits;
        for (uint256 i = 0; i < splits.length; i++) {
            g.prizeSplits.push(splits[i]);
        }
        emit PrizeSplitsSet(code, splits);
    }

    function rmGame(string memory code, address participant) external validCode(code) nonReentrant {
        Game storage g = games[code];
        require(!g.isLocked, "Game is locked");
        require(
            g.joined[participant] &&
            (msg.sender == g.host || msg.sender == participant),
            "Only host or self, and only joined players"
        );
        
        bool wasRemoved = false;
        for (uint256 i = 0; i < g.players.length; i++) {
            if (g.players[i] == participant) {
                g.players[i] = g.players[g.players.length - 1];
                g.players.pop();
                wasRemoved = true;
                break;
            }
        }
        require(wasRemoved, "Participant not found as player");
        
        uint256 refundAmount = g.playerBalances[participant];
        g.joined[participant] = false;
        g.playerBalances[participant] = 0;
        
        if (refundAmount > 0) {
            require(g.totalPot >= refundAmount, "Pot insufficient");
            g.totalPot -= refundAmount;
            
            if (g.buyInToken == address(0)) {
                (bool sent, ) = payable(participant).call{value: refundAmount}("");
                require(sent, "Refund failed");
            } else {
                IERC20(g.buyInToken).safeTransfer(participant, refundAmount);
            }
        }
        
        emit PlayerRemoved(code, participant);
    }

    // -------- Admin Functions --------
    function setTokenWhitelist(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
        emit TokenWhitelisted(token, allowed);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    // -------- View Functions --------
    function getGameInfo(string memory code) external view validCode(code) returns (
        address host, 
        address token, 
        uint256 buyIn, 
        uint256 maxPlayers, 
        uint256 playerCount, 
        bool isLocked, 
        uint256[] memory splits, 
        address[] memory judges
    ) {
        Game storage g = games[code];
        return (g.host, g.buyInToken, g.buyInAmount, g.maxPlayers, g.players.length, g.isLocked, g.prizeSplits, g.judges);
    }

    function getPlayers(string memory code) external view validCode(code) returns (address[] memory) {
        return games[code].players;
    }

    function getInGameJudges(string memory code) external view validCode(code) returns (address[] memory) {
        return games[code].judges;
    }

    function getConfirmedWinners(string memory code) external view validCode(code) returns (address[] memory) {
        return games[code].confirmedWinners;
    }

    function codeIsAvailable(string memory code) public view returns (bool) {
        return !codeUsed[code];
    }

    function isWinnerConfirmed(string memory code, address winner) public view validCode(code) returns (bool) {
        Game storage g = games[code];
        if (g.confirmedWinnerSet == bytes32(0)) return false;
        for (uint256 i = 0; i < g.confirmedWinners.length; i++) {
            if (g.confirmedWinners[i] == winner) return true;
        }
        return false;
    }

    function isTokenAllowed(address token) external view returns (bool) {
        return allowedTokens[token];
    }

    // -------- Utility Functions --------
    function _isContract(address addr) private view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }

    // Emergency functions
    receive() external payable {}
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner, amount);
        }
    }
}