#!/usr/bin/env node

import { setupCli } from './cli-setup';

const program = setupCli();
program.parse();

export {};
