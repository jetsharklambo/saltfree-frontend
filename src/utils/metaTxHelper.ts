/**
 * Meta-Transaction Helper for ERC2771 Gasless Transactions
 *
 * This module handles the creation and signing of meta-transactions
 * that can be submitted to the MinimalForwarder contract.
 *
 * Flow:
 * 1. User wants to perform an action (create game, join, etc.)
 * 2. Frontend builds a meta-transaction request
 * 3. User signs the request (one signature, no gas)
 * 4. Frontend sends signed request to backend
 * 5. Backend submits to forwarder (pays gas)
 * 6. Contract receives transaction with user as _msgSender()
 */

import { readContract } from 'thirdweb';
import { FORWARDER_ADDRESS } from '../thirdweb';
import { base } from 'thirdweb/chains';
import { getContract } from 'thirdweb';
import { client } from '../thirdweb';

// MinimalForwarder ABI
const FORWARDER_ABI = [
  'function getNonce(address from) view returns (uint256)'
];

// EIP-712 Domain for MinimalForwarder
// MUST match the deployed contract exactly
const EIP712_DOMAIN = {
  name: 'MinimalForwarder',
  version: '0.0.1',
  chainId: 8453, // Base mainnet
  verifyingContract: FORWARDER_ADDRESS
};

// EIP-712 Types for ForwardRequest
// NOTE: This MinimalForwarder does NOT have a deadline field!
const FORWARD_REQUEST_TYPE = {
  ForwardRequest: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'gas', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'data', type: 'bytes' }
  ]
};

export interface MetaTxRequest {
  from: string;
  to: string;
  value: string;
  gas: string;
  nonce: string;
  data: string;
}

export interface SignedMetaTxRequest {
  request: MetaTxRequest;
  signature: string;
}

/**
 * Get the current nonce for a user from the forwarder contract
 */
export async function getUserNonce(userAddress: string): Promise<bigint> {
  try {
    const forwarder = getContract({
      client,
      chain: base,
      address: FORWARDER_ADDRESS,
      abi: FORWARDER_ABI
    });

    const nonce = await readContract({
      contract: forwarder,
      method: 'function getNonce(address from) view returns (uint256)',
      params: [userAddress]
    });

    return nonce as bigint;
  } catch (error) {
    console.error('Failed to get user nonce:', error);
    throw new Error('Failed to get nonce from forwarder');
  }
}

/**
 * Build a meta-transaction request
 *
 * @param userAddress - The user's wallet address (will be _msgSender() in contract)
 * @param contractAddress - The target contract address
 * @param functionData - The encoded function call data
 * @param value - ETH value to send (default 0)
 * @param gasLimit - Gas limit for the meta-tx (default 500000)
 * @returns MetaTxRequest ready for signing
 */
export async function buildMetaTxRequest(
  userAddress: string,
  contractAddress: string,
  functionData: string,
  value: bigint = 0n,
  gasLimit: bigint = 500000n
): Promise<MetaTxRequest> {
  try {
    // Get user's current nonce
    const nonce = await getUserNonce(userAddress);

    console.log('🔧 Building request with functionData:', functionData);

    const request: MetaTxRequest = {
      from: userAddress,
      to: contractAddress,
      value: value.toString(),
      gas: gasLimit.toString(),
      nonce: nonce.toString(),
      data: functionData
    };

    console.log('📝 Built meta-transaction request:', {
      from: request.from,
      to: request.to,
      nonce: request.nonce,
      value: request.value,
      data: request.data,
      dataPresent: !!request.data,
      dataLength: request.data?.length
    });

    return request;
  } catch (error) {
    console.error('Failed to build meta-tx request:', error);
    throw error;
  }
}

/**
 * Request user to sign a meta-transaction
 *
 * @param account - Active Thirdweb account
 * @param request - The meta-transaction request to sign
 * @returns Signature string
 */
export async function signMetaTxRequest(
  account: any,
  request: MetaTxRequest
): Promise<string> {
  try {
    console.log('✍️  Requesting signature from user...');

    // Convert string values back to proper types for signing
    const typedRequest = {
      from: request.from,
      to: request.to,
      value: BigInt(request.value),
      gas: BigInt(request.gas),
      nonce: BigInt(request.nonce),
      data: request.data
    };

    // Sign using EIP-712 typed data
    const signature = await account.signTypedData({
      domain: EIP712_DOMAIN,
      types: FORWARD_REQUEST_TYPE,
      primaryType: 'ForwardRequest',
      message: typedRequest
    });

    console.log('✅ User signed meta-transaction');
    console.log(`   Signature: ${signature.slice(0, 20)}...`);

    return signature;
  } catch (error: any) {
    console.error('Failed to sign meta-transaction:', error);

    // User rejected signature
    if (error.code === 4001 || error.message?.includes('User rejected')) {
      throw new Error('Signature rejected by user');
    }

    throw new Error('Failed to sign meta-transaction');
  }
}

/**
 * Build and sign a meta-transaction in one step
 *
 * @param account - Active Thirdweb account
 * @param contractAddress - Target contract address
 * @param functionData - Encoded function call
 * @param value - ETH value (default 0)
 * @param gasLimit - Gas limit (default 500000)
 * @returns Signed meta-transaction ready to send to backend
 */
export async function createSignedMetaTx(
  account: any,
  contractAddress: string,
  functionData: string,
  value: bigint = 0n,
  gasLimit: bigint = 500000n
): Promise<SignedMetaTxRequest> {
  try {
    const userAddress = account.address;

    // Build the request
    const request = await buildMetaTxRequest(
      userAddress,
      contractAddress,
      functionData,
      value,
      gasLimit
    );

    console.log('✅ Built request object:', request);
    console.log('   request.data:', request.data);
    console.log('   All keys:', Object.keys(request));

    // Get user signature
    const signature = await signMetaTxRequest(account, request);

    console.log('✅ After signing, request.data:', request.data);

    return {
      request,
      signature
    };
  } catch (error) {
    console.error('Failed to create signed meta-tx:', error);
    throw error;
  }
}

/**
 * Check if account can sign (has wallet connected)
 */
export function canSignMetaTx(account: any): boolean {
  return !!(account && account.address && account.signTypedData);
}
