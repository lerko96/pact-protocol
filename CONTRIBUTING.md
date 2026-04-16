# Contributing to PACT

PACT is CC0. No CLA, no copyright assignment. Contributions welcome in any form.

---

## Implementing the spec in a new language

A conforming implementation must:

1. **PACT-01**: Generate Ed25519 keypairs, encode as `did:key:z6Mk...` (multicodec prefix `0xed01` + base58btc), sign/verify over canonical JSON (keys sorted, no whitespace).

2. **PACT-02**: Issue warrants (signed JSON with `issuer`, `subject`, `capabilities`, `expires`, `delegable`, `parent`, `signature`), verify single warrants, verify full chains (attenuation check: child expires ≤ parent, child capabilities ⊆ parent), sign and verify message envelopes with ±5 minute clock skew tolerance.

3. **PACT-03**: Create content-addressed facts (CIDv1, SHA-256, raw codec), verify fact signatures and CID integrity, implement merge semantics (additive, no deletes), export/import fact sets.

Read the three spec documents first — they contain the full algorithm in ~30 minutes of reading.

When your implementation is ready, open a pull request adding it to the `implementations/` directory (or a separate repo linked from here) and update the table in `README.md`.

---

## Proposing a spec change

Open an issue with the `spec` label. Include:

- Which document the change affects (PACT-01, PACT-02, PACT-03)
- The problem the change solves
- A proposed diff or description of the change
- Any backward compatibility concerns

Breaking changes require strong justification — the spec's value is its stability.

---

## Reporting spec errors

Open an issue with the `spec-error` label. Describe the ambiguity or inconsistency, quote the relevant passage, and suggest the intended behavior.

---

## Reporting security issues

See [SECURITY.md](./SECURITY.md).
