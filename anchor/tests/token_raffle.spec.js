import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, ComputeBudgetProgram } from "@solana/web3.js";
import { createMint, getOrCreateAssociatedTokenAccount, mintTo } from "@solana/spl-token";
import { ASSOCIATED_TOKEN_PROGRAM_ID, } from "@solana/spl-token";
import BN from "bn.js";
describe("Token Raffle Tests", function () {
    this.timeout(60000);
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
    const program = anchor.workspace.TokenRaffle;
    const payer = provider.wallet.payer;
    const buyer = Keypair.generate();
    let rafflePda;
    let collectionMint;
    let mintAuthorityPda;
    let metadata;
    let masterEdition;
    let ticketMintAuthorityPda;
    const tokenMetadataProgramId = new anchor.web3.PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
    const raffleId = new anchor.BN(27);
    before(async () => {
        // await provider.connection.confirmTransaction(
        //   await provider.connection.requestAirdrop(payer.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL)
        // );
        // await provider.connection.confirmTransaction(
        //   await provider.connection.requestAirdrop(buyer.publicKey, 5 * anchor.web3.LAMPORTS_PER_SOL)
        // );
        // 3. Compute raffle PDA
        [rafflePda] = PublicKey.findProgramAddressSync([
            Buffer.from("raffle"),
            payer.publicKey.toBuffer(),
            raffleId.toArrayLike(Buffer, "le", 8)
        ], program.programId);
        [collectionMint] = PublicKey.findProgramAddressSync([Buffer.from("collection_mint"), rafflePda.toBuffer()], program.programId);
        // 4. Compute ticket mint authority PDA
        [ticketMintAuthorityPda] = PublicKey.findProgramAddressSync([Buffer.from("ticket_mint_authority"), rafflePda.toBuffer()], program.programId);
        [metadata] = PublicKey.findProgramAddressSync([
            Buffer.from("metadata"),
            tokenMetadataProgramId.toBuffer(),
            collectionMint.toBuffer(),
        ], tokenMetadataProgramId);
        [masterEdition] = PublicKey.findProgramAddressSync([
            Buffer.from("metadata"),
            tokenMetadataProgramId.toBuffer(),
            collectionMint.toBuffer(),
            Buffer.from("edition"),
        ], tokenMetadataProgramId);
        [mintAuthorityPda] = PublicKey.findProgramAddressSync([Buffer.from("mint_authority"), rafflePda.toBuffer()], program.programId);
        // 5. Compute collection mint PDA
        // 6. Initialize config
        await program.methods.initConfig(raffleId, new BN(2001), new BN(3000), new BN(1000), new BN(10))
            .accounts({
            payer: payer.publicKey,
            raffle: rafflePda,
            systemProgram: SystemProgram.programId,
        })
            .rpc();
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
            units: 400000, // increase compute units (default is 200k)
        });
        const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 1, // optional
        });
        // 7. Initialize raffle
        const initRaffleIx = await program.methods.initRaffle()
            .accounts({
            payer: payer.publicKey,
            raffle: rafflePda,
            mintAuthority: mintAuthorityPda,
            collectionMint: collectionMint,
            metadata: metadata,
            masterEdition: masterEdition,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
            .instruction();
        const tx = new anchor.web3.Transaction()
            .add(modifyComputeUnits)
            .add(addPriorityFee)
            .add(initRaffleIx);
        const sig = await provider.sendAndConfirm(tx, [], { skipPreflight: false });
        console.log("initRaffle TX:", sig);
    });
    async function buyTickets() {
        const raffleState = await program.account.raffle.fetch(rafflePda);
        // Derive new ticket mint PDA
        const [ticketMintPda] = PublicKey.findProgramAddressSync([
            Buffer.from("ticket_mint"),
            rafflePda.toBuffer(),
            new BN(raffleState.totalNumTicketsBought).toArrayLike(Buffer, "le", 8)
        ], program.programId);
        const mint = await createMint(provider.connection, payer, payer.publicKey, null, 6 // decimals
        );
        console.log("Created mint: ", mint.toBase58());
        // Create user's ATA for this ticket mint
        const userTokenAccount = await getOrCreateAssociatedTokenAccount(provider.connection, payer, // fee payer
        mint, buyer.publicKey);
        console.log("User token account: ", userTokenAccount.address.toBase58());
        await mintTo(provider.connection, payer, mint, userTokenAccount.address, payer, // mint authority
        1000000000 // amount in smallest units (e.g., 1000 tokens)
        );
        console.log("Minted tokens to user account");
        const modifyComputeUnits = ComputeBudgetProgram.setComputeUnitLimit({
            units: 400000,
        });
        const addPriorityFee = ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 1,
        });
        const buyTicketsIx = await program.methods.buyTickets()
            .accounts({
            payer: buyer.publicKey,
            raffle: rafflePda,
            ticketMintAuthority: ticketMintAuthorityPda,
            ticketMint: ticketMintPda,
            userTokenAccount: userTokenAccount.address,
            mint: mint,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        }).instruction();
        const tx = new anchor.web3.Transaction()
            .add(modifyComputeUnits)
            .add(addPriorityFee)
            .add(buyTicketsIx);
        const sig = await provider.sendAndConfirm(tx, [buyer]);
        console.log("buyTickets TX:", sig);
    }
    it("buy tickets twice", async () => {
        await buyTickets();
        const updatedRaffleState = await program.account.raffle.fetch(rafflePda);
        const [ticketMintPda2] = PublicKey.findProgramAddressSync([
            Buffer.from("ticket_mint"),
            rafflePda.toBuffer(),
            new BN(updatedRaffleState.totalNumTicketsBought).toArrayLike(Buffer, "le", 8)
        ], program.programId);
        console.log("Second Ticket Mint PDA:", ticketMintPda2.toBase58());
        await buyTickets(); // Second ticket
    });
    // it("commit a winner", async () => {
    //   const randomnessAccount = Keypair.generate();
    //   await program.methods
    //   .commitRandomness().accounts({
    //     payer: payer.publicKey,
    //     raffle: rafflePda,
    //     systemProgram: SystemProgram.programId,})
    // })
});
