import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { createUpdateTimestamp } from '../schema-wrapper';

export const AuthUserSchema = pgTable('user', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	email: text('email').notNull().unique(),
	emailVerified: boolean('email_verified').default(false).notNull(),
	image: text('image'),
	/** When true, user may create API keys; keys authenticate drive APIs as this user. */
	developerModeEnabled: boolean('developer_mode_enabled').notNull().default(false),
	...createUpdateTimestamp
});

export const AuthSessionSchema = pgTable(
	'session',
	{
		id: text('id').primaryKey(),
		expiresAt: timestamp('expires_at').notNull(),
		token: text('token').notNull().unique(),
		...createUpdateTimestamp,
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => AuthUserSchema.id, { onDelete: 'cascade' })
	},
	(table) => [index('session_userId_idx').on(table.userId)]
);

export const AuthAccountSchema = pgTable(
	'account',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => AuthUserSchema.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: timestamp('access_token_expires_at'),
		refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
		scope: text('scope'),
		password: text('password'),
		...createUpdateTimestamp
	},
	(table) => [index('account_userId_idx').on(table.userId)]
);

export const AuthVerificationSchema = pgTable(
	'verification',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: timestamp('expires_at').notNull(),
		...createUpdateTimestamp
	},
	(table) => [index('verification_identifier_idx').on(table.identifier)]
);
