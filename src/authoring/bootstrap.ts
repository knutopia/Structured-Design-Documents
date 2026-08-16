import type { Bundle } from "../bundle/types.js";

export interface EmptyDocumentBootstrap {
  effectiveVersion: string;
  text: string;
  versionLine: string;
}

export function createEmptyDocumentBootstrap(bundle: Bundle): EmptyDocumentBootstrap {
  const declaration = bundle.syntax.document.version_declaration;
  const effectiveVersion = declaration.default_effective_version;
  const versionLine = `${declaration.literal} ${effectiveVersion}`;
  return {
    effectiveVersion,
    versionLine,
    text: `${versionLine}\n`
  };
}
