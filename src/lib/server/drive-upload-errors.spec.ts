import { describe, expect, it } from 'vitest';
import { error } from '@sveltejs/kit';
import { throwMappedUploadError } from './drive-upload-errors';

function makeHttpError(status: number, message: string) {
	try {
		error(status, message);
	} catch (e) {
		return e;
	}
	throw new Error('error() did not throw');
}

describe('throwMappedUploadError', () => {
	const ctx = { route: 'drive/upload' };

	function catchMapped(err: unknown) {
		try {
			throwMappedUploadError(err, ctx);
			return null;
		} catch (mapped) {
			return mapped;
		}
	}

	it('rethrows HttpError unchanged', () => {
		const httpErr = makeHttpError(400, 'Parent folder not found');
		expect(catchMapped(httpErr)).toBe(httpErr);
	});

	it('maps EACCES to 507', () => {
		const mapped = catchMapped(Object.assign(new Error('denied'), { code: 'EACCES' }));
		expect(mapped).toMatchObject({ status: 507 });
	});

	it('maps encryption misconfig to 500 with message', () => {
		const mapped = catchMapped(
			new Error('Set DRIVE_ENCRYPTION_KEY, FILE_ENCRYPTION_KEY, or BETTER_AUTH_SECRET')
		);
		expect(mapped).toMatchObject({ status: 500 });
	});
});
