/**
 * Gasless Transaction Helper for Base Blocks
 *
 * Implements gasless transactions via ERC2771 meta-transactions.
 * Backend handles gas payments, but user signs the request.
 *
 * Flow:
 * 1. User initiates action (create game, join, etc.)
 * 2. Frontend builds meta-transaction and requests signature
 * 3. User signs (one click for external wallets, automatic for embedded)
 * 4. Frontend sends signed request to backend
 * 5. Backend submits to forwarder and pays gas
 * 6. Contract sees user as _msgSender() ✅
 */

import { RELAY_API_URL, CONTRACT_ADDRESS } from '../thirdweb';
import { createSignedMetaTx, canSignMetaTx } from './metaTxHelper';
import { prepareContractCall } from 'thirdweb';
import { getGameContract } from '../thirdweb';

export interface RelayResult {
  success: boolean;
  txHash?: string;
  blockNumber?: number;
  gasUsed?: string;
  gameCode?: string;
  error?: string;
}

/**
 * Create a new game (gasless with ERC2771 meta-transaction)
 *
 * @param account - Active Thirdweb account (needed for signing)
 * @param buyInAmount - Buy-in amount in wei (as bigint or string)
 * @param buyInToken - Token contract address (0x0 for ETH)
 * @param maxPlayers - Maximum number of players
 * @param judgeList - Optional array of judge addresses
 * @param prizeSplits - Optional prize splits in basis points (e.g., [10000] = winner takes all)
 */
export async function gaslessCreateGame(
  account: any,
  buyInAmount: bigint | string,
  buyInToken: string,
  maxPlayers: number,
  judgeList: string[] = [],
  prizeSplits: number[] = [10000]
): Promise<RelayResult> {
  try {
    if (!canSignMetaTx(account)) {
      throw new Error('No wallet connected or wallet cannot sign');
    }

    console.log('🎮 Creating game gaslessly (ERC2771)...');
    console.log(`   User: ${account.address}`);
    console.log(`   Buy-in: ${buyInAmount.toString()} (${buyInToken})`);
    console.log(`   Max Players: ${maxPlayers}`);
    console.log(`   Judges: ${judgeList.length}`);

    // Get contract to encode function call
    const contract = await getGameContract();

    // Encode the createGame function call
    const tx = prepareContractCall({
      contract,
      method: 'function createGame(uint256 buyIn, address token, uint256 maxPlayers, address[] judges, uint256[] splits, uint256 initialPotAmount) returns (string)',
      params: [
        BigInt(buyInAmount),
        buyInToken,
        BigInt(maxPlayers),
        judgeList,
        prizeSplits,
        0n  // initialPotAmount (0 for standard game creation)
      ]
    });

    // IMPORTANT: tx.data is a function that needs to be awaited to get the encoded data
    const functionData = await tx.data();

    console.log('📝 Building meta-transaction...');
    console.log('   functionData:', functionData);
    console.log('   functionData type:', typeof functionData);
    console.log('   functionData length:', functionData?.length);

    // Build and sign meta-transaction
    const signedMetaTx = await createSignedMetaTx(
      account,
      CONTRACT_ADDRESS,
      functionData,
      0n, // No ETH value for createGame
      500000n // Gas limit
    );

    console.log('🚀 Sending signed meta-tx to backend...');
    console.log('   metaTx:', signedMetaTx.request);
    console.log('   signature:', signedMetaTx.signature.slice(0, 20) + '...');

    const payload = {
      metaTx: signedMetaTx.request,
      signature: signedMetaTx.signature,
      // Also send decoded params for backend validation
      buyInAmount: buyInAmount.toString(),
      buyInToken,
      maxPlayers,
      judgeList,
      prizeSplits
    };

    console.log('   Full payload:', JSON.stringify(payload, null, 2));

    // Send signed request to backend
    const response = await fetch(`${RELAY_API_URL}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to create game');
    }

    console.log('✅ Game created successfully!');
    console.log(`   Game Code: ${result.gameCode}`);
    console.log(`   TX Hash: ${result.txHash}`);
    console.log(`   Host: ${account.address} ✅`);
    console.log(`⚡ Gasless! Backend paid the gas`);

    return result;

  } catch (error: any) {
    console.error('❌ Gasless create error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error creating game'
    };
  }
}

/**
 * Join a game (gasless)
 *
 * @param userAddress - User's wallet address
 * @param gameCode - Game code to join
 */
export async function gaslessJoinGame(
  userAddress: string,
  gameCode: string
): Promise<RelayResult> {
  try {
    console.log('🎮 Joining game gaslessly...');
    console.log(`   User: ${userAddress}`);
    console.log(`   Game Code: ${gameCode}`);

    const response = await fetch(`${RELAY_API_URL}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userAddress,
        gameCode
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to join game');
    }

    console.log('✅ Joined game successfully!');
    console.log(`   TX Hash: ${result.txHash}`);
    console.log(`⚡ Gasless! Backend paid the gas`);

    return result;

  } catch (error: any) {
    console.error('❌ Gasless join error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error joining game'
    };
  }
}

/**
 * Lock a game (gasless with ERC2771 meta-transaction)
 *
 * @param account - Active Thirdweb account (needed for signing)
 * @param gameCode - Game code to lock
 */
export async function gaslessLockGame(
  account: any,
  gameCode: string
): Promise<RelayResult> {
  try {
    if (!canSignMetaTx(account)) {
      throw new Error('No wallet connected or wallet cannot sign');
    }

    console.log('🔒 Locking game gaslessly (ERC2771)...');
    console.log(`   User: ${account.address}`);
    console.log(`   Game Code: ${gameCode}`);

    const contract = await getGameContract();

    // Encode the lockGame function call
    const tx = prepareContractCall({
      contract,
      method: 'function lockGame(string code)',
      params: [gameCode]
    });

    const functionData = await tx.data();

    // Build and sign meta-transaction
    const signedMetaTx = await createSignedMetaTx(
      account,
      CONTRACT_ADDRESS,
      functionData,
      0n,
      500000n
    );

    const payload = {
      metaTx: signedMetaTx.request,
      signature: signedMetaTx.signature,
      gameCode
    };

    const response = await fetch(`${RELAY_API_URL}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to lock game');
    }

    console.log('✅ Game locked successfully!');
    console.log(`   TX Hash: ${result.txHash}`);
    console.log(`⚡ Gasless! Backend paid the gas`);

    return result;

  } catch (error: any) {
    console.error('❌ Gasless lock error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error locking game'
    };
  }
}

/**
 * Report winners for a game (gasless with ERC2771 meta-transaction)
 *
 * @param account - Active Thirdweb account (needed for signing)
 * @param gameCode - Game code
 * @param winners - Array of winner addresses in ranking order (IMPORTANT: rank order!)
 */
export async function gaslessReportWinners(
  account: any,
  gameCode: string,
  winners: string[]
): Promise<RelayResult> {
  try {
    if (!canSignMetaTx(account)) {
      throw new Error('No wallet connected or wallet cannot sign');
    }

    console.log('🏆 Reporting winners gaslessly (ERC2771)...');
    console.log(`   User: ${account.address}`);
    console.log(`   Game Code: ${gameCode}`);
    console.log(`   Winners (ranked): ${winners.join(', ')}`);

    const contract = await getGameContract();

    // Encode the reportWinners function call
    const tx = prepareContractCall({
      contract,
      method: 'function reportWinners(string code, address[] winners)',
      params: [gameCode, winners]  // IMPORTANT: winners array stays in rank order!
    });

    const functionData = await tx.data();

    console.log('📝 Building meta-transaction...');

    // Build and sign meta-transaction
    const signedMetaTx = await createSignedMetaTx(
      account,
      CONTRACT_ADDRESS,
      functionData,
      0n,
      500000n
    );

    console.log('🚀 Sending signed meta-tx to backend...');

    const payload = {
      metaTx: signedMetaTx.request,
      signature: signedMetaTx.signature,
      winners  // Include for backend validation
    };

    const response = await fetch(`${RELAY_API_URL}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to report winners');
    }

    console.log('✅ Winners reported successfully!');
    console.log(`   TX Hash: ${result.txHash}`);
    console.log(`⚡ Gasless! Backend paid the gas`);

    return result;

  } catch (error: any) {
    console.error('❌ Gasless report error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error reporting winners'
    };
  }
}

/**
 * Claim winnings from a game (gasless with ERC2771 meta-transaction, 1% UI fee)
 *
 * @param account - Active Thirdweb account (needed for signing)
 * @param gameCode - Game code
 */
export async function gaslessClaimWinnings(
  account: any,
  gameCode: string
): Promise<RelayResult> {
  try {
    if (!canSignMetaTx(account)) {
      throw new Error('No wallet connected or wallet cannot sign');
    }

    console.log('💰 Claiming winnings gaslessly (ERC2771)...');
    console.log(`   User: ${account.address}`);
    console.log(`   Game Code: ${gameCode}`);

    const contract = await getGameContract();

    // Encode the claimWinnings function call
    const tx = prepareContractCall({
      contract,
      method: 'function claimWinnings(string code)',
      params: [gameCode]
    });

    const functionData = await tx.data();

    console.log('📝 Building meta-transaction...');

    // Build and sign meta-transaction
    const signedMetaTx = await createSignedMetaTx(
      account,
      CONTRACT_ADDRESS,
      functionData,
      0n,
      500000n
    );

    console.log('🚀 Sending signed meta-tx to backend...');

    const payload = {
      metaTx: signedMetaTx.request,
      signature: signedMetaTx.signature,
      gameCode
    };

    const response = await fetch(`${RELAY_API_URL}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(errorData.error || `Request failed with status ${response.status}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to claim winnings');
    }

    console.log('✅ Winnings claimed successfully!');
    console.log(`   TX Hash: ${result.txHash}`);
    if (result.userPayout) {
      console.log(`   User Payout: ${result.userPayout}`);
      console.log(`   UI Fee: ${result.uiFee} (${result.feeRate / 100}%)`);
    }
    console.log(`⚡ Gasless! Backend paid the gas`);

    return result;

  } catch (error: any) {
    console.error('❌ Gasless claim error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error claiming winnings'
    };
  }
}

/**
 * Helper to check if an address has gasless transactions available
 *
 * Could be used to show user their remaining daily gasless tx quota.
 */
export async function checkGaslessQuota(userAddress: string): Promise<{
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  resetAt?: string;
}> {
  try {
    const response = await fetch(`${RELAY_API_URL}/rate-limit/${userAddress}`);

    if (!response.ok) {
      throw new Error(`Failed to check quota: ${response.statusText}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Failed to check gasless quota:', error);
    // Return default values on error
    return {
      allowed: true,
      used: 0,
      limit: 10,
      remaining: 10
    };
  }
}

/**
 * Check relay backend health
 */
export async function checkRelayHealth(): Promise<{
  status: string;
  paymasterBalance?: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${RELAY_API_URL}/health`);
    return await response.json();
  } catch (error: any) {
    return {
      status: 'unhealthy',
      error: error.message
    };
  }
}
