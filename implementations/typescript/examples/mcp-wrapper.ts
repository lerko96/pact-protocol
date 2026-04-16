/**
 * PACT + MCP: wrapping a real MCP tool call in a PACT envelope.
 *
 * Demonstrates the "PACT wraps MCP" pattern:
 *   1. User issues a warrant to an agent for a specific MCP server
 *   2. Agent signs the MCP request inside a PACT envelope
 *   3. MCP server verifies the envelope before executing the tool
 *
 * Run: npx tsx examples/mcp-wrapper.ts
 */

import {
  generateKeypair,
  didFromPublicKey,
  issueWarrant,
  signEnvelope,
  verifyEnvelope,
  createFact,
  exportFactSet,
  CAPABILITIES,
  PREDICATES,
} from "../src/index.js";

// ── Simulate an MCP JSON-RPC tool call ────────────────────────────────────────

interface McpToolCall {
  jsonrpc: "2.0";
  method: "tools/call";
  params: { name: string; arguments: Record<string, unknown> };
  id: number | string;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  // Setup: a user controls a web-search MCP server at mcp://search.example
  const user = await generateKeypair();
  const agent = await generateKeypair();
  const userDid = didFromPublicKey(user.publicKey);
  const agentDid = didFromPublicKey(agent.publicKey);

  const MCP_SERVER = "mcp://search.example";

  // 1. User authorizes the agent to call tools on this specific MCP server
  const warrant = await issueWarrant({
    issuerDid: userDid,
    issuerPrivateKey: user.privateKey,
    subjectDid: agentDid,
    capabilities: [
      { action: CAPABILITIES.TOOL_USE, resource: `${MCP_SERVER}/*` },
      { action: CAPABILITIES.MEMORY_WRITE, resource: "*" },
    ],
    expiresAt: new Date(Date.now() + 3_600_000),
    delegable: false,
  });

  console.log("Warrant issued to agent:", warrant.id);

  // 2. Agent constructs an MCP tool call
  const mcpCall: McpToolCall = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "web_search",
      arguments: { query: "PACT agent protocol 2026", max_results: 5 },
    },
    id: 1,
  };

  // 3. Agent wraps the MCP call in a PACT envelope
  const envelope = await signEnvelope(
    agentDid,
    agent.privateKey,
    userDid,
    [warrant],
    { type: "mcp/tool-call", body: mcpCall }
  );

  console.log("\nSigned envelope ID:", envelope.id);
  console.log("From:", envelope.from.slice(0, 32) + "...");

  // 4. MCP server verifies: is this agent allowed to call web_search here?
  const verification = await verifyEnvelope(
    envelope,
    userDid,
    CAPABILITIES.TOOL_USE,
    `${MCP_SERVER}/web_search`
  );

  console.log("\nVerification:", verification);
  // { valid: true }

  if (!verification.valid) {
    console.error("Rejected:", verification.reason);
    process.exit(1);
  }

  // 5. Tool executes (simulated), agent records result as a PACT fact
  const simulatedResult = "PACT is a minimal agent identity protocol (lerko96/open-pact)";

  const factStore = new Map();

  const resultFact = await createFact({
    sourcePrivateKey: agent.privateKey,
    sourceDid: agentDid,
    subject: userDid,
    predicate: PREDICATES.CONTEXT,
    object: simulatedResult,
    confidence: 0.95,
    expiresAt: new Date(Date.now() + 7 * 24 * 3_600_000), // 1 week TTL
  });

  factStore.set(resultFact.id, resultFact);

  const agentFact = await createFact({
    sourcePrivateKey: agent.privateKey,
    sourceDid: agentDid,
    subject: userDid,
    predicate: PREDICATES.SAID,
    object: "research PACT protocol",
    confidence: 1.0,
  });

  factStore.set(agentFact.id, agentFact);

  // 6. Export the fact set — portable across platforms
  const factSet = exportFactSet(factStore);
  console.log("\nFact set exported:", factSet.id);
  console.log("Facts:", factSet.facts.length);
  console.log("\nPortable JSON (first fact):", JSON.stringify(factSet.facts[0], null, 2));
}

main().catch(console.error);
