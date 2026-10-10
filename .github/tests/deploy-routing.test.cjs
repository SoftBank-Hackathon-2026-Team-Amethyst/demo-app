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

function routes(files, options = {}) {
  const outputs = Object.fromEntries(Object.entries(filters).map(([name, patterns]) => [
    name, String(files.some(file => patterns.some(pattern => picomatch(pattern, {dot: true})(file))))
  ]));
  const context = {
    github: {event_name: 'push', ref: 'refs/heads/main'},
    inputs: {}, vars: {},
    needs: {
      checks: {result: 'success'}, request: {result: 'success'},
      changes: {result: 'success', outputs}, test: {result: 'success'}
    },
    always: () => true, cancelled: () => false,
    startsWith: (value, prefix) => value.startsWith(prefix),
    ...options
  };
  if (options.results) {
    for (const [job, result] of Object.entries(options.results)) context.needs[job].result = result;
  }
  const evaluate = job => Boolean(vm.runInNewContext(
    workflow.jobs[job].if.replaceAll('inputs.verify-observability', "inputs['verify-observability']"), context
  ));
  const deployTest = evaluate('test');
  if (!deployTest) context.needs.test.result = 'skipped';
  return [deployTest, evaluate('prod')];
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

test('target-only files deploy only the selected target; secondary maps to onprem', () => {
  for (const target of ['aws', 'gcp', 'onprem', 'onprem-secondary']) {
    const scope = target.startsWith('onprem') ? 'onprem' : target;
    assert.deepEqual(routes([`deploy/${scope}/values.yaml`], {vars: {DEPLOY_TARGET: target}}), [true, true]);
    const other = scope === 'aws' ? 'gcp' : 'aws';
    assert.deepEqual(routes([`deploy/${other}/values.yaml`], {vars: {DEPLOY_TARGET: target}}), [false, false]);
    assert.deepEqual(routes(['deploy/values-be.test.yaml'], {vars: {DEPLOY_TARGET: target}}), [true, false]);
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
  assert.deepEqual(workflow.jobs.prod.needs, ['test', 'changes']);
});
