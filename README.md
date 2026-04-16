# PACT
**Protocol for Agent Capability and Trust**

```
Status:   DRAFT
Version:  0.1.0
Date:     2026-04-15
License:  CC0 (public domain)
```

---

## What is PACT?

PACT is a minimal protocol for AI agents to establish identity, delegate authority, and share memory — without depending on any central server, registry, or platform.

Three primitives. Three documents. ~300 lines of code to implement.

---

## The Problem

AI agents in 2026 cannot trust each other, cannot delegate authority safely, and cannot carry memory across platforms. Every major platform has solved these problems privately, creating lock-in disguised as features.

The protocols that exist (MCP, A2A) solve tool connectivity and agent coordination well. None of them answer three questions:

- **Who is this agent, really?**
- **Is this agent actually authorized to do what it's doing?**
- **Where does an agent's memory go when it moves platforms?**

PACT answers those three questions and nothing else.

---

## Three Primitives

### Identity — a keypair
```
Agent = Ed25519 keypair
ID    = did:key:z6Mk[public-key-base58btc]
```
Generate a keypair. You have an agent identity. No registration. No server. No issuer. The identity is portable because it is just a key.

### Warrant — a signed delegation
```
Warrant = { issuer, subject, capabilities, expires, signature }
```
A warrant is a signed statement: *"Agent A authorizes Agent B to do X until time T."* Warrants chain — B can delegate a subset of its authority to C, but never more than it holds. Every chain traces back to a human-controlled root key. No agent can forge authority it was never given.

### Fact — a signed memory claim
```
Fact = { subject, predicate, object, confidence, source, signature }
```
A fact is an atomic, typed assertion signed by the agent that observed it. Facts are content-addressed — the same fact always has the same ID. They compose into portable memory: export a signed fact set from one platform, import it on another, context intact.

---

## How PACT Relates to Existing Protocols

PACT does not replace MCP or A2A. It wraps them.

```
┌─────────────────────────────────┐
│         Your application        │
├─────────────────────────────────┤
│  PACT-03  │  Memory / Facts     │  ← portable context
│  PACT-02  │  Warrants           │  ← who is authorized
│  PACT-01  │  Identity           │  ← who is this agent
├───────────┼─────────────────────┤
│  MCP      │  Tool calls         │  ← existing standard
│  A2A      │  Agent coordination │  ← existing standard
├─────────────────────────────────┤
│  HTTP / WebSocket / gRPC        │  ← existing transport
└─────────────────────────────────┘
```

An MCP tool call arrives inside a PACT envelope. The envelope proves who sent it and whether they were authorized. The tool result gets stored as a PACT fact. None of the existing protocols change.

---

## Design Principles

**Simplicity is the distribution strategy.**
If a spec requires a platform team to implement, only platforms win. PACT is implementable by one developer in a weekend.

**No infrastructure required to participate.**
No registry to join. No server to run. No permission to ask. Generate a keypair and you're in.

**Authority flows from humans, not systems.**
Every warrant chain terminates at a keypair controlled by a human. Agents are delegates, not principals.

**Additive, not competitive.**
PACT adds identity and memory to the existing ecosystem. It does not replace what works.

**Open by default.**
CC0. No copyright. No contributor agreement. Take it, implement it, ship it.

---

## The Documents

| Document | What it specifies |
|----------|------------------|
| [PACT-01: Identity](./PACT-01-identity.md) | Keypair generation, DID format, agent document, signing |
| [PACT-02: Warrants](./PACT-02-warrants.md) | Capability grants, delegation chains, message envelopes, revocation |
| [PACT-03: Facts](./PACT-03-facts.md) | Memory format, fact sets, portability, merging |

Read time: ~30 minutes for all three.

---

## Reference Implementation

~300 lines across three files. No framework. No dependencies beyond:
- An Ed25519 library
- A CID library (for content-addressed fact IDs)
- A JSON canonicalization function

Implementations in progress:
- TypeScript (reference)

---

## Why Now?

The AI agent ecosystem is at an inflection point. MCP and A2A have solved the middle of the stack and just entered neutral governance under the Linux Foundation. The layers they leave open — identity, delegation, memory — will either be solved by open standards or by platform lock-in.

The window for a simple, open answer is now. In 18 months the platforms will have won this layer too.

---

## Status

PACT is a draft specification. The core design is stable. The reference implementation is in progress. Feedback welcome — open an issue or submit a pull request.

---

*PACT is CC0. Do whatever you want with it.*
