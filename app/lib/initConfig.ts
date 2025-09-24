import { PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { deriveRafflePda } from "./pda";

export async function initConfig(
  program: any,         // ✅ accept program as an argument
  raffleId: BN,
  name: string,
  start: BN,
  end: BN,
  price: BN,
  maxTickets: BN,
  payer: PublicKey
) {
  if (!program) throw new Error("Program not available");

  const [rafflePda] = deriveRafflePda(program.programId, payer, raffleId);

  await program.methods
    .initConfig(
      new BN(raffleId),
      name,
      new BN(start),
      new BN(end),
      new BN(price),
      new BN(maxTickets)
    )
    .accounts({
      payer,
      raffle: rafflePda,
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();

  console.log("✅ initConfig complete:", rafflePda.toBase58());
  return rafflePda;
}
