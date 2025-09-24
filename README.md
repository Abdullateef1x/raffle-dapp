# 🎟️ Raffle DApp — Solana + Anchor + Next.js

![Switchboard Randomness](https://img.shields.io/badge/Switchboard-Mocked-orange)

A decentralized raffle application built on **Solana** using **Anchor framework** for smart contracts and **Next.js** for the frontend.  
It integrates with **Switchboard** for randomness generation (⚠️ currently not fully working; using mock/pseudo-randomness instead).

## 🚀 Tech Stack

- [Solana](https://solana.com/) — Blockchain platform
- [Anchor](https://www.anchor-lang.com/) — Solana smart contract framework
- [Switchboard](https://switchboard.xyz/) — On-chain randomness oracle
- [Next.js](https://nextjs.org/) — Frontend framework
- [Tailwind CSS](https://tailwindcss.com/) — Styling
- [TypeScript](https://www.typescriptlang.org/) — Type safety

## 🛠️ Features

- Create and manage raffles on Solana
- Buy raffle tickets
- Generate secure randomness with Switchboard (**currently fallback to mock/pseudo-randomness**)
- Choose winners and claim prizes
- Wallet connection and on-chain transactions

## ⚡ Development Setup

### Prerequisites
- Node.js (v18+ recommended)
- Yarn or npm
- Solana CLI (`solana` command)
- Anchor CLI (`anchor` command)

### Clone the repository
```bash
git clone git@github.com:Abdullateef1x/raffle-dapp.git
cd raffle-dapp

Install dependencies
npm install

Build and deploy Solana program
anchor build
anchor deploy

Run frontend locally
npm run dev

📂 Project Structure
raffle-dapp/
├── app/              # Next.js App Router frontend
├── anchor/           # Anchor smart contract program
├── setup/            # Local setup and Switchboard configs
├── public/           # Static assets
└── README.md

⚠️ Known Issues

Switchboard randomness commit is not stable (currently debugging timeouts on devnet).

Currently, the app uses mock/pseudo-randomness for testing.

RPC timeouts sometimes occur when testing locally.

⚠️ Important

Sensitive JSON keypairs are not tracked — they are ignored in .gitignore.

Generate your own keypairs locally:

solana-keygen new -o anchor/your-keypair.json

🔒 Security Note

Never commit private keys or .json keypairs. They have been removed and are now in .gitignore.

📜 License

MIT