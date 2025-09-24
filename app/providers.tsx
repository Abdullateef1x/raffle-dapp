"use client";

import { WalletContextProvider } from "./lib/WalletContextProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <WalletContextProvider>{children}</WalletContextProvider>;
}
