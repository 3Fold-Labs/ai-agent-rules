#!/usr/bin/env node
// Local stdio MCP server. stdout is protocol messages only. No network, no files written.
import {createInterface} from 'node:readline';
import {VERSION} from '../src/core/version.mjs';
import {PLUGIN_VERSION, SERVER_NAME, REMINDER} from './session.mjs';
import {TOOLS, callTool} from './tools.mjs';

const PROTOCOL_VERSIONS = ['2024-11-05', '2025-03-26', '2025-06-18'];

function send(message) {
  process.stdout.write(JSON.stringify(message) + '\n');
}

function reply(id, result) {
  send({jsonrpc: '2.0', id, result});
}

function fail(id, code, message) {
  send({jsonrpc: '2.0', id: id ?? null, error: {code, message}});
}

function initialize(params) {
  const requested = params && params.protocolVersion;
  return {
    protocolVersion: PROTOCOL_VERSIONS.includes(requested) ? requested : PROTOCOL_VERSIONS.at(-1),
    capabilities: {tools: {}},
    serverInfo: {name: SERVER_NAME, version: PLUGIN_VERSION, title: '100-Question AI Agent Setup'},
    instructions: `100-Question AI Agent Setup ${VERSION}. Two tracks, 100 questions each. ${REMINDER}`
  };
}

function onMessage(message) {
  if (!message || message.jsonrpc !== '2.0' || typeof message.method !== 'string') {
    fail(message && message.id, -32600, 'Invalid request');
    return;
  }
  const {id, method, params} = message;
  if (id == null) return;
  if (method === 'initialize') {
    reply(id, initialize(params));
    return;
  }
  if (method === 'ping') {
    reply(id, {});
    return;
  }
  if (method === 'tools/list') {
    reply(id, {tools: TOOLS});
    return;
  }
  if (method === 'tools/call') {
    const name = params && params.name;
    const args = params && params.arguments;
    if (typeof name !== 'string' || (args != null && (typeof args !== 'object' || Array.isArray(args)))) {
      fail(id, -32602, 'Invalid tool call');
      return;
    }
    try {
      reply(id, {content: [{type: 'text', text: JSON.stringify(callTool(name, args), null, 2)}], isError: false});
    } catch (error) {
      reply(id, {content: [{type: 'text', text: error.message || 'The tool could not run.'}], isError: true});
    }
    return;
  }
  fail(id, -32601, `Method not found: ${method}`);
}

const lines = createInterface({input: process.stdin, terminal: false});
lines.on('line', line => {
  const text = line.trim();
  if (!text) return;
  let message;
  try {
    message = JSON.parse(text);
  } catch {
    fail(null, -32700, 'Parse error');
    return;
  }
  onMessage(message);
});
