# PACT Compared to Similar Protocols

This document addresses the most common question: *how is PACT different from X?*

---

## PACT vs AIP (Agent Identity Protocol)

[AIP](https://arxiv.org/abs/2603.24775) (March 2026) is the closest contemporary work. Both solve agent identity and delegation; they make different tradeoffs.

| | PACT | AIP |
|---|---|---|
| Token format | Signed JSON warrants | IBCT (Biscuit tokens) |
| Policy evaluation | Structural attenuation check | Datalog interpreter |
| Memory layer | Yes — PACT-03 signed facts | No |
| Infrastructure | Zero required | Zero required |
| Spec size | ~30 min read (3 docs) | Biscuit RFC + Datalog spec |
| Impl complexity | ~300 lines | Biscuit library + Datalog engine |
| License | CC0 | Unknown |
| Ecosystem integrations | TypeScript (ref impl) | Python, Rust, CrewAI, ADK, LangChain |

**When to use AIP:** You need fine-grained Datalog policy evaluation, you're building on an existing AIP ecosystem (CrewAI/ADK/LangChain adapters), or enterprise compliance requirements favor a formal policy language.

**When to use PACT:** You want to implement the spec yourself in a weekend, you need portable agent memory (PACT-03), you want CC0 with zero licensing questions, or you prefer structural delegation without a Datalog dependency.

The key differentiators for PACT:
1. **Memory portability** — PACT-03 Facts have no AIP equivalent. Agent context can move between platforms as a signed, verifiable fact set.
2. **Simplicity** — Warrant verification is a structural check, not a Datalog evaluation. No policy interpreter to implement.

---

## PACT vs UCAN

[UCAN](https://github.com/ucan-wg/spec) (User Controlled Authorization Networks) is the closest prior work. PACT is directly inspired by UCAN's delegation model.

| | PACT | UCAN |
|---|---|---|
| Delegation model | Attenuating warrant chains | Attenuating capability chains |
| Content addressing | CIDv1 for fact IDs | IPLD throughout |
| DID resolution | None required (`did:key` only) | DID resolution infrastructure optional |
| Memory layer | PACT-03 Facts | No equivalent |
| Target audience | AI agent developers | Web3 / IPFS ecosystem |
| Spec size | ~30 min read | Multiple UCAN sub-specs |

PACT borrows UCAN's core insight — *authority flows from users down through capability-attenuating chains* — and simplifies it:
- No IPLD requirements for warrant verification (PACT uses canonical JSON, not CBOR/CID links in the warrant body itself)
- `did:key` only — no DID resolution infrastructure, no DID document fetching
- Smaller spec surface: three documents, one canonical JSON encoding
- PACT-03 Facts are entirely novel relative to UCAN

If you're already in the IPFS/web3 ecosystem and want IPLD-native delegation, use UCAN. If you're building AI agents and want something you can implement in a day, use PACT.

---

## PACT vs OAuth 2.0 / OIDC

OAuth is for *user → service* delegation in a browser context. It was not designed for agent-to-agent authorization.

| | PACT | OAuth 2.0 |
|---|---|---|
| Central server | None | Authorization server required |
| Agent-to-agent | Native | Not supported |
| Delegation chains | Attenuating chains | No standard equivalent |
| Memory layer | PACT-03 Facts | No |
| Infrastructure | Zero | OAuth server, redirect flows |

OAuth requires a central authorization server to issue tokens and validate them. PACT warrants are self-contained and verifiable with only the issuer's public key (embedded in the `did:key` identifier). No callback, no server, no discovery document.

---

## PACT vs JWT alone

JWTs can express claims but are not a delegation protocol.

| | PACT | JWT |
|---|---|---|
| Delegation chains | Native | No standard model |
| Key distribution | `did:key` (self-describing) | Requires JWKS endpoint or out-of-band sharing |
| Memory layer | PACT-03 Facts | No |
| Attenuation | Enforced by spec | Not defined |
| Content addressing | CIDv1 fact IDs | No |

JWTs are a serialization format. You can build a delegation system on top of JWTs, but PACT specifies *how* — the chain structure, the attenuation rules, the clock skew tolerance, the canonical signing format, and the memory layer. JWT implementations of agent auth tend to reinvent these decisions inconsistently.

---

## Summary

PACT occupies a specific position: **simpler than AIP or UCAN, purpose-built for AI agents, with a memory layer none of the alternatives have.**

If simplicity and memory portability matter to you, PACT. If you need a rich policy language or ecosystem integrations, look at AIP. If you're in the web3/IPFS world, look at UCAN.
