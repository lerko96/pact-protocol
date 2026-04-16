# PACT-03: Facts
**Protocol for Agent Capability and Trust — Layer 3 of 3**

```
Status:   DRAFT
Version:  0.1.0
Date:     2026-04-15
License:  CC0 (public domain)
```

---

## Abstract

A fact is a signed, typed, content-addressed assertion about the world. This document defines the fact format, how facts compose into portable agent memory, and how agents share, verify, and expire them. No central store required.

---

## 1. The Axiom

> Memory is a set of signed claims. Trust the claim only as far as you trust the signer.

---

## 2. The Fact

```json
{
  "pact": "0.1.0",
  "type": "fact",
  "id": "bafkreigh2akiscaildcqabab4q2xt7s3zkdfsb4vlgkzhrxhzabcd1234",
  "subject": "did:key:z6MkUser...",
  "predicate": "prefers",
  "object": "dark mode",
  "confidence": 0.9,
  "issued": "2026-04-15T00:00:00Z",
  "expires": "2027-04-15T00:00:00Z",
  "source": "did:key:z6MkAgent...",
  "signature": "base64url-encoded-ed25519-signature"
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `pact` | YES | Protocol version |
| `type` | YES | Always `"fact"` |
| `id` | YES | CIDv1 hash of canonical JSON of all other fields |
| `subject` | YES | What this fact is about — a DID, URI, or namespaced string |
| `predicate` | YES | The relationship being asserted — namespaced string |
| `object` | YES | The value — string, number, boolean, or URI |
| `confidence` | YES | Float 0.0–1.0. 1.0 = observed directly. Lower = inferred or uncertain |
| `issued` | YES | ISO 8601 UTC, when asserted |
| `expires` | NO | ISO 8601 UTC. Absent = no expiry. Receivers SHOULD respect this |
| `source` | YES | DID of the agent asserting this fact |
| `signature` | YES | Ed25519 signature over canonical JSON of all other fields |

### The ID is the fact

The `id` field is a content hash (CIDv1, SHA2-256, base32). The same fact always produces the same ID. Different facts always produce different IDs. This means:

- Facts are deduplicated by ID automatically
- Tampered facts have wrong IDs and fail verification
- Facts can be referenced by ID without transmitting the full body
- No central authority needed to assign IDs

---

## 3. Subjects, Predicates, Objects

### Subjects

Any URI or DID. Common patterns:

| Subject | Meaning |
|---------|---------|
| `did:key:z6Mk...` | A specific agent or user |
| `urn:uuid:...` | A specific session or object |
| `https://example.com/resource` | An external resource |

### Predicates

Namespaced strings. The `pact:` namespace is reserved:

| Predicate | Meaning |
|-----------|---------|
| `pact:knows` | Subject has knowledge of object |
| `pact:prefers` | Subject has stated preference for object |
| `pact:said` | Subject made a statement (object is the statement) |
| `pact:did` | Subject performed an action (object is the action) |
| `pact:trusts` | Subject has expressed trust in object agent |
| `pact:context` | Subject exists within a named context |

Other namespaces are permitted and encouraged. Unknown predicates MUST be stored and forwarded — receivers should not discard facts they don't understand.

### Objects

Strings, numbers, booleans, URIs, or DIDs. For structured objects, serialize as a JSON string. Keep objects small — facts are atomic assertions, not documents.

---

## 4. Confidence

Confidence is not probability. It is a signal about how the fact was derived:

| Range | Meaning |
|-------|---------|
| `1.0` | Directly observed or explicitly stated by subject |
| `0.7–0.9` | Strongly inferred from multiple sources |
| `0.4–0.6` | Weakly inferred or single-source |
| `0.1–0.3` | Speculative |
| `0.0` | Retracted — this fact is believed to be false |

A confidence of `0.0` is a **retraction**. Agents SHOULD store retractions alongside original facts rather than deleting them — the history of what was believed matters.

---

## 5. Fact Sets

A **fact set** is a collection of facts shared between agents. It has no required structure — it is simply an array of fact objects.

```json
{
  "pact": "0.1.0",
  "type": "fact-set",
  "id": "urn:uuid:fact-set-uuid",
  "facts": [ ...fact objects... ],
  "warrant": { ...PACT-02 warrant authorizing memory-read/write... }
}
```

Fact sets are transmitted inside PACT-02 envelopes with payload type `pact:fact-set`.

### Merging

When an agent receives a fact set, it MUST:

1. Verify each fact's signature against the source DID
2. Verify the sender holds a valid `pact:memory-write` warrant
3. Check each fact's `id` against local store — skip duplicates
4. For conflicting facts (same subject + predicate, different object): keep both, ranked by confidence
5. Apply retractions (confidence `0.0`) by marking affected facts as retracted, not deleting them

Merge is always additive. Facts are never deleted, only retracted.

---

## 6. Portability

The goal of PACT-03 is that an agent can move between platforms without losing context. Portability works as follows:

1. The outgoing platform exports a fact set containing all facts about the user
2. Facts are signed by the exporting agent's DID
3. The incoming platform imports the fact set
4. The user verifies the import by checking signatures against known DIDs
5. The incoming platform begins asserting new facts under its own DID

The user's DID (from PACT-01) is the stable identity that ties fact sets together across platforms. Platform DIDs may change — the user DID does not.

---

## 7. Privacy

Facts about a user SHOULD only be shared with agents that hold a `pact:memory-read` warrant issued by that user.

Facts MUST NOT be shared with third parties without explicit warrant coverage.

Agents SHOULD implement fact expiry — purging facts past their `expires` timestamp from active storage. Expired facts MAY be archived but MUST NOT be used for inference.

---

## 8. What This Layer Does NOT Cover

- Storage backends (use SQLite, Postgres, a graph DB, whatever fits)
- Query languages (facts are simple enough to filter in memory)
- Semantic reasoning over facts (that is an application concern)
- Economic exchange of facts (PACT does not define a fact marketplace)

---

## 9. Reference Implementation

Minimum conforming implementation:

```
create_fact(source_sk, subject, predicate, object, confidence, expires)
  → Fact

verify_fact(fact)
  → bool

merge_facts(local_store[], incoming_facts[])
  → store[]

export_fact_set(store[], warrant)
  → FactSet

import_fact_set(fact_set, trusted_root_did)
  → store[]
```

Approximately 100 lines in any language with an Ed25519 library, a CID library, and a JSON canonicalization function.

---

## 10. Design Decisions

**Why RDF-shaped but not RDF?**
RDF's triple model (subject, predicate, object) is the right abstraction for typed assertions. But RDF brings ontology requirements, namespace registries, and tooling complexity that kills adoption. We take the shape, not the baggage. Any developer who understands JSON can read a PACT fact without knowing what RDF is.

**Why content-addressed IDs?**
Deduplication, tamper-evidence, and referenceability without a central authority — all for free. CIDv1 is already widely implemented (IPFS ecosystem). The choice costs nothing and pays dividends immediately.

**Why keep retractions rather than deleting?**
Agents need to reason about what was believed and when. Deleting facts destroys that history. A retraction is itself a fact — "as of this moment, the source no longer believes this." That information is valuable for trust calibration.

**Why confidence instead of boolean truth?**
Agents infer. Inference is uncertain. A boolean true/false forces a false precision that leads to bad downstream decisions. Confidence makes the uncertainty explicit and composable — two agents that disagree on confidence can both be right.

---

## 11. Relationship to Existing Standards

| Concern | PACT-03 approach | Existing standard |
|---------|-----------------|-------------------|
| Triple structure | subject/predicate/object | RDF (W3C) |
| Content addressing | CIDv1 SHA2-256 | IPLD / IPFS |
| Signing | Ed25519 over canonical JSON | RFC 8037 |
| Portability | Signed fact sets | No existing standard |
| Expiry | `expires` field | Inspired by JWT `exp` |

---

## 12. Complete Example

A user switches from Platform A to Platform B. Platform A exports:

```json
{
  "pact": "0.1.0",
  "type": "fact-set",
  "id": "urn:uuid:abc123",
  "facts": [
    {
      "pact": "0.1.0",
      "type": "fact",
      "id": "bafkrei...",
      "subject": "did:key:z6MkUser...",
      "predicate": "pact:prefers",
      "object": "dark mode",
      "confidence": 1.0,
      "issued": "2026-01-01T00:00:00Z",
      "expires": "2027-01-01T00:00:00Z",
      "source": "did:key:z6MkPlatformA...",
      "signature": "base64url..."
    },
    {
      "pact": "0.1.0",
      "type": "fact",
      "id": "bafkrei...",
      "subject": "did:key:z6MkUser...",
      "predicate": "pact:knows",
      "object": "pact:prefers Python over JavaScript",
      "confidence": 0.85,
      "issued": "2026-02-10T00:00:00Z",
      "source": "did:key:z6MkPlatformA...",
      "signature": "base64url..."
    }
  ],
  "warrant": { ...pact:memory-read warrant from user... }
}
```

Platform B imports, verifies signatures, merges into local store. The user's context survives the migration intact. Platform A's DID remains in the fact history — the user can audit what was asserted and by whom.

---

*End of PACT-03.*

---

## PACT Complete

Three documents. Three axioms.

- **PACT-01**: Identity is a public key.
- **PACT-02**: Authority flows downward from a human root.
- **PACT-03**: Memory is a set of signed claims.

Total reference implementation: ~300 lines across three files. No central infrastructure required to participate.
