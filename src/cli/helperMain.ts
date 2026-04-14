#!/usr/bin/env node
import { runHelperCli } from "./helperProgram.js";

const { exitCode } = await runHelperCli(process.argv);
process.exitCode = exitCode;
