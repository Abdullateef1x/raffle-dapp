// createVrf.ts
import * as anchor from "@coral-xyz/anchor";
import * as sbv2 from "@switchboard-xyz/solana.js";

import { PublicKey } from "@solana/web3.js";
import {
  SwitchboardProgram,
  VrfAccount
} from "@switchboard-xyz/solana.js";
import fs from "fs";
import os from "os";


(async () => {
  // Load your devnet keypair
const payerKeypair = anchor.web3.Keypair.fromSecretKey(
  Uint8Array.from(
    JSON.parse(
      fs.readFileSync(`${os.homedir()}/.config/solana/id.json`, "utf8")
    )
  )
);



  // Provider setup
  const provider = new anchor.AnchorProvider(
    new anchor.web3.Connection("https://api.devnet.solana.com"),
    new anchor.Wallet(payerKeypair),
    {}
  );
anchor.setProvider(provider);

// Initialize SwitchboardProgram
const switchboardProgram = await SwitchboardProgram.load(
  provider.connection,
  payerKeypair
);

// Public devnet queue address
const queuePubkey = new PublicKey("EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7");
const queueAccount = new sbv2.QueueAccount(switchboardProgram, queuePubkey);

const vrfKeypair = anchor.web3.Keypair.generate();

const [vrfAccount] = await VrfAccount.create(switchboardProgram, {
  vrfKeypair,
  authority: payerKeypair.publicKey,
  queueAccount, // must be QueueAccount object
  callback: {
    programId: new PublicKey("7W77VF27RQ6sgzo2ExMNsDcys52Nq85nvvpwHAKHczJV"),
    accounts: [],
    ixData: Buffer.from(""),
  },
});

  console.log("✅ VRF Public Key:", vrfAccount.publicKey.toBase58());
})();
