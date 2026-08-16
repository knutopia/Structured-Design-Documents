import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function source(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("Guided Addition v1 published documentation", () => {
  const readme = source("README.md");
  const siteReadme = source("docs/doc_site/README.md");
  const cliGuide = source("docs/doc_site/sdd_cli_tools/index.md");
  const architecture = source("docs/toolchain/architecture.md");
  const helperGuide = source("docs/doc_site/sdd-helper/index.md");

  it("documents the versioned public runtime, executor, error, and metadata boundary", () => {
    expect(architecture).toContain("createGuidedAdditionRuntimeV1(bundle)");
    expect(architecture).toContain("applyAdditionProposalV1(workspace, bundle, args)");
    expect(architecture).toContain("GuidedAdditionV1DomainError");
    expect(architecture).toContain('contract_version: "0.1"');
    expect(architecture).toContain('workflow_version: "1.0"');
    expect(architecture).toContain('proposal_version: "1.0"');
    expect(helperGuide).toContain("Guided Addition v1 `domain.service.*` metadata");
    expect(helperGuide).toContain("createGuidedAdditionRuntimeV1(...)");
    expect(helperGuide).toContain("applyAdditionProposalV1(...)");
  });

  it("documents contextual filtering, semantic organization, and one ordinary Save decision", () => {
    expect(cliGuide).toContain("`--node <node_id>` supplies an exact starting-node anchor");
    expect(cliGuide).toContain("select a diagram, change it, or return to all diagram types");
    expect(cliGuide).toContain("`sdd add` does not accept a `--view` option");
    expect(cliGuide).toContain("relationship type first or choosing an existing connected node first");
    expect(cliGuide).toContain("Relationship-line placement is handled internally rather than presented as a user choice");
    expect(cliGuide).toContain("If verification has no warnings, the command commits immediately without a second ordinary confirmation");
    expect(cliGuide).toContain("A concrete warning offers `Save anyway` or `Go back`");
    expect(cliGuide).toContain("`Cancel` performs no verification and writes nothing");
    expect(readme).toContain("Interactive Guided Addition v1 through `sdd add`");
    expect(siteReadme).toContain("Interactive Guided Addition v1 through `sdd add`");
    expect(siteReadme).toContain("Guided addition is currently terminal-based");
  });

  it("contains no current claim for the rejected workflow or an available guided adapter", () => {
    const currentDocs = [readme, siteReadme, cliGuide, architecture, helperGuide].join("\n");
    expect(currentDocs).not.toMatch(/\bendpoint_strategy\b|\bset_filter\b/);
    expect(currentDocs).not.toMatch(/createGuidedAdditionRuntime\(bundle\)/);
    expect(currentDocs).not.toMatch(/applyAdditionProposal\(workspace/);
    expect(currentDocs).not.toMatch(/\bGuidedAdditionDomainError\b/);
    expect(currentDocs).not.toContain("Edge placement remains a separate recommendation");
    expect(currentDocs).not.toContain("generic placement recommendations");
    expect(currentDocs).not.toContain("final commit prompt");
    expect(currentDocs).not.toMatch(/sdd add[^\n`]*--view/);
    expect(cliGuide).not.toMatch(/\breparent\w*/i);
    expect(helperGuide).toContain("This does not add guided helper commands");
    expect(helperGuide).toContain("Any helper or MCP adapter requires a separate approved plan");
  });

  it("emits declarations for v1 and no removed unversioned Guided Addition exports", () => {
    const declarations = source("dist/index.d.ts");
    expect(declarations).toContain("createGuidedAdditionRuntimeV1");
    expect(declarations).toContain("applyAdditionProposalV1");
    expect(declarations).toContain("GuidedAdditionV1DomainError");
    expect(declarations).not.toMatch(/createGuidedAdditionRuntime[}\s]/);
    expect(declarations).not.toMatch(/applyAdditionProposal[}\s]/);
    expect(declarations).not.toMatch(/GuidedAdditionDomainError/);
  });
});
