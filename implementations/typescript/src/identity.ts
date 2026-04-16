/**
 * PACT-01: Identity
 * An agent is a keypair. Everything else is metadata.
 */

import * as ed from "@noble/ed25519";
import { base58btc } from "multiformats/bases/base58";

export const PACT_VERSION = "0.1.0";

const ED25519_MULTICODEC = new Uint8Array([0xed, 0x01]);

export interface AgentKeypair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}

export interface AgentDocument {
  pact: string;
  id: string;
  created: string;
  name?: string;
  description?: string;
  endpoint?: string;
  capabilities?: string[];
}

/** Canonical JSON — keys sorted, no whitespace, no external dependency. */
export function canonicalize(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(canonicalize).join(",") + "]";
  const sorted = Object.keys(obj as object)
    .sort()
    .map((k) => JSON.stringify(k) + ":" + canonicalize((obj as Record<string, unknown>)[k]))
    .join(",");
  return "{" + sorted + "}";
}

export async function generateKeypair(): Promise<AgentKeypair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  return { publicKey, privateKey };
}

export function didFromPublicKey(publicKey: Uint8Array): string {
  const prefixed = new Uint8Array(ED25519_MULTICODEC.length + publicKey.length);
  prefixed.set(ED25519_MULTICODEC);
  prefixed.set(publicKey, ED25519_MULTICODEC.length);
  return `did:key:${base58btc.encode(prefixed)}`;
}

export function publicKeyFromDid(did: string): Uint8Array {
  if (!did.startsWith("did:key:")) throw new Error(`Not a did:key: ${did}`);
  const prefixed = base58btc.decode(did.slice("did:key:".length));
  return prefixed.slice(ED25519_MULTICODEC.length);
}

export async function sign(message: string, privateKey: Uint8Array): Promise<string> {
  const sig = await ed.signAsync(new TextEncoder().encode(message), privateKey);
  return base64urlEncode(sig);
}

export async function verify(message: string, signature: string, publicKey: Uint8Array): Promise<boolean> {
  try {
    return await ed.verifyAsync(base64urlDecode(signature), new TextEncoder().encode(message), publicKey);
  } catch { return false; }
}

export function createAgentDocument(
  did: string,
  opts: Omit<AgentDocument, "pact" | "id" | "created"> = {}
): AgentDocument {
  return { pact: PACT_VERSION, id: did, created: new Date().toISOString(), ...opts };
}

export function base64urlEncode(bytes: Uint8Array): string {
  let b = "";
  for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]);
  return btoa(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(str: string): Uint8Array {
  const p = str.replace(/-/g, "+").replace(/_/g, "/");
  const s = p.length % 4 ? p + "=".repeat(4 - p.length % 4) : p;
  const b = atob(s);
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
