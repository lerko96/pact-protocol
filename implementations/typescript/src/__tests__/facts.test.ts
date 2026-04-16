import {
  createFact,
  verifyFact,
  retractFact,
  mergeFacts,
  queryFacts,
  exportFactSet,
  importFactSet,
  PREDICATES,
} from "../facts.js";
import { generateKeypair, didFromPublicKey } from "../identity.js";
import type { FactStore } from "../facts.js";

async function makeAgent() {
  const kp = await generateKeypair();
  return { kp, did: didFromPublicKey(kp.publicKey) };
}

describe("createFact / verifyFact", () => {
  it("creates a verifiable fact", async () => {
    const agent = await makeAgent();
    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.CONTEXT,
      object: "test context",
      confidence: 0.8,
    });

    expect(fact.type).toBe("fact");
    expect(fact.id).toBeTruthy();
    expect(await verifyFact(fact)).toBe(true);
  });

  it("produces a stable CID that matches fact content", async () => {
    const agent = await makeAgent();
    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: "did:key:z6MkTest",
      predicate: PREDICATES.PREFERS,
      object: "dark mode",
      confidence: 1.0,
    });

    // CID is a base32 CIDv1 — verify it is well-formed
    expect(fact.id).toMatch(/^bafy|^bafk/);
    // Fact can be re-verified, confirming CID is stable relative to content
    expect(await verifyFact(fact)).toBe(true);
  });

  it("rejects confidence outside 0–1", async () => {
    const agent = await makeAgent();
    await expect(
      createFact({
        sourcePrivateKey: agent.kp.privateKey,
        sourceDid: agent.did,
        subject: agent.did,
        predicate: PREDICATES.CONTEXT,
        object: "x",
        confidence: 1.5,
      })
    ).rejects.toThrow(/confidence/i);
  });

  it("rejects tampered fact", async () => {
    const agent = await makeAgent();
    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.CONTEXT,
      object: "original",
      confidence: 0.9,
    });

    const tampered = { ...fact, object: "tampered" };
    expect(await verifyFact(tampered)).toBe(false);
  });

  it("supports expiry field", async () => {
    const agent = await makeAgent();
    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.CONTEXT,
      object: "ephemeral",
      confidence: 0.5,
      expiresAt: new Date(Date.now() + 3_600_000),
    });

    expect(fact.expires).toBeTruthy();
    expect(await verifyFact(fact)).toBe(true);
  });
});

describe("retractFact", () => {
  it("creates a retraction with confidence 0.0", async () => {
    const agent = await makeAgent();
    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.PREFERS,
      object: "light mode",
      confidence: 0.9,
    });

    const retraction = await retractFact(fact, agent.kp.privateKey, agent.did);
    expect(retraction.confidence).toBe(0.0);
    expect(retraction.predicate).toBe(fact.predicate);
    expect(retraction.object).toBe(fact.object);
    expect(await verifyFact(retraction)).toBe(true);
  });
});

describe("mergeFacts", () => {
  it("merges new facts into an empty store", async () => {
    const agent = await makeAgent();
    const store: FactStore = new Map();

    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.CONTEXT,
      object: "hello",
      confidence: 1.0,
    });

    const stats = await mergeFacts(store, [fact]);
    expect(stats.merged).toBe(1);
    expect(stats.skipped).toBe(0);
    expect(stats.invalid).toBe(0);
    expect(store.size).toBe(1);
  });

  it("skips duplicate IDs", async () => {
    const agent = await makeAgent();
    const store: FactStore = new Map();

    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.CONTEXT,
      object: "hello",
      confidence: 1.0,
    });

    await mergeFacts(store, [fact]);
    const stats = await mergeFacts(store, [fact]);
    expect(stats.skipped).toBe(1);
    expect(store.size).toBe(1);
  });

  it("skips expired facts", async () => {
    const agent = await makeAgent();
    const store: FactStore = new Map();

    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.CONTEXT,
      object: "stale",
      confidence: 1.0,
      expiresAt: new Date(Date.now() - 1000), // expired
    });

    const stats = await mergeFacts(store, [fact]);
    expect(stats.skipped).toBe(1);
    expect(store.size).toBe(0);
  });

  it("counts invalid facts", async () => {
    const store: FactStore = new Map();
    const agent = await makeAgent();

    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.CONTEXT,
      object: "real",
      confidence: 0.8,
    });

    const tampered = { ...fact, object: "injected" };
    const stats = await mergeFacts(store, [tampered]);
    expect(stats.invalid).toBe(1);
    expect(store.size).toBe(0);
  });
});

describe("queryFacts", () => {
  async function buildStore() {
    const agent = await makeAgent();
    const store: FactStore = new Map();

    const facts = await Promise.all([
      createFact({ sourcePrivateKey: agent.kp.privateKey, sourceDid: agent.did, subject: "user:alice", predicate: PREDICATES.PREFERS, object: "dark mode", confidence: 0.9 }),
      createFact({ sourcePrivateKey: agent.kp.privateKey, sourceDid: agent.did, subject: "user:alice", predicate: PREDICATES.CONTEXT, object: "senior engineer", confidence: 0.8 }),
      createFact({ sourcePrivateKey: agent.kp.privateKey, sourceDid: agent.did, subject: "user:bob", predicate: PREDICATES.PREFERS, object: "light mode", confidence: 0.7 }),
    ]);

    await mergeFacts(store, facts);
    return { store, agent };
  }

  it("filters by subject", async () => {
    const { store } = await buildStore();
    const results = queryFacts(store, { subject: "user:alice" });
    expect(results).toHaveLength(2);
    expect(results.every(f => f.subject === "user:alice")).toBe(true);
  });

  it("filters by predicate", async () => {
    const { store } = await buildStore();
    const results = queryFacts(store, { predicate: PREDICATES.PREFERS });
    expect(results).toHaveLength(2);
  });

  it("filters by minConfidence", async () => {
    const { store } = await buildStore();
    const results = queryFacts(store, { minConfidence: 0.85 });
    expect(results.every(f => f.confidence >= 0.85)).toBe(true);
  });

  it("excludes retractions by default", async () => {
    const agent = await makeAgent();
    const store: FactStore = new Map();

    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.PREFERS,
      object: "vim",
      confidence: 1.0,
    });

    const retraction = await retractFact(fact, agent.kp.privateKey, agent.did);
    await mergeFacts(store, [fact, retraction]);

    const withoutRetractions = queryFacts(store, {});
    expect(withoutRetractions.some(f => f.confidence === 0.0)).toBe(false);

    const withRetractions = queryFacts(store, { includeRetractions: true });
    expect(withRetractions.some(f => f.confidence === 0.0)).toBe(true);
  });

  it("sorts by confidence descending", async () => {
    const { store } = await buildStore();
    const results = queryFacts(store, {});
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].confidence).toBeGreaterThanOrEqual(results[i].confidence);
    }
  });
});

describe("exportFactSet / importFactSet", () => {
  it("round-trips a fact store", async () => {
    const agent = await makeAgent();
    const store: FactStore = new Map();

    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.CONTEXT,
      object: "exported context",
      confidence: 0.75,
    });

    await mergeFacts(store, [fact]);

    const factSet = exportFactSet(store);
    expect(factSet.type).toBe("fact-set");
    expect(factSet.facts).toHaveLength(1);

    const { store: restored, stats } = await importFactSet(factSet);
    expect(stats.merged).toBe(1);
    expect(restored.size).toBe(1);
    expect(restored.get(fact.id)?.object).toBe("exported context");
  });

  it("produces a deterministic fact-set ID", async () => {
    const agent = await makeAgent();
    const store: FactStore = new Map();

    const fact = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.CONTEXT,
      object: "stable",
      confidence: 1.0,
    });

    await mergeFacts(store, [fact]);

    const a = exportFactSet(store);
    const b = exportFactSet(store);
    expect(a.id).toBe(b.id);
  });

  it("merges into an existing store on import", async () => {
    const agent = await makeAgent();

    const fact1 = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.CONTEXT,
      object: "fact one",
      confidence: 0.9,
    });

    const fact2 = await createFact({
      sourcePrivateKey: agent.kp.privateKey,
      sourceDid: agent.did,
      subject: agent.did,
      predicate: PREDICATES.CONTEXT,
      object: "fact two",
      confidence: 0.8,
    });

    const existingStore: FactStore = new Map();
    await mergeFacts(existingStore, [fact1]);

    const importStore: FactStore = new Map();
    await mergeFacts(importStore, [fact2]);
    const factSet = exportFactSet(importStore);

    const { store: merged } = await importFactSet(factSet, existingStore);
    expect(merged.size).toBe(2);
  });
});
