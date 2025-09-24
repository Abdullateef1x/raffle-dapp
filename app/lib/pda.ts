import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

export const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s" // Metaplex Token Metadata program
);

export function deriveRafflePda(programId: PublicKey, payer: PublicKey, raffleId: BN) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("raffle"),
      payer.toBuffer(),
raffleId.toArrayLike(Buffer, "le", 8), // 8-byte little endian
    ],
    programId
  );
}

export function deriveMintAuthorityPda(programId: PublicKey, rafflePda: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("mint_authority"), rafflePda.toBuffer()],
    programId
  );
}

export function deriveCollectionMintPda(programId: PublicKey, rafflePda: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("collection_mint"), rafflePda.toBuffer()],
    programId
  );
}

export function deriveMetadataPda(mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
}

export function deriveMasterEditionPda(mint: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from("metadata"),
      TOKEN_METADATA_PROGRAM_ID.toBuffer(),
      mint.toBuffer(),
      Buffer.from("edition"),
    ],
    TOKEN_METADATA_PROGRAM_ID
  );
}
