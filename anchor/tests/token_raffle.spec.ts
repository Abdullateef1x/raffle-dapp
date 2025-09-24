import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  ComputeBudgetProgram,
  SYSVAR_RENT_PUBKEY,
  SendTransactionError,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { BN } from "bn.js";
import { TokenRaffle } from "../target/types/token_raffle";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
  mintTo,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
  createMintToInstruction,
  createAssociatedTokenAccount,
  getMint,
} from "@solana/spl-token";
import { assert, expect } from "chai";

describe("Token Raffle Devnet — split tx + compute budget", function () {
  this.timeout(180_000);

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.TokenRaffle as Program<TokenRaffle>;

  const payer = (provider.wallet as anchor.Wallet).payer as Keypair;
  const winner = Keypair.generate();

  const raffleAccount = Keypair.generate(); // for randomness data account if needed

  // PDAs / globals
  const raffleId = new BN(Date.now()); // unique raffle id
  const start = new BN(Math.floor(Date.now() / 1000)); // now
  const end = new BN(start.toNumber() + 3600); // +1 hour
  const price = new BN(0); // set to zero for testing (or set lamports price)
  const maxTickets = new BN(10);
  const ticketNumbers: number[] = [0, 1, 2, 3, 4];


  let rafflePda: PublicKey;
  let mintAuthorityPda: PublicKey;
  let collectionMintPda: PublicKey; // actual mint created in test
  let collectionMintKeypair: Keypair; // created mint keypair OR null if createMint returns pubkey
  let ticketMintPda: PublicKey; // derived per-ticket mint PDA
  let prizeMintPda: PublicKey;
  let nftMetadata: PublicKey;
  let nftMasterEdition: PublicKey;
  let nftAssociatedAccount: PublicKey;


  // token metadata program (devnet)
  const tokenMetadataProgramId = new PublicKey(
    "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
  );

  // helper to increase CU (we add before heavy txs)
  function cuInstructions() {
    return [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
    ];
  }

  // fund buyer helper (devnet airdrop)
  // async function fundBuyer(lamports: number) {
  //   console.log("Airdropping to buyer:", buyer.publicKey.toBase58(), lamports);
  //   const sig = await provider.connection.requestAirdrop(
  //     buyer.publicKey,
  //     lamports
  //   );
  //   await provider.connection.confirmTransaction(sig, "confirmed");
  // }

  before(async () => {
    // --------------------------------------------------
    // 1) derive PDAs (raffle)
    // --------------------------------------------------
    [rafflePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("raffle"), payer.publicKey.toBuffer(), raffleId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    [mintAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("mint_authority"), rafflePda.toBuffer()],
      program.programId
    );

    console.log("rafflePda:", rafflePda.toBase58());
    console.log("mintAuthorityPda:", mintAuthorityPda.toBase58());

      
    // --------------------------------------------------
    // 2) fund buyer (so they can sign and pay fees)
    // --------------------------------------------------
    // await fundBuyer(2 * anchor.web3.LAMPORTS_PER_SOL);

    // --------------------------------------------------
    // 3) initConfig (lightweight) in single tx
    // --------------------------------------------------
    console.log("Calling initConfig...");
    await program.methods
      .initConfig(raffleId, start, end, price, maxTickets)
      .accounts({
        payer: payer.publicKey,
        raffle: rafflePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("initConfig complete");

    // --------------------------------------------------
    // 4) Create a real SPL collection mint in test (not a PDA mint)
    //    This avoids the complexity of creating a mint at PDA from the test.
    // --------------------------------------------------
    console.log("Creating collection mint (test-side)...");
    // createMint (helper) creates & initializes a mint and returns its Pubkey
    // uses payer/authority as the payer and mint authority
    collectionMintKeypair = Keypair.generate();
    // createMint utility will create a new mint account and return its Pubkey
    // The createMint helper from @solana/spl-token returns the minted PublicKey
    [collectionMintPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("collection_mint"), rafflePda.toBuffer()],
  program.programId
);

    // createMint returns PublicKey of minted token (some older helper returns Keypair).
    console.log("collectionMint (pubkey):", collectionMintPda.toBase58());

    // Create collection token account (ATA) owned by the mint_authority PDA (owner is PDA).
    // Because PDA is off-curve, getOrCreateAssociatedTokenAccount cannot be used
    // directly to create an ATA owned by an off-curve signatory; instead we create ATA manually with createAssociatedTokenAccountInstruction using the associated token program,
    // but the PDA can't sign — so we create a normal token account (not ATA) with payer as owner and then later your program may transfer.
    //
    // Simpler for testing: create an ATA for the payer (so payer holds the minted token supply),
    // then mint tokens to the payer ATA; the on-chain program's initRaffle should accept this
    // collectionMint and collectionTokenAccount (payer's ATA) as the token deposit.
    const collectionTokenAccount = await getAssociatedTokenAddress(
  collectionMintPda,
  mintAuthorityPda,
  true,  // because mintAuthority is PDA
);
    console.log("Creating collection token account (ATA) for payer:", collectionTokenAccount.toBase58());

    

    // --------------------------------------------------
    // 5) Call initRaffle — split heavy ops to separate transaction and include compute budget
    //    We pass collectionMint and collectionTokenAccount = payerCollectionAta.address
    // --------------------------------------------------
    console.log("Calling initRaffle (split tx, with compute budget)...");
    const cuIxs = cuInstructions();
    const initRaffleIx = await program.methods
      .initRaffle()
      .accounts({
        payer: payer.publicKey,
        raffle: rafflePda,
        mintAuthority: mintAuthorityPda,
        collectionMint: collectionMintPda,
        collectionTokenAccount,
        metadata: PublicKey.findProgramAddressSync(
          [Buffer.from("metadata"), tokenMetadataProgramId.toBuffer(), collectionMintPda.toBuffer()],
          tokenMetadataProgramId
        )[0],
        masterEdition: PublicKey.findProgramAddressSync(
          [Buffer.from("metadata"), tokenMetadataProgramId.toBuffer(), collectionMintPda.toBuffer(), Buffer.from("edition")],
          tokenMetadataProgramId
        )[0],
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .instruction();

    const tx = new Transaction();
    cuIxs.forEach((ix) => tx.add(ix));
    tx.add(initRaffleIx);

    // payer signs (as payer)
    await provider.sendAndConfirm(tx, []);
    console.log("initRaffle complete");
  });

  // buyTickets helper: buys `count` tickets sequentially
  async function buyTickets(count = 1) {
    for (let i = 0; i < count; i++) {
      // fetch raffle to get current totalNumTicketsBought
      const raffle = await program.account.raffle.fetch(rafflePda);
      const ticketIndex = new BN(raffle.totalNumTicketsBought.toString()); // current index

       [ticketMintPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("ticket_mint"),
          rafflePda.toBuffer(),
          ticketIndex.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );

      // buyer's ATA for the ticket mint (will be created by CPI init_if_needed in on-chain instruction,
      // but some programs may need it pre-created — we attempt to compute it and create if missing)

        const userTokenAccount = await getAssociatedTokenAddress(ticketMintPda, payer.publicKey);

    const cuIxs = cuInstructions();


      // Build buyTickets instruction
      const buyIx = await program.methods
        .buyTickets()
        .accounts({
          payer: payer.publicKey,
          raffle: rafflePda,
          ticketMint: ticketMintPda,
          userTokenAccount,
          mint: collectionMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .instruction();

      const tx = new Transaction();
      cuIxs.forEach((ix) => tx.add(ix));
      tx.add(buyIx);

      // send tx with payer as signer (payer in buyTickets is payer)
      console.log(`Sending buyTickets tx for ticketIndex=${ticketIndex.toString()} (ticketMint=${ticketMintPda.toBase58()})`);
      await provider.sendAndConfirm(tx, [payer]);
      console.log("buyTickets tx succeeded");
    }
  }

  it("buys 2 tickets successfully (split txs + compute budget)", async () => {
    // Ensure payer has funds still (safety)
    const balance = await provider.connection.getBalance(payer.publicKey);
    console.log("payer balance lamports:", balance);

    await buyTickets(2);

    // final assertions
    const raffleAfter = await program.account.raffle.fetch(rafflePda);
    console.log("Raffle after buys:", {
      totalNumTicketsBought: raffleAfter.totalNumTicketsBought.toString(),
      ticketNumbers: raffleAfter.ticketNumbers.length,
    });

    expect(raffleAfter.totalNumTicketsBought.toNumber()).to.be.gte(2);
  });

it("should mock randomness and choose a winner", async () => {
  // Commit randomness (mock feature)
  await program.methods
    .commitRandomness()
    .accounts({
      payer: payer.publicKey,
      raffle: rafflePda,
      randomnessDataAccount: Keypair.generate().publicKey, // dummy
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();

  const raffleState = await program.account.raffle.fetch(rafflePda);
  console.log("Randomness bytes:", raffleState.randomness);
  assert(raffleState.randomness.length === 32, "Randomness should be 32 bytes");

  // Reveal winner
  await program.methods
    .revealWinner()
    .accounts({
      payer: payer.publicKey,
      raffle: rafflePda,
      randomnessDataAccount: Keypair.generate().publicKey, // dummy
      systemProgram: SystemProgram.programId,
    } as any)
    .rpc();

  const updatedRaffle = await program.account.raffle.fetch(rafflePda);
  console.log("Winner:", updatedRaffle.winner.toBase58());

  assert(updatedRaffle.winnerChosen, "Winner should be marked as chosen");
  assert(!updatedRaffle.isActive, "Raffle should be inactive after winner reveal");
});

it("Check randomness logic (index calculation)", async () => {
  const raffleState = await program.account.raffle.fetch(rafflePda);
  const randomnessBuffer = Buffer.from(raffleState.randomness);
  const randomnessValue = randomnessBuffer.readBigUInt64LE(0); // Use first 8 bytes
  const ticketCount = raffleState.ticketNumbers.length;
  const index = Number(randomnessValue % BigInt(ticketCount));

  console.log(`Randomness value: ${randomnessValue}, Index: ${index}`);
  assert(index >= 0 && index < ticketCount, "Index should be valid");
});












it("should allow the winner to claim the NFT prize", async () => {

  await provider.connection.requestAirdrop(winner.publicKey, 1e9);




[prizeMintPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("prize_mint"), rafflePda.toBuffer()],
  program.programId
);

[nftMetadata] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("metadata"),
    tokenMetadataProgramId.toBuffer(),
    prizeMintPda.toBuffer(),
  ],
  tokenMetadataProgramId
);

[nftMasterEdition] = PublicKey.findProgramAddressSync(
  [
    Buffer.from("metadata"),
    tokenMetadataProgramId.toBuffer(),
    prizeMintPda.toBuffer(),
    Buffer.from("edition"),
  ],
  tokenMetadataProgramId
);





// 4️⃣ Create winner ATA if needed (Anchor will handle)
const winnerAta = await getAssociatedTokenAddress(prizeMintPda, winner.publicKey);

console.log("Winner ATA:", winnerAta.toBase58());
console.log("Prize Mint PDA:", prizeMintPda.toBase58());
console.log("Metadata PDA:", nftMetadata.toBase58());
console.log("Master Edition PDA:", nftMasterEdition.toBase58());
console.log("Raffle PDA:", rafflePda.toBase58());
console.log("Winner (payer) pubkey:", payer.publicKey.toBase58());
console.log("Token Metadata Program ID:", tokenMetadataProgramId.toBase58());
console.log("Token Program ID:", TOKEN_PROGRAM_ID.toBase58());
console.log("Associated Token Program ID:", ASSOCIATED_TOKEN_PROGRAM_ID.toBase58());
console.log("System Program ID:", SystemProgram.programId.toBase58());
console.log("Rent Sysvar ID:", SYSVAR_RENT_PUBKEY.toBase58());


    const cuIxs = cuInstructions();


 const ix = await program.methods
  .claimPrize()
  .accounts({
   raffle: rafflePda,
   winner: winner.publicKey,
   prizeMint: prizeMintPda,
   winnerAta: winnerAta,
   metadata: nftMetadata,
    masterEdition: nftMasterEdition,
    tokenMetadataProgram: tokenMetadataProgramId,
    tokenProgram: TOKEN_PROGRAM_ID,
    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
    systemProgram: SystemProgram.programId,
    rent: SYSVAR_RENT_PUBKEY,
  }).signers([winner]).rpc(); // <-- get instruction object



const updatedRaffle = await program.account.raffle.fetch(rafflePda);
assert(updatedRaffle.claimed, "Prize should be marked as claimed");



const  winnerAtaInfoBalance = await provider.connection.getTokenAccountBalance(winnerAta);
console.log("Winner ATA balance:", winnerAtaInfoBalance.value.amount);
assert(parseInt(winnerAtaInfoBalance.value.amount) > 0, "Winner should have received the prize token");

})

  // Claim prize (assuming payer is the winner for test)




})
