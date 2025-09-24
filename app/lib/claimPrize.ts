// hooks/useClaimPrize.ts
import { useWallet } from "@solana/wallet-adapter-react";
import { Program } from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { deriveRafflePda } from "../lib/pda";

export function useClaimPrize(program: Program<any> | null) {
  const { publicKey } = useWallet();

  const claimPrize = async (raffle: any) => {
    if (!publicKey) return alert("Please connect your wallet first.");
    if (!program) return alert("Program not loaded");

    try {
      const raffleIdBn = BN.isBN(raffle.raffleId) ? raffle.raffleId : new BN(raffle.raffleId);

      // ✅ Derive raffle PDA
      const [rafflePda] = deriveRafflePda(program.programId, publicKey, raffleIdBn);

      // ✅ Prize mint PDA
      const [prizeMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("prize_mint"), rafflePda.toBuffer()],
        program.programId
      );

      // ✅ Winner ATA
      const winnerAta = getAssociatedTokenAddressSync(prizeMintPda, publicKey);

      // ✅ Metadata + Edition PDAs
      const tokenMetadataProgramId = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");

      const [nftMetadata] = PublicKey.findProgramAddressSync(
        [Buffer.from("metadata"), tokenMetadataProgramId.toBuffer(), prizeMintPda.toBuffer()],
        tokenMetadataProgramId
      );

      const [nftMasterEdition] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("metadata"),
          tokenMetadataProgramId.toBuffer(),
          prizeMintPda.toBuffer(),
          Buffer.from("edition"),
        ],
        tokenMetadataProgramId
      );

      // ✅ Call claimPrize method
      await program.methods
        .claimPrize()
        .accountsStrict({
          raffle: rafflePda,
          prizeMint: prizeMintPda,
          winner: publicKey,
          winnerAta,
          metadata: nftMetadata,
          masterEdition: nftMasterEdition,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenMetadataProgram: tokenMetadataProgramId,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        } as any)
        .rpc();

      alert("🎉 Prize claimed successfully!");
    } catch (err) {
      console.error("❌ Error claiming prize:", err);
      alert("Failed to claim prize. See console for details.");
    }
  };

  return { claimPrize };
}
