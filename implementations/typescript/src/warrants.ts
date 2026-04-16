/**
 * PACT-02: Warrants
 * Authority flows downward from a human root.
 * No agent can grant more than it holds.
 */

import { v4 as uuidv4 } from "uuid";
import { PACT_VERSION, canonicalize, sign, verify, publicKeyFromDid } from "./identity.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Capability {
  action: string;
  resource: string;
  constraints?: Record<string, unknown>;
}

export interface Warrant {
  pact: string;
  type: "warrant";
  id: string;
  issuer: string;
  subject: string;
  issued: string;
  expires: string;
  capabilities: Capability[];
  delegable: boolean;
  parent: string | null;
  signature: string;
}

export interface MessagePayload {
  type: string;
  body: unknown;
}

export interface Envelope {
  pact: string;
  type: "message";
  id: string;
  from: string;
  to: string;
  sent: string;
  warrants: Warrant[];
  payload: MessagePayload;
  signature: string;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
}

// ── Issuance ──────────────────────────────────────────────────────────────────

export interface IssueWarrantOptions {
  issuerDid: string;
  issuerPrivateKey: Uint8Array;
  subjectDid: string;
  capabilities: Capability[];
  expiresAt: Date;
  delegable?: boolean;
  parentId?: string | null;
}

export async function issueWarrant(opts: IssueWarrantOptions): Promise<Warrant> {
  const partial = {
    pact: PACT_VERSION,
    type: "warrant" as const,
    id: uuidv4(),
    issuer: opts.issuerDid,
    subject: opts.subjectDid,
    issued: new Date().toISOString(),
    expires: opts.expiresAt.toISOString(),
    capabilities: opts.capabilities,
    delegable: opts.delegable ?? false,
    parent: opts.parentId ?? null,
  };
  const signature = await sign(canonicalize(partial), opts.issuerPrivateKey);
  return { ...partial, signature };
}

// ── Verification ──────────────────────────────────────────────────────────────

export async function verifyWarrant(warrant: Warrant): Promise<VerifyResult> {
  if (new Date(warrant.expires) < new Date())
    return { valid: false, reason: "Warrant expired" };

  const { signature, ...rest } = warrant;
  const ok = await verify(canonicalize(rest), signature, publicKeyFromDid(warrant.issuer));
  return ok ? { valid: true } : { valid: false, reason: "Invalid signature" };
}

export async function verifyWarrantChain(
  chain: Warrant[],
  trustedRootDid: string
): Promise<VerifyResult> {
  if (chain.length === 0)
    return { valid: false, reason: "Empty warrant chain" };

  for (let i = 0; i < chain.length; i++) {
    const result = await verifyWarrant(chain[i]);
    if (!result.valid)
      return { valid: false, reason: `Warrant ${i}: ${result.reason}` };

    if (i > 0) {
      const rootSide = chain[i];     // root-direction warrant (issued to chain[i-1]'s issuer)
      const leafSide = chain[i - 1]; // leaf-direction warrant (issued by rootSide's subject)
      if (rootSide.subject !== leafSide.issuer)
        return { valid: false, reason: `Chain broken at ${i}: subject/issuer mismatch` };

      if (!rootSide.delegable)
        return { valid: false, reason: `Warrant at ${i} is not delegable` };

      const att = checkAttenuation(rootSide, leafSide);
      if (!att.valid) return att;
    }
  }

  const root = chain[chain.length - 1];
  if (root.parent !== null)
    return { valid: false, reason: "Root warrant must have null parent" };
  if (root.issuer !== trustedRootDid)
    return { valid: false, reason: `Root issuer does not match trusted root` };

  return { valid: true };
}

function checkAttenuation(parent: Warrant, child: Warrant): VerifyResult {
  if (new Date(child.expires) > new Date(parent.expires))
    return { valid: false, reason: "Child warrant expires after parent" };

  for (const childCap of child.capabilities) {
    const covered = parent.capabilities.some((p) => capabilityCovered(p, childCap));
    if (!covered)
      return { valid: false, reason: `Child capability ${childCap.action}:${childCap.resource} not covered by parent` };
  }
  return { valid: true };
}

function capabilityCovered(parent: Capability, child: Capability): boolean {
  if (parent.action !== child.action) return false;
  if (parent.resource === "*") return true;
  if (child.resource === "*") return false;
  const base = parent.resource.replace(/\*$/, "");
  return child.resource.startsWith(base);
}

// ── Envelope ──────────────────────────────────────────────────────────────────

export async function signEnvelope(
  senderDid: string,
  senderPrivateKey: Uint8Array,
  recipientDid: string,
  warrants: Warrant[],
  payload: MessagePayload
): Promise<Envelope> {
  const partial = {
    pact: PACT_VERSION,
    type: "message" as const,
    id: uuidv4(),
    from: senderDid,
    to: recipientDid,
    sent: new Date().toISOString(),
    warrants,
    payload,
  };
  const signature = await sign(canonicalize(partial), senderPrivateKey);
  return { ...partial, signature };
}

export async function verifyEnvelope(
  envelope: Envelope,
  trustedRootDid: string,
  requiredAction: string,
  requiredResource: string
): Promise<VerifyResult> {
  // Clock skew ±5 minutes
  if (Math.abs(Date.now() - new Date(envelope.sent).getTime()) > 5 * 60 * 1000)
    return { valid: false, reason: "Envelope timestamp outside acceptable skew" };

  // Envelope signature
  const { signature, ...rest } = envelope;
  const ok = await verify(canonicalize(rest), signature, publicKeyFromDid(envelope.from));
  if (!ok) return { valid: false, reason: "Invalid envelope signature" };

  // Warrant chain
  const chainResult = await verifyWarrantChain(envelope.warrants, trustedRootDid);
  if (!chainResult.valid) return chainResult;

  // Leaf subject must match sender
  const leaf = envelope.warrants[0];
  if (leaf.subject !== envelope.from)
    return { valid: false, reason: "Leaf warrant subject does not match sender" };

  // Action/resource coverage
  const covered = leaf.capabilities.some((cap) =>
    capabilityCovered(cap, { action: requiredAction, resource: requiredResource })
  );
  if (!covered)
    return { valid: false, reason: `Sender not authorized for ${requiredAction}:${requiredResource}` };

  return { valid: true };
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const CAPABILITIES = {
  TOOL_USE:     "pact:tool-use",
  AGENT_CALL:   "pact:agent-call",
  MEMORY_READ:  "pact:memory-read",
  MEMORY_WRITE: "pact:memory-write",
  DELEGATE:     "pact:delegate",
} as const;
