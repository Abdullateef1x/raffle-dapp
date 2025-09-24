"use client";

import { useState } from "react";
import { Dialog } from "@headlessui/react";
import { Button } from "./Button";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRaffleProgram } from "../useRaffleProgram";
import { PublicKey, SystemProgram } from "@solana/web3.js";

type Props = {
  rafflePda: string;
  raffleAuthority: string;
  raffleName: string;
  randomness_committed: boolean;
  raffleWinner?: string | null;
};

export default function RevealWinnerModal({
  rafflePda,
  raffleAuthority,
  raffleName,
  randomness_committed,
  raffleWinner
}: Props) {
  const { publicKey } = useWallet();
  const program = useRaffleProgram();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const isAuthority = publicKey?.toBase58() === raffleAuthority;

  async function handleRevealWinner() {
    if (!program || !publicKey || !rafflePda) return;
    setLoading(true);

    try {
      await program.methods
        .revealWinner()
        .accounts({
                authority: publicKey,
                raffle: new PublicKey(rafflePda),
                systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      alert("🎉 Winner revealed successfully!");
      setIsOpen(false);
    } catch (err) {
      console.error("❌ Failed to reveal winner:", err);
      alert("Failed to reveal winner.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Trigger Button */}
      <Button
        onClick={() => setIsOpen(true)}
        disabled={!isAuthority || !randomness_committed || !!raffleWinner}
        className={`${
          isAuthority && randomness_committed
            ? "bg-green-600 text-white hover:bg-green-700"
            : "bg-gray-300 text-gray-500 cursor-not-allowed"
        }`}
      >
  {raffleWinner ? "Winner Revealed" : "Reveal Winner"}
      </Button>

      {/* Modal */}
      <Dialog
        open={isOpen}
        onClose={() => setIsOpen(false)}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div className="fixed inset-0 bg-black/40" aria-hidden="true" />
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-lg max-w-md w-full">
          <Dialog.Title className="text-lg font-bold">
            Reveal Winner
          </Dialog.Title>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            You are about to reveal the winner for <b>{raffleName}</b>. 
            This action is irreversible. Are you sure you want to continue?
          </p>

          <div className="mt-6 flex justify-end gap-3">
            <Button
              onClick={() => setIsOpen(false)}
              className="bg-gray-200 text-gray-700 hover:bg-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRevealWinner}
              disabled={loading}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {loading ? "Revealing..." : "Confirm"}
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
