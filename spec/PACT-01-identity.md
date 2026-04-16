# PACT-01: Agent Identity
**Protocol for Agent Capability and Trust — Layer 1 of 3**

```
Status:   DRAFT
Version:  0.1.0
Date:     2026-04-15
License:  CC0 (public domain)
```

---

## Abstract

An agent is a keypair. This document defines how that keypair becomes a verifiable, portable, self-describing identity requiring zero infrastructure to create and zero central authority to verify.

---

## 1. The Axiom

> Identity is a public key. Everything else is metadata.

No registration. No server. No issuer. Generate a keypair — you have an agent identity. Lose the private key — the identity is gone. This is a feature, not a bug.

---

## 2. Key Requirements

**Algorithm:** Ed25519 (RFC 8032)

Rationale: 64-byte signatures, 32-byte public keys, fast verification, implemented in every language worth caring about. No parameter choices to get wrong.

An implementation MUST:
- Generate keys using a cryptographically secure random number generator
- Store private keys outside this protocol's scope (that's your problem)
- Never transmit private keys

---

## 3. Agent Identifier Format

Agents are identified using `did:key` (W3C, no server required).

```
did:key:z6Mk[base58btc-encoded-public-key]
```

Example:
```
did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
```

The `z` prefix signals base58btc multicodec encoding. For Ed25519, the multicodec prefix is `0xed01`.

Encoding steps:
1. Take the 32-byte Ed25519 public key
2. Prepend multicodec prefix bytes `[0xed, 0x01]`
3. Encode with base58btc
4. Prepend `z`
5. Prepend `did:key:`

This is deterministic — the same public key always produces the same DID. No lookup required.

---

## 4. Agent Document

An Agent Document is a JSON object describing an agent's identity and capabilities. It is unsigned — trust comes from the DID binding, not the document itself.

```json
{
  "pact": "0.1.0",
  "id": "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK",
  "created": "2026-04-15T00:00:00Z",
  "name": "my-agent",
  "description": "optional human-readable description",
  "endpoint": "https://example.com/agent",
  "capabilities": ["pact:tool-use", "pact:memory-read"]
}
```

Fields:

| Field | Required | Description |
|-------|----------|-------------|
| `sap` | YES | Protocol version |
| `id` | YES | The agent's DID |
| `created` | YES | ISO 8601 UTC timestamp |
| `name` | NO | Human-readable label |
| `description` | NO | Free text |
| `endpoint` | NO | Where to send messages (PACT-02) |
| `capabilities` | NO | What this agent claims to support |

Capability strings are namespaced. The `pact:` namespace is reserved for this protocol. Other namespaces are permitted (`mcp:`, `a2a:`, etc.).

Agent Documents SHOULD be published at:
```
[endpoint]/.well-known/sap-agent.json
```

They MAY be distributed through any other mechanism — there is no required registry.

---

## 5. Signing

All SAP messages (defined in PACT-02) are signed using the agent's Ed25519 private key. Signatures are over the UTF-8 encoded canonical JSON of the message body.

Canonical JSON rules (minimal, no library required):
- Keys sorted lexicographically
- No whitespace outside strings
- UTF-8 encoding
- No trailing commas

Signature encoding: base64url (no padding)

Verification: given a message, a signature, and a public key derivable from the sender's DID — verify without any network call.

---

## 6. What This Layer Does NOT Cover

- How agents communicate (PACT-02)
- How agents delegate authority (PACT-02)
- How agents share memory (PACT-03)
- Key recovery (out of scope — use your own backup strategy)
- Revocation (handled at the warrant level in PACT-02, not at identity)

---

## 7. Reference Implementation

A minimal conforming implementation requires:

```
keygen()         → { publicKey: bytes[32], privateKey: bytes[64] }
did_from_key(pk) → string
sign(message, sk) → bytes[64]
verify(message, signature, pk) → bool
```

No dependencies beyond an Ed25519 library. Approximately 50 lines in any language.

---

## 8. Design Decisions

**Why did:key and not did:web?**
`did:web` requires DNS, HTTPS, and a running server. `did:key` requires nothing. We optimize for the case where agents run anywhere — including offline, edge, or personal devices. Interoperability with `did:web` agents is possible at the message layer (PACT-02) since both resolve to a public key.

**Why not a blockchain-based DID?**
Blockchain DID methods (did:ion, did:ethr) provide global revocation and key rotation. We deliberately defer those to the warrant layer (PACT-02). The identity layer should be stateless and fast. If you need on-chain identity, wrap this layer — don't replace it.

**Why no central registry?**
Registries are choke points. They go down, they get captured, they require permission to join. The whole point of this protocol is that participation is permissionless. Discovery is a separate concern handled by publishing Agent Documents to known endpoints.

---

## 9. Relationship to Existing Standards

| Concern | PACT-01 approach | Existing standard deferred to |
|---------|----------------|-------------------------------|
| Key algorithm | Ed25519 | RFC 8032 |
| DID format | did:key | W3C DID Core 1.1 |
| Signature format | Ed25519 over canonical JSON | RFC 8037 |
| Encoding | base58btc, base64url | Multibase |

PACT-01 does not reinvent any cryptographic primitive. It only specifies which ones to use and how to combine them.

---

## 10. Next Documents

- **PACT-02: Capability Warrants** — how agents delegate authority to other agents using signed, attenuatable capability tokens
- **PACT-03: Memory Facts** — how agents share portable, verifiable context using content-addressed typed facts

---

*End of PACT-01.*
