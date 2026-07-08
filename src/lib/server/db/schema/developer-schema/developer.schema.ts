import {
	boolean,
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { TeamSchema } from '../main-schema/team.schema';
import { createUpdateTimestamp, uuidSchemaWrapper } from '../schema-wrapper';

export const DeveloperApiKeySchema = pgTable(
	'developer_api_key',
	{
		...uuidSchemaWrapper,
		userId: text('user_id').notNull(),
		name: text('name').notNull(),
		keyPrefix: text('key_prefix').notNull(),
		keyHash: text('key_hash').notNull(),
		last4: text('last4').notNull(),
		isRevoked: boolean('is_revoked').notNull().default(false),
		lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		/** Per-key caps (`null` = no key-specific cap; env defaults may still apply). */
		maxTeams: integer('max_teams'),
		maxFolders: integer('max_folders'),
		maxFiles: integer('max_files'),
		/** When set, key is scoped to this team only (`znltv_…` prefix). */
		teamId: uuid('team_id').references(() => TeamSchema.id, { onDelete: 'cascade' }),
		/** Team key permissions; ignored for user-wide keys. */
		permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
		...createUpdateTimestamp
	},
	(table) => [
		uniqueIndex('developer_api_key_key_prefix_uidx').on(table.keyPrefix),
		index('developer_api_key_userId_idx').on(table.userId),
		index('developer_api_key_team_id_idx').on(table.teamId)
	]
);
