import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const script = new URL('../.github/scripts/release-channel.sh', import.meta.url).pathname;
test('release channels keep RC tags independent of stable aliases', () => {
  for (const [ref, expected] of [['refs/tags/v0.8.0-rc.1', 'prerelease'], ['refs/tags/v0.8.0', 'stable'], ['refs/heads/fix/annual-analysis', 'candidate']])
    assert.equal(execFileSync('bash', [script, ref], { encoding: 'utf8' }).trim(), expected);
  assert.throws(() => execFileSync('bash', [script, 'refs/tags/v0.8.0-invalid'], { stdio: 'pipe' }));
  const workflow = readFileSync(new URL('../.github/workflows/container-release.yml', import.meta.url), 'utf8');
  assert.match(workflow, /flavor: latest=false/);
  assert.match(workflow, /type=raw,value=latest,enable=\$\{\{ steps.channel.outputs.name == 'stable' \}\}/);
  assert.match(workflow, /release_flags\+=\(--prerelease --latest=false\)/);
});
