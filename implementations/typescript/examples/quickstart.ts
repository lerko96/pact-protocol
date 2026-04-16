/**
 * PACT Quickstart
 * Run: npx tsx examples/quickstart.ts
 */

import {
  generateKeypair,
  didFromPublicKey,
  issueWarrant,
  signEnvelope,
  verifyEnvelope,
  createFact,
  verifyFact,
  CAPABILITIES,
  PREDICATES,
} from "../src/index.js";

async function main() {
  // 1. Create a user (root authority) and an agent
  const user = await generateKeypair();
  const agent = await generateKeypair();
  const userDid = didFromPublicKey(user.publicKey);
  const agentDid = didFromPublicKey(agent.publicKey);

  console.log("User DID:", userDid);
  console.log("Agent DID:", agentDid);

  // 2. User issues a warrant: agent may call tools for 1 hour
  const warrant = await issueWarrant({
    issuerDid: userDid,
    issuerPrivateKey: user.privateKey,
    subjectDid: agentDid,
    capabilities: [{ action: CAPABILITIES.TOOL_USE, resource: "*" }],
    expiresAt: new Date(Date.now() + 3_600_000),
    delegable: false,
  });

  console.log("\nWarrant issued:", warrant.id);

  // 3. Agent signs an envelope around a tool call
  const envelope = await signEnvelope(
    agentDid,
    agent.privateKey,
    userDid,
    [warrant],
    {
      type: "mcp/tool-call",
      body: { method: "tools/call", params: { name: "search", arguments: { q: "PACT protocol" } } },
    }
  );

  // 4. Verify the envelope (tool server side)
  const result = await verifyEnvelope(envelope, userDid, CAPABILITIES.TOOL_USE, "*");
  console.log("\nEnvelope valid:", result.valid); // true

  // 5. Agent records a fact about what it found
  const fact = await createFact({
    sourcePrivateKey: agent.privateKey,
    sourceDid: agentDid,
    subject: userDid,
    predicate: PREDICATES.CONTEXT,
    object: "User prefers concise answers",
    confidence: 0.9,
  });

  const factValid = await verifyFact(fact);
  console.log("Fact CID:", fact.id);
  console.log("Fact valid:", factValid); // true
}

main().catch(console.error);
