import {
  generateKeypair,
  didFromPublicKey,
  publicKeyFromDid,
  sign,
  verify,
  createAgentDocument,
  canonicalize,
  base64urlEncode,
  base64urlDecode,
} from "../identity.js";

describe("canonicalize", () => {
  it("sorts keys", () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it("handles nested objects", () => {
    expect(canonicalize({ x: { z: 3, y: 2 } })).toBe('{"x":{"y":2,"z":3}}');
  });

  it("handles arrays", () => {
    expect(canonicalize([3, 1, 2])).toBe("[3,1,2]");
  });

  it("handles null and primitives", () => {
    expect(canonicalize(null)).toBe("null");
    expect(canonicalize(42)).toBe("42");
    expect(canonicalize("hello")).toBe('"hello"');
    expect(canonicalize(true)).toBe("true");
  });
});

describe("base64url", () => {
  it("round-trips bytes", () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255]);
    expect(base64urlDecode(base64urlEncode(bytes))).toEqual(bytes);
  });

  it("produces URL-safe output", () => {
    const encoded = base64urlEncode(new Uint8Array(32).fill(0xff));
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });
});

describe("generateKeypair", () => {
  it("returns 32-byte keys", async () => {
    const kp = await generateKeypair();
    expect(kp.privateKey).toHaveLength(32);
    expect(kp.publicKey).toHaveLength(32);
  });

  it("generates unique keypairs", async () => {
    const a = await generateKeypair();
    const b = await generateKeypair();
    expect(a.publicKey).not.toEqual(b.publicKey);
  });
});

describe("DID encoding", () => {
  it("produces did:key: prefix", async () => {
    const kp = await generateKeypair();
    const did = didFromPublicKey(kp.publicKey);
    expect(did).toMatch(/^did:key:z6Mk/);
  });

  it("round-trips public key", async () => {
    const kp = await generateKeypair();
    const did = didFromPublicKey(kp.publicKey);
    const recovered = publicKeyFromDid(did);
    expect(recovered).toEqual(kp.publicKey);
  });

  it("throws on invalid DID", () => {
    expect(() => publicKeyFromDid("not-a-did")).toThrow();
  });
});

describe("sign / verify", () => {
  it("verifies a valid signature", async () => {
    const kp = await generateKeypair();
    const msg = "hello pact";
    const sig = await sign(msg, kp.privateKey);
    expect(await verify(msg, sig, kp.publicKey)).toBe(true);
  });

  it("rejects wrong message", async () => {
    const kp = await generateKeypair();
    const sig = await sign("hello", kp.privateKey);
    expect(await verify("wrong", sig, kp.publicKey)).toBe(false);
  });

  it("rejects wrong key", async () => {
    const kp1 = await generateKeypair();
    const kp2 = await generateKeypair();
    const sig = await sign("hello", kp1.privateKey);
    expect(await verify("hello", sig, kp2.publicKey)).toBe(false);
  });

  it("rejects tampered signature", async () => {
    const kp = await generateKeypair();
    const sig = await sign("hello", kp.privateKey);
    const tampered = sig.slice(0, -4) + "AAAA";
    expect(await verify("hello", tampered, kp.publicKey)).toBe(false);
  });
});

describe("createAgentDocument", () => {
  it("includes required fields", async () => {
    const kp = await generateKeypair();
    const did = didFromPublicKey(kp.publicKey);
    const doc = createAgentDocument(did, { name: "test-agent" });
    expect(doc.id).toBe(did);
    expect(doc.pact).toBe("0.1.0");
    expect(doc.name).toBe("test-agent");
    expect(doc.created).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });
});
