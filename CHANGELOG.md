# Changelog

All notable changes to the PACT specification and reference implementation.

---

## [0.1.2] — 2026-04-16

### Fixed
- npm publish configuration: `files` field in `package.json` now correctly includes only `dist/`
- Package renamed to `@lerkolabs/open-pact`

---

## [0.1.1] — 2026-04-15

### Changed
- Package renamed from `open-pact` to `@lerkolabs/open-pact` (scoped npm package)

---

## [0.1.0] — 2026-04-15

### Added
- PACT-01: Identity specification — Ed25519 keypairs, `did:key` encoding, agent documents, canonical JSON signing
- PACT-02: Warrants specification — capability grants, attenuation rules, delegation chains, message envelopes, clock skew handling
- PACT-03: Facts specification — content-addressed memory claims, CIDv1 fact IDs, merge semantics, portable fact sets
- TypeScript reference implementation (`@lerkolabs/open-pact`) covering all three primitives
- CC0 license
