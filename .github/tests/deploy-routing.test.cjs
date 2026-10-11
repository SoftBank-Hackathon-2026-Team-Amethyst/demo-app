// Exercise the actual workflow filters and job conditions, using paths-filter v3's matcher.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const yaml = require('js-yaml');
const picomatch = require('picomatch');

const workflow = yaml.load(fs.readFileSync(path.join(__dirname, '../workflows/deploy.yml'), 'utf8'));
const filters = yaml.load(workflow.jobs.changes.steps.find(s => s.id === 'paths').with.filters);

const {execFileSync} = require('node:child_process');
const os = require('node:os');
const script = path.join(__dirname, '../scripts/deploy-targets.sh');

// Evaluate a GitHub expression with JS semantics (enough for the operators used in deploy.yml).
const evaluate = (expr, context) => vm.runInNewContext(
  expr.replaceAll('inputs.verify-observability', "inputs['verify-observability']"), context);
const env = (job, context) => Object.fromEntries(Object.entries(job.steps.find(s => s.id === 'targets').env).map(
  ([key, value]) => [key, String(evaluate(value.replace(/^\$\{\{(.*)\}\}$/s, '$1'), context) ?? '')]));

// Returns the targets (labels) that deploy to test and to prod.
function plan(files, options = {}) {
  const outputs = Object.fromEntries(Object.entries(filters).map(([name, patterns]) => [
    name, String(files.some(file => patterns.some(pattern => picomatch(pattern, {dot: true})(file))))
  ]));
  const context = {
    github: {event_name: 'push', ref: 'refs/heads/main'},
    inputs: {}, vars: {},
    needs: {
      checks: {result: 'success'}, request: {result: 'success'},
      changes: {result: 'success', outputs}, targets: {result: 'success', outputs: {}}, test: {result: 'success'}
    },
    always: () => true, cancelled: () => false,
    startsWith: (value, prefix) => value.startsWith(prefix),
    ...options
  };
  if (options.results) {
    for (const [job, result] of Object.entries(options.results)) context.needs[job].result = result;
  }
  if (context.needs.changes.result !== 'success') context.needs.changes.outputs = {};
  const jobs = workflow.jobs;
  if (!evaluate(jobs.targets.if, context)) return {test: [], prod: []};
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'targets-')), 'out');
  fs.writeFileSync(out, '');
  execFileSync('bash', [script], {env: {...process.env, ...env(jobs.targets, context), GITHUB_OUTPUT: out}, stdio: 'pipe'});
  context.needs.targets.outputs = Object.fromEntries(fs.readFileSync(out, 'utf8').trim().split('\n')
    .map(line => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]));
  const matrix = job => JSON.parse(context.needs.targets.outputs[job]);
  const test = evaluate(jobs.test.if, context) ? matrix('test') : [];
  if (!test.length) context.needs.test.result = 'skipped';
  const prod = evaluate(jobs.prod.if, context) ? matrix('prod') : [];
  return {test, prod};
}

// Single-target view used by the existing routing cases: [test runs, prod runs].
function routes(files, options = {}) {
  const {test, prod} = plan(files, options);
  return [test.length > 0, prod.length > 0];
}

test('test-only values never start prod, including additions, removals and renames within test files', () => {
  for (const files of [['deploy/values-be.test.yaml'], ['deploy/values-fe.test.yaml'],
    ['deploy/values-be.test.yaml', 'deploy/values-worker.test.yaml']]) {
    assert.deepEqual(routes(files), [true, false]);
  }
});

test('shared/prod values, application and schema changes retain test then prod', () => {
  for (const file of ['be/src/index.ts', 'fe/src/App.tsx', 'db/init.sql',
    'deploy/values-be.yaml', 'deploy/values-be.prod.yaml', 'deploy/values-worker.yaml']) {
    assert.deepEqual(routes([file]), [true, true], file);
    assert.deepEqual(routes(['deploy/values-be.test.yaml', file]), [true, true], `mixed: ${file}`);
  }
});

test('target-only files deploy only the selected target; secondary and wsl map to onprem', () => {
  for (const target of ['aws', 'gcp', 'onprem', 'onprem-secondary', 'onprem-wsl']) {
    const scope = target.startsWith('onprem') ? 'onprem' : target;
    assert.deepEqual(routes([`deploy/${scope}/values.yaml`], {vars: {DEPLOY_TARGET: target, GCP_CLUSTER: "gke-1"}}), [true, true]);
    const other = scope === 'aws' ? 'gcp' : 'aws';
    assert.deepEqual(routes([`deploy/${other}/values.yaml`], {vars: {DEPLOY_TARGET: target, GCP_CLUSTER: "gke-1"}}), [false, false]);
    assert.deepEqual(routes(['deploy/values-be.test.yaml'], {vars: {DEPLOY_TARGET: target, GCP_CLUSTER: "gke-1"}}), [true, false]);
  }
});

test('docs, workflows and template/infra-only changes do not deploy applications', () => {
  assert.deepEqual(routes(['README.md', '.deploy/config.yaml', '.github/workflows/deploy.yml', 'infra/envs/aws/main.tf']), [false, false]);
  assert.deepEqual(routes([]), [false, false]);
});

test('PR and yolo preserve their existing deployment scope', () => {
  assert.deepEqual(routes(['be/src/index.ts'], {github: {event_name: 'pull_request', ref: 'refs/pull/1/merge'}}), [false, false]);
  assert.deepEqual(routes(['be/src/index.ts'], {github: {event_name: 'push', ref: 'refs/heads/yolo/test'}}), [true, false]);
});

test('manual main test skips prod; explicit prod still follows test; observation never starts prod', () => {
  const github = {event_name: 'workflow_dispatch', ref: 'refs/heads/main'};
  assert.deepEqual(routes([], {github, inputs: {environment: 'test'}, results: {changes: 'skipped'}}), [true, false]);
  assert.deepEqual(routes([], {github, inputs: {environment: 'prod'}, results: {changes: 'skipped'}}), [true, true]);
  assert.deepEqual(routes([], {github, inputs: {environment: 'prod', 'verify-observability': true}}), [true, false]);
  assert.deepEqual(routes([], {github: {...github, ref: 'refs/heads/other'}, inputs: {environment: 'prod'}}), [false, false]);
});

test('failure or cancellation cannot start a downstream deployment', () => {
  for (const job of ['checks', 'request', 'changes']) {
    for (const result of ['failure', 'cancelled', 'skipped']) {
      assert.deepEqual(routes(['be/src/index.ts'], {results: {[job]: result}}), [false, false]);
    }
  }
  for (const result of ['failure', 'cancelled', 'skipped']) {
    assert.deepEqual(routes(['be/src/index.ts'], {results: {test: result}}), [true, false]);
  }
  assert.deepEqual(routes(['be/src/index.ts'], {cancelled: () => true}), [false, false]);
  assert.deepEqual(workflow.jobs.prod.needs, ['targets', 'test']);
});

const labels = entries => entries.map(e => e.label);

test('DEPLOY_TARGETS deploys every target in parallel; the first one is the primary (yolo report and main PR)', () => {
  const vars = {DEPLOY_TARGETS: 'aws,gcp,onprem', DEPLOY_TARGET: 'gcp', GCP_CLUSTER: 'gke-1'};
  const {test, prod} = plan(['be/src/index.ts'], {vars});
  assert.deepEqual(labels(test), ['aws', 'gcp', 'onprem']);
  assert.deepEqual(labels(prod), ['aws', 'gcp', 'onprem']);
  assert.deepEqual(test.map(e => e.primary), [true, false, false]);
  assert.deepEqual(test.map(e => e.cluster), ['one-tatchi', 'gke-1', 'k3d-onetouch']);
  assert.deepEqual(test.map(e => e.preview_test), ['green-yolo.onetatchi.soulee.dev', 'green-yolo-gcp.onetatchi.soulee.dev', 'green-yolo-onprem.soulee.dev']);
  assert.deepEqual(prod.map(e => e.preview_prod), ['green.onetatchi.soulee.dev', 'green-gcp.onetatchi.soulee.dev', 'green-onprem.soulee.dev']);
});

test('target-only files deploy only that target, and the primary moves to the first deployed target', () => {
  const vars = {DEPLOY_TARGETS: 'aws,gcp,onprem-secondary', GCP_CLUSTER: 'gke-1', ONPREM_SECONDARY_CLUSTER: 'k3d-mini'};
  const {test, prod} = plan(['deploy/onprem/values.yaml'], {vars});
  assert.deepEqual(labels(test), ['onprem-secondary']);
  assert.deepEqual(labels(prod), ['onprem-secondary']);
  assert.deepEqual([test[0].target, test[0].runner, test[0].cluster, test[0].preview_auth, test[0].primary],
    ['onprem', 'onprem-secondary', 'k3d-mini', false, true]);
  assert.deepEqual(plan(['deploy/values-be.test.yaml'], {vars}).prod, []);
});

test('one failed target test stops prod for every target', () => {
  const vars = {DEPLOY_TARGETS: 'aws,gcp', GCP_CLUSTER: 'gke-1'};
  assert.deepEqual(plan(['be/src/index.ts'], {vars, results: {test: 'failure'}}).prod, []);
  assert.equal(workflow.jobs.test.strategy['fail-fast'], false);
});

test('manual run deploys one requested target, or every target with all', () => {
  const github = {event_name: 'workflow_dispatch', ref: 'refs/heads/main'};
  const vars = {DEPLOY_TARGETS: 'aws,gcp', GCP_CLUSTER: 'gke-1'};
  assert.deepEqual(labels(plan([], {github, vars, inputs: {target: 'onprem-wsl', environment: 'prod'}, results: {changes: 'skipped'}}).prod), ['onprem-wsl']);
  assert.deepEqual(labels(plan([], {github, vars, inputs: {target: 'all', environment: 'prod'}, results: {changes: 'skipped'}}).prod), ['aws', 'gcp']);
  assert.deepEqual(labels(plan([], {github, vars, inputs: {target: 'aws', targets: 'gcp,onprem', environment: 'prod'}, results: {changes: 'skipped'}}).prod), ['gcp', 'onprem']);
});

test('invalid target lists fail the targets job', () => {
  for (const DEPLOY_TARGETS of ['aws,aws', 'aws,azure', 'gcp']) {
    assert.throws(() => plan(['be/src/index.ts'], {vars: {DEPLOY_TARGETS}}), DEPLOY_TARGETS);
  }
});
