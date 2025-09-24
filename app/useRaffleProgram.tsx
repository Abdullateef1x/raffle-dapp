import { AnchorProvider, Program, Idl,  } from "@coral-xyz/anchor";
import type { Wallet } from "@coral-xyz/anchor/dist/cjs/provider"; // 👈 force the correct Wallet type

import idl from "../anchor/target/idl/token_raffle.json"
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { TokenRaffle } from "../anchor/target/types/token_raffle";


export function useRaffleProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();


  if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
    return null; // Wallet not connected yet
  }

  // 👇 Explicitly typed as Anchor's Wallet (not NodeWallet!)
  const anchorWallet: Wallet = {
    publicKey: wallet.publicKey,
    signTransaction: wallet.signTransaction,
    signAllTransactions: wallet.signAllTransactions,
  };


  
  const provider = new AnchorProvider(connection, anchorWallet, {preflightCommitment: "processed"});

    // const programId = new PublicKey((idl as any).address);
  const program = new Program(idl as Idl, provider) as Program<TokenRaffle>;
  return program;
}
