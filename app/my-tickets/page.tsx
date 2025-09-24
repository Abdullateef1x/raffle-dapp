// app/my-tickets/page.tsx (Next.js App Router)
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { Button } from "../components/Button";
import {  useEffect, useState } from "react";
import { useRaffleProgram } from "../useRaffleProgram";
import Link from "next/link";
import { ArrowLeftIcon } from "@heroicons/react/24/outline";

import { useClaimPrize } from "../lib/claimPrize";

export default function MyTickets() {
  const { publicKey } = useWallet();
  const program = useRaffleProgram();

  const [myTickets, setMyTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false); 

    const { claimPrize } = useClaimPrize(program);


  useEffect(() => {

    if (!program || !publicKey) return;

    const fetchMyTickets = async () => {
      try {
        setLoading(true);
        const raffleAccounts = await program.account.raffle.all();

        const userTickets = [];

        for (const {account, publicKey: rafflePda} of raffleAccounts) {
          const maxTickets = account.totalNumTicketsBought.toNumber();
          const tickets: number[] = [];

          for (let i = 0; i < maxTickets; i++) {
            const ticket = account.ticketNumbers[i];
            if (ticket && ticket.toBase58() === publicKey.toBase58()) {
              tickets.push(i + 1)
            }
        }

        if (tickets.length > 0) {
          userTickets.push({
            raffleName: account.name,
            raffleId: account.raffleId.toNumber(),
            status: Date.now() < account.endTime.toNumber() * 1000 ? "Active" : "Ended",
            tickets,
            winner: account.winner ? account.winner.toBase58() : null,
            endTime: account.endTime.toNumber(),
            pda: rafflePda
          });
        }

        }
        setMyTickets(userTickets);

      } catch (error) {
         console.error("❌ Failed to fetch tickets", error);
      } finally {
        setLoading(false)
      }
    };

    fetchMyTickets();
}, [ publicKey]);
  
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">

 {/* Back to Home */}
    <div className="px-6 py-4">
      <Link
        href="/"
    className="inline-flex items-center text-purple-700 hover:text-purple-900"
      >
        <ArrowLeftIcon className="w-4 h-4 mr-2 shrink-0 "  />
            <span className="text-base  font-medium">Back to Home</span>

      </Link>
    </div>

      {/* Hero Section */}
      <section className="text-center py-12 bg-gradient-to-r from-purple-600 to-purple-800 text-white">
        <h1 className="text-4xl font-bold">🎟️ My Tickets</h1>
        <p className="mt-2 text-lg">
          Track all your raffle entries and claim your prizes
        </p>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto px-6 py-12">
        {myTickets.length === 0 ? (
          <div className="text-center text-gray-600">
            <p>You haven’t bought any tickets yet.</p>
            <Link href="/#raffles">
            <Button className="mt-4 bg-purple-600 text-white hover:bg-purple-700">
              Browse Raffles
            </Button>
            </Link>
          </div>
        ) : (

          <div className="grid md:grid-cols-2 gap-6">
            {myTickets.map((raffle) => (
              <div
                key={raffle.raffleId}
                className="bg-white rounded-xl shadow p-6 flex flex-col"
              >
                <h2 className="text-2xl font-semibold text-purple-700">
                  {raffle.raffleName}
                </h2>
                <p className="text-gray-500 mt-1">Status: {raffle.status}</p>

                <div className="mt-4">
                  <h3 className="font-semibold">Your Tickets:</h3>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {raffle.tickets.map((t: any) => (
                      <span
                        key={t}
                        className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>

                {/* If raffle ended, show winner status */}
                {raffle.status === "Ended" && (
                  <div className="mt-4">
                    {raffle.winner === publicKey?.toBase58() ? (
                      <Button onClick={() => claimPrize(raffle)} disabled={raffle.winner != publicKey?.toBase58()} className="w-full bg-green-600 text-white hover:bg-green-700">
                        Claim Prize
                      </Button>
                    ) : (
                      <p className="text-gray-500">
                        Winner: {raffle.winner?.slice(0, 6)}...
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
