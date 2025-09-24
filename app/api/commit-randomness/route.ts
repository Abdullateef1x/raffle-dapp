import { NextResponse } from "next/server";
import * as anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { commitRealRandomness } from "../../lib/commitRealRandomness";
import { TokenRaffle } from "../../../anchor/target/types/token_raffle";
import idl from "../../../anchor/target/idl/token_raffle.json";
import { BN } from "@coral-xyz/anchor";

export async function POST(req: Request) {
  try {
    const { raffleId, payer } = await req.json();

    // Convert raffleId to BN/Buffer
    const raffleIdBn = BN.isBN(raffleId) ? raffleId : new BN(String(raffleId));
    const raffleIdBuf = raffleIdBn.toArrayLike(Buffer, "le", 8);

    const rpcUrl = process.env.RPC_URL || process.env.NEXT_PUBLIC_RPC;
    console.log("RPC URL:", rpcUrl);
    if (!rpcUrl) throw new Error("❌ Missing RPC_URL in env vars");
    const connection = new Connection(rpcUrl, "confirmed");

    /** Wallet **/
    class DummyWallet {
      constructor(readonly payer: Keypair) {}
      async signTransaction(tx: any) { return tx; }
      async signAllTransactions(txs: any[]) { return txs; }
      get publicKey(): PublicKey { return this.payer.publicKey; }
    }

    const dummyKeypair = anchor.web3.Keypair.generate();
    const wallet = new DummyWallet(dummyKeypair);

    const provider = new anchor.AnchorProvider(connection, wallet, {});
    anchor.setProvider(provider);

    const program = new anchor.Program<TokenRaffle>(idl as TokenRaffle, provider);

    // Step 1 — Get randomness creation + commit instructions
    const { randomnessPubkey, instructions, rngKp } = await commitRealRandomness(program);
    console.log("✅ Created randomness pubkey:", randomnessPubkey.toBase58());

    // Step 2 — Build raffle commit instruction
    const rafflePda = PublicKey.findProgramAddressSync(
      [Buffer.from("raffle"), new PublicKey(payer).toBuffer(), raffleIdBuf],
      program.programId
    )[0];

    const raffleIx = await program.methods
      .commitRandomness(false)
      .accounts({
        raffle: rafflePda,
        payer: new PublicKey(payer),
        randomnessDataAccount: randomnessPubkey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .instruction();

    /** Airdrop devnet SOL to dummyKeypair **/
    console.log("💸 Requesting airdrop...");
    const airdropSig = await connection.requestAirdrop(dummyKeypair.publicKey, 2e9);
    const latest = await connection.getLatestBlockhash();
    await connection.confirmTransaction(
      {
        signature: airdropSig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed"
    );
    console.log("✅ Airdrop confirmed");

    /** Create randomness account transaction **/
    const createTx = new Transaction().add(instructions[0]);
    createTx.feePayer = wallet.publicKey;
    createTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    createTx.sign(dummyKeypair, rngKp);

    const sig = await sendAndConfirmTransaction(connection, createTx, [dummyKeypair, rngKp]);
    console.log("✅ Randomness account creation tx:", sig);

    // Check if account actually exists now
    const acctInfo = await connection.getAccountInfo(randomnessPubkey);
    console.log("🔎 randomness account info:", acctInfo);
    if (!acctInfo) throw new Error("Randomness account was not created successfully");

    /** Prepare commit randomness transaction for Phantom to sign **/
    const tx = new Transaction().add(instructions[1], raffleIx);
    tx.feePayer = new PublicKey(payer);
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.partialSign(rngKp);

    const serialized = tx.serialize({ requireAllSignatures: false });

    return NextResponse.json({
      tx: serialized.toString("base64"),
      randomnessPubkey: randomnessPubkey.toBase58(),
    });
  } catch (err: any) {
    console.error("❌ API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
