import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/auth-user-lookup', () => ({
	getUsersByIds: vi.fn()
}));

import { getUsersByIds } from '$lib/server/auth-user-lookup';
import {
	DRIVE_ON_BEHALF_OF_HEADER,
	resolveUploadOwnerUserId
} from '$lib/server/drive-upload-owner';
import type { DriveApiSession } from '$lib/server/require-api-session';

function session(partial: Partial<DriveApiSession> & { user: DriveApiSession['user'] }): DriveApiSession {
	return {
		viaApiKey: false,
		...partial
	};
}

describe('resolveUploadOwnerUserId', () => {
	beforeEach(() => {
		vi.mocked(getUsersByIds).mockReset();
	});

	it('uses cookie session user', async () => {
		const req = new Request('http://localhost/api/drive/upload', {
			headers: { [DRIVE_ON_BEHALF_OF_HEADER]: 'other-user' }
		});
		const id = await resolveUploadOwnerUserId(
			session({ user: { id: 'cookie-user' }, viaApiKey: false }),
			req
		);
		expect(id).toBe('cookie-user');
		expect(getUsersByIds).not.toHaveBeenCalled();
	});

	it('defaults API key owner when header missing', async () => {
		const req = new Request('http://localhost/api/drive/upload');
		const id = await resolveUploadOwnerUserId(
			session({ user: { id: 'key-owner' }, viaApiKey: true, apiKeyId: 'k1' }),
			req
		);
		expect(id).toBe('key-owner');
	});

	it('attributes API upload to on-behalf-of user', async () => {
		vi.mocked(getUsersByIds).mockResolvedValue(
			new Map([['portal-admin', { id: 'portal-admin', name: 'A', email: 'a@x', developerModeEnabled: false }]])
		);
		const req = new Request('http://localhost/api/drive/upload', {
			headers: { [DRIVE_ON_BEHALF_OF_HEADER]: 'portal-admin' }
		});
		const id = await resolveUploadOwnerUserId(
			session({ user: { id: 'key-owner' }, viaApiKey: true, apiKeyId: 'k1' }),
			req
		);
		expect(id).toBe('portal-admin');
	});

	it('rejects unknown on-behalf-of user', async () => {
		vi.mocked(getUsersByIds).mockResolvedValue(new Map());
		const req = new Request('http://localhost/api/drive/upload', {
			headers: { [DRIVE_ON_BEHALF_OF_HEADER]: 'missing' }
		});
		await expect(
			resolveUploadOwnerUserId(
				session({ user: { id: 'key-owner' }, viaApiKey: true, apiKeyId: 'k1' }),
				req
			)
		).rejects.toMatchObject({ status: 400 });
	});
});
