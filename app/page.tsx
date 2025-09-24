"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "./components/Button";
import { useRaffleProgram } from "./useRaffleProgram";
import { Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY, Transaction, TransactionInstruction } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import * as anchor from "@coral-xyz/anchor";
import { BN, Program,  } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { deriveCollectionMintPda, deriveRafflePda } from "./lib/pda";
import Form from "./components/Form";
import RevealWinnerModal from "./components/RevealWinnerModal";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { TokenRaffle } from "../anchor/target/types/token_raffle";

import { ON_DEMAND_DEVNET_PID, Queue, Randomness } from "@switchboard-xyz/on-demand";
// import { commitRealRandomness } from "./api/commit-randomness/route";


// ⏳ countdown helper
function getTimeLeft(endTime: number) {
  const diff = endTime * 1000 - Date.now();
  if (diff <= 0) return "Ended";

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s left`;
  if (minutes > 0) return `${minutes}m ${seconds}s left`;
  return `${seconds}s left`;
}

export default function Home() {
  const [isAdmin, setIsAdmin] = useState(true); // TODO: replace with on-chain authority check
  const [raffles, setRaffles] = useState<any[]>([]);
  const { publicKey, connected } = useWallet();
const [loadingRaffleId, setLoadingRaffleId] = useState<{raffleId: string | null; type: "mock" | "real" | null }>({raffleId: null, type: null}); // track loading state per raffle 
  const program = useRaffleProgram();

const hasFetchedRaffles = useRef(false);

  useEffect(() => {
  if (!program || hasFetchedRaffles.current) return;


    const fetchRaffles = async () => {
      try {
        const raffleAccounts = await program.account.raffle.all();
        const parsed = raffleAccounts.map((raf) => ({
          id: raf.account.raffleId.toNumber(),
          name: raf.account.name,
          ticketPrice: raf.account.price.toNumber() / 1e9, // lamports -> SOL
          ticketsLeft:
            raf.account.maxTickets.toNumber() -
            raf.account.totalNumTicketsBought.toNumber(),
          endTime: raf.account.endTime.toNumber(), // store raw end_time
          pda: raf.publicKey,
          randomness_committed: raf.account.randomnessCommitted,
          authority: raf.account.authority.toBase58(),
          raffleWinner: raf.account.winner,
          isClaimed: raf.account.claimed,
        }));
        setRaffles(parsed);
        hasFetchedRaffles.current = true; // mark as fetched

      } catch (error) {
        console.error("❌ failed to fetch raffles", error);
      }
    };

    fetchRaffles();
    const interval = setInterval(fetchRaffles, 30000); // refresh countdown
    return () => clearInterval(interval);
  }, [program]);

  

   if (!program) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-900">
        <p className="text-lg">🔄 Loading Raffle Program...</p>
      </main>
    );
  }

  
 

  const handleBuyTicket = async (raffleId: number | string | BN) => {
    if (!publicKey || !connected) {
      alert("Please connect your wallet first!");
      return;
    }

    try {
      const raffleIdBn = BN.isBN(raffleId) ? raffleId : new BN(raffleId);

      const [rafflePda] = deriveRafflePda(
        program.programId,
        publicKey,
        raffleIdBn
      );
      const raffle = await program.account.raffle.fetch(rafflePda);
      const ticketIndex = new BN(raffle.totalNumTicketsBought.toString());

      const [ticketMintPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("ticket_mint"),
          rafflePda.toBuffer(),
          ticketIndex.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      const [collectionMintPda] = deriveCollectionMintPda(
        program.programId,
        rafflePda
      );
      const userTokenAccount = await getAssociatedTokenAddress(
        ticketMintPda,
        publicKey
      );

      await program.methods
        .buyTickets()
        .accounts({
          raffle: rafflePda,
          buyer: publicKey,
          ticketMint: ticketMintPda,
          userTokenAccount,
          mint: collectionMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          system: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        } as any)
        .rpc();

      alert("🎉 Ticket purchased successfully!");
    } catch (err) {
      console.error("❌ Error buying ticket:", err);
      alert("Failed to buy ticket.");
    }
  };


const handleClaimPrize = async (raffle: any) => {
  if (!publicKey) return alert("Please connect your wallet first.");

  try {
    const raffleIdBn = BN.isBN(raffle.id) ? raffle.id : new BN(raffle.id);

    // ✅ Derive Raffle PDA
    const [rafflePda] = deriveRafflePda(
      program.programId,
      publicKey,
      raffleIdBn
    );

    // ✅ Derive Prize Mint PDA
    const [prizeMintPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("prize_mint"), rafflePda.toBuffer()],
      program.programId
    );

    // ✅ Winner’s ATA for prize mint
    const winnerAta = getAssociatedTokenAddressSync(
      prizeMintPda,
      publicKey
    );

    // ✅ Metadata + Edition PDA
    const tokenMetadataProgramId = new PublicKey(
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
    );

    const [nftMetadata] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        tokenMetadataProgramId.toBuffer(),
        prizeMintPda.toBuffer(),
      ],
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

    // ✅ Send transaction to claim prize
    await program.methods
      .claimPrize()
      .accounts({
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

    console.log("🎉 Prize claimed successfully!");
  } catch (err) {
    console.error("❌ Error claiming prize:", err);
  }
};





// async function commitRandomness(
//   raffleId: number | string | BN,
//   publicKey: PublicKey,
//   program: Program<TokenRaffle>,
//   useMock: boolean
// ) {
  
//   try {
//     setLoadingRaffleId({raffleId: String(raffleId), type: useMock ? "mock" : "real" }); // set loading state
//     const raffleIdBn = BN.isBN(raffleId) ? raffleId : new BN(raffleId);

//     if (!publicKey) {
//   throw new Error("Wallet not connected");
// }
    
//     // 🔹 Call server API first (to fetch raffle PDA, ix, etc.)
//     const res = await fetch("/api/commit-randomness", {
//       method: "POST",
//        headers: {
//     "Content-Type": "application/json", 
//   },
//       body: JSON.stringify({
//         raffleId: raffleIdBn.toString(),
//         wallet: publicKey?.toBase58(),
//         programId: program.programId.toBase58(),
//         useMock,
//       }),
//     }).then((r) => r.json()).catch((e) => {
//       console.error("❌ API request failed:", e);
//       return { success: false, error: e.message };
//     });
    
 

// if (!res || !res.success) {
//   throw new Error(res?.error || "Unknown API error");
// }

//     // ✅ Mock path
//     if (res.useMock) {
//       const tx = await program.methods
//         .commitRandomness(true)
//         .accounts({
//           raffle: new PublicKey(res.rafflePda),
//           payer: publicKey,
//           randomnessDataAccount: Keypair.generate().publicKey, // dummy
//           systemProgram: SystemProgram.programId,
//         } as any)
//         .rpc();

//       console.log("✅ Mock randomness committed:", tx);
//       return tx;
//     }

//     // 🔹 Switchboard (real randomness) path
//     const rngKp = Keypair.fromSecretKey(new Uint8Array(res.rngSecret));
//     const createIx = new TransactionInstruction(res.createIx);
//     const commitIx = new TransactionInstruction(res.commitIx);

//     const raffleIx = await program.methods
//       .commitRandomness(false)
//       .accounts({
//         raffle: new PublicKey(res.rafflePda),
//         payer: publicKey,
//         randomnessDataAccount: rngKp.publicKey,
//         systemProgram: SystemProgram.programId,
//       } as any)
//       .instruction();

//     const tx = new Transaction().add(createIx, commitIx, raffleIx);

//     // ✅ Use Anchor provider from program
//     const provider = (program as any).provider;
//     if (!provider) throw new Error("Provider not found");

//     const sig = await provider.sendAndConfirm(tx, [rngKp]);
//     console.log("✅ Switchboard randomness committed:", sig);
//     return sig;
//   } catch (err) {
//     console.error("❌ Error committing randomness:", err);
//     alert("Failed to commit randomness.");
//   } finally {
//     setLoadingRaffleId({raffleId: null, type: null}); // clear loading state
//   }
// }





async function commitRandomness(
  raffleId: number | string | BN,
  publicKey: PublicKey,
  program: Program<TokenRaffle>,
  useMock: boolean
) {
  try {
    setLoadingRaffleId({raffleId: String(raffleId), type: useMock ? "mock" : "real" }); // set loading state
const provider = program.provider as anchor.AnchorProvider;
if (!provider) throw new Error("Provider not found");


    const raffleIdBn = BN.isBN(raffleId) ? raffleId : new BN(raffleId);
    if (!publicKey) throw new Error("Wallet not connected");




    const [rafflePda] = deriveRafflePda(
      program.programId,
      publicKey,
      raffleIdBn
    );

    // 🔹 If mock randomness, short-circuit
    if (useMock) {
      const tx = await program.methods
        .commitRandomness(true)
        .accounts({
          raffle: rafflePda,
          payer: publicKey,
          randomnessDataAccount: Keypair.generate().publicKey, // dummy
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();
      console.log("✅ Mock randomness committed:", tx);
      return tx;
    }

  const res = await fetch("/api/commit-randomness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      raffleId: String(raffleId),
      payer: publicKey.toBase58(),
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "Server error");
  }

  const { tx } = await res.json();

  // Step 2: deserialize
  const txBuffer = Buffer.from(tx, "base64");
  const transaction = Transaction.from(txBuffer);

  // Step 3: sign with Phantom
  const signed = await window.solana.signTransaction(transaction);

  // Step 4: send raw transaction
  const sig = await window.solana.sendRawTransaction(signed.serialize());
  console.log("✅ Submitted randomness tx:", sig);

  return sig;



  } catch (err) {
    console.error("❌ Error committing randomness:", err);
    alert("Failed to commit randomness.");
    setLoadingRaffleId({raffleId: null, type: null}); // clear loading state
    throw err;
  }
}



  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Navbar */}
      <Navbar isAdmin={isAdmin} />

      {/* Hero Section */}
      <section className="text-center py-16 bg-gradient-to-r from-purple-600 to-purple-800 text-white">
        <h1 className="text-4xl md:text-6xl font-bold">
          Join the Raffle, Win Big!
        </h1>
        <p className="mt-4 text-lg">
          Buy tickets for a chance to win NFTs or Tokens
        </p>
        <Button className="mt-6 bg-white text-purple-700 font-semibold hover:bg-gray-100"  onClick={() => {
          document.getElementById("raffles")?.scrollIntoView({ behavior: "smooth" });
        }}>
          View Raffles
        </Button>
      </section>

      {/* Active Raffles */}
      <section id="raffles" className="max-w-7xl mx-auto px-6 py-12">
        <h2 className="text-3xl font-bold mb-6">Active Raffles</h2>
        {raffles.length === 0 ? (
          <p className="text-gray-600">No raffles found on-chain.</p>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {raffles.map((raffle) => (
              <div
                key={raffle.id}
                className="bg-white rounded-2xl shadow-lg p-6 flex flex-col items-center text-center"
              >
                {/* Raffle Name */}
                <h3 className="text-2xl font-bold text-gray-900">
                  {raffle.name || `Raffle #${raffle.id}`}
                </h3>

                {/* Details */}
                <div className="mt-3 space-y-2 text-gray-600">
                  <p>
                    <span className="font-semibold">Price:</span>{" "}
                    {raffle.ticketPrice} SOL
                  </p>
                  <p>
                    <span className="font-semibold">Tickets Left:</span>{" "}
                    {raffle.ticketsLeft}
                  </p>
                  <p>
                    <span className="font-semibold">Ends in:</span>{" "}
                    {getTimeLeft(raffle.endTime)}
                  </p>
                </div>

                {/* Buttons */}
                <div className="mt-6 flex flex-col space-y-3 w-full">
                  <Button
                    className="w-full bg-purple-600 text-white hover:bg-purple-700"
                    onClick={() => handleBuyTicket(raffle.id)}
                  >
                    Buy Ticket
                  </Button>

                  {isAdmin && (
                    <>
<Button
  onClick={() => {
    if (!publicKey) {
      alert("Please connect your wallet first!");
      return;
    }
    commitRandomness(raffle.id, publicKey, program,  true); // true = mock
  }}
    disabled={loadingRaffleId.raffleId === String(raffle.id) && loadingRaffleId.type === "mock" || raffle.randomness_committed}

>
  {loadingRaffleId.raffleId === String(raffle.id) && loadingRaffleId.type === "mock"
    ? "Committing..."
    : "Commit Mock Randomness"}
</Button>

<Button
  onClick={() => {
    if (!publicKey) {
      alert("Please connect your wallet first!");
      return;
    }
    commitRandomness(raffle.id, publicKey, program,  false); // false = switchboard
  }}
      disabled={loadingRaffleId.raffleId === String(raffle.id) && loadingRaffleId.type === "real" || raffle.randomness_committed}

>
  {loadingRaffleId.raffleId === String(raffle.id) && loadingRaffleId.type === "real"
    ? "Committing..."
    : "Commit Real Randomness"}</Button>


                      <RevealWinnerModal
                        rafflePda={raffle.pda.toBase58()}
                        raffleAuthority={raffle.authority}
                        raffleName={raffle.name || `Raffle #${raffle.id}`}
                        randomness_committed={raffle.randomness_committed}
                        raffleWinner={raffle.winner ? raffle.winner.toBase58()  ?? raffle.winner : null} // pass actual winner if available
                      />
                    </>
                  )}

                  {raffle.Winner === publicKey?.toBase58() && (
                    <Button
                      disabled={raffle.winner !== publicKey?.toBase58() || raffle.isClaimed}

                      className="w-full bg-green-600 text-white hover:bg-green-700"
                      onClick={() => handleClaimPrize(raffle)}
                    >
                      Claim Prize
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Create Raffle (Admin Only) */}
      {isAdmin && (
        <section
          id="create-raffle"
          className="max-w-4xl mx-auto px-6 py-12 bg-white rounded-xl shadow mt-12"
        >
          <h2 className="text-3xl font-bold mb-6">Create a New Raffle</h2>
          <Form />
        </section>
      )}

      {/* Footer */}
      <Footer />
    </main>
  );
}
