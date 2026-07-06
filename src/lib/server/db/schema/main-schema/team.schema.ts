import { index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { MasterStorageProviderSchema } from '../master-schema/master.schema';
import { createUpdateTimestamp, uuidSchemaWrapper } from '../schema-wrapper';

export const TeamSchema = pgTable(
	'team',
	{
		...uuidSchemaWrapper,
		name: text('name').notNull(),
		slug: text('slug').notNull(),
		createdByUserId: text('created_by_user_id').notNull(),
		/** Filled after root folder row is created; may be null briefly during a transaction. */
		rootFolderId: uuid('root_folder_id'),
		storageProvider: MasterStorageProviderSchema('storage_provider').notNull().default('local'),
		...createUpdateTimestamp
	},
	(t) => [
		index('team_createdByUserId_idx').on(t.createdByUserId),
		uniqueIndex('team_slug_uidx').on(t.slug)
	]
);

export const TeamMemberSchema = pgTable(
	'team_member',
	{
		...uuidSchemaWrapper,
		teamId: uuid('team_id')
			.notNull()
			.references(() => TeamSchema.id, { onDelete: 'cascade' }),
		userId: text('user_id').notNull(),
		/** `owner` (creator) or `member` */
		role: text('role').notNull().default('member'),
		...createUpdateTimestamp
	},
	(t) => [
		uniqueIndex('team_member_teamId_userId_uidx').on(t.teamId, t.userId),
		index('team_member_userId_idx').on(t.userId)
	]
);

export const TeamInviteSchema = pgTable(
	'team_invite',
	{
		...uuidSchemaWrapper,
		teamId: uuid('team_id')
			.notNull()
			.references(() => TeamSchema.id, { onDelete: 'cascade' }),
		email: text('email').notNull(),
		/** `pending` until user exists and accepts, or you remove manually */
		status: text('status').notNull().default('pending'),
		...createUpdateTimestamp
	},
	(t) => [uniqueIndex('team_invite_teamId_email_uidx').on(t.teamId, t.email)]
);
