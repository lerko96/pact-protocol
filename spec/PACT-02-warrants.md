# PACT-02: Warrants
**Protocol for Agent Capability and Trust — Layer 2 of 3**

```
Status:   DRAFT
Version:  0.1.0
Date:     2026-04-15
License:  CC0 (public domain)
```

---

## Abstract

A warrant is a signed, time-bounded, attenuatable delegation of capability from one agent to another. This document defines the warrant format, the delegation rules, the message envelope that carries warrants, and the user root trust model.

---

## 1. The Axiom

> Authority flows downward from a human root. No agent can grant more than it holds.

---

## 2. Trust Root

Every warrant chain MUST terminate at a **user agent** — a keypair whose private key lives on a device controlled by a human.

A user agent is structurally identical to any other PACT-01 agent. The distinction is social, not cryptographic: the user agent is the one whose private key the human controls directly. It issues the first warrant in every chain.

There is no global registry of user agents. The termination condition is local: you trust a chain if and only if you trust the root key that signed it.

---

## 3. The Warrant

```json
{
  "pact": "0.1.0",
  "type": "warrant",
  "id": "urn:uuid:550e8400-e29b-41d4-a716-446655440000",
  "issuer": "did:key:z6MkIssuer...",
  "subject": "did:key:z6MkSubject...",
  "issued": "2026-04-15T00:00:00Z",
  "expires": "2026-04-15T01:00:00Z",
  "capabilities": [
    {
      "action": "pact:tool-use",
      "resource": "mcp://tools/web-search",
      "constraints": { "max_calls": 100 }
    }
  ],
  "delegable": false,
  "parent": "urn:uuid:parent-warrant-id-or-null",
  "signature": "base64url-encoded-ed25519-signature"
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `pact` | YES | Protocol version |
| `type` | YES | Always `"warrant"` |
| `id` | YES | UUID v4, globally unique |
| `issuer` | YES | DID of the granting agent |
| `subject` | YES | DID of the receiving agent |
| `issued` | YES | ISO 8601 UTC, when signed |
| `expires` | YES | ISO 8601 UTC, hard expiry |
| `capabilities` | YES | Array of capability grants (see §4) |
| `delegable` | YES | Whether subject may re-delegate |
| `parent` | YES | Parent warrant ID, or `null` for root |
| `signature` | YES | Ed25519 signature over canonical JSON of all other fields |

### Invariants

A verifier MUST reject a warrant if:
- The signature does not verify against the issuer's public key
- `expires` is in the past
- Any capability exceeds what the issuer's own warrant grants
- `delegable` is `false` on the parent but the child warrant exists
- The chain does not terminate at a trusted root

---

## 4. Capabilities

A capability grant specifies what the subject may do.

```json
{
  "action": "pact:tool-use",
  "resource": "mcp://tools/web-search",
  "constraints": {}
}
```

**`action`** — namespaced string. Reserved `pact:` actions:

| Action | Meaning |
|--------|---------|
| `pact:tool-use` | Invoke tools via MCP |
| `pact:agent-call` | Send messages to other agents via A2A |
| `pact:memory-read` | Read PACT-03 facts |
| `pact:memory-write` | Assert PACT-03 facts |
| `pact:delegate` | Issue warrants to sub-agents |

Other namespaces are permitted. Unknown actions MUST be rejected by default.

**`resource`** — URI identifying the specific resource. Wildcards permitted:
- `mcp://tools/web-search` — specific tool
- `mcp://tools/*` — all tools on an MCP server
- `*` — any resource for this action (use with caution)

**`constraints`** — optional key-value pairs narrowing the grant. Constraint keys are action-specific. A verifier that does not understand a constraint key MUST reject the warrant.

### Attenuation Rule

When Agent A delegates to Agent B:
- B's `action` set MUST be a subset of A's
- B's `resource` set MUST be a subset of A's
- B's `expires` MUST be ≤ A's `expires`
- B's `constraints` MUST be equal to or stricter than A's
- B's `delegable` MUST be `false` if A's `delegable` is `false`

These rules are enforced by the verifier, not the issuer. Issuers are untrusted.

---

## 5. The Envelope

Every PACT message is wrapped in a signed envelope. The envelope carries the warrant chain proving the sender is authorized to send.

```json
{
  "pact": "0.1.0",
  "type": "message",
  "id": "urn:uuid:message-uuid",
  "from": "did:key:z6MkSender...",
  "to": "did:key:z6MkRecipient...",
  "sent": "2026-04-15T00:00:00Z",
  "warrants": [
    { ...warrant-n... },
    { ...warrant-n-minus-1... },
    { ...root-warrant... }
  ],
  "payload": {
    "type": "mcp:tool-call",
    "body": {}
  },
  "signature": "base64url-encoded-ed25519-signature-over-canonical-json"
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `pact` | YES | Protocol version |
| `type` | YES | Always `"message"` |
| `id` | YES | UUID v4 |
| `from` | YES | Sender's DID |
| `to` | YES | Recipient's DID |
| `sent` | YES | ISO 8601 UTC |
| `warrants` | YES | Full chain, leaf first, root last |
| `payload` | YES | Opaque content (see §6) |
| `signature` | YES | Sender signs over all other fields |

The signature is the sender's proof that they authored this message. The warrants are the proof they're authorized to send it. Both are required.

---

## 6. Payload Types

The `payload.type` field is namespaced. The `payload.body` is opaque to PACT — the receiving agent interprets it.

Built-in types:

| Type | Description |
|------|-------------|
| `pact:warrant-request` | Ask issuer to sign a new warrant |
| `pact:warrant-revoke` | Notify of revocation (advisory) |
| `mcp:tool-call` | MCP tool invocation |
| `mcp:tool-result` | MCP tool response |
| `a2a:task` | A2A task delegation |
| `a2a:task-result` | A2A task response |
| `pact:fact` | PACT-03 memory fact assertion |

Any payload type is permitted. Unknown types SHOULD be logged and MAY be rejected.

---

## 7. Warrant Lifecycle

### Issuance

1. User agent generates root warrant (`parent: null`) for a delegate agent
2. Root warrant SHOULD have the narrowest scope and shortest TTL that meets the use case
3. Delegate agent stores warrant locally — no registration required

### Pre-issuance for offline operation

The user MAY sign a batch of warrants at setup time, covering anticipated agent needs. Agents consume these without the user being online. TTLs enforce eventual re-authorization.

Example: user signs 24 one-hour warrants covering a day of autonomous operation. Agents cycle through them. At day's end, re-authorization required.

### Revocation

PACT uses **advisory revocation** — there is no mandatory revocation infrastructure.

A revoking agent SHOULD:
1. Broadcast a signed `pact:warrant-revoke` message to known recipients
2. Stop honoring the revoked warrant's downstream messages

Receivers SHOULD maintain a local revocation list. They are not required to check a central service.

Hard revocation is achieved by key rotation: if the user rotates their root keypair, all downstream warrants become unverifiable and are therefore invalid. This is the nuclear option and is always available.

---

## 8. Verification Algorithm

Given an incoming envelope, a verifier MUST:

```
1. Verify envelope signature against sender's public key (from DID)
2. Check envelope `sent` is within acceptable clock skew (±5 minutes)
3. Extract warrant chain from envelope
4. Verify leaf warrant:
   a. Signature valid against issuer's public key
   b. `expires` in the future
   c. `subject` matches envelope `from`
5. Walk chain to root:
   a. Each warrant's `issuer` matches parent warrant's `subject`
   b. Attenuation rules satisfied at every step
   c. Root warrant has `parent: null`
6. Verify root issuer is a trusted user agent
7. Verify payload action/resource is covered by leaf warrant capabilities
8. Check local revocation list
9. Accept or reject
```

Steps are ordered by cost — cheapest checks first.

---

## 9. What This Layer Does NOT Cover

- Transport (use HTTP, WebSocket, whatever — PACT-02 is transport-agnostic)
- Agent discovery (publish your PACT-01 Agent Document somewhere findable)
- Memory portability (PACT-03)
- Economic settlement (out of scope for this version)

---

## 10. Reference Implementation

Minimum conforming implementation:

```
issue_warrant(issuer_sk, subject_did, capabilities, expires, delegable, parent_id)
  → Warrant

verify_warrant_chain(chain[], trusted_root_did)
  → bool

sign_envelope(sender_sk, to_did, warrants[], payload)
  → Envelope

verify_envelope(envelope, trusted_root_did)
  → bool
```

Approximately 150 lines in any language with an Ed25519 library and a JSON canonicalization function.

---

## 11. Design Decisions

**Why full chain in every message?**
Stateless verification. The recipient needs no prior knowledge of the sender — everything required to verify is in the envelope. No database lookup, no network call.

**Why advisory revocation?**
Mandatory revocation requires infrastructure. Infrastructure requires trust in the infrastructure operator. We eliminate that dependency. The TTL is the primary revocation mechanism — short TTLs make advisory revocation sufficient for most threat models.

**Why UUIDs for warrant IDs?**
Content-addressable IDs (hashes) would be cleaner but make revocation lists harder to reason about before verification. UUIDs are issued at signing time, known before the warrant is distributed, and cheap to store in a revocation list.

**Why is payload opaque?**
PACT's job is trust, not semantics. MCP handles tool calls. A2A handles agent coordination. PACT wraps them with verified identity and authority. Keeping the payload opaque means PACT-02 never needs to change when MCP or A2A evolve.

---

## 12. Relationship to Existing Standards

| Concern | PACT-02 approach | Existing standard |
|---------|-----------------|-------------------|
| Capability model | Attenuatable warrants | Object-capability theory (Miller) |
| Delegation | Chain of signed tokens | UCAN (similar, simpler here) |
| Message signing | Ed25519 over canonical JSON | RFC 8037 |
| Payload wrapping | Opaque typed body | Inspired by DIDComm v2 |
| Revocation | Advisory + TTL | Deliberate simplification |

---

*End of PACT-02.*
