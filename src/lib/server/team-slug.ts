import { db } from '$lib/server/db';
import { TeamSchema } from '$lib/server/db/schema/main-schema/team.schema';
import { slugifyTeamName } from '$lib/tool/team-slug';
import { eq } from 'drizzle-orm';

export async function uniqueTeamSlug(baseName: string, excludeTeamId?: string): Promise<string> {
	let slug = slugifyTeamName(baseName);
	let n = 0;
	for (;;) {
		const candidate = n === 0 ? slug : `${slug}-${n}`;
		const [existing] = await db
			.select({ id: TeamSchema.id })
			.from(TeamSchema)
			.where(eq(TeamSchema.slug, candidate))
			.limit(1);
		if (!existing || (excludeTeamId && existing.id === excludeTeamId)) return candidate;
		n += 1;
	}
}
