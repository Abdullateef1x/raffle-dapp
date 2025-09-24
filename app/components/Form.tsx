import { useState } from "react";
import { Button } from "./Button";
import { initConfig } from "../lib/initConfig";
import { initRaffle } from "../lib/initRaffle";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRaffleProgram } from "../useRaffleProgram";
import {
  deriveCollectionMintPda,
  deriveMasterEditionPda,
  deriveMetadataPda,
  deriveMintAuthorityPda,
  deriveRafflePda,
} from "../lib/pda";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";

export default function Form() {
  const { publicKey } = useWallet();
  const program = useRaffleProgram();

  const [raffleName, setRaffleName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [ticketPrice, setTicketPrice] = useState("");
  const [maxTickets, setMaxTickets] = useState("");

  async function handleCreateRaffle(e: React.FormEvent) {
    e.preventDefault();
    if (!publicKey || !program) return;

    console.log("Submit fired!")
    
    try {
      // Generate unique raffle ID
      const raffleId = Date.now();
      const raffleIdBn = new BN(raffleId);

      // Derive PDAs
      const [rafflePda] = deriveRafflePda(
        program.programId,
        publicKey,
        raffleIdBn
      );
      const [mintAuthorityPda] = deriveMintAuthorityPda(
        program.programId,
        rafflePda
      );
      const [collectionMintPda] = deriveCollectionMintPda(
        program.programId,
        rafflePda
      );
      const collectionTokenAccount = await getAssociatedTokenAddress(
        collectionMintPda,
        mintAuthorityPda,
        true // mint authority is PDA
      );

      const [metadata] = deriveMetadataPda(collectionMintPda);
      const [masterEdition] = deriveMasterEditionPda(collectionMintPda);

      // Convert UI inputs → BN / numbers
      const start = new BN(new Date(startTime).getTime() / 1000); // seconds
      const end = new BN(new Date(endTime).getTime() / 1000);

    // parse ticket price
    const priceFloat = parseFloat(ticketPrice);
    if (isNaN(priceFloat) || priceFloat <= 0) {
      throw new Error("Invalid ticket price");
    }

    // parse max tickets
    const maxTicketsInt = parseInt(maxTickets);
    if (isNaN(maxTicketsInt) || maxTicketsInt <= 0) {
      throw new Error("Invalid max tickets");
    }

    // convert to BN safely
    const priceLamports = new BN(Math.floor(priceFloat * 1e9)); // 1 SOL = 1e9 lamports
    const maxTicketsBN = new BN(maxTicketsInt);

    console.log("✅ Validated inputs:", {
      priceFloat,
      priceLamports: priceLamports.toString(),
      maxTicketsBN: maxTicketsBN.toString(),
    });



      console.log("🔑 Derived PDAs", {
        rafflePda: rafflePda.toBase58(),
        mintAuthorityPda: mintAuthorityPda.toBase58(),
        collectionMintPda: collectionMintPda.toBase58(),
        metadata: metadata.toBase58(),
        masterEdition: masterEdition.toBase58(),
        collectionTokenAccount: collectionTokenAccount.toBase58(),
      });

      // Step 1: Init Config
      await initConfig(
        program,
        raffleIdBn,
        raffleName,
        start,
        end,
        priceLamports,
        maxTicketsBN,
        publicKey
      );
      console.log("✅ Config initialized");

      // Step 2: Init Raffle
      await initRaffle(
        program,
        publicKey,
        rafflePda,
        mintAuthorityPda,
        collectionMintPda,
        collectionTokenAccount,
        metadata,
        masterEdition,
        new PublicKey("SysvarRent111111111111111111111111111111111")
      );
      console.log("✅ Raffle initialized");

      setRaffleName("");
    setStartTime("");
    setEndTime("");
    setTicketPrice("");
    setMaxTickets("");


      alert(`🎉 Raffle created! PDA: ${rafflePda.toBase58()}`);
    } catch (err) {
      console.error("❌ Failed to create raffle:", err);
      alert("Failed to create raffle.");
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleCreateRaffle}>
      <div>
        <label className="block mb-1 font-medium">Raffle Name</label>
        <input
          type="text"
          value={raffleName}
          onChange={(e) => setRaffleName(e.target.value)}
          placeholder="Enter raffle name"
          className="w-full border border-gray-300 rounded-lg px-4 py-2"
        />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 font-medium">Start Time</label>
          <input
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">End Time</label>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block mb-1 font-medium">Ticket Price (SOL)</label>
          <input
            type="number"
    step="0.000000001" // 1 lamport = 0.000000001 SOL
    min="0.000000001"
            value={ticketPrice}
            onChange={(e) => setTicketPrice(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>
        <div>
          <label className="block mb-1 font-medium">Number of Tickets</label>
          <input
            type="number"
            min="1"      // must be at least 1
      step="1"     // only integers
            value={maxTickets}
            onChange={(e) => setMaxTickets(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2"
          />
        </div>
      </div>
      <Button
        type="submit"
        className="bg-purple-600 text-white hover:bg-purple-700"
      >
        Create Raffle
      </Button>
    </form>
  );
}
