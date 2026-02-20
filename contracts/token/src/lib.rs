#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Address, Env, String};

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    PendingAdmin,
    Name,
    Symbol,
    Decimals,
    TotalSupply,
    MaxSupply,
    Balance(Address),
    Allowance(Address, Address), // (owner, spender)
    Frozen(Address),
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

/// SEP-41 Token Contract — base implementation.
///
/// Contributor issues layered on top:
/// - #1  freeze_account / unfreeze_account (guard on transfer)
/// - #2  two-step admin transfer (propose_admin / accept_admin)
/// - #4  max_supply cap enforcement in mint
#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    // ── Initialization ──────────────────────────────────────────────────

    /// Initialize the token with metadata and an initial supply minted to `admin`.
    pub fn initialize(
        env: Env,
        admin: Address,
        decimal: u32,
        name: String,
        symbol: String,
        initial_supply: i128,
        max_supply: Option<i128>,
    ) {
        // Prevent re-initialization
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }

        if let Some(cap) = max_supply {
            assert!(cap > 0, "max_supply must be positive");
            assert!(initial_supply <= cap, "initial_supply exceeds max_supply");
            env.storage().instance().set(&DataKey::MaxSupply, &cap);
        }

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Decimals, &decimal);
        env.storage().instance().set(&DataKey::Name, &name);
        env.storage().instance().set(&DataKey::Symbol, &symbol);
        env.storage().instance().set(&DataKey::TotalSupply, &0i128);

        if initial_supply > 0 {
            Self::_mint(&env, &admin, initial_supply);
        }

        env.events().publish(
            (symbol_short!("init"),),
            admin,
        );
    }

    // ── Admin actions ───────────────────────────────────────────────────

    /// Mint `amount` tokens to `to`. Admin only.
    pub fn mint(env: Env, to: Address, amount: i128) {
        Self::_require_admin(&env);
        assert!(amount > 0, "amount must be positive");
        Self::_mint(&env, &to, amount);
    }

    /// Burn `amount` tokens from `from`. Admin only.
    pub fn burn(env: Env, from: Address, amount: i128) {
        Self::_require_admin(&env);
        assert!(amount > 0, "amount must be positive");
        Self::_burn(&env, &from, amount);
    }

    /// Propose a new admin. Must be called by the current admin.
    /// The new admin must call `accept_admin` to finalize the transfer.
    pub fn propose_admin(env: Env, new_admin: Address) {
        Self::_require_admin(&env);
        env.storage().instance().set(&DataKey::PendingAdmin, &new_admin);
    }

    /// Accept the admin role. Must be called by the pending admin.
    pub fn accept_admin(env: Env) {
        let pending: Address = env
            .storage()
            .instance()
            .get(&DataKey::PendingAdmin)
            .expect("no pending admin");
        pending.require_auth();
        env.storage().instance().set(&DataKey::Admin, &pending);
        env.storage().instance().remove(&DataKey::PendingAdmin);
    }

   /// Transfer admin role instantly.
/// TODO (issue #2): replace with two-step propose_admin / accept_admin.
pub fn set_admin(env: Env, new_admin: Address) {
    Self::_require_admin(&env);
    env.storage().instance().set(&DataKey::Admin, &new_admin);
    env.events().publish(
        (symbol_short!("set_admin"),),
        new_admin,
    );
}

/// Freeze an account, preventing it from sending tokens. Admin only.
pub fn freeze_account(env: Env, addr: Address) {
    Self::_require_admin(&env);
    env.storage().persistent().set(&DataKey::Frozen(addr.clone()), &true);
    env.events().publish((symbol_short!("freeze"), addr), true);
}

/// Unfreeze a previously frozen account. Admin only.
pub fn unfreeze_account(env: Env, addr: Address) {
    Self::_require_admin(&env);
    env.storage().persistent().remove(&DataKey::Frozen(addr.clone()));
    env.events().publish((symbol_short!("freeze"), addr), false);
}

    // ── Token operations ────────────────────────────────────────────────

    /// Transfer `amount` from `from` to `to`. Caller must be `from`.
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();
        assert!(amount > 0, "amount must be positive");
        assert!(!Self::_is_frozen(&env, &from), "account is frozen");

        Self::_transfer(&env, &from, &to, amount);
    }

    /// Approve `spender` to spend up to `amount` on behalf of `from`.
    pub fn approve(env: Env, from: Address, spender: Address, amount: i128, _expiration_ledger: u32) {
        from.require_auth();
        assert!(amount >= 0, "amount must be non-negative");

        let key = DataKey::Allowance(from.clone(), spender.clone());
        env.storage().persistent().set(&key, &amount);

        env.events().publish(
            (symbol_short!("approve"), from, spender),
            amount,
        );
    }

    /// Transfer `amount` from `from` to `to` using `spender`'s allowance.
    pub fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128) {
        spender.require_auth();
        assert!(amount > 0, "amount must be positive");
        assert!(!Self::_is_frozen(&env, &from), "account is frozen");

        let key = DataKey::Allowance(from.clone(), spender.clone());
        let allowance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        assert!(allowance >= amount, "insufficient allowance");

        env.storage().persistent().set(&key, &(allowance - amount));

        Self::_transfer(&env, &from, &to, amount);
    }

    // ── Read-only getters ───────────────────────────────────────────────

    pub fn balance(env: Env, id: Address) -> i128 {
        let key = DataKey::Balance(id);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn allowance(env: Env, from: Address, spender: Address) -> i128 {
        let key = DataKey::Allowance(from, spender);
        env.storage().persistent().get(&key).unwrap_or(0)
    }

    pub fn admin(env: Env) -> Address {
        env.storage().instance().get(&DataKey::Admin).expect("not initialized")
    }

    pub fn decimals(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Decimals).expect("not initialized")
    }

    pub fn name(env: Env) -> String {
        env.storage().instance().get(&DataKey::Name).expect("not initialized")
    }

    pub fn symbol(env: Env) -> String {
        env.storage().instance().get(&DataKey::Symbol).expect("not initialized")
    }

    pub fn total_supply(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0)
    }

    /// Returns `true` if the given address is frozen.
    pub fn is_frozen(env: Env, addr: Address) -> bool {
        env.storage().persistent().get(&DataKey::Frozen(addr)).unwrap_or(false)
    }
  
    pub fn max_supply(env: Env) -> Option<i128> {
        env.storage().instance().get(&DataKey::MaxSupply)
    }

    // ── Internal helpers ────────────────────────────────────────────────

    fn _require_admin(env: &Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).expect("not initialized");
        admin.require_auth();
    }

    fn _is_frozen(env: &Env, addr: &Address) -> bool {
        env.storage().persistent().get(&DataKey::Frozen(addr.clone())).unwrap_or(false)
    }

    fn _mint(env: &Env, to: &Address, amount: i128) {
        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        let new_supply = supply + amount;

        if let Some(cap) = env.storage().instance().get::<DataKey, i128>(&DataKey::MaxSupply) {
            assert!(new_supply <= cap, "mint would exceed max_supply");
        }

        let key = DataKey::Balance(to.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        env.storage().persistent().set(&key, &(balance + amount));

        env.storage().instance().set(&DataKey::TotalSupply, &new_supply);

        env.events().publish((symbol_short!("mint"), to.clone()), amount);
    }

    fn _burn(env: &Env, from: &Address, amount: i128) {
        let key = DataKey::Balance(from.clone());
        let balance: i128 = env.storage().persistent().get(&key).unwrap_or(0);
        assert!(balance >= amount, "insufficient balance to burn");
        env.storage().persistent().set(&key, &(balance - amount));

        let supply: i128 = env.storage().instance().get(&DataKey::TotalSupply).unwrap_or(0);
        env.storage().instance().set(&DataKey::TotalSupply, &(supply - amount));

        env.events().publish((symbol_short!("burn"), from.clone()), amount);
    }

    fn _transfer(env: &Env, from: &Address, to: &Address, amount: i128) {
        let from_key = DataKey::Balance(from.clone());
        let to_key = DataKey::Balance(to.clone());

        let from_balance: i128 = env.storage().persistent().get(&from_key).unwrap_or(0);
        assert!(from_balance >= amount, "insufficient balance");

        env.storage().persistent().set(&from_key, &(from_balance - amount));

        let to_balance: i128 = env.storage().persistent().get(&to_key).unwrap_or(0);
        env.storage().persistent().set(&to_key, &(to_balance + amount));

        env.events().publish(
            (symbol_short!("transfer"), from.clone(), to.clone()),
            amount,
        );
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env, IntoVal};

    fn setup() -> (Env, TokenContractClient<'static>, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TokenContract);
        let client = TokenContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "TestToken"),
            &String::from_str(&env, "TST"),
            &1_000_000_0000000i128, // 1M tokens with 7 decimals
            &None,
        );

        (env, client, admin, user)
    }

    #[test]
    fn test_initialize_and_getters() {
        let (env, client, admin, _) = setup();
        assert_eq!(client.name(), String::from_str(&env, "TestToken"));
        assert_eq!(client.symbol(), String::from_str(&env, "TST"));
        assert_eq!(client.decimals(), 7u32);
        assert_eq!(client.admin(), admin.clone());
        assert_eq!(client.total_supply(), 1_000_000_0000000i128);
        assert_eq!(client.balance(&admin), 1_000_000_0000000i128);
    }

    #[test]
    #[should_panic(expected = "already initialized")]
    fn test_double_init_panics() {
        let (env, client, admin, _) = setup();
        client.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "Dup"),
            &String::from_str(&env, "DUP"),
            &0i128,
            &None,
        );
    }

    #[test]
    fn test_mint() {
        let (_, client, admin, user) = setup();
        client.mint(&user, &500_0000000i128);
        assert_eq!(client.balance(&user), 500_0000000i128);
        assert_eq!(client.total_supply(), 1_000_000_0000000i128 + 500_0000000i128);
        // admin balance unchanged
        assert_eq!(client.balance(&admin), 1_000_000_0000000i128);
    }

    #[test]
    fn test_burn() {
        let (_, client, admin, _) = setup();
        client.burn(&admin, &100_0000000i128);
        assert_eq!(client.balance(&admin), 1_000_000_0000000i128 - 100_0000000i128);
        assert_eq!(client.total_supply(), 1_000_000_0000000i128 - 100_0000000i128);
    }

    #[test]
    #[should_panic(expected = "insufficient balance to burn")]
    fn test_burn_insufficient() {
        let (_, client, _, user) = setup();
        client.burn(&user, &1i128);
    }

    #[test]
    fn test_transfer() {
        let (_, client, admin, user) = setup();
        client.transfer(&admin, &user, &250_0000000i128);
        assert_eq!(client.balance(&admin), 1_000_000_0000000i128 - 250_0000000i128);
        assert_eq!(client.balance(&user), 250_0000000i128);
        // total supply unchanged
        assert_eq!(client.total_supply(), 1_000_000_0000000i128);
    }

    #[test]
    #[should_panic(expected = "insufficient balance")]
    fn test_transfer_insufficient() {
        let (_, client, _, user) = setup();
        client.transfer(&user, &user, &1i128);
    }

    #[test]
    fn test_approve_and_transfer_from() {
        let (env, client, admin, user) = setup();
        let spender = Address::generate(&env);

        client.approve(&admin, &spender, &100_0000000i128, &0u32);
        assert_eq!(client.allowance(&admin, &spender), 100_0000000i128);

        client.transfer_from(&spender, &admin, &user, &60_0000000i128);
        assert_eq!(client.allowance(&admin, &spender), 40_0000000i128);
        assert_eq!(client.balance(&user), 60_0000000i128);
        assert_eq!(client.balance(&admin), 1_000_000_0000000i128 - 60_0000000i128);
    }

    #[test]
    #[should_panic(expected = "insufficient allowance")]
    fn test_transfer_from_exceeds_allowance() {
        let (env, client, admin, user) = setup();
        let spender = Address::generate(&env);

        client.approve(&admin, &spender, &10i128, &0u32);
        client.transfer_from(&spender, &admin, &user, &11i128);
    }

    #[test]
    fn test_propose_and_accept_admin() {
        let (_, client, _, user) = setup();
        client.propose_admin(&user);
        // Admin has not changed yet
        assert_ne!(client.admin(), user);
        client.accept_admin();
        assert_eq!(client.admin(), user);
    }

    #[test]
    #[should_panic(expected = "no pending admin")]
    fn test_accept_admin_without_proposal() {
        let (_, client, _, _) = setup();
        client.accept_admin();
    }

    #[test]
    fn test_propose_admin_overwrites_previous() {
        let (env, client, _, user) = setup();
        let other = Address::generate(&env);
        client.propose_admin(&user);
        client.propose_admin(&other);
        client.accept_admin();
        assert_eq!(client.admin(), other);
    }

    #[test]
    fn test_old_admin_retains_role_until_accepted() {
        let (_, client, admin, user) = setup();
        client.propose_admin(&user);
        // Admin can still mint before acceptance
        client.mint(&user, &1i128);
        assert_eq!(client.admin(), admin);
    }
  
    // ── Freeze / Unfreeze tests ─────────────────────────────────────────

    #[test]
    fn test_freeze_and_is_frozen() {
        let (_, client, _, user) = setup();
        assert!(!client.is_frozen(&user));
        client.freeze_account(&user);
        assert!(client.is_frozen(&user));
    }

    #[test]
    #[should_panic(expected = "account is frozen")]
    fn test_frozen_transfer_blocked() {
        let (_, client, admin, user) = setup();
        client.transfer(&admin, &user, &1000i128);
        client.freeze_account(&user);
        // This should panic because `user` is frozen.
        client.transfer(&user, &admin, &500i128);
    }

    #[test]
    #[should_panic(expected = "account is frozen")]
    fn test_frozen_transfer_from_blocked() {
        let (env, client, admin, user) = setup();
        let spender = Address::generate(&env);
        // Give user some tokens and approve spender.
        client.transfer(&admin, &user, &1000i128);
        client.approve(&user, &spender, &1000i128, &0u32);
        // Freeze user, then attempt transfer_from.
        client.freeze_account(&user);
        client.transfer_from(&spender, &user, &admin, &500i128);
    }

    #[test]
    fn test_unfreeze_restores_transfer() {
        let (_, client, admin, user) = setup();
        client.transfer(&admin, &user, &1000i128);
        client.freeze_account(&user);
        assert!(client.is_frozen(&user));
        client.unfreeze_account(&user);
        assert!(!client.is_frozen(&user));
        // Transfer should now succeed.
        client.transfer(&user, &admin, &500i128);
        assert_eq!(client.balance(&user), 500i128);
    }

    #[test]
    #[should_panic]
    fn test_non_admin_cannot_freeze() {
        let env = Env::default();
        // Do NOT mock all auths — we want real auth checks.
        let contract_id = env.register_contract(None, TokenContract);
        let client = TokenContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        env.mock_all_auths();
        client.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "TestToken"),
            &String::from_str(&env, "TST"),
            &0i128,
        );

        // Remove mock — only user will auth, not admin.
        env.mock_auths(&[
            soroban_sdk::testutils::MockAuth {
                address: &user,
                invoke: &soroban_sdk::testutils::MockAuthInvoke {
                    contract: &contract_id,
                    fn_name: "freeze_account",
                    args: (&user,).into_val(&env),
                    sub_invokes: &[],
                },
            },
        ]);
        // Should panic — user is not admin.
        client.freeze_account(&user);
    }
    // ── max_supply tests ────────────────────────────────────────────────    
    fn setup_with_cap() -> (Env, TokenContractClient<'static>, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TokenContract);
        let client = TokenContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let user = Address::generate(&env);

        client.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "CappedToken"),
            &String::from_str(&env, "CAP"),
            &500_0000000i128,
            &Some(1_000_0000000i128),
        );

        (env, client, admin, user)
    }

    #[test]
    fn test_max_supply_getter_none() {
        let (_, client, _, _) = setup();
        assert_eq!(client.max_supply(), None);
    }

    #[test]
    fn test_max_supply_getter_some() {
        let (_, client, _, _) = setup_with_cap();
        assert_eq!(client.max_supply(), Some(1_000_0000000i128));
    }

    #[test]
    fn test_mint_within_max_supply() {
        let (_, client, _, user) = setup_with_cap();
        client.mint(&user, &500_0000000i128);
        assert_eq!(client.total_supply(), 1_000_0000000i128);
    }

    #[test]
    #[should_panic(expected = "mint would exceed max_supply")]
    fn test_mint_exceeds_max_supply() {
        let (_, client, _, user) = setup_with_cap();
        client.mint(&user, &500_0000001i128);
    }

    #[test]
    fn test_mint_exact_max_supply() {
        let (_, client, _, user) = setup_with_cap();
        // Mint exactly to the cap boundary
        client.mint(&user, &500_0000000i128);
        assert_eq!(client.total_supply(), 1_000_0000000i128);
        assert_eq!(client.max_supply(), Some(1_000_0000000i128));
    }

    #[test]
    #[should_panic(expected = "initial_supply exceeds max_supply")]
    fn test_initial_supply_exceeds_max_supply() {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register_contract(None, TokenContract);
        let client = TokenContractClient::new(&env, &contract_id);
        let admin = Address::generate(&env);

        client.initialize(
            &admin,
            &7u32,
            &String::from_str(&env, "Bad"),
            &String::from_str(&env, "BAD"),
            &2_000_0000000i128,
            &Some(1_000_0000000i128),
        );
    }
}
