# Event Schema

All state-changing operations in the token and vesting contracts emit structured
Soroban events. Each event uses `env.events().publish(topics, data)` where
**topics** is a tuple whose first element is the event name (a `symbol_short!`
value) and **data** carries the payload.

---

## Token Contract

| Function | Topic 0 | Topic 1 | Topic 2 | Data |
|---|---|---|---|---|
| `initialize` | `init` | — | — | `admin: Address` |
| `mint` | `mint` | `to: Address` | — | `amount: i128` |
| `burn` | `burn` | `from: Address` | — | `amount: i128` |
| `set_admin` | `set_admin` | — | — | `new_admin: Address` |
| `transfer` | `transfer` | `from: Address` | `to: Address` | `amount: i128` |
| `approve` | `approve` | `owner: Address` | `spender: Address` | `amount: i128` |
| `transfer_from` | `transfer` | `from: Address` | `to: Address` | `amount: i128` |

> `transfer_from` re-uses the `transfer` event emitted by the internal
> `_transfer` helper because the observable balance change is identical to a
> direct transfer. The allowance deduction is an implementation detail visible
> through the `allowance` getter.

---

## Vesting Contract

| Function | Topic 0 | Topic 1 | Data |
|---|---|---|---|
| `initialize` | `init` | — | `(admin: Address, token_contract: Address)` |
| `create_schedule` | `create` | `recipient: Address` | `total_amount: i128` |
| `release` | `release` | `recipient: Address` | `releasable: i128` |

> `revoke` is not yet implemented (tracked by issue #3). Its event should be
> added when the function is built.

---

### Conventions

- Topic 0 is always the event name as a `symbol_short!` value.
- Subsequent topics carry the primary addresses involved in the operation.
- The data slot carries amounts or composite tuples when multiple values are
  relevant (e.g. the vesting `init` event).
- All amounts are `i128` and follow the token's decimal precision.
