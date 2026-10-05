import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function generateSeed() {
	return crypto.randomBytes(8).toString('hex');
}

export function validateSeed(value) {
	const seed = String(value);
	if (seed.length === 0) {
		throw new TypeError('The --seed flag must be provided with a non-empty value.');
	}

	return seed;
}

const normalizeFile = file => file.startsWith('file://') ? fileURLToPath(file) : file;

const portableRelativePath = (projectDir, file) =>
	path.relative(projectDir, normalizeFile(file)).split(path.sep).join('/');

export function testOrderSeed(seed, projectDir, file) {
	return `tests:${seed}:${portableRelativePath(projectDir, file)}`;
}

function hashSeed(seed) {
	let hash = 2_166_136_261;
	for (const character of seed) {
		hash ^= character.codePointAt(0);
		hash = Math.imul(hash, 16_777_619);
	}

	return hash >>> 0;
}

function createRandom(seed) {
	let state = hashSeed(seed);
	return () => {
		state = (state + 0x6D2B79F5) | 0;
		let value = state;
		value = Math.imul(value ^ (value >>> 15), value | 1);
		value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
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
