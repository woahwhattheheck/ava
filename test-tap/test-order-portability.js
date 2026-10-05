import childProcess from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {promisify} from 'node:util';

import {test} from 'tap';

import {testOrderSeed} from '../lib/test-order.js';

const execFile = promisify(childProcess.execFile);
const cli = fileURLToPath(new URL('../entrypoints/cli.js', import.meta.url));
const main = new URL('../entrypoints/main.js', import.meta.url).href;

test('per-file seed uses the project-relative path', t => {
	const firstRoot = path.resolve('first-checkout');
	const secondRoot = path.resolve('second-checkout');
	const firstFile = path.join(firstRoot, 'tests', 'example.js');
	const secondFile = path.join(secondRoot, 'tests', 'example.js');

	t.equal(testOrderSeed('seed', firstFile, firstRoot), 'tests:seed:tests/example.js');
	t.equal(testOrderSeed('seed', firstFile, firstRoot), testOrderSeed('seed', secondFile, secondRoot));
	t.equal(testOrderSeed('seed', pathToFileURL(firstFile).href, firstRoot), testOrderSeed('seed', firstFile, firstRoot));
	t.not(testOrderSeed('seed', firstFile, firstRoot), testOrderSeed('seed', path.join(firstRoot, 'tests', 'other.js'), firstRoot));
	t.not(testOrderSeed('seed', firstFile, firstRoot), testOrderSeed('other-seed', firstFile, firstRoot));
	t.end();
});

for (const workerThreads of [true, false]) {
	test(`seeded launch order is portable with workerThreads=${workerThreads}`, async t => {
		const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ava-portable-seed-'));
		t.teardown(() => fs.rmSync(root, {recursive: true, force: true}));
		const source = [
			`import test from ${JSON.stringify(main)};`,
			'test.serial("serial-first", t => t.pass());',
			'test.serial("serial-second", t => t.pass());',
			...Array.from({length: 12}, (_, index) => `test("test-${index}", t => t.pass());`),
		].join('\n');
		const run = async directory => {
			fs.mkdirSync(path.join(directory, 'tests'), {recursive: true});
			fs.mkdirSync(path.join(directory, '.fake-root'));
			fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({type: 'module'}));
			fs.writeFileSync(path.join(directory, 'tests', 'example.js'), source);
			const args = [cli, '--tap', '--seed=portable-seed', 'tests/example.js'];
			if (!workerThreads) {
				args.push('--no-worker-threads');
			}

			const {stdout} = await execFile(process.execPath, args, {
				cwd: directory,
				env: {...process.env, AVA_FORCE_CI: 'ci', AVA_FAKE_SCM_ROOT: '.fake-root'},
			});
			return [...stdout.matchAll(/^ok \d+ - (?:.* › )?(serial-first|serial-second|test-\d+)$/gm)].map(([, title]) => title);
		};

		const first = await run(path.join(root, 'first-checkout'));
		const second = await run(path.join(root, 'second-checkout'));

		t.equal(first.length, 14);
		t.same(first.slice(0, 2), ['serial-first', 'serial-second']);
		t.same(second.slice(0, 2), ['serial-first', 'serial-second']);
		t.same(first, second);
		t.notSame(first.slice(2), Array.from({length: 12}, (_, index) => `test-${index}`));
	});
}
