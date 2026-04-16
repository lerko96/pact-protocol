import {
  issueWarrant,
  verifyWarrant,
  verifyWarrantChain,
  signEnvelope,
  verifyEnvelope,
  CAPABILITIES,
} from "../warrants.js";
import { generateKeypair, didFromPublicKey } from "../identity.js";

async function makeKeypair() {
  const kp = await generateKeypair();
  return { kp, did: didFromPublicKey(kp.publicKey) };
}

function inOneHour() {
  return new Date(Date.now() + 3_600_000);
}

function inThePast() {
  return new Date(Date.now() - 1000);
}

describe("issueWarrant / verifyWarrant", () => {
  it("issues and verifies a valid warrant", async () => {
    const issuer = await makeKeypair();
    const subject = await makeKeypair();

    const warrant = await issueWarrant({
      issuerDid: issuer.did,
      issuerPrivateKey: issuer.kp.privateKey,
      subjectDid: subject.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "*" }],
      expiresAt: inOneHour(),
    });

    const result = await verifyWarrant(warrant);
    expect(result.valid).toBe(true);
  });

  it("rejects an expired warrant", async () => {
    const issuer = await makeKeypair();
    const subject = await makeKeypair();

    const warrant = await issueWarrant({
      issuerDid: issuer.did,
      issuerPrivateKey: issuer.kp.privateKey,
      subjectDid: subject.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "*" }],
      expiresAt: inThePast(),
    });

    const result = await verifyWarrant(warrant);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/expired/i);
  });

  it("rejects tampered warrant", async () => {
    const issuer = await makeKeypair();
    const subject = await makeKeypair();
    const other = await makeKeypair();

    const warrant = await issueWarrant({
      issuerDid: issuer.did,
      issuerPrivateKey: issuer.kp.privateKey,
      subjectDid: subject.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "*" }],
      expiresAt: inOneHour(),
    });

    // Tamper: swap subject with a different DID
    const tampered = { ...warrant, subject: other.did };
    const result = await verifyWarrant(tampered);
    expect(result.valid).toBe(false);
  });
});

describe("verifyWarrantChain", () => {
  it("validates a two-level chain", async () => {
    const root = await makeKeypair();
    const mid = await makeKeypair();
    const leaf = await makeKeypair();
    const expiry = inOneHour(); // shared expiry avoids millisecond-difference failures

    const rootWarrant = await issueWarrant({
      issuerDid: root.did,
      issuerPrivateKey: root.kp.privateKey,
      subjectDid: mid.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "*" }],
      expiresAt: expiry,
      delegable: true,
    });

    const leafWarrant = await issueWarrant({
      issuerDid: mid.did,
      issuerPrivateKey: mid.kp.privateKey,
      subjectDid: leaf.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "mcp://tools/search" }],
      expiresAt: expiry,
      delegable: false,
      parentId: rootWarrant.id,
    });

    const result = await verifyWarrantChain([leafWarrant, rootWarrant], root.did);
    expect(result.valid).toBe(true);
  });

  it("rejects chain with wrong root", async () => {
    const root = await makeKeypair();
    const other = await makeKeypair();
    const subject = await makeKeypair();

    const warrant = await issueWarrant({
      issuerDid: root.did,
      issuerPrivateKey: root.kp.privateKey,
      subjectDid: subject.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "*" }],
      expiresAt: inOneHour(),
    });

    const result = await verifyWarrantChain([warrant], other.did);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/root/i);
  });

  it("rejects non-delegable parent", async () => {
    const root = await makeKeypair();
    const mid = await makeKeypair();
    const leaf = await makeKeypair();

    const rootWarrant = await issueWarrant({
      issuerDid: root.did,
      issuerPrivateKey: root.kp.privateKey,
      subjectDid: mid.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "*" }],
      expiresAt: inOneHour(),
      delegable: false, // non-delegable
    });

    const leafWarrant = await issueWarrant({
      issuerDid: mid.did,
      issuerPrivateKey: mid.kp.privateKey,
      subjectDid: leaf.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "mcp://tools/search" }],
      expiresAt: inOneHour(),
    });

    const result = await verifyWarrantChain([leafWarrant, rootWarrant], root.did);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not delegable/i);
  });

  it("rejects capability escalation", async () => {
    const root = await makeKeypair();
    const mid = await makeKeypair();
    const leaf = await makeKeypair();
    const expiry = inOneHour();

    const rootWarrant = await issueWarrant({
      issuerDid: root.did,
      issuerPrivateKey: root.kp.privateKey,
      subjectDid: mid.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "mcp://tools/search" }],
      expiresAt: expiry,
      delegable: true,
    });

    // Leaf claims wildcard — exceeds parent's narrower resource grant
    const leafWarrant = await issueWarrant({
      issuerDid: mid.did,
      issuerPrivateKey: mid.kp.privateKey,
      subjectDid: leaf.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "*" }],
      expiresAt: expiry,
      delegable: false,
    });

    const result = await verifyWarrantChain([leafWarrant, rootWarrant], root.did);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not covered/i);
  });

  it("rejects empty chain", async () => {
    const root = await makeKeypair();
    const result = await verifyWarrantChain([], root.did);
    expect(result.valid).toBe(false);
  });
});

describe("signEnvelope / verifyEnvelope", () => {
  it("signs and verifies a valid envelope", async () => {
    const root = await makeKeypair();
    const agent = await makeKeypair();

    const warrant = await issueWarrant({
      issuerDid: root.did,
      issuerPrivateKey: root.kp.privateKey,
      subjectDid: agent.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "*" }],
      expiresAt: inOneHour(),
    });

    const envelope = await signEnvelope(
      agent.did,
      agent.kp.privateKey,
      root.did,
      [warrant],
      { type: "mcp/tool-call", body: { method: "tools/call" } }
    );

    const result = await verifyEnvelope(envelope, root.did, CAPABILITIES.TOOL_USE, "*");
    expect(result.valid).toBe(true);
  });

  it("rejects envelope with mismatched sender", async () => {
    const root = await makeKeypair();
    const agent = await makeKeypair();
    const impersonator = await makeKeypair();

    const warrant = await issueWarrant({
      issuerDid: root.did,
      issuerPrivateKey: root.kp.privateKey,
      subjectDid: agent.did,
      capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "*" }],
      expiresAt: inOneHour(),
    });

    const envelope = await signEnvelope(
      agent.did,
      agent.kp.privateKey,
      root.did,
      [warrant],
      { type: "mcp/tool-call", body: {} }
    );

    // Swap the `from` field to impersonator
    const tampered = { ...envelope, from: impersonator.did };
    const result = await verifyEnvelope(tampered, root.did, CAPABILITIES.TOOL_USE, "*");
    expect(result.valid).toBe(false);
  });

  it("rejects envelope without required capability", async () => {
    const root = await makeKeypair();
    const agent = await makeKeypair();

    const warrant = await issueWarrant({
      issuerDid: root.did,
      issuerPrivateKey: root.kp.privateKey,
      subjectDid: agent.did,
      capabilities: [{ action: CAPABILITIES.MEMORY_READ, resource: "*" }], // only memory-read
      expiresAt: inOneHour(),
    });

    const envelope = await signEnvelope(
      agent.did,
      agent.kp.privateKey,
      root.did,
      [warrant],
      { type: "mcp/tool-call", body: {} }
    );

    // Require tool-use — not granted
    const result = await verifyEnvelope(envelope, root.did, CAPABILITIES.TOOL_USE, "*");
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/not authorized/i);
  });
});
