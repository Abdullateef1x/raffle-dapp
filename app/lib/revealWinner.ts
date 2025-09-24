import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { TokenRaffle } from "../../anchor/target/types/token_raffle" // adjust to your IDL path

export async function revealWinner(
  program: Program<TokenRaffle>,
  authority: PublicKey,
  rafflePda: PublicKey
) {
  await program.methods
    .revealWinner()
    .accounts({
      raffle: rafflePda,
      authority,
      systemProgram: PublicKey.default,
    } as any)
    .rpc();
}
