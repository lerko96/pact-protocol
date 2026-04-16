# Security Policy

## Threat Model

PACT is a cryptographic delegation protocol. Its security properties depend on:

**What PACT guarantees:**
- An agent's identity is bound to an Ed25519 keypair — forgery requires the private key
- Warrant chains cannot be extended beyond granted authority — attenuation is enforced by signature verification
- Facts cannot be forged — each fact's CID is a hash of its content; the signature binds it to the issuer's key
- Message envelopes cannot be replayed — timestamps and ±5 minute clock skew enforcement limit the replay window

**What PACT does not guarantee:**
- Key security — if a private key is compromised, all warrants and facts signed by it are compromised. PACT has no revocation infrastructure by design; rely on short-lived warrants (TTL) as the primary mitigation.
- Confidentiality — PACT signs and addresses data but does not encrypt it. Encrypt envelope payloads at the transport layer if confidentiality is required.
- Clock synchronization — clock skew tolerance (±5 minutes) assumes reasonably synchronized clocks. Severely skewed clocks can allow replay or premature rejection.
- Fact truthfulness — a fact's signature proves who asserted it, not whether the assertion is true. Trust the claim only as far as you trust the signer.

## Reporting a Vulnerability

If you discover a security issue in the PACT specification or reference implementation, please report it privately:

**Email:** security@lerkolabs.com

Include:
- A description of the vulnerability
- Which component is affected (spec document, TypeScript implementation, or both)
- Steps to reproduce or a proof of concept
- Your assessment of severity and exploitability

We will acknowledge receipt within 48 hours and aim to publish a fix or spec clarification within 14 days for critical issues.

Do not open a public GitHub issue for security vulnerabilities.
