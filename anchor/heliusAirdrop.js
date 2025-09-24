

// heliusAirdrop.js
import fetch from "node-fetch";

const API_KEY = "7f9c08ce-b765-4c30-ac64-fca1dd4151bc";
const url = `https://devnet.helius-rpc.com/?api-key=${API_KEY}`;

/**
 * Request SOL airdrop from Helius and confirm transaction.
 * @param {string} walletAddress - Solana wallet address
 * @param {number} amountSOL - Amount in SOL (e.g., 2 means 2 SOL)
 */
async function heliusAirdrop(walletAddress, amountSOL) {
  const lamports = amountSOL * 1_000_000_000;

  console.log(`Requesting ${amountSOL} SOL for ${walletAddress}...`);

  // Step 1: Request airdrop
  const payload = {
    jsonrpc: "2.0",
    id: "helius-airdrop",
    method: "requestAirdrop",
    params: [walletAddress, lamports]
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();
  if (!data.result) {
    console.error("❌ Airdrop failed:", data);
    return;
  }

  const signature = data.result;
  console.log("✅ Airdrop transaction signature:", signature);

  // Step 2: Confirm transaction
  await confirmTransaction(signature);
  console.log(`✅ ${amountSOL} SOL successfully airdropped to ${walletAddress}`);
}

async function confirmTransaction(signature) {
  const confirmPayload = {
    jsonrpc: "2.0",
    id: "helius-confirm",
    method: "confirmTransaction",
    params: [signature, "confirmed"]
  };

  console.log("⏳ Waiting for transaction confirmation...");
  let confirmed = false;
  while (!confirmed) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(confirmPayload)
    });

    const data = await res.json();
    if (data.result && data.result.value) {
      confirmed = true;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

export default heliusAirdrop;
