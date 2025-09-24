import * as anchor from "@coral-xyz/anchor";
import { publicKey } from "@coral-xyz/anchor/dist/cjs/utils";
import { Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import {
  getDefaultDevnetQueue,
  ON_DEMAND_DEVNET_PID,
  Queue,
  Randomness,
} from "@switchboard-xyz/on-demand";


const SB_PROGRAM_ID = ON_DEMAND_DEVNET_PID;

export async function commitRealRandomness<T extends anchor.Idl>(
  program: anchor.Program<T>
): Promise<{
  randomnessPubkey: PublicKey;
  instructions: TransactionInstruction[];
  rngKp: Keypair;
}> {
  const provider = program.provider as anchor.AnchorProvider;
  if (!provider) throw new Error("Provider not found");

  const sbProgram = await anchor.Program.at(SB_PROGRAM_ID, provider);

  // Load the queue wrapper, but remember: only pass `.pubKey` to instructions
  const queueAccount = await getDefaultDevnetQueue()

  // Step 1: Create randomness account
  const rngKp = Keypair.generate();
  const [randomnessAccount, ix] = await Randomness.create(
    sbProgram,
    rngKp,
    queueAccount.pubkey // ✅ MUST be pubkey
  );

  console.log("✅ Created randomness:", randomnessAccount.pubkey.toBase58());

  // Step 2: Build commit randomness instruction
  const commitIx = await randomnessAccount.commitIx(queueAccount.pubkey); // ✅ MUST be PublicKey
  console.log("✅ Created commit instruction");

  return {
    randomnessPubkey: randomnessAccount.pubkey,
    instructions: [ix, commitIx],
    rngKp
  };
}
