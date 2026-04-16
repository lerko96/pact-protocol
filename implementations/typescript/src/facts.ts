/**
 * PACT-03: Facts
 * Memory is a set of signed claims.
 * Trust the claim only as far as you trust the signer.
 */

import { sha256 } from "@noble/hashes/sha2.js";
import { CID } from "multiformats/cid";
import { base32 } from "multiformats/bases/base32";
import { create as createDigest } from "multiformats/hashes/digest";
import { PACT_VERSION, canonicalize, sign, verify, publicKeyFromDid } from "./identity.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Fact {
  pact: string;
  type: "fact";
  id: string;
  subject: string;
  predicate: string;
  object: string | number | boolean;
  confidence: number;
  issued: string;
  expires?: string;
  source: string;
  signature: string;
}

export interface FactSet {
  pact: string;
  type: "fact-set";
  id: string;
  facts: Fact[];
}

export type FactStore = Map<string, Fact>;

// ── Creation ──────────────────────────────────────────────────────────────────

export interface CreateFactOptions {
  sourcePrivateKey: Uint8Array;
  sourceDid: string;
  subject: string;
  predicate: string;
  object: string | number | boolean;
  confidence: number;
  expiresAt?: Date;
}

export async function createFact(opts: CreateFactOptions): Promise<Fact> {
  if (opts.confidence < 0 || opts.confidence > 1)
    throw new Error("Confidence must be 0.0–1.0");

  const partial = {
    pact: PACT_VERSION,
    type: "fact" as const,
    subject: opts.subject,
    predicate: opts.predicate,
    object: opts.object,
    confidence: opts.confidence,
    issued: new Date().toISOString(),
    ...(opts.expiresAt ? { expires: opts.expiresAt.toISOString() } : {}),
    source: opts.sourceDid,
  };

  const id = computeCID(canonicalize(partial));
  const signature = await sign(canonicalize({ ...partial, id }), opts.sourcePrivateKey);
  return { ...partial, id, signature };
}

/**
 * Retract a fact — confidence 0.0 means "no longer believed".
 * Retractions are additive: we never delete, only mark.
 */
export async function retractFact(
  original: Fact,
  sourcePrivateKey: Uint8Array,
  sourceDid: string
): Promise<Fact> {
  return createFact({
    sourcePrivateKey,
    sourceDid,
    subject: original.subject,
    predicate: original.predicate,
    object: original.object,
    confidence: 0.0,
  });
}

// ── Verification ──────────────────────────────────────────────────────────────

export async function verifyFact(fact: Fact): Promise<boolean> {
  try {
    const { id, signature, ...rest } = fact;
    if (computeCID(canonicalize(rest)) !== id) return false;
    return await verify(canonicalize({ ...rest, id }), signature, publicKeyFromDid(fact.source));
  } catch { return false; }
}

// ── Store operations ──────────────────────────────────────────────────────────

export interface MergeStats {
  merged: number;
  skipped: number;
  invalid: number;
}

export async function mergeFacts(store: FactStore, incoming: Fact[]): Promise<MergeStats> {
  let merged = 0, skipped = 0, invalid = 0;

  for (const fact of incoming) {
    if (store.has(fact.id)) { skipped++; continue; }
    if (fact.expires && new Date(fact.expires) < new Date()) { skipped++; continue; }
    if (!(await verifyFact(fact))) { invalid++; continue; }
    store.set(fact.id, fact);
    merged++;
  }

  return { merged, skipped, invalid };
}

export interface FactQuery {
  subject?: string;
  predicate?: string;
  source?: string;
  minConfidence?: number;
  includeRetractions?: boolean;
}

export function queryFacts(store: FactStore, query: FactQuery = {}): Fact[] {
  const results: Fact[] = [];
  for (const fact of store.values()) {
    if (query.subject && fact.subject !== query.subject) continue;
    if (query.predicate && fact.predicate !== query.predicate) continue;
    if (query.source && fact.source !== query.source) continue;
    if (!query.includeRetractions && fact.confidence === 0.0) continue;
    if (query.minConfidence !== undefined && fact.confidence < query.minConfidence) continue;
    results.push(fact);
  }
  return results.sort((a, b) =>
    b.confidence - a.confidence || b.issued.localeCompare(a.issued)
  );
}

// ── Portability ───────────────────────────────────────────────────────────────

export function exportFactSet(store: FactStore): FactSet {
  const facts = Array.from(store.values());
  return {
    pact: PACT_VERSION,
    type: "fact-set",
    id: computeCID(canonicalize(facts)),
    facts,
  };
}

export async function importFactSet(
  factSet: FactSet,
  store: FactStore = new Map()
): Promise<{ store: FactStore; stats: MergeStats }> {
  const stats = await mergeFacts(store, factSet.facts);
  return { store, stats };
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const PREDICATES = {
  KNOWS:   "pact:knows",
  PREFERS: "pact:prefers",
  SAID:    "pact:said",
  DID:     "pact:did",
  TRUSTS:  "pact:trusts",
  CONTEXT: "pact:context",
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeCID(canonical: string): string {
  const hash = sha256(new TextEncoder().encode(canonical));
  const digest = createDigest(0x12, hash); // 0x12 = sha2-256
  return CID.create(1, 0x55, digest).toString(base32); // 0x55 = raw codec
}
