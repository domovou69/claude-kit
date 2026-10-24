#!/usr/bin/env node
// Isolated, chunked, resumable LLM run for an LLM-versus-tool comparison. Copy into the project (e.g. audit/llm/)
// next to input.json and prompt.md, fill the slots below, and run:
//   node run.js <model> <effort> [--name <label>] [--size <items per chunk>] [--chunks 1,2|all] [--concurrency <n>]
// input.json: [{ "id": "...", ...task fields }]. prompt.md: the one prompt for every model; {{COUNT}} becomes the
// number of items in the chunk. The model reads input.json and writes output.json: [{ "id": "...", ...answer }].
// Every chunk runs in a new empty temp folder outside the repository with input.json only, tools Read + Write, no
// settings, hooks, MCP servers or saved session, and a minimal environment. Output is stream-json, so tokens and
// cost survive a stopped chunk. A valid chunk is never run again (resume); `touch STOP` stops after running chunks.
// Writes runs/<model>-<effort>-<name>/chunk-N.json and, once all chunks are valid, runs/<model>-<effort>-<name>.json.
// No dependencies.

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

// ---------------------------------------------------------------- slots
const MODELS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5' }; // key → model id
const EFFORTS = ['low', 'medium', 'high', 'xhigh']; // never max
const DEFAULT_SIZE = 100; // items per chunk; 50–100 kept every model inside one request
const TIMEOUT_MIN = +(process.env.TIMEOUT_MIN || 10); // per chunk
const TOOLS = 'Read,Write';
// ---------------------------------------------------------------- end of slots

const HERE = __dirname;
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const [model, effort] = argv;
if (!MODELS[model] || !EFFORTS.includes(effort)) {
  console.error(`usage: node run.js <${Object.keys(MODELS).join('|')}> <${EFFORTS.join('|')}> [--name <label>] [--size <n>] [--chunks 1,2|all] [--concurrency <n>]`);
  process.exit(2);
}
const name = opt('name', 'run');
const size = +opt('size', DEFAULT_SIZE);
const conc = +opt('concurrency', 1);
const CLI = process.env.CLAUDE_BIN || 'claude';
const input = JSON.parse(fs.readFileSync(path.join(HERE, 'input.json'), 'utf8'));
const promptText = fs.readFileSync(path.join(HERE, 'prompt.md'), 'utf8');
const nChunks = Math.ceil(input.length / size);
const chunksArg = opt('chunks', 'all');
const chunks = chunksArg === 'all' ? [...Array(nChunks).keys()].map((i) => i + 1) : chunksArg.split(',').map(Number);
const RUNS = path.join(HERE, 'runs');
const DIR = path.join(RUNS, `${model}-${effort}-${name}`);
const STOP = path.join(HERE, 'STOP');
fs.mkdirSync(DIR, { recursive: true });
// the parent session's environment stays out: only what the CLI needs to find its login
const env = Object.fromEntries(['HOME', 'USER', 'LOGNAME', 'PATH', 'SHELL', 'TMPDIR', 'LANG'].filter((k) => process.env[k]).map((k) => [k, process.env[k]]));
const cliVersion = (spawnSync(CLI, ['--version'], { encoding: 'utf8', env }).stdout || '').trim() || null;

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const writeJson = (f, v) => { fs.writeFileSync(`${f}.tmp`, JSON.stringify(v, null, 1) + '\n'); fs.renameSync(`${f}.tmp`, f); };
const chunkFile = (n) => path.join(DIR, `chunk-${n}.json`);

function usageOf(u = {}) {
  return { input: u.input_tokens || 0, cacheWrite: u.cache_creation_input_tokens || 0, cacheRead: u.cache_read_input_tokens || 0,
    output: u.output_tokens || 0, thinking: (u.output_tokens_details || {}).thinking_tokens || 0 };
}

function runChunk(n) {
  return new Promise((resolve) => {
    const done = readJson(chunkFile(n));
    if (done && done.valid) { console.log(`chunk ${n}: done before, skipped`); return resolve(); }
    const part = input.slice((n - 1) * size, n * size);
    const ids = part.map((x) => x.id);
    const work = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-run-'));
    fs.writeFileSync(path.join(work, 'input.json'), JSON.stringify(part, null, 1));
    const prompt = promptText.replaceAll('{{COUNT}}', String(part.length));
    const args = ['-p', prompt, '--model', MODELS[model], '--effort', effort, '--tools', TOOLS,
      '--setting-sources', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
      '--permission-mode', 'acceptEdits', '--no-session-persistence', '--output-format', 'stream-json', '--verbose'];
    const t0 = Date.now();
    const perMessage = {};
    let result = null;
    let buf = '';
    let timedOut = false;
    const p = spawn(CLI, args, { cwd: work, env });
    const timer = setTimeout(() => { timedOut = true; p.kill('SIGTERM'); }, TIMEOUT_MIN * 60e3);
    p.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        let j;
        try { j = JSON.parse(line); } catch { continue; }
        if (j.type === 'assistant' && j.message) perMessage[j.message.id || Object.keys(perMessage).length] = j.message.usage;
        if (j.type === 'result') result = j;
      }
    });
    let stderr = '';
    p.stderr.on('data', (d) => { stderr = (stderr + d).slice(-4000); });
    p.on('close', (code, signal) => {
      clearTimeout(timer);
      // the final result line is exact; summing per-message usage (a stopped chunk) undercounts output
      let usage = usageOf();
      if (result && result.usage) usage = usageOf(result.usage);
      else for (const u of Object.values(perMessage)) { const x = usageOf(u); for (const k in usage) usage[k] += x[k]; }
      let output = null;
      let error = null;
      try {
        output = JSON.parse(fs.readFileSync(path.join(work, 'output.json'), 'utf8'));
        if (!Array.isArray(output)) throw new Error('not an array');
      } catch (e) {
        error = `output.json: ${e.message}`;
        output = null;
      }
      const got = new Set((output || []).map((x) => x.id));
      const missing = ids.filter((id) => !got.has(id));
      const rec = {
        model, modelId: MODELS[model], effort, name, chunk: n, size, ids: ids.length, valid: !error && !missing.length, error, missing,
        exitCode: code, signal, timedOut, wallMs: Date.now() - t0, costUsd: result ? result.total_cost_usd ?? null : null,
        costComplete: !!result, usage, files: fs.readdirSync(work).filter((f) => f !== 'input.json'), stderr, output,
      };
      writeJson(chunkFile(n), rec);
      fs.rmSync(work, { recursive: true, force: true });
      const cost = rec.costUsd != null ? `$${rec.costUsd.toFixed(2)}` : 'cost unknown';
      console.log(`chunk ${n}: ${rec.valid ? 'ok' : error || `missing ${missing.length}`} · ${(rec.wallMs / 60e3).toFixed(1)} min · ${cost}${timedOut ? ' · TIMEOUT' : ''}`);
      resolve();
    });
  });
}

(async () => {
  const queue = [...chunks];
  await Promise.all(Array.from({ length: conc }, async () => {
    while (queue.length) {
      if (fs.existsSync(STOP)) { console.log('STOP file found, not starting more chunks'); return; }
      await runChunk(queue.shift());
    }
  }));
  const recs = [...Array(nChunks).keys()].map((i) => readJson(chunkFile(i + 1)));
  const valid = recs.filter((r) => r && r.valid);
  // time is the sum of chunk times: chunks may run in parallel or in different sessions (resume)
  const tot = { wallMs: 0, costUsd: 0, costComplete: true, usage: usageOf() };
  for (const r of recs) {
    if (!r) continue;
    tot.wallMs += r.wallMs;
    tot.costUsd += r.costUsd || 0;
    if (!r.costComplete) tot.costComplete = false;
    for (const k in tot.usage) tot.usage[k] += r.usage[k];
  }
  console.log(`${valid.length}/${nChunks} chunks valid · ${(tot.wallMs / 60e3).toFixed(1)} min · $${tot.costUsd.toFixed(2)}${tot.costComplete ? '' : ' (some chunks have no cost line)'}`);
  if (valid.length !== nChunks) process.exit(1);
  const merged = {
    model, modelId: MODELS[model], effort, name, cliVersion, chunked: size, chunks: nChunks, promptText,
    wallMs: tot.wallMs, costUsd: tot.costUsd, costComplete: tot.costComplete, usage: tot.usage,
    output: recs.flatMap((r) => r.output),
  };
  writeJson(path.join(RUNS, `${model}-${effort}-${name}.json`), merged);
  console.log(`merged runs/${model}-${effort}-${name}.json: ${merged.output.length} answers`);
})();
