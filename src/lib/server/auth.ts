import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { sveltekitCookies } from 'better-auth/svelte-kit';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getRequestEvent } from '$app/server';
import { authDb } from '$lib/server/db/auth-db';
import {
	AuthAccountSchema,
	AuthSessionSchema,
	AuthUserSchema,
	AuthVerificationSchema
} from '$lib/server/db/schema/auth-schema/auth.schema';
import { getAuthSessionOptions } from '$lib/server/auth-session-config';
import { getFromAddress, getSmtpTransport } from '$lib/server/mailer';
import { getConfiguredOrigin } from '$lib/server/public-origin';

/**
 * CI/Docker image builds run `pnpm build` without production secrets.
 * Better Auth throws if it falls back to its default secret/base URL. We provide safe placeholders
 * during the build step so compilation succeeds, but we still fail fast at runtime in production.
 */
const isBuildStep = building || process.env.BUILDING === 'true';

const baseURL = getConfiguredOrigin() ?? (isBuildStep ? 'http://localhost:1025' : undefined);

const secret =
	(typeof env.BETTER_AUTH_SECRET === 'string' && env.BETTER_AUTH_SECRET.trim()
		? env.BETTER_AUTH_SECRET.trim()
		: undefined) ??
	(typeof process.env.BETTER_AUTH_SECRET === 'string' && process.env.BETTER_AUTH_SECRET.trim()
		? process.env.BETTER_AUTH_SECRET.trim()
		: undefined) ??
	(isBuildStep ? 'build-only-secret-change-me' : undefined);

if (!isBuildStep && process.env.NODE_ENV === 'production') {
	if (!baseURL) {
		throw new Error(
			'[config] ORIGIN is not set. Set it to your public URL (e.g. fly secrets set ORIGIN=https://your-app.fly.dev).'
		);
	}
	if (!secret) {
		throw new Error(
			'[config] BETTER_AUTH_SECRET is not set. Set it in production (e.g. fly secrets set BETTER_AUTH_SECRET=...).'
		);
	}
}

const { session, advanced: sessionAdvanced } = getAuthSessionOptions();

export const auth = betterAuth({
	baseURL: baseURL!,
	secret: secret!,
	advanced: sessionAdvanced,
	user: {
		additionalFields: {
			developerModeEnabled: {
				type: 'boolean',
				required: false,
				defaultValue: false,
				input: false
			}
		}
	},
	session,
	database: drizzleAdapter(authDb, {
		provider: 'pg',
		schema: {
			user: AuthUserSchema,
			session: AuthSessionSchema,
			account: AuthAccountSchema,
			verification: AuthVerificationSchema
		}
	}),
	emailAndPassword: {
		enabled: true,
		/** Session is created in our custom `/api/auth/signup` route via `signInEmail` after OTP. */
		autoSignIn: false,
		async sendResetPassword({ user, url }) {
			const transport = getSmtpTransport();
			const from = getFromAddress();
			if (!transport || !from) {
				throw new Error(
					'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.'
				);
			}

			await transport.sendMail({
				from,
				to: user.email,
				subject: 'Reset your password',
				text: `Reset your password using this link:\n\n${url}\n\nIf you did not request this, you can ignore this email.`
			});
		}
	},
	...(Object.keys({
		...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
			? {
					github: {
						clientId: env.GITHUB_CLIENT_ID,
						clientSecret: env.GITHUB_CLIENT_SECRET
					}
				}
			: {}),
		...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
			? {
					google: {
						clientId: env.GOOGLE_CLIENT_ID,
						clientSecret: env.GOOGLE_CLIENT_SECRET
					}
				}
			: {})
	}).length
		? {
				socialProviders: {
					...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
						? {
								github: {
									clientId: env.GITHUB_CLIENT_ID,
									clientSecret: env.GITHUB_CLIENT_SECRET
								}
							}
						: {}),
					...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
						? {
								google: {
									clientId: env.GOOGLE_CLIENT_ID,
									clientSecret: env.GOOGLE_CLIENT_SECRET
								}
							}
						: {})
				}
			}
		: {}),
	plugins: [
		sveltekitCookies(getRequestEvent) // make sure this is the last plugin in the array
	]
});
