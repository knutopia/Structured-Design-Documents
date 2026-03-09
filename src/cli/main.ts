#!/usr/bin/env node
import { runCli } from "./program.js";

const { exitCode } = await runCli(process.argv);
process.exit(exitCode);
