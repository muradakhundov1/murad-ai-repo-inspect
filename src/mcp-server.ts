#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./mcp.js";

const allowedRoot = process.env.INSPECTOR_ALLOWED_ROOT ?? process.cwd();
const server = createServer(allowedRoot);
await server.connect(new StdioServerTransport());
