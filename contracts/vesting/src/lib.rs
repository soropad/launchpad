#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env};

// ---------------------------------------------------------------------------
// Storage types
// ---------------------------------------------------------------------------

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    TokenContract,
    Schedule(Address),
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct VestingSchedule {
    pub recipient: Address,
    pub total_amount: i128,
    pub cliff_ledger: u32,
    pub end_ledger: u32,
    pub released: i128,
    pub revoked: bool,
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/// Vesting Contract — cliff + linear unlock schedules.
///
/// Contributor issues layered on top:
/// - #3  revoke() — admin reclaims unvested tokens
/// - #5  structured events audit
#[contract]
pub struct VestingContract;

#[contractimpl]
impl VestingContract {
    // ── Initialization ──────────────────────────────────────────────────

    /// Set the admin and the token contract this vesting module manages.
    pub fn initialize(env: Env, admin: Address, token_contract: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage()
            .instance()
            .set(&DataKey::TokenContract, &token_contract);

        env.events().publish(
            (symbol_short!("init"),),
            (admin, token_contract),
        );
    }

    // ── Admin actions ───────────────────────────────────────────────────

    /// Create a cliff + linear vesting schedule for `recipient`.
    ///
    /// `cliff_ledger` — ledger number when tokens start unlocking.
    /// `end_ledger`   — ledger number when 100 % is vested.
    ///
    /// The caller (admin) must have already transferred `total_amount` tokens
    /// to this contract's address before calling this function.
    pub fn create_schedule(
        env: Env,
        recipient: Address,
        total_amount: i128,
        cliff_ledger: u32,
        end_ledger: u32,
    ) {
        Self::_require_admin(&env);
        assert!(total_amount > 0, "total_amount must be positive");
        assert!(
            end_ledger > cliff_ledger,
            "end_ledger must be after cliff_ledger"
        );

        let key = DataKey::Schedule(recipient.clone());
        if env.storage().persistent().has(&key) {
            panic!("schedule already exists for this recipient");
        }

        let schedule = VestingSchedule {
            recipient: recipient.clone(),
            total_amount,
            cliff_ledger,
            end_ledger,
            released: 0,
            revoked: false,
        };

        env.storage().persistent().set(&key, &schedule);

        env.events().publish(
            (symbol_short!("create"), recipient),
            total_amount,
        );
    }

    /// Release all currently vested (but unreleased) tokens to the recipient.
    /// Can be called by anyone.
    pub fn release(env: Env, recipient: Address) {
        let key = DataKey::Schedule(recipient.clone());
        let mut schedule: VestingSchedule = env
            .storage()
            .persistent()
            .get(&key)
            .expect("no schedule found");

        assert!(!schedule.revoked, "schedule has been revoked");

        let vested = Self::_vested_amount(&env, &schedule);
        let releasable = vested - schedule.released;
        assert!(releasable > 0, "nothing to release");

        schedule.released += releasable;
        env.storage().persistent().set(&key, &schedule);

        // Transfer tokens from the vesting contract to the recipient via
        // the token contract's transfer function.
        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenContract)
            .expect("not initialized");

        let token_client = soroban_sdk::token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &recipient, &releasable);

        env.events().publish(
            (symbol_short!("release"), recipient),
            releasable,
        );
    }

    /// Admin-only: revoke a schedule, send vested portion to recipient,
    /// return unvested remainder to admin.
    ///
    /// TODO (issue #3): implement revoke logic
    pub fn revoke(env: Env, recipient: Address) {
        Self::_require_admin(&env);

        let key = DataKey::Schedule(recipient.clone());
        let mut schedule: VestingSchedule = env
            .storage()
            .persistent()
            .get(&key)
            .expect("no schedule found");

        assert!(!schedule.revoked, "schedule already revoked");

        let vested = Self::_vested_amount(&env, &schedule);
        let releasable = vested - schedule.released;
        let unvested = schedule.total_amount - vested;

        // Update schedule state
        schedule.revoked = true;
        schedule.released = vested; // All vested tokens are now accounted for as released (or being released)
        env.storage().persistent().set(&key, &schedule);

        let token_addr: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenContract)
            .expect("not initialized");

        let token_client = soroban_sdk::token::Client::new(&env, &token_addr);

        // 1. Transfer releasable vested tokens to recipient
        if releasable > 0 {
            token_client.transfer(&env.current_contract_address(), &recipient, &releasable);
        }

        // 2. Transfer unvested tokens back to admin
        if unvested > 0 {
            let admin: Address = env
                .storage()
                .instance()
                .get(&DataKey::Admin)
                .expect("not initialized");
            token_client.transfer(&env.current_contract_address(), &admin, &unvested);
        }

        env.events().publish(
            (symbol_short!("revoke"), recipient),
            (releasable, unvested),
        );
    }

    // ── Read-only queries ───────────────────────────────────────────────

    /// Total amount vested so far (may or may not have been released).
    pub fn vested_amount(env: Env, recipient: Address) -> i128 {
        let key = DataKey::Schedule(recipient);
        let schedule: VestingSchedule = env
            .storage()
            .persistent()
            .get(&key)
            .expect("no schedule found");
        Self::_vested_amount(&env, &schedule)
    }

    /// Amount already released to the recipient.
    pub fn released_amount(env: Env, recipient: Address) -> i128 {
        let key = DataKey::Schedule(recipient);
        let schedule: VestingSchedule = env
            .storage()
            .persistent()
            .get(&key)
            .expect("no schedule found");
        schedule.released
    }

    /// Return the full schedule struct for a recipient.
    pub fn get_schedule(env: Env, recipient: Address) -> VestingSchedule {
        let key = DataKey::Schedule(recipient);
        env.storage()
            .persistent()
            .get(&key)
            .expect("no schedule found")
    }

    // ── Internals ───────────────────────────────────────────────────────

    fn _require_admin(env: &Env) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .expect("not initialized");
        admin.require_auth();
    }

    /// Cliff + linear vesting formula.
    ///
    /// - Before cliff → 0
    /// - Between cliff and end → proportional
    /// - After end → total_amount
    fn _vested_amount(env: &Env, schedule: &VestingSchedule) -> i128 {
        let current = env.ledger().sequence();

        if current < schedule.cliff_ledger {
            return 0;
        }
        if current >= schedule.end_ledger {
            return schedule.total_amount;
        }

        // Linear interpolation between cliff and end
        let elapsed = (current - schedule.cliff_ledger) as i128;
        let duration = (schedule.end_ledger - schedule.cliff_ledger) as i128;
        schedule.total_amount * elapsed / duration
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, testutils::Ledger, Env};

    // We don't use the token_client import in tests — we test the vesting
    // schedule logic in isolation. The `release` function (which calls the
    // token) would be tested in integration tests.

    fn setup_schedule(env: &Env, client: &VestingContractClient) -> (Address, Address) {
        let admin = Address::generate(env);
        let recipient = Address::generate(env);
        
        // Register a mock token contract
        let token = env.register_stellar_asset_contract(admin.clone());
        let token_client = soroban_sdk::token::StellarAssetClient::new(env, &token);
        
        // Mint tokens to the vesting contract
        token_client.mint(&client.address, &1_000_000i128);

        client.initialize(&admin, &token);

        // cliff at ledger 100, fully vested at ledger 200
        client.create_schedule(&recipient, &1_000i128, &100u32, &200u32);

        (admin, recipient)
    }

    #[test]
    fn test_initialize() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        client.initialize(&admin, &token);
        // No panic = success
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_init() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let token = Address::generate(&env);
        client.initialize(&admin, &token);
        client.initialize(&admin, &token);
    }

    #[test]
    fn test_create_schedule_and_getters() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        let schedule = client.get_schedule(&recipient);
        assert_eq!(schedule.total_amount, 1_000);
        assert_eq!(schedule.cliff_ledger, 100);
        assert_eq!(schedule.end_ledger, 200);
        assert_eq!(schedule.released, 0);
        assert!(!schedule.revoked);
    }

    #[test]
    fn test_vested_before_cliff() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        // Ledger 50 — before cliff
        env.ledger().set_sequence_number(50);
        assert_eq!(client.vested_amount(&recipient), 0);
    }

    #[test]
    fn test_vested_at_cliff() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        // Ledger 100 — exactly at cliff: 0% of (100→200) elapsed
        env.ledger().set_sequence_number(100);
        assert_eq!(client.vested_amount(&recipient), 0);
    }

    #[test]
    fn test_vested_midway() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        // Ledger 150 — 50% vested
        env.ledger().set_sequence_number(150);
        assert_eq!(client.vested_amount(&recipient), 500);
    }

    #[test]
    fn test_vested_at_end() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        // Ledger 200 — fully vested
        env.ledger().set_sequence_number(200);
        assert_eq!(client.vested_amount(&recipient), 1_000);
    }

    #[test]
    fn test_vested_after_end() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        // Ledger 300 — past end, still capped at total
        env.ledger().set_sequence_number(300);
        assert_eq!(client.vested_amount(&recipient), 1_000);
    }

    #[test]
    fn test_released_amount_initial() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        assert_eq!(client.released_amount(&recipient), 0);
    }

    #[test]
    #[should_panic(expected = "schedule already exists")]
    fn test_duplicate_schedule_panics() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        // Try to create a second schedule for the same recipient
        client.create_schedule(&recipient, &500i128, &100u32, &200u32);
    }

    #[test]
    fn test_revoke_midway() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        // Ledger 150 — 50% vested (500 tokens)
        env.ledger().set_sequence_number(150);
        
        // Revoke
        client.revoke(&recipient);

        let schedule = client.get_schedule(&recipient);
        assert!(schedule.revoked);
        assert_eq!(schedule.released, 500);

        // Verify release panics
        let res = client.try_release(&recipient);
        assert!(res.is_err());
    }

    #[test]
    fn test_revoke_before_cliff() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        // Ledger 50 — nothing vested
        env.ledger().set_sequence_number(50);
        
        client.revoke(&recipient);

        let schedule = client.get_schedule(&recipient);
        assert!(schedule.revoked);
        assert_eq!(schedule.released, 0);
    }

    #[test]
    fn test_revoke_after_end() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        // Ledger 250 — fully vested
        env.ledger().set_sequence_number(250);
        
        client.revoke(&recipient);

        let schedule = client.get_schedule(&recipient);
        assert!(schedule.revoked);
        assert_eq!(schedule.released, 1_000);
    }

    #[test]
    #[should_panic(expected = "schedule already revoked")]
    fn test_double_revoke_panics() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        let (_, recipient) = setup_schedule(&env, &client);

        client.revoke(&recipient);
        client.revoke(&recipient);
    }

    #[test]
    #[should_panic] // require_auth will fail
    fn test_revoke_non_admin_panics() {
        let env = Env::default();
        // Do NOT mock auths here to test requirement
        
        let contract_id = env.register_contract(None, VestingContract);
        let client = VestingContractClient::new(&env, &contract_id);
        
        let admin = Address::generate(&env);
        let recipient = Address::generate(&env);
        let token = Address::generate(&env);

        client.initialize(&admin, &token);
        
        // This should fail because we haven't mocked auth for admin
        client.revoke(&recipient);
    }
}
