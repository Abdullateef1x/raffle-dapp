import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ASSOCIATED_TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useRaffleProgram } from "../useRaffleProgram";

export async function initRaffle(
  program: any,         // ✅ accept program as an argument
  payer: PublicKey,
  rafflePda: PublicKey,
  mintAuthorityPda: PublicKey,
  collectionMintPda: PublicKey,
  collectionTokenAccount: PublicKey,
  metadata: PublicKey,
  masterEdition: PublicKey,
  rent: PublicKey
) {
  if (!program) throw new Error("Wallet not connected");

  

  await program.methods
    .initRaffle()
    .accounts({
      payer,
      raffle: rafflePda,
      mintAuthority: mintAuthorityPda,
      collectionMint: collectionMintPda,
      collectionTokenAccount,
      metadata,
      masterEdition,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
      rent,
    }as any)
    .rpc();

  console.log("✅ initRaffle complete");
}
