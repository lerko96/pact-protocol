# PACT
**Protocol for Agent Capability and Trust**

[![npm](https://img.shields.io/npm/v/@lerkolabs/open-pact)](https://www.npmjs.com/package/@lerkolabs/open-pact)
[![License: CC0](https://img.shields.io/badge/license-CC0-blue)](./LICENSE)
[![Spec Status](https://img.shields.io/badge/spec-DRAFT%200.1.0-yellow)]()
[![CI](https://github.com/lerko96/open-pact/actions/workflows/ci.yml/badge.svg)](https://github.com/lerko96/open-pact/actions/workflows/ci.yml)

```
Status:   DRAFT
Spec:     0.1.0
Date:     2026-04-16
License:  CC0 (public domain)
```

> AI agents call tools via MCP and delegate via A2A. Neither protocol answers:
> *who is this agent, are they authorized, and where does their memory go when they switch platforms?*
> PACT answers those three questions. Nothing else.

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

## Quickstart

```bash
npm install @lerkolabs/open-pact
```

```typescript
import {
  generateKeypair, didFromPublicKey,
  issueWarrant, signEnvelope, verifyEnvelope,
  CAPABILITIES,
} from "@lerkolabs/open-pact";

// Create a user (root) and an agent
const user = await generateKeypair();
const agent = await generateKeypair();
const userDid = didFromPublicKey(user.publicKey);
const agentDid = didFromPublicKey(agent.publicKey);

// User authorizes the agent to call tools for 1 hour
const warrant = await issueWarrant({
  issuerDid: userDid, issuerPrivateKey: user.privateKey,
  subjectDid: agentDid,
  capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "*" }],
  expiresAt: new Date(Date.now() + 3_600_000),
});

// Agent signs an envelope around an MCP tool call
const envelope = await signEnvelope(agentDid, agent.privateKey, userDid, [warrant], {
  type: "mcp/tool-call",
  body: { method: "tools/call", params: { name: "search", arguments: { q: "PACT" } } },
});

// The tool server verifies: is this agent authorized?
const result = await verifyEnvelope(envelope, userDid, CAPABILITIES.TOOL_USE, "*");
console.log(result.valid); // true
```

See [`examples/`](./implementations/typescript/examples/) for runnable scripts.

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

## PACT vs AIP vs UCAN

| | PACT | AIP | UCAN |
|---|---|---|---|
| Auth model | Ed25519 warrant chains | IBCT/Biscuit + Datalog | UCAN delegation |
| Memory layer | Yes (PACT-03 Facts) | No | No |
| Infrastructure | Zero required | Zero required | Zero required |
| Complexity | ~300 lines | Biscuit format + Datalog eval | IPLD + DID resolution |
| License | CC0 | Unknown | MIT/Apache |
| Implementations | TypeScript | Python, Rust | JS, Go, Rust |

See [`spec/COMPARISON.md`](./spec/COMPARISON.md) for a detailed technical comparison.

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
| [PACT-01: Identity](./spec/PACT-01-identity.md) | Keypair generation, DID format, agent document, signing |
| [PACT-02: Warrants](./spec/PACT-02-warrants.md) | Capability grants, delegation chains, message envelopes, revocation |
| [PACT-03: Facts](./spec/PACT-03-facts.md) | Memory format, fact sets, portability, merging |

Read time: ~30 minutes for all three.

---

## Implementations

| Language | Status | Notes |
|----------|--------|-------|
| TypeScript | Reference | `npm install @lerkolabs/open-pact` |
| Python | Wanted | [Open an issue](https://github.com/lerko96/open-pact/issues) |
| Go | Wanted | [Open an issue](https://github.com/lerko96/open-pact/issues) |
| Rust | Wanted | [Open an issue](https://github.com/lerko96/open-pact/issues) |

Building an implementation? See [CONTRIBUTING.md](./CONTRIBUTING.md).

---

## Why Now?

The AI agent ecosystem is at an inflection point. MCP and A2A have solved the middle of the stack and just entered neutral governance under the Linux Foundation. The layers they leave open — identity, delegation, memory — will either be solved by open standards or by platform lock-in.

The window for a simple, open answer is now. In 18 months the platforms will have won this layer too.

---

## Status

PACT is a draft specification. The core design is stable. The reference implementation passes its test suite. Feedback welcome — open an issue or submit a pull request.

---

*PACT is CC0. Do whatever you want with it.*
