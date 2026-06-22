import type { AnyPgColumn } from 'drizzle-orm/pg-core';
import {
	boolean,
	bigint,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid
} from 'drizzle-orm/pg-core';
import { MasterStorageProviderSchema } from '../master-schema/master.schema';
import { createUpdateTimestamp, uuidSchemaWrapper } from '../schema-wrapper';
import { TeamSchema } from './team.schema';

export const MainFileSchema = pgTable('main_file', {
	...uuidSchemaWrapper,
	ownerId: text('owner_id').notNull(),
	/** When set, file belongs to a team drive (any member with matching storage may CRUD). */
	teamId: uuid('team_id').references(() => TeamSchema.id, { onDelete: 'cascade' }),
	parentId: uuid('parent_id').references((): AnyPgColumn => MainFileSchema.id, {
		onDelete: 'cascade'
	}),
	itemType: text('item_type').notNull().default('file'),
	isPinned: boolean('is_pinned').notNull().default(false),
	isStarred: boolean('is_starred').notNull().default(false),
	trashedAt: timestamp('trashed_at', { withTimezone: true }),
	/** `null` = no label tint (folders default); files often `'base'`. */
	color: text('color'),
	path: text('path').notNull(),
	name: text('name').notNull(),
	mimeType: text('mime_type').notNull(),
	sizeBytes: bigint('size_bytes', { mode: 'bigint' }).notNull(),
	/** Postgres enum `master_storage_provider` — ties each object to a backend (local vs Tigris, etc.). */
	storageProvider: MasterStorageProviderSchema('storage_provider').notNull().default('local'),
	isEncrypted: boolean('is_encrypted').notNull().default(true),
	isCompressed: boolean('is_compressed').notNull().default(true),
	...createUpdateTimestamp
},
	(t) => [index('main_file_teamId_idx').on(t.teamId)]
);

export const MainFileShareSchema = pgTable('main_file_share', {
	...uuidSchemaWrapper,
	fileId: uuid('file_id')
		.notNull()
		.references(() => MainFileSchema.id, { onDelete: 'cascade' }),
	ownerId: text('owner_id').notNull(),
	targetEmail: text('target_email').notNull(),
	permission: text('permission').notNull(),
	canReshare: boolean('can_reshare').notNull().default(false),
	...createUpdateTimestamp
});

export const MainFileActivitySchema = pgTable('main_file_activity', {
	...uuidSchemaWrapper,
	userId: text('user_id').notNull(),
	fileId: integer('file_id'),
	action: text('action').notNull(),
	...createUpdateTimestamp
});

export const MainFilePublicLinkSchema = pgTable(
	'main_file_public_link',
	{
		...uuidSchemaWrapper,
		fileId: uuid('file_id')
			.notNull()
			.references(() => MainFileSchema.id, { onDelete: 'cascade' }),
		ownerId: text('owner_id').notNull(),
		token: text('token').notNull(),
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		...createUpdateTimestamp
	},
	(table) => [
		uniqueIndex('main_file_public_link_token_uidx').on(table.token),
		index('main_file_public_link_fileId_idx').on(table.fileId),
		index('main_file_public_link_ownerId_idx').on(table.ownerId)
	]
);
