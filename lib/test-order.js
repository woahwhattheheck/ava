import crypto from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

export function generateSeed() {
	return crypto.randomBytes(8).toString('hex');
}

export function fileOrderSeed(seed) {
	return `files:${seed}`;
}

export function testOrderSeed(seed, file, projectDir = process.cwd()) {
	const filename = file.startsWith('file://') ? fileURLToPath(file) : file;
	const relativePath = path.relative(projectDir, filename).split(path.sep).join('/');
	return `tests:${seed}:${relativePath}`;
}

const modulus = 2_147_483_647;
const multiplier = 48_271;

function createRandom(seed) {
	let state = 1;

	for (const character of seed) {
		state = ((state * 31) + character.codePointAt(0)) % modulus;
	}

	if (state === 0) {
		state = 1;
	}

	return () => {
		state = (state * multiplier) % modulus;
		return (state - 1) / (modulus - 1);
	};
}

export function shuffle(items, seed) {
	const shuffled = [...items];
	const random = createRandom(seed);

	for (let index = shuffled.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(random() * (index + 1));
		[shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
	}

	return shuffled;
}
