import { ruleExecutors } from "./ruleExecutors.js";

export function getRuleExecutor(kind: string) {
  return ruleExecutors[kind];
}

