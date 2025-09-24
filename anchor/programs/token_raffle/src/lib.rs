use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::metadata::{create_metadata_accounts_v3, CreateMetadataAccountsV3, Metadata};
use anchor_spl::token::{self, mint_to, transfer, MintTo, Transfer};
use anchor_lang::solana_program::{keccak, sysvar::clock::Clock};
// use anchor_lang::solana_program::program;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};
use mpl_token_metadata::accounts::Metadata as MetadataAccount;

use anchor_lang::system_program;
use anchor_spl::metadata::{
    create_master_edition_v3,
    mpl_token_metadata::types::{CollectionDetails, Creator, DataV2},
    sign_metadata, CreateMasterEditionV3, SignMetadata,
};

declare_id!("8xQ1B6beBjoP9oFRHzjmPyHzdGAJPnxcUYzL6Dr5Vsax");

#[constant]
pub const NAME: &str = "Token Lottery Ticket #";
#[constant]
pub const URI: &str = "Token Lottery";
#[constant]
pub const SYMBOL: &str = "TICKET";

#[program]
pub mod token_raffle {

    use super::*;

    pub fn init_config(
        ctx: Context<InitConfig>,
        raffle_id: u64,
        name: String,
        start: u64,
        end: i64,
        price: u64,
        max_tickets: u64,
    ) -> Result<()> {
        ctx.accounts.raffle.authority = ctx.accounts.payer.key();
        ctx.accounts.raffle.bump = ctx.bumps.raffle;

        ctx.accounts.raffle.name = name;
        ctx.accounts.raffle.is_active = true;
        ctx.accounts.raffle.raffle_id = raffle_id;
        ctx.accounts.raffle.start_time = start;
        ctx.accounts.raffle.end_time = end;
        ctx.accounts.raffle.price = price;
        ctx.accounts.raffle.randomness = [0u8; 32];

        ctx.accounts.raffle.winner_chosen = false;
        ctx.accounts.raffle.total_num_tickets_bought = 0;
        ctx.accounts.raffle.max_tickets = max_tickets;
        ctx.accounts.raffle.prize_amount = 10;
        ctx.accounts.raffle.claimed = false;
        ctx.accounts.raffle.randomness_committed = false;

        Ok(())
    }

    pub fn init_raffle(ctx: Context<InitRaffle>) -> Result<()> {
        let ma_bump = ctx.bumps.mint_authority;
        let raffle = &ctx.accounts.raffle;

        let binding = raffle.key();
        let seeds: &[&[u8]] = &[b"mint_authority", binding.as_ref(), &[ma_bump]];
        let signer: &[&[&[u8]]] = &[seeds];

        // --- Mint one token (or any initial supply you need) to the collection ATA
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.collection_mint.to_account_info(),
                    to: ctx.accounts.collection_token_account.to_account_info(),
                    authority: ctx.accounts.mint_authority.to_account_info(),
                },
                signer,
            ),
            1, // supply to mint now
        )?;

        create_metadata_accounts_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMetadataAccountsV3 {
                    metadata: ctx.accounts.metadata.to_account_info(),
                    mint: ctx.accounts.collection_mint.to_account_info(),
                    mint_authority: ctx.accounts.mint_authority.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    update_authority: ctx.accounts.mint_authority.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer,
            ),
            DataV2 {
                name: NAME.to_string(),
                symbol: SYMBOL.to_string(),
                uri: URI.to_string(),
                seller_fee_basis_points: 0,
                creators: Some(vec![Creator {
                    address: ctx.accounts.mint_authority.key(),
                    verified: true,
                    share: 100,
                }]),
                collection: None,
                uses: None,
            },
            // is_mutable, is_collection, collection details
            true,
            false,
            Some(CollectionDetails::V1 { size: 0 }),
        )?;

        create_master_edition_v3(
            CpiContext::new_with_signer(
                ctx.accounts.token_metadata_program.to_account_info(),
                CreateMasterEditionV3 {
                    edition: ctx.accounts.master_edition.to_account_info(),
                    mint: ctx.accounts.collection_mint.to_account_info(),
                    update_authority: ctx.accounts.mint_authority.to_account_info(),
                    mint_authority: ctx.accounts.mint_authority.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    metadata: ctx.accounts.metadata.to_account_info(),
                    token_program: ctx.accounts.token_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                    rent: ctx.accounts.rent.to_account_info(),
                },
                signer,
            ),
            Some(0), // max supply
        )?;

        sign_metadata(CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            SignMetadata {
                creator: ctx.accounts.mint_authority.to_account_info(),
                metadata: ctx.accounts.metadata.to_account_info(),
            },
            signer,
        ))?;

        Ok(())
    }

    pub fn buy_tickets(ctx: Context<BuyTickets>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;

        // Make sure tickets are still available
        require!(
            raffle.total_num_tickets_bought < raffle.max_tickets,
            ErrorCode::NoTicketsLeft
        );

        // Mint 1 ticket token to the user

        let binding = ctx.accounts.payer.key();
        let signer_seeds: &[&[&[u8]]] = &[&[
            b"raffle",
            binding.as_ref(),
            &raffle.raffle_id.to_le_bytes(),
            &[raffle.bump],
        ]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.ticket_mint.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: raffle.to_account_info(),
        };

        let cpi_context = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            cpi_accounts,
            signer_seeds,
        );

        token::mint_to(cpi_context, 1)?;

        raffle.ticket_numbers.push(ctx.accounts.payer.key());

        // Update number of tickets bought
        raffle.total_num_tickets_bought = raffle
            .total_num_tickets_bought
            .checked_add(1)
            .ok_or(ErrorCode::Overflow)?;

        Ok(())
    }

pub fn commit_randomness(ctx: Context<CommitRandomness>, use_mock: bool) -> Result<()> {
    let raffle = &mut ctx.accounts.raffle;
    let clock = Clock::get()?;

    require!(
        ctx.accounts.payer.key() == raffle.authority,
        ErrorCode::NotAuthorized
    );

    require!(
        clock.unix_timestamp >= raffle.end_time,
        ErrorCode::RaffleStillActive
    );

    require!(raffle.is_active, ErrorCode::RaffleNotActive);

    if use_mock {
        // ✅ Deterministic mock randomness
        let combined_value = (clock.unix_timestamp as u128)
            .wrapping_mul(raffle.raffle_id as u128)
            .wrapping_add(clock.slot as u128);

        let randomness_bytes = combined_value.to_le_bytes();
        raffle.randomness[..16].copy_from_slice(&randomness_bytes);

                raffle.randomness_committed = true;


        msg!("Mock randomness committed: {:?}", raffle.randomness);
    } else {
        // ✅ Ensure randomness account exists
        let randomness_ai = ctx
            .accounts
            .randomness_data_account
            .as_ref()
            .ok_or(ErrorCode::MissingRandomnessAccount)?;

        let data = randomness_ai.try_borrow_data()?;
        require!(data.len() >= 40, ErrorCode::InvalidRandomnessAccount);

        let seed_bytes: [u8; 32] = data[8..40]
            .try_into()
            .map_err(|_| ErrorCode::InvalidRandomnessAccount)?;
        raffle.randomness = seed_bytes;

        raffle.randomness_committed = true;

        msg!("Real randomness committed: {:?}", raffle.randomness);
    }

    Ok(())
}

    pub fn reveal_winner(ctx: Context<RevealWinner>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;

                    let clock = Clock::get()?;

    require!(
        ctx.accounts.payer.key() == raffle.authority,
        ErrorCode::NotAuthorized
    );

    // ✅ Prevent committing before raffle ends
    require!(
        clock.unix_timestamp >= raffle.end_time,
        ErrorCode::RaffleStillActive
    );

                require!(raffle.is_active, ErrorCode::RaffleNotActive);

                require!(
        raffle.randomness_committed,
        ErrorCode::RandomnessNotCommitted
    );

    



        require!(!raffle.winner_chosen, ErrorCode::WinnerAlreadyChosen);
        require!(
            raffle.total_num_tickets_bought > 0,
            ErrorCode::NoTicketsBought
        );
        require!(
            raffle.randomness != [0u8; 32],
            ErrorCode::RandomnessNotCommitted
        );
        require!(
            raffle.ticket_numbers.len() == raffle.total_num_tickets_bought as usize,
            ErrorCode::InvalidTicketData
        );

        // Convert first 16 bytes of randomness to u128
        let mut bytes = [0u8; 16];
        bytes.copy_from_slice(&raffle.randomness[..16]);
        let random_value = u128::from_le_bytes(bytes);

        // Winner index
        let winner_index = (random_value % raffle.ticket_numbers.len() as u128) as usize;
        let winner_pubkey = raffle.ticket_numbers[winner_index];

        // Set winner details
        raffle.winner = winner_pubkey;
        raffle.winner_index = Some(winner_index as u64);
        raffle.winner_chosen = true;
        raffle.is_active = false;

        emit!(WinnerChosen {
            raffle_id: raffle.raffle_id,
            winner: winner_pubkey,
            winner_index: winner_index as u64,
        });

        Ok(())
    }

    pub fn claim_prize(ctx: Context<ClaimPrize>) -> Result<()> {
        let raffle = &mut ctx.accounts.raffle;
            let clock = Clock::get()?;

          require!(
        clock.unix_timestamp >= raffle.end_time,
        ErrorCode::RaffleStillActive
    );

    

require!(!raffle.claimed, ErrorCode::AlreadyClaimed);


require!(raffle.winner_chosen, ErrorCode::WinnerNotChosen);

        require!(
raffle.randomness != [0u8; 32],
ErrorCode::RandomnessNotCommitted
);
        // ✅ Check winner conditions here...




        // ✅ Mint 1 token to winner
        let cpi_accounts = MintTo {
            mint: ctx.accounts.prize_mint.to_account_info(),
            to: ctx.accounts.winner_ata.to_account_info(),
            authority: ctx.accounts.prize_mint.to_account_info(), // PDA as authority
        };

        let binding = raffle.key();
        let seeds: &[&[u8]] = &[b"prize_mint", binding.as_ref(), &[ctx.bumps.prize_mint]];
        let signer_seeds = &[&seeds[..]];

        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            ),
            1,
        )?;

        // ✅ Create Metadata using CPI
        let data = DataV2 {
            seller_fee_basis_points: 0,
            creators: None,
            collection: None,
            uses: None,
            name: NAME.to_string(),
            symbol: SYMBOL.to_string(),
            uri: URI.to_string(),
        };

        let metadata_accounts = CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata.to_account_info(),
            mint: ctx.accounts.prize_mint.to_account_info(),
            mint_authority: ctx.accounts.prize_mint.to_account_info(), // PDA as mint authority
            payer: ctx.accounts.winner.to_account_info(),
            update_authority: ctx.accounts.prize_mint.to_account_info(), // PDA as update authority
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        };

        let metadata_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            metadata_accounts,
            signer_seeds,
        );

        create_metadata_accounts_v3(
            metadata_ctx,
            data,
            true, // is_mutable
            true, // update_authority_is_signer
            None,
        )?;

        // ✅ Create Master Edition using CPI
        let edition_accounts = CreateMasterEditionV3 {
            edition: ctx.accounts.master_edition.to_account_info(),
            mint: ctx.accounts.prize_mint.to_account_info(),
            update_authority: ctx.accounts.prize_mint.to_account_info(),
            mint_authority: ctx.accounts.prize_mint.to_account_info(),
            payer: ctx.accounts.winner.to_account_info(),
            metadata: ctx.accounts.metadata.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
        };

        let edition_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_metadata_program.to_account_info(),
            edition_accounts,
            signer_seeds,
        );

        create_master_edition_v3(edition_ctx, Some(0))?;

        raffle.claimed = true;

        Ok(())
    }
}
#[event]
pub struct WinnerChosen {
    pub raffle_id: u64,
    pub winner: Pubkey,
    pub winner_index: u64,
}

#[derive(Accounts)]
pub struct RevealWinner<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
    seeds = [b"raffle", payer.key().as_ref(), &raffle.raffle_id.to_le_bytes()],
bump = raffle.bump,
    )]
    pub raffle: Account<'info, Raffle>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimPrize<'info> {
    #[account(mut)]
    pub raffle: Account<'info, Raffle>,

    #[account(mut)]
    pub winner: Signer<'info>,

    #[account(
        init,
        payer = winner,
        seeds = [b"prize_mint", raffle.key().as_ref()],
        bump,
        mint::decimals = 0,
        mint::authority = prize_mint,
        mint::freeze_authority = prize_mint
    )]
    pub prize_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = winner,
        associated_token::mint = prize_mint,
        associated_token::authority = winner
    )]
    pub winner_ata: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: Metaplex Metadata Program
        #[account(
        mut,
        seeds = [
            b"metadata",
            token_metadata_program.key().as_ref(),
            prize_mint.key().as_ref()
        ],
        bump,
        seeds::program = token_metadata_program.key()
    )]
    pub metadata: UncheckedAccount<'info>,
    /// CHECK: Master Edition Account
        #[account(
        mut,
        seeds = [
            b"metadata",
            token_metadata_program.key().as_ref(),
            prize_mint.key().as_ref(),
            b"edition"
        ],
        bump,
        seeds::program = token_metadata_program.key()
    )]
    pub master_edition: UncheckedAccount<'info>,

    /// CHECK: Metaplex Token Metadata Program
    pub token_metadata_program: UncheckedAccount<'info>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(raffle_id: u64)]
pub struct InitConfig<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + Raffle::INIT_SPACE,
    seeds = [b"raffle", payer.key().as_ref(), &raffle_id.to_le_bytes()],

        bump
    )]
    pub raffle: Account<'info, Raffle>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitRaffle<'info> {
    /// Payer for all inits
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
    seeds = [b"raffle", payer.key().as_ref(), &raffle.raffle_id.to_le_bytes()],

        bump = raffle.bump,
    )]
    pub raffle: Account<'info, Raffle>,

    /// PDA used as mint authority (separate from the mint being created)
    #[account(
        seeds = [b"mint_authority", raffle.key().as_ref()],
        bump
    )]
    /// CHECK: PDA is only used as a signer for CPIs (mint + metadata); no data read/written
    pub mint_authority: UncheckedAccount<'info>,

    /// The collection mint we’re creating (PDA mint)
    #[account(
        init_if_needed,
        payer = payer,
        seeds = [b"collection_mint", raffle.key().as_ref()],
        bump,
        mint::decimals = 0,
        mint::authority = mint_authority,        // ✅ not self
        mint::freeze_authority = mint_authority, // ✅ not self
        mint::token_program = token_program
    )]
    pub collection_mint: InterfaceAccount<'info, Mint>,

    /// ATA to hold the minted supply (owned by the PDA authority)
    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = collection_mint,
        associated_token::authority = mint_authority,
        associated_token::token_program = token_program
    )]
    pub collection_token_account: InterfaceAccount<'info, TokenAccount>,

    /// Metaplex Metadata PDA (derived off the Metaplex program)
    #[account(
        mut,
        seeds = [
            b"metadata",
            token_metadata_program.key().as_ref(),
            collection_mint.key().as_ref()
        ],
        bump,
        seeds::program = token_metadata_program.key()
    )]
    /// CHECK: created & verified by Metaplex CPI
    pub metadata: UncheckedAccount<'info>,

    /// Metaplex Master Edition PDA
    #[account(
        mut,
        seeds = [
            b"metadata",
            token_metadata_program.key().as_ref(),
            collection_mint.key().as_ref(),
            b"edition"
        ],
        bump,
        seeds::program = token_metadata_program.key()
    )]
    /// CHECK: created & verified by Metaplex CPI
    pub master_edition: UncheckedAccount<'info>,

    // Programs
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BuyTickets<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
    seeds = [b"raffle", payer.key().as_ref(), &raffle.raffle_id.to_le_bytes()],

        bump = raffle.bump,
    )]
    pub raffle: Account<'info, Raffle>,

    #[account(
        init_if_needed,
        payer = payer,
        seeds = [ b"ticket_mint",
            raffle.key().as_ref(), raffle.total_num_tickets_bought.to_le_bytes().as_ref()],
        bump,
        mint::decimals = 0,
        mint::authority = raffle,
        mint::freeze_authority = raffle,
        mint::token_program = token_program,
    )]
    pub ticket_mint: InterfaceAccount<'info, Mint>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = ticket_mint,
        associated_token::authority = payer,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [b"collection_mint".as_ref(), raffle.key().as_ref()],
        bump
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]

pub struct CommitRandomness<'info> {
    pub payer: Signer<'info>,

    #[account(
        mut,
    seeds = [b"raffle", payer.key().as_ref(), &raffle.raffle_id.to_le_bytes()],
      bump = raffle.bump,
    )]
    pub raffle: Account<'info, Raffle>,


    // ✅ Optional account — only used in real randomness mode
    pub randomness_data_account: Option<AccountInfo<'info>>,


    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Raffle {
    pub authority: Pubkey,
    pub bump: u8,
    pub raffle_id: u64,
    pub winner: Pubkey,
    pub start_time: u64,
    pub end_time: i64,
     #[max_len(50)]
    pub name: String,
    pub winner_chosen: bool,
    pub is_active: bool,
    pub randomness: [u8; 32],
    pub price: u64,
    pub total_num_tickets_bought: u64,
    #[max_len(100)]
    pub ticket_numbers: Vec<Pubkey>,
    pub max_tickets: u64,
    pub winner_index: Option<u64>,
    pub prize_amount: u64,
    pub claimed: bool,
    pub randomness_committed: bool
}

#[error_code]
pub enum ErrorCode {
    #[msg("Raffle not active")]
    RaffleNotActive,
    #[msg("Ticket limit per user exceeded")]
    TicketLimitPerUserExceeded,
    #[msg("No tickets left")]
    NoTicketsLeft,

    #[msg("Missing bump")]
    MissingBump,

    #[msg("Overflow")]
    Overflow,

    #[msg("Randomness already revealed")]
    RandomnessAlreadyRevealed,

    #[msg("Randomness not resolved")]
    RandomnessNotResolved,

    #[msg("Randomness Not Committed")]
    RandomnessNotCommitted,

    #[msg("Not authorized")]
    NotAuthorized,

    #[msg("Raffle not completed")]
    RaffleNotCompleted,

    #[msg("Raffle still active")]
    RaffleStillActive,

    #[msg("Winner already chosen")]
    WinnerAlreadyChosen,

    #[msg("Winner not chosen")]
    WinnerNotChosen,

    #[msg("No tickets bought")]
    NoTicketsBought,

    #[msg("Invalid ticket data")]
    InvalidTicketData,

    #[msg("Invalid randomness account")]
    InvalidRandomnessAccount,

    #[msg("Invalid randomness data")]
    InvalidRandomness,

    #[msg("Caller is not the winner")]
    NotWinner,
    #[msg("Invalid collection")]
    InvalidCollection,
    #[msg("Already claimed")]
    AlreadyClaimed,
    #[msg("Invalid NFT")]
    InvalidNFT,
    #[msg("Collection not verified")]
    CollectionNotVerified,
    #[msg("Missing randomness account")]
    MissingRandomnessAccount,
}
