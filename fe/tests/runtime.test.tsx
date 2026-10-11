import React from 'react';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { RuntimePodCards } from '../src/RuntimePods';
import { formatCpu, formatMemory, parseRuntimeSnapshot, type RuntimeSnapshot } from '../src/runtime';

const now = Date.parse('2026-10-11T00:00:00Z');
function snapshot(): RuntimeSnapshot {
  return { inventoryStatus: 'fresh', inventoryObservedAt: new Date(now).toISOString(),
    pods: ['pod-a', 'pod-b'].map((name) => ({ uid: name, name, version: 'v2', revision: 'hash',
      trafficRole: 'active', phase: 'Running', ready: true, terminating: false, restartCount: 0,
      metrics: { status: 'fresh', observedAt: new Date(now).toISOString(), windowSeconds: 15,
        cpuMillicores: 2125, memoryBytes: 96 * 2 ** 20 },
      resources: { cpuRequestMillicores: 100, cpuLimitMillicores: null,
        memoryRequestBytes: 128 * 2 ** 20, memoryLimitBytes: 256 * 2 ** 20 },
    })) };
}
function render(data: RuntimeSnapshot | null, failed = false, time = now) {
  return renderToStaticMarkup(<RuntimePodCards snapshot={data} failed={failed} lang="en" now={time} colorForHost={() => '#000'} />);
}

test('all inventory pods render with cores above 1000m and actual MiB/limit', () => {
  const data = parseRuntimeSnapshot(snapshot());
  const html = render(data);
  for (const expected of ['pod-a', 'pod-b', '2 ready / 2 total', '2125m', '96 MiB', '256 MiB', 'width:37.5%']) {
    assert.ok(html.includes(expected), expected);
  }
  assert.equal(formatCpu(0), '0m');
  assert.equal(formatMemory(0), '0 MiB');
  assert.equal(formatCpu(null), '—');
});

test('failed or aged inventory keeps both cards and reports stale data', () => {
  for (const html of [render(snapshot(), true), render(snapshot(), false, now + 46000)]) {
    assert.ok(html.includes('pod-a'));
    assert.ok(html.includes('pod-b'));
    assert.ok(html.includes('Pod list update delayed'));
    assert.ok(html.includes('Usage update delayed'));
  }
});

test('pending pod without metrics stays visible and has no fabricated usage/bar', () => {
  const data = snapshot();
  data.pods = [data.pods[0]];
  data.pods[0].phase = 'Pending';
  data.pods[0].ready = false;
  data.pods[0].metrics = { status: 'unavailable', observedAt: null, windowSeconds: null,
    cpuMillicores: null, memoryBytes: null };
  data.pods[0].resources.memoryLimitBytes = null;
  const html = render(data);
  assert.ok(html.includes('pod-a'));
  assert.ok(html.includes('0 ready / 1 total'));
  assert.ok(html.includes('Collecting pod information'));
  assert.ok(!html.includes('width:'));
  assert.ok(!/>0m</.test(html));
});

test('only successful empty inventory is displayed as no pods', () => {
  const data = snapshot();
  data.pods = [];
  assert.ok(render(data).includes('No backend pods'));
  assert.ok(!render(null, true).includes('No backend pods'));
});

test('rejects legacy metrics, malformed quantities and non-JSON proxy responses', () => {
  for (const data of [{ hostname: 'pod-a', cpuPercent: 12 }, '<html>502</html>', null]) {
    assert.throws(() => parseRuntimeSnapshot(data));
  }
  const data = snapshot();
  data.pods[0].metrics.cpuMillicores = NaN;
  assert.throws(() => parseRuntimeSnapshot(data));
});

test('terminating pods are excluded from Ready count and preview role is visible', () => {
  const data = snapshot();
  data.pods[0].terminating = true;
  data.pods[1].trafficRole = 'preview';
  const html = render(data);
  assert.ok(html.includes('1 ready / 2 total'));
  assert.ok(html.includes('Terminating'));
  assert.ok(html.includes('Preview'));
});
