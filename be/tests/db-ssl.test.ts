import assert from 'node:assert/strict';
import test from 'node:test';
import { sslOption } from '../src/db/index.js';

test('PGSSL이 없거나 disable이면 TLS 옵션을 넘기지 않는다', () => {
  assert.equal(sslOption({}), undefined);
  assert.equal(sslOption({ PGSSL: '' }), undefined);
  assert.equal(sslOption({ PGSSL: 'disable' }), undefined);
  assert.equal(sslOption({ PGSSLMODE: 'disable' }), undefined);
});

test('PGSSL=require(클라우드 DB 기본값)는 ssl: require', () => {
  assert.equal(sslOption({ PGSSL: 'require' }), 'require');
  assert.equal(sslOption({ PGSSL: 'true' }), 'require');
  assert.equal(sslOption({ PGSSLMODE: 'require' }), 'require');
});

test('postgres.js가 아는 다른 모드는 그대로 넘긴다', () => {
  assert.equal(sslOption({ PGSSL: 'prefer' }), 'prefer');
  assert.equal(sslOption({ PGSSL: 'verify-full' }), 'verify-full');
});
