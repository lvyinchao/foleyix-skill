import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(repository, 'skills/audiocreator-foleyix/scripts/foleyix.mjs');
const oldAccess = 'access-opaque-fixture-0123456789';
const oldRefresh = 'refresh-opaque-fixture-0123456789';
const newAccess = 'access-rotated-fixture-0123456789';
const newRefresh = 'refresh-rotated-fixture-0123456789';
const deviceSecret = 'device-opaque-fixture-0123456789';
const refreshExpiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
function wav() {
  const data = Buffer.alloc(320), bytes = Buffer.alloc(44 + data.length);
  bytes.write('RIFF'); bytes.writeUInt32LE(bytes.length - 8, 4); bytes.write('WAVE', 8); bytes.write('fmt ', 12); bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22); bytes.writeUInt32LE(16000, 24); bytes.writeUInt32LE(32000, 28); bytes.writeUInt16LE(2, 32); bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36); bytes.writeUInt32LE(data.length, 40); data.copy(bytes, 44);
  return bytes;
}
const audio = wav();
function child(program, args, options = {}) {
  return new Promise((resolve, reject) => {
    const process = spawn(program, args, { cwd: repository, ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    process.stdout.on('data', (part) => { stdout += part; }); process.stderr.on('data', (part) => { stderr += part; });
    process.on('error', reject); process.on('exit', (code) => resolve({ code, stdout, stderr }));
  });
}
async function fixture(t, { handler } = {}) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'foleyix-cli-'));
  const configRoot = path.join(directory, 'private');
  const requests = [], jobs = new Map(), generationBodies = [], keys = [], state = { refreshCount: 0, generationCount: 0, revokeCount: 0, polls: 0, validAccess: oldAccess, status: 'succeeded' };
  let origin;
  function job(id = 'job-1', extra = {}) {
    return { id, kind: 'generation', projectName: null, segmentTitle: 'Standalone audio', status: state.status, quotaUnits: 1, quotaUnit: 'seconds', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), resultAvailable: state.status === 'succeeded', resultExpiresAt: new Date(Date.now() + 3600000).toISOString(), asset: state.status === 'succeeded' ? { id: 'asset-' + id, mime: 'audio/wav', bytes: audio.length, duration: 0.01, url: '/api/assets/asset-' + id } : null, ...extra };
  }
  const server = http.createServer(async (request, response) => {
    const bodyParts = [];
    for await (const chunk of request) bodyParts.push(chunk);
    const raw = Buffer.concat(bodyParts), body = request.headers['content-type'] === 'audio/wav' ? raw : raw.length ? JSON.parse(raw.toString('utf8')) : null;
    requests.push({ method: request.method, url: request.url, headers: request.headers, body });
    const send = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
    if (handler && await handler({ request, response, body, send, state, job, jobs, origin })) return;
    if (request.url === '/api/cli/auth/device-code') return send(200, { device_code: deviceSecret, user_code: 'ABCD-EFGH', verification_uri: origin + '/activate', verification_uri_complete: origin + '/activate?user_code=ABCD-EFGH', expires_in: 600, interval: 1 });
    if (request.url === '/api/cli/auth/token') {
      if (body.grant_type === 'refresh_token') {
        state.refreshCount++;
        if (state.refreshCount > 1 || body.refresh_token !== oldRefresh) return send(400, { error: 'invalid_grant' });
        await new Promise((resolve) => setTimeout(resolve, 100)); state.validAccess = newAccess;
        return send(200, { token_type: 'Bearer', access_token: newAccess, refresh_token: newRefresh, expires_in: 900, refresh_expires_at: refreshExpiresAt });
      }
      state.polls++;
      return send(200, { token_type: 'Bearer', access_token: oldAccess, refresh_token: oldRefresh, expires_in: 900, refresh_expires_at: refreshExpiresAt });
    }
    if (request.url === '/api/cli/auth/revoke') { state.revokeCount++; assert.equal(request.headers.authorization, undefined); assert.equal(body.client_id, 'foleyix-cli'); assert.ok([oldRefresh, newRefresh].includes(body.refresh_token)); return send(200, { success: true }); }
    if (request.headers.authorization !== 'Bearer ' + state.validAccess) return send(401, { error: 'Expired credential', code: 'invalid_token' });
    if (request.url === '/api/cli/auth/whoami') return send(200, { user: { id: 'user-fixture', email: 'user@example.test', name: 'Fixture' }, scopes: ['audio:read', 'audio:generate'], expiresAt: new Date(Date.now() + 900000).toISOString(), modelEnabled: true });
    if (request.url === '/api/quota') return send(200, { quota: { plan: 'trial', generationUnit: 'seconds', generationLimit: 300, generationUsed: 1, generationReserved: 0, queueLimit: 1, queueUsed: 0, privateToken: oldAccess } });
    if (request.url === '/api/generations') {
      state.generationCount++; generationBodies.push(body); keys.push(request.headers['idempotency-key']);
      const key = request.headers['idempotency-key'];
      if (!jobs.has(key)) jobs.set(key, job('job-' + jobs.size));
      return send(202, { job: jobs.get(key) });
    }
    if (request.url?.startsWith('/api/jobs/')) return send(200, { job: job(decodeURIComponent(request.url.slice('/api/jobs/'.length))) });
    if (request.url?.startsWith('/api/jobs')) return send(200, { jobs: [...jobs.values()], nextCursor: 'cursor+fixture/next' });
    if (request.url?.startsWith('/api/assets/')) { response.writeHead(200, { 'Content-Type': 'audio/wav', 'Content-Length': audio.length }); return response.end(audio); }
    return send(404, { error: 'Missing', code: 'not_found' });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  const configDirectory = path.join(configRoot, createHash('sha256').update(origin).digest('hex'));
  const credentialPath = path.join(configDirectory, 'credentials.json');
  const run = async (args, options = {}) => {
    const result = await child(process.execPath, [cli, ...args, '--json', '--origin', options.origin || origin], { env: { ...process.env, FOLEYIX_CONFIG_DIR: options.configRoot || configRoot } });
    const lines = result.stdout.trim().split('\n');
    assert.equal(lines.length, 1, 'stdout is one JSON object');
    result.data = JSON.parse(lines[0]);
    for (const secret of [oldAccess, oldRefresh, newAccess, newRefresh, deviceSecret]) assert.ok(!result.stdout.includes(secret) && !result.stderr.includes(secret), 'No secret in process output');
    return result;
  };
  const seed = async (patch = {}) => {
    await fs.mkdir(configDirectory, { recursive: true, mode: 0o700 });
    const credentials = { origin, accessToken: oldAccess, refreshToken: oldRefresh, expiresAt: Date.now() + 900000, refreshExpiresAt: Date.parse(refreshExpiresAt), refreshPending: false, ...patch };
    await fs.writeFile(credentialPath, JSON.stringify(credentials), { mode: 0o600 });
    return credentials;
  };
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); await fs.rm(directory, { recursive: true, force: true }); });
  return { directory, configRoot, configDirectory, credentialPath, origin, requests, state, jobs, job, keys, generationBodies, run, seed };
}

test('device login waits for human approval, saves private per-origin login, and never outputs secrets', async (t) => {
  const f = await fixture(t, { handler({ request, body, send, state }) { if (request.url === '/api/cli/auth/token' && body.grant_type !== 'refresh_token' && state.polls++ === 0) { send(400, { error: 'authorization_pending' }); return true; } } });
  const result = await f.run(['login']);
  assert.equal((await f.run(['version'])).data.version, '1.5.0');
  assert.equal(result.code, 0); assert.equal(result.data.user.email, 'user@example.test'); assert.equal(result.data.modelEnabled, true);
  assert.match(result.stderr, /ABCD-EFGH/); assert.match(result.stderr, /\/activate\?user_code=ABCD-EFGH/);
  const saved = JSON.parse(await fs.readFile(f.credentialPath, 'utf8'));
  assert.equal(saved.refreshExpiresAt, Date.parse(refreshExpiresAt));
  if (process.platform !== 'win32') { assert.equal((await fs.stat(f.configDirectory)).mode & 0o777, 0o700); assert.equal((await fs.stat(f.credentialPath)).mode & 0o777, 0o600); }
  assert.ok(f.requests.every((request) => request.headers.origin === undefined));
});
for (const error of ['access_denied', 'expired_token']) test('login reports ' + error + ' without saving credentials', async (t) => {
  const f = await fixture(t, { handler({ request, send }) { if (request.url === '/api/cli/auth/token') { send(400, { error }); return true; } } });
  const result = await f.run(['login', '--no-browser']); assert.equal(result.code, 1); assert.equal(result.data.error.code, error); await assert.rejects(fs.access(f.credentialPath));
});
test('login deadline returns a concrete timeout', async (t) => {
  const f = await fixture(t); const result = await f.run(['login', '--no-browser', '--timeout', '1']); assert.equal(result.data.error.code, 'login_timeout'); assert.equal(f.state.polls, 0);
});
test('whoami, shared seconds quota, and history expose only public fields', async (t) => {
  const f = await fixture(t); await f.seed();
  assert.equal((await f.run(['whoami'])).data.user.id, 'user-fixture');
  const quota = (await f.run(['quota'])).data.quota; assert.equal(quota.generationUnit, 'seconds'); assert.equal(quota.generationLimit, 300); assert.equal(quota.privateToken, undefined);
  await f.run(['jobs', '--active', '--limit', '50', '--cursor', 'a+b/c']);
  const query = new URL(f.requests.at(-1).url, f.origin).searchParams; assert.equal(query.get('active'), '1'); assert.equal(query.get('cursor'), 'a+b/c');
});
test('all seven modes and UTF-8 file input generate and deliver complete WAV bytes', async (t) => {
  const f = await fixture(t); await f.seed();
  const text = path.join(f.directory, 'script.txt'); await fs.writeFile(text, '你好，世界。');
  for (const mode of ['narration', 'free', 'dialogue', 'podcast', 'scene', 'sfx', 'ambience']) {
    const out = path.join(f.directory, mode + '.wav');
    const args = ['generate', '--mode', mode, ...(mode === 'narration' ? ['--input', text] : ['--prompt', 'A short ' + mode]), '--out', out];
    const result = await f.run(args); assert.equal(result.code, 0); assert.equal(result.data.path, out); assert.equal(result.data.status, 'succeeded'); assert.deepEqual(await fs.readFile(out), audio);
  }
  assert.deepEqual(f.generationBodies.map((body) => body.mode), ['narration', 'free', 'dialogue', 'podcast', 'scene', 'sfx', 'ambience']); assert.equal(f.generationBodies[0].prompt, '你好，世界。');
});
test('capabilities lists website audio types offline without creating account state', async (t) => {
  const f = await fixture(t);
  const result = await f.run(['capabilities']);
  assert.equal(result.code, 0);
  const types = result.data.capabilities.types;
  for (const [id, mode] of [['song', 'free'], ['background-music', 'free'], ['podcast', 'podcast'], ['ambience', 'ambience'], ['sound-effects', 'sfx']]) assert.equal(types.find(type => type.id === id).cliMode, mode);
  assert.equal(types.find(type => type.id === 'character-voice').cliMode, null);
  assert.equal(f.requests.length, 0);
  await assert.rejects(fs.access(f.configRoot));
});
test('songs preserve sung lyrics and BGM preserves instrumental directions in their shared free mode', async (t) => {
  const f = await fixture(t); await f.seed();
  const prompts = ['Original folk song, warm female singing.\n[Verse]\n月光照着归家的路。\n[Chorus]\n我把思念唱给你听。', 'Instrumental background music, soft piano, gentle pulse. No singing or spoken words.'];
  for (const [index, prompt] of prompts.entries()) {
    const result = await f.run(['generate', '--mode', 'free', '--prompt', prompt, '--out', path.join(f.directory, `music-${index}.wav`)]);
    assert.equal(result.code, 0);
  }
  assert.deepEqual(f.generationBodies.map(body => ({ mode: body.mode, prompt: body.prompt })), prompts.map(prompt => ({ mode: 'free', prompt })));
});

test('owned reference listing exposes only public metadata; ordered binding and recovery keep the correct speakers', async t => {
  const f = await fixture(t, { handler({request, send}) {
    if (request.url !== '/api/voices') return;
    assert.equal(request.headers.authorization, 'Bearer ' + oldAccess);
    send(200, {voices: [{id:'saved-lin',name:'林',description:'Soft synthetic voice',status:'done',source:'catalog',assetId:'reference-asset',referenceAudio:{duration:2,bytes:64044},r2_key:'private/bucket/key',privateToken:oldAccess}]});
    return true;
  }});
  await f.seed();
  const voices = await f.run(['voices']);
  assert.equal(voices.code, 0); assert.deepEqual(voices.data.voices[0], {id:'saved-lin',name:'林',description:'Soft synthetic voice',status:'done',source:'catalog',assetId:'reference-asset',referenceAudio:{duration:2,bytes:64044}});
  const prompt = '林（@voice1）：“你还是来了。” 周（@voice2）：“我答应过你。”';
  const args = ['generate','--mode','dialogue','--prompt',prompt,'--voice-id','saved-lin','--voice-id=saved-zhou','--voice-id','saved-third','--request-id','ordered-voices'];
  const out = path.join(f.directory, 'reference-dialogue.wav');
  assert.equal((await f.run([...args,'--out',out])).code, 0);
  assert.deepEqual(await fs.readFile(out), audio);
  assert.deepEqual(f.generationBodies, [{mode:'dialogue',prompt,voiceIds:['saved-lin','saved-zhou','saved-third']}]);
  assert.equal((await f.run(args)).code, 0); assert.equal(f.state.generationCount, 1);
  for (const ids of [['saved-zhou','saved-lin','saved-third'], ['saved-lin'], []]) {
    const retry = await f.run(['generate','--mode','dialogue','--prompt',prompt,'--request-id','ordered-voices',...ids.flatMap(id => ['--voice-id',id])]);
    assert.equal(retry.data.error.code, 'idempotency_conflict');
  }
  assert.equal(f.state.generationCount, 1);
});

test('invalid reference arguments fail before authentication, journal writes and generation', async t => {
  const f = await fixture(t);
  for (const ids of [['a','b','c','d'],['same','same'],['../local.wav'],[''],['a'.repeat(129)]]) {
    const result = await f.run(['generate','--prompt','Exact spoken words.',...ids.flatMap(id => ['--voice-id',id])]);
    assert.equal(result.data.error.code,'invalid_argument');
  }
  assert.equal((await f.run(['voices','--voice-id','a'])).data.error.code,'invalid_argument');
  assert.equal(f.requests.length,0);
  await assert.rejects(fs.access(path.join(f.configDirectory,'requests.json')));
});

test('reference rejection is explicit and never retried or replaced with an unbound request', async t => {
  const f = await fixture(t, {handler({request, body, send}) {
    if (request.url !== '/api/generations') return;
    assert.deepEqual(body.voiceIds,['foreign-voice']); send(400,{code:'voice_not_ready',error:'Untrusted private server detail'}); return true;
  }});
  await f.seed();
  const result = await f.run(['generate','--prompt','@voice1: Hello.','--voice-id','foreign-voice']);
  assert.equal(result.code,1); assert.equal(result.data.error.code,'voice_not_ready'); assert.match(result.data.error.message,/owned/);
  assert.ok(!result.stdout.includes('Untrusted private server detail'));
  assert.equal(f.requests.filter(request=>request.url==='/api/generations').length,1);
});
test('concurrent processes refresh once under lock and keep absolute session expiry', async (t) => {
  const f = await fixture(t); await f.seed({ expiresAt: Date.now() - 1 });
  const results = await Promise.all([f.run(['whoami']), f.run(['quota']), f.run(['whoami'])]);
  assert.ok(results.every((r) => r.code === 0)); assert.equal(f.state.refreshCount, 1);
  const saved = JSON.parse(await fs.readFile(f.credentialPath, 'utf8')); assert.equal(saved.refreshExpiresAt, Date.parse(refreshExpiresAt)); assert.equal(saved.refreshPending, false);
});
test('lost refresh response never replays the consumed token and logout can revoke that session', async (t) => {
  const f = await fixture(t, { handler({ request, response, body, state }) { if (request.url === '/api/cli/auth/token' && body.grant_type === 'refresh_token') { state.refreshCount++; response.destroy(); return true; } } });
  await f.seed({ expiresAt: Date.now() - 1 });
  assert.equal((await f.run(['whoami'])).data.error.code, 'login_required'); assert.equal((await f.run(['whoami'])).data.error.code, 'login_required'); assert.equal(f.state.refreshCount, 1);
  assert.equal(JSON.parse(await fs.readFile(f.credentialPath, 'utf8')).refreshPending, true);
  assert.equal((await f.run(['logout'])).data.revoked, true); assert.equal(f.state.revokeCount, 1); await assert.rejects(fs.access(f.credentialPath));
});
test('logout after expired access revokes with refresh proof without minting another access token', async (t) => {
  const f = await fixture(t); await f.seed({ expiresAt: Date.now() - 1 });
  assert.equal((await f.run(['logout'])).code, 0); assert.equal(f.state.revokeCount, 1); assert.equal(f.state.refreshCount, 0); await assert.rejects(fs.access(f.credentialPath));
});
test('uncertain revoke keeps local login and reports failure', async (t) => {
  const f = await fixture(t, { handler({ request, response }) { if (request.url === '/api/cli/auth/revoke') { response.destroy(); return true; } } });
  await f.seed(); const result = await f.run(['logout']); assert.equal(result.code, 1); await fs.access(f.credentialPath);
});
test('generation response loss retries one persistent key and creates only one task', async (t) => {
  const keys = new Set(); let calls = 0;
  const f = await fixture(t, { handler({ request, response, send, job }) { if (request.url === '/api/generations') { calls++; keys.add(request.headers['idempotency-key']); if (calls === 1) response.destroy(); else send(202, { job: job('lost-response-job') }); return true; } } });
  await f.seed(); const result = await f.run(['generate', '--prompt', 'Response loss fixture']); assert.equal(result.code, 0); assert.equal(calls, 2); assert.equal(keys.size, 1);
  assert.equal((await f.run(['generate', '--prompt', 'Response loss fixture', '--request-id', result.data.requestId])).data.jobId, 'lost-response-job'); assert.equal(calls, 2);
  const conflict = await f.run(['generate', '--prompt', 'Different input', '--request-id', result.data.requestId]); assert.equal(conflict.data.error.code, 'idempotency_conflict'); assert.equal(calls, 2);
});
test('malformed accepted generation response remains uncertain and resumes the same request key', async (t) => {
  const keys = []; let calls = 0;
  const f = await fixture(t, { handler({ request, response, send, job }) { if (request.url === '/api/generations') { calls++; keys.push(request.headers['idempotency-key']); if (calls === 1) { response.writeHead(202, { 'Content-Type': 'text/html' }); response.end('<html>accepted</html>'); } else send(202, { job: job() }); return true; } } });
  await f.seed(); const first = await f.run(['generate', '--prompt', 'Malformed response fixture']); assert.equal(first.code, 1); assert.ok(first.data.error.requestId);
  const second = await f.run(['generate', '--prompt', 'Malformed response fixture']); assert.equal(second.code, 0); assert.equal(keys[0], keys[1]); assert.equal(second.data.requestId, first.data.error.requestId);
});
test('server error after durable acceptance retries the same key', async (t) => {
  const keys = []; let calls = 0;
  const f = await fixture(t, { handler({ request, send, job }) { if (request.url === '/api/generations') { keys.push(request.headers['idempotency-key']); send(++calls === 1 ? 500 : 202, calls === 1 ? { error: 'Database response lost', code: 'internal_error' } : { job: job() }); return true; } } });
  await f.seed(); assert.equal((await f.run(['generate', '--prompt', '500 fixture'])).code, 0); assert.equal(keys.length, 2); assert.equal(keys[0], keys[1]);
});
test('timeout and no-wait commands resume a known pending task without another POST', async (t) => {
  const f = await fixture(t); await f.seed(); f.state.status = 'queued';
  const first = await f.run(['generate', '--prompt', 'Queue fixture', '--timeout', '1']); assert.equal(first.data.timedOut, true); assert.equal(first.data.status, 'queued');
  const second = await f.run(['generate', '--prompt', 'Queue fixture', '--no-wait']); assert.equal(second.data.jobId, first.data.jobId); assert.equal(second.data.requestId, first.data.requestId); assert.equal(f.state.generationCount, 1);
  f.state.status = 'succeeded'; const third = await f.run(['generate', '--prompt', 'Queue fixture']); assert.equal(third.data.status, 'succeeded'); assert.equal(f.state.generationCount, 1);
});
test('unknown model outcomes stay linked to the existing task and do not create replacements', async (t) => {
  const f = await fixture(t); await f.seed(); f.state.status = 'unknown';
  const first = await f.run(['generate', '--prompt', 'Unknown result fixture']); const second = await f.run(['generate', '--prompt', 'Unknown result fixture']);
  assert.equal(first.data.error.code, 'generation_unknown'); assert.equal(second.data.error.jobId, first.data.error.jobId); assert.equal(f.state.generationCount, 1);
});
test('actual API error code takes precedence over human error text', async (t) => {
  const f = await fixture(t, { handler({ request, send }) { if (request.url === '/api/generations') { send(409, { error: 'The queue is full.', code: 'queue_full' }); return true; } } });
  await f.seed(); const result = await f.run(['generate', '--prompt', 'Queue refusal']); assert.equal(result.data.error.code, 'queue_full'); assert.match(result.data.error.message, /queue/); assert.ok(result.data.error.requestId);
});
test('existing audio files need --force, and symlink output paths are refused', async (t) => {
  const f = await fixture(t); await f.seed(); const out = path.join(f.directory, 'existing.wav'); await fs.writeFile(out, 'preserve');
  const first = await f.run(['download', 'job-1', '--out', out]); assert.equal(first.data.error.code, 'output_exists'); assert.equal(await fs.readFile(out, 'utf8'), 'preserve');
  const forced = await f.run(['download', 'job-1', '--out', out, '--force']); assert.equal(forced.code, 0); assert.deepEqual(await fs.readFile(out), audio);
  const target = path.join(f.directory, 'target.wav'), link = path.join(f.directory, 'link.wav'); await fs.writeFile(target, 'private'); await fs.symlink(target, link);
  assert.equal((await f.run(['download', 'job-1', '--out', link, '--force'])).data.error.code, 'unsafe_output'); assert.equal(await fs.readFile(target, 'utf8'), 'private');
});
for (const variation of ['mime', 'size', 'magic']) test('invalid ' + variation + ' audio never produces a final output file', async (t) => {
  const f = await fixture(t, { handler({ request, response }) { if (request.url.startsWith('/api/assets/')) { const content = variation === 'size' ? audio.subarray(0, 80) : variation === 'magic' ? Buffer.alloc(audio.length) : audio; response.writeHead(200, { 'Content-Type': variation === 'mime' ? 'text/html' : 'audio/wav', 'Content-Length': content.length }); response.end(content); return true; } } });
  await f.seed(); const out = path.join(f.directory, variation + '.wav'); const result = await f.run(['download', 'job-1', '--out', out]); assert.equal(result.data.error.code, 'invalid_audio'); await assert.rejects(fs.access(out)); assert.ok(!(await fs.readdir(f.directory)).some((name) => name.endsWith('.part')));
});
test('per-origin login isolation and cross-origin asset rejection prevent credential disclosure', async (t) => {
  const a = await fixture(t), b = await fixture(t); await a.seed();
  const switched = await a.run(['whoami'], { origin: b.origin }); assert.equal(switched.data.error.code, 'not_logged_in'); assert.equal(b.requests.length, 0);
  const attacker = await fixture(t, { handler({ request, send, job }) { if (request.url.startsWith('/api/jobs/')) { const value = job(); value.asset.url = b.origin + '/api/assets/' + value.asset.id; send(200, { job: value }); return true; } } });
  await attacker.seed(); const result = await attacker.run(['download', 'job-1', '--out', path.join(attacker.directory, 'unsafe.wav')]); assert.equal(result.data.error.code, 'unsafe_url'); assert.equal(b.requests.length, 0);
});
test('asset redirects are refused before any credentials reach the redirect target', async (t) => {
  const target = await fixture(t);
  const f = await fixture(t, { handler({ request, response }) { if (request.url.startsWith('/api/assets/')) { response.writeHead(302, { Location: target.origin + request.url }); response.end(); return true; } } });
  await f.seed(); assert.equal((await f.run(['download', 'job-1', '--out', path.join(f.directory, 'redirect.wav')])).data.error.code, 'network_error'); assert.equal(target.requests.length, 0);
});
test('symlink private credentials and configuration roots are refused', async (t) => {
  const f = await fixture(t); const credentials = await f.seed(); await fs.unlink(f.credentialPath);
  const other = path.join(f.directory, 'other.json'); await fs.writeFile(other, JSON.stringify(credentials), { mode: 0o600 }); await fs.symlink(other, f.credentialPath);
  assert.equal((await f.run(['whoami'])).data.error.code, 'unsafe_config'); assert.equal(f.requests.length, 0);
  const rootLink = path.join(f.directory, 'root-link'); await fs.symlink(f.configRoot, rootLink);
  assert.equal((await f.run(['whoami'], { configRoot: rootLink })).data.error.code, 'unsafe_config'); assert.equal(f.requests.length, 0);
});
test('stale locks are never removed based on a stale ownership read', async (t) => {
  const f = await fixture(t); await f.seed(); const lock = path.join(f.configDirectory, '.lock'); await fs.mkdir(lock, { mode: 0o700 }); await fs.writeFile(path.join(lock, 'owner.json'), JSON.stringify({ pid: 99999999, nonce: 'old-owner' }), { mode: 0o600 });
  const result = await f.run(['whoami']); assert.equal(result.data.error.code, 'cli_busy'); assert.equal(result.data.error.lockPath, lock); await fs.access(lock); assert.equal(f.requests.length, 0);
});
test('unsafe nonlocal HTTP origins are refused before any network request', async (t) => {
  const f = await fixture(t); for (const origin of ['http://example.com', 'https://user:password@example.com', 'https://example.com/path', 'https://example.com?x=1']) { const result = await f.run(['whoami'], { origin }); assert.equal(result.data.error.code, 'invalid_origin'); } assert.equal(f.requests.length, 0);
});
test('release ZIP is deterministic, has only reviewed skill files, and checksum matches exact bytes', async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'foleyix-package-')); t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const script = path.join(repository, 'scripts/package-foleyix-skill.mjs');
  const first = await child(process.execPath, [script, '--out-dir', path.join(temporary, 'first')]); const second = await child(process.execPath, [script, '--out-dir', path.join(temporary, 'second')]); assert.equal(first.code, 0); assert.equal(second.code, 0);
  const bytes = await fs.readFile(path.join(temporary, 'first', 'audiocreator-foleyix-skill.zip')); assert.deepEqual(bytes, await fs.readFile(path.join(temporary, 'second', 'audiocreator-foleyix-skill.zip')));
  const manifest = JSON.parse(await fs.readFile(path.join(temporary, 'first', 'audiocreator-foleyix-skill-manifest.json'), 'utf8')); assert.equal(manifest.sha256, createHash('sha256').update(bytes).digest('hex')); assert.equal(manifest.bytes, bytes.length); assert.equal(manifest.version, '1.5.0'); assert.equal(manifest.publicReleased, false); assert.equal(manifest.name, 'audiocreator-foleyix');
  const names = []; let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) { const size = bytes.readUInt32LE(offset + 18), nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28); names.push(bytes.toString('utf8', offset + 30, offset + 30 + nameLength)); offset += 30 + nameLength + extraLength + size; }
  assert.deepEqual(names.sort(), ['audiocreator-foleyix/LICENSE', 'audiocreator-foleyix/SKILL.md', 'audiocreator-foleyix/agents/openai.yaml', 'audiocreator-foleyix/references/audio-capabilities.json', 'audiocreator-foleyix/references/capabilities.md', 'audiocreator-foleyix/references/cli.md', 'audiocreator-foleyix/references/examples.md', 'audiocreator-foleyix/references/prompt-writing.md', 'audiocreator-foleyix/references/sound-design.md', 'audiocreator-foleyix/references/speech.md', 'audiocreator-foleyix/scripts/foleyix.mjs']);
});
test('Qoder flat ZIP contains root SKILL.md, preserves audited bytes, and leaves canonical output unchanged', async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'foleyix-qoder-package-')); t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const script = path.join(repository, 'scripts/package-foleyix-skill.mjs');
  const canonical = await child(process.execPath, [script, '--out-dir', temporary]); assert.equal(canonical.code, 0);
  const canonicalBefore = await fs.readFile(path.join(temporary, 'audiocreator-foleyix-skill.zip'));
  const flat = await child(process.execPath, [script, '--qoder', '--out-dir', temporary]); assert.equal(flat.code, 0);
  assert.deepEqual(await fs.readFile(path.join(temporary, 'audiocreator-foleyix-skill.zip')), canonicalBefore);
  const flatPath = path.join(temporary, 'audiocreator-foleyix-qoder.zip'), bytes = await fs.readFile(flatPath);
  const integrity = await child('unzip', ['-t', flatPath]); assert.equal(integrity.code, 0, integrity.stdout + integrity.stderr);
  const entries = []; let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18), nameLength = bytes.readUInt16LE(offset + 26), extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes.toString('utf8', offset + 30, offset + 30 + nameLength), bodyOffset = offset + 30 + nameLength + extraLength;
    entries.push(name); assert.ok(!name.startsWith('audiocreator-foleyix/'));
    assert.deepEqual(bytes.subarray(bodyOffset, bodyOffset + size), await fs.readFile(path.join(repository, 'skills/audiocreator-foleyix', name)));
    offset = bodyOffset + size;
  }
  assert.deepEqual(entries.sort(), ['LICENSE', 'SKILL.md', 'agents/openai.yaml', 'references/audio-capabilities.json', 'references/capabilities.md', 'references/cli.md', 'references/examples.md', 'references/prompt-writing.md', 'references/sound-design.md', 'references/speech.md', 'scripts/foleyix.mjs']);
  const manifest = JSON.parse(await fs.readFile(path.join(temporary, 'audiocreator-foleyix-qoder-manifest.json'), 'utf8'));
  assert.equal(manifest.zip, '/downloads/audiocreator-foleyix-qoder.zip'); assert.equal(manifest.sha256, createHash('sha256').update(bytes).digest('hex')); assert.equal(manifest.bytes, bytes.length);
  assert.equal(await fs.readFile(path.join(temporary, 'audiocreator-foleyix-qoder.sha256'), 'utf8'), manifest.sha256 + '  audiocreator-foleyix-qoder.zip\n');
  const repeated = await child(process.execPath, [script, '--qoder', '--out-dir', temporary]); assert.equal(repeated.code, 0); assert.deepEqual(await fs.readFile(flatPath), bytes);
});

test('voice-create saves a draft and voice-preview uses recoverable idempotent jobs and downloads real WAV', async t=>{
 let creates=0,previews=0;const ids=[];
 const f=await fixture(t,{handler({request,body,send,job}){
  if(request.url==='/api/voices'&&request.method==='POST'){creates++;assert.deepEqual(body,{name:'Narrator',description:'Warm synthetic adult voice',previewText:'Hello.'});send(201,{voice:{id:'voice-owned',name:body.name,description:body.description,status:'draft',source:'design'}});return true;}
  if(request.url==='/api/generations/voice'){previews++;assert.deepEqual(body,{voiceId:'voice-owned'});ids.push(request.headers['idempotency-key']);if(previews===1)send(503,{code:'service_not_ready'});else send(202,{job:job('voice-preview-1',{kind:'voice-design'})});return true;}
 }});await f.seed();
 const draft=await f.run(['voice-create','--name','Narrator','--description','Warm synthetic adult voice','--preview-text','Hello.']);assert.equal(draft.code,0);assert.equal(draft.data.voice.status,'draft');assert.equal(creates,1);
 const out=path.join(f.directory,'preview.wav');const preview=await f.run(['voice-preview','voice-owned','--request-id','preview-once','--out',out]);assert.equal(preview.code,0);assert.equal(preview.data.job.kind,'voice-design');assert.deepEqual(ids,['preview-once','preview-once']);assert.deepEqual(await fs.readFile(out),audio);
 const again=await f.run(['voice-preview','voice-owned','--request-id','preview-once']);assert.equal(again.code,0);assert.equal(previews,2);
 const changed=await f.run(['voice-preview','different-voice','--request-id','preview-once']);assert.equal(changed.code,1);assert.equal(previews,2);
});

test('voice-upload sends exact WAV, encoded name and explicit rights, rejecting invalid audio before network', async t=>{
 const f=await fixture(t,{handler({request,body,send}){
  if(request.url==='/api/voices/upload'){assert.deepEqual(body,audio);assert.equal(request.headers['x-audio-rights'],'confirmed');assert.equal(decodeURIComponent(request.headers['x-audio-name']),'测试参考');assert.equal(request.headers.authorization,'Bearer '+oldAccess);send(201,{voice:{id:'voice-uploaded',name:'测试参考',description:'Reference audio',status:'done',source:'upload',assetId:'uploaded-asset',referenceAudio:{duration:0.01,bytes:audio.length}}});return true;}
 }});await f.seed();const input=path.join(f.directory,'reference.wav');await fs.writeFile(input,audio);
 const missing=await f.run(['voice-upload','--name','测试参考','--input',input]);assert.equal(missing.data.error.code,'reference_rights_required');assert.equal(f.requests.length,0);
 const invalid=path.join(f.directory,'invalid.wav');await fs.writeFile(invalid,Buffer.alloc(100));assert.equal((await f.run(['voice-upload','--name','Invalid','--input',invalid,'--rights-confirmed'])).data.error.code,'invalid_reference_audio');assert.equal(f.requests.length,0);
 const long=path.join(f.directory,'long.wav'),bytes=Buffer.alloc(44+31*32000);audio.copy(bytes,0,0,44);bytes.writeUInt32LE(bytes.length-8,4);bytes.writeUInt32LE(bytes.length-44,40);await fs.writeFile(long,bytes);assert.equal((await f.run(['voice-upload','--name','Long','--input',long,'--rights-confirmed'])).data.error.code,'reference_audio_too_long');assert.equal(f.requests.length,0);
 const large=path.join(f.directory,'large.wav');await fs.writeFile(large,Buffer.alloc(10000001));assert.equal((await f.run(['voice-upload','--name','Large','--input',large,'--rights-confirmed'])).data.error.code,'reference_audio_too_large');assert.equal(f.requests.length,0);
 const result=await f.run(['voice-upload','--name','测试参考','--input',input,'--rights-confirmed']);assert.equal(result.code,0);assert.equal(result.data.voice.id,'voice-uploaded');assert.equal(result.data.voice.status,'done');assert.equal(f.requests.length,1);
});

test('legacy scope denial explains re-login; uncertain metadata writes are not retried', async t=>{
 let creates=0;const f=await fixture(t,{handler({request,send}){if(request.url==='/api/voices'&&request.method==='POST'){creates++;send(creates===1?403:500,{code:creates===1?'cli_scope_denied':'service_not_ready'});return true;}}});await f.seed();
 const args=['voice-create','--name','Narrator','--description','Synthetic adult voice'];const denied=await f.run(args);assert.equal(denied.data.error.code,'cli_scope_denied');assert.match(denied.data.error.message,/login again/);
 const uncertain=await f.run(args);assert.equal(uncertain.code,1);assert.equal(creates,2);
 const login=await f.run(['login']);assert.equal(login.code,0);assert.equal(f.requests.find(r=>r.url==='/api/cli/auth/device-code').body.scope,'audio:read audio:generate voices:write');
});
