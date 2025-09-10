// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title PokerGameSmallBetRandomIdMultiWinnerJudges
/// @notice Supports judge-majority winner consensus (judges always override players if present), player-only paid entry, free judges, and full frontend compatibility.

contract PokerGameSmallBetRandomIdMultiWinnerJudges {
    bytes constant _SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    uint8 private constant _CODE_LENGTH = 6;

    struct Game {
        string gameCode;
        address host;
        uint256 buyIn;
        uint256 maxPlayers;

        address[] players;   // All joined/paid players
        address[] judges;    // Judges set at creation (free, never pay)
        mapping(address => bool) isJudge; // For instant lookup
        mapping(address => bool) joined; // True if joined as player (i.e., paid)
        mapping(address => bool) hasClaimed; // To avoid double claim

        // Consensus
        mapping(address => bytes32) lastReportHash; // Per-address most recent winner array report (judge or player)
        mapping(bytes32 => uint256) reportSupport;  // Hash to vote counts (by winner array and reporting party group)
        bytes32 confirmedWinnerSet;
        address[] confirmedWinners;

        // Misc state
        bool isLocked;
        uint256[] prizeSplits;
        uint256 totalPot;
    }
    mapping(string => Game) private games;
    mapping(string => bool) private codeUsed;
    uint256 public randomSalt;

    // --- Events (legacy-compatible + utility) ---
    event GameStarted(string code, address indexed host, uint256 buyIn, uint256 maxPlayers, address[] judges);
    event JudgeSet(string code, address indexed judge);
    event PlayerJoined(string code, address indexed player);
    event PlayerRemoved(string code, address indexed participant);
    event GameLocked(string code);
    event PrizeSplitsSet(string code, uint256[] splits);
    event PotAdded(string code, address indexed sender, uint256 amount);
    event WinnersReported(string code, address indexed reporter, address[] winners);
    event WinnerSetConfirmed(string code, address[] winners);
    event WinningsClaimed(string code, address indexed winner, uint256 amount);

    modifier validCode(string memory code) {
        bytes memory b = bytes(code);
        require(b.length == 7 && b[3] == "-", "Game code invalid");
        _;
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

    /// Set judges ONCE at creation (as free voters/refs; does not require buy-in or joining as a player).
    function startGame(
        uint256 buyIn,
        uint256 maxPlayers,
        address[] calldata judgeList
    ) external returns (string memory code) {
        require(buyIn > 0, "Buy-in required");
        require(maxPlayers > 1, "At least two players");
        code = _generateCode();
        Game storage g = games[code];
        g.gameCode = code;
        g.host = msg.sender;
        g.buyIn = buyIn;
        g.maxPlayers = maxPlayers;
        g.isLocked = false;
        // Set judges as pure voters (free, not in pot, not eligible for prize unless they join as player)
        for (uint256 i = 0; i < judgeList.length; i++) {
            address judge = judgeList[i];
            require(judge != address(0), "Judge zero address");
            g.judges.push(judge);
            g.isJudge[judge] = true;
            emit JudgeSet(code, judge);
        }
        emit GameStarted(code, msg.sender, buyIn, maxPlayers, judgeList);
    }

    /// Only paid-in players may join. (A judge may also be a player, and must pay if so.)
    function joinGame(string memory code) external payable validCode(code) {
        Game storage g = games[code];
        require(!g.isLocked, "Game is locked");
        require(g.host != address(0), "No game found");
        require(!g.joined[msg.sender], "Already joined as player");
        require(g.players.length < g.maxPlayers, "Game full");
        require(msg.value == g.buyIn, "Incorrect buy-in");
        g.players.push(msg.sender);
        g.joined[msg.sender] = true;
        g.totalPot += msg.value;
        emit PlayerJoined(code, msg.sender);
    }

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

    // --- AddPot: anyone can increase the pot at any time ---
    function addPot(string memory code) external payable validCode(code) {
        require(msg.value > 0, "Send ETH to add to pot");
        require(games[code].host != address(0), "Game does not exist");
        games[code].totalPot += msg.value;
        emit PotAdded(code, msg.sender, msg.value);
    }

    // -------- Winner Consensus and Voting --------
    /// Judges' report overrides players if any judges set; otherwise, only paid-in players vote.
    /// Only paid-in players can be named as a winner!
    function reportWinners(string memory code, address[] calldata winners) external validCode(code) {
        Game storage g = games[code];
        require(g.isLocked, "Game not locked");
        if (g.confirmedWinnerSet != bytes32(0)) revert("Winners already confirmed");
        require(winners.length > 0 && winners.length <= g.players.length, "No valid winners");
        // Validate: only paid-in players can be named as winner
        for (uint256 i = 0; i < winners.length; i++) {
            require(g.joined[winners[i]], "Winner not a paid-in player");
        }
        bytes32 setHash = keccak256(abi.encode(winners));

        if (g.judges.length > 0) {
            // Only judges can report (regardless of game participation or payment)
            require(g.isJudge[msg.sender], "Only judge may report when judges are set");
            uint256 n = g.judges.length;
            uint256 thresh = (n / 2) + 1;
            // Deduct prior
            bytes32 last = g.lastReportHash[msg.sender];
            if (last != bytes32(0) && g.reportSupport[last] > 0) {
                g.reportSupport[last] -= 1;
            }
            g.lastReportHash[msg.sender] = setHash;
            g.reportSupport[setHash] += 1;
            emit WinnersReported(code, msg.sender, winners);
            // Confirm only if judge-majority reached for *exact* order
            if (g.reportSupport[setHash] >= thresh) {
                g.confirmedWinnerSet = setHash;
                delete g.confirmedWinners;
                for (uint256 i = 0; i < winners.length; i++) {
                    g.confirmedWinners.push(winners[i]);
                }
                emit WinnerSetConfirmed(code, winners);
            }
        } else {
            // Players-only vote if and only if no judges are set for this game.
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

    // -------- Prize Claims --------
    /// Only paid-in players ever claim winnings, regardless of judge/player status.
    function claimWinnings(string memory code) external validCode(code) {
        Game storage g = games[code];
        require(g.isLocked, "Game not locked");
        require(!g.hasClaimed[msg.sender], "Already claimed");
        require(g.confirmedWinnerSet != bytes32(0), "No winners confirmed");
        require(g.joined[msg.sender], "Only paid-in players can claim");

        // Up to 3 split ranks
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
        (bool sent, ) = payable(msg.sender).call{value: amount}("");
        require(sent, "ETH transfer failed");
        emit WinningsClaimed(code, msg.sender, amount);
    }

    // ----------- Player Removal (rmGame) -----------
    /// Host can kick anyone (before lock); paid-in player can remove self before lock (and get refunded).
    function rmGame(string memory code, address participant) external validCode(code) {
        Game storage g = games[code];
        require(!g.isLocked, "Game is locked");
        require(
            g.joined[participant] &&
            (msg.sender == g.host || msg.sender == participant),
            "Only host or self, and only joined players"
        );
        // Remove from players array
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
        g.joined[participant] = false;
        (bool sent, ) = payable(participant).call{value: g.buyIn}("");
        require(sent, "Refund failed");
        require(g.totalPot >= g.buyIn, "Pot insufficient");
        g.totalPot -= g.buyIn;
        emit PlayerRemoved(code, participant);
    }

    // ----------- Frontend/readers/compatibility -----------
    function getPlayers(string memory code) external view validCode(code) returns (address[] memory) {
        return games[code].players;
    }
    function getInGameJudges(string memory code) external view validCode(code) returns (address[] memory) {
        return games[code].judges;
    }
    function getGameInfo(string memory code) external view validCode(code) returns (
        address host, uint256 buyIn, uint256 maxPlayers, uint256 playerCount, bool isLocked, uint256[] memory splits, address[] memory judges
    ) {
        Game storage g = games[code];
        return (g.host, g.buyIn, g.maxPlayers, g.players.length, g.isLocked, g.prizeSplits, g.judges);
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
    receive() external payable {}
}