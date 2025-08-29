/**
 * Centralized buy-in utility functions for consistent handling across all components
 */

export interface GameContractInfo {
  host: string;
  buyIn: bigint;
  maxPlayers: number;
  playerCount: number;
}

/**
 * Validates that buy-in value makes sense (not zero unless judge, reasonable range)
 */
export function validateBuyIn(buyInWei: bigint, isJudge: boolean = false): boolean {
  // Judges can have 0 buy-in
  if (isJudge && buyInWei === BigInt(0)) {
    return true;
  }
  
  // Regular players should have non-zero buy-in
  if (buyInWei === BigInt(0)) {
    console.warn('⚠️ Buy-in is 0 for non-judge player');
    return false;
  }
  
  // Reasonable range check (0.0001 ETH to 10 ETH)
  const minBuyIn = BigInt('100000000000000'); // 0.0001 ETH in wei
  const maxBuyIn = BigInt('10000000000000000000'); // 10 ETH in wei
  
  if (buyInWei < minBuyIn || buyInWei > maxBuyIn) {
    console.warn(`⚠️ Buy-in ${buyInWei.toString()} wei is outside reasonable range`);
    return false;
  }
  
  return true;
}

/**
 * Formats buy-in for display (converts wei to ETH with appropriate precision)
 */
export function formatBuyInForDisplay(buyInWei: string | bigint): string {
  const wei = typeof buyInWei === 'string' ? BigInt(buyInWei) : buyInWei;
  const eth = Number(wei) / 1e18;
  
  // Format with appropriate precision
  if (eth === 0) return '0';
  if (eth < 0.0001) return eth.toExponential(2);
  if (eth < 1) return eth.toFixed(4);
  return eth.toFixed(3);
}

/**
 * Ensures consistent logging format for buy-in debugging
 */
export function logBuyInInfo(context: string, gameCode: string, buyInWei: bigint, source: string = 'contract'): void {
  console.log(`💰 ${context} buy-in for ${gameCode}: ${formatBuyInForDisplay(buyInWei)} ETH (${buyInWei.toString()} wei) from ${source}`);
}

/**
 * Compares transaction parameters between working and current implementations
 */
export function compareTransactionParams(
  context: string,
  gameCode: string,
  buyInWei: bigint,
  contractAddress: string,
  accountAddress: string,
  methodSignature: string
): void {
  console.log(`🔍 Transaction Comparison for ${context}:`);
  console.log(`  Working vs Current Implementation:`);
  console.log(`  - Game Code: "${gameCode}" (should match exactly)`);
  console.log(`  - Buy-in Value: ${buyInWei.toString()} wei`);
  console.log(`  - Buy-in ETH: ${formatBuyInForDisplay(buyInWei)}`);
  console.log(`  - Contract: ${contractAddress}`);
  console.log(`  - Account: ${accountAddress}`);
  console.log(`  - Method: ${methodSignature}`);
  console.log(`  Expected Working Pattern:`);
  console.log(`    method: "function joinGame(string code) payable"`);
  console.log(`    params: ["${gameCode}"]`);
  console.log(`    value: ${buyInWei.toString()}`);
}

/**
 * Simple validation for PonyUpGameOptimized contract return values
 * Contract returns values in consistent order: [host, buyIn, maxPlayers, playerCount]
 */
export function validatePonyUpGameInfo(
  gameCode: string,
  host: string,
  buyIn: bigint,
  maxPlayers: number,
  playerCount: number
): GameContractInfo | null {
  console.log(`🎯 Validating PonyUpGame info for ${gameCode}: host=${host}, buyIn=${buyIn.toString()}, maxPlayers=${maxPlayers}, playerCount=${playerCount}`);
  
  // Final validation
  const validatedInfo = validateContractGameInfo(host, buyIn, maxPlayers, playerCount);
  if (!validatedInfo) {
    console.error(`❌ PonyUpGame validation failed for ${gameCode}`);
    return null;
  }
  
  return validatedInfo;
}

/**
 * Validates contract return values make sense for game data
 */
export function validateContractGameInfo(
  host: string, 
  buyIn: bigint, 
  maxPlayers: number, 
  playerCount: number
): GameContractInfo | null {
  // Host should not be zero address for valid games
  if (host === "0x0000000000000000000000000000000000000000") {
    console.warn('⚠️ Game has zero address host - invalid game');
    return null;
  }
  
  // Max players should be reasonable (2-50)
  if (maxPlayers < 2 || maxPlayers > 50) {
    console.warn(`⚠️ Unrealistic maxPlayers: ${maxPlayers}`);
    return null;
  }
  
  // Player count shouldn't exceed max players
  if (playerCount > maxPlayers) {
    console.warn(`⚠️ PlayerCount (${playerCount}) exceeds maxPlayers (${maxPlayers})`);
  }
  
  // Buy-in validation (allow 0 for potential judge games)
  if (buyIn < 0) {
    console.warn(`⚠️ Negative buy-in: ${buyIn.toString()}`);
    return null;
  }
  
  // Buy-in range check (warn but don't fail)
  const MIN_BUY_IN = BigInt('100000000000000'); // 0.0001 ETH
  const MAX_BUY_IN = BigInt('10000000000000000000'); // 10 ETH
  
  if (buyIn > 0 && (buyIn < MIN_BUY_IN || buyIn > MAX_BUY_IN)) {
    console.warn(`⚠️ Buy-in ${buyIn.toString()} wei outside expected range (0.0001-10 ETH)`);
  }
  
  return {
    host,
    buyIn,
    maxPlayers,
    playerCount
  };
}