"use client"

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

const WalletMultiButton = dynamic(
  async () =>
    (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);


export default function Navbar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();

  const linkClass = (path: string) =>
    `hover:text-purple-600 transition ${
      pathname === path ? "font-bold text-purple-700 underline" : ""
    }`;

return (
        <nav className="flex items-center justify-between px-6 py-4 bg-white shadow">
          <div className="text-2xl font-bold">RaffleDApp</div>
          <div className="hidden md:flex space-x-6">
<Link href="/" className={linkClass("/")}>
          Home
        </Link>
        <Link href="/my-tickets" className={linkClass("/my-tickets")}>
          My Tickets
        </Link>

            {isAdmin && (
              <a href="#create-raffle" className="hover:text-purple-600">
                Create Raffle
              </a>
            )}
          </div>
          <WalletMultiButton className="!bg-purple-600 !text-white hover:!bg-purple-700" />
        </nav>
);
}