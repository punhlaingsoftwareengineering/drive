import { SendOtpBodyEmailInterface } from '$lib/model/interface/auth.interface';
import { getFromAddress, getSmtpTransport } from '$lib/server/mailer';
import { generateOtp, hashOtp, sealSignupOtpCookie } from '$lib/server/signup-otp';
import { useSecureCookies } from '$lib/server/public-origin';
import { dev } from '$app/environment';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => null);
	const parsed = SendOtpBodyEmailInterface.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid email');

	const email = parsed.data.email.toLowerCase().trim();
	const otp = generateOtp();
	const otpHash = hashOtp(email, otp);
	const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

	cookies.set(
		'signup_otp',
		sealSignupOtpCookie({
			email,
			otpHash,
			expiresAt
		}),
		{
			httpOnly: true,
			sameSite: 'lax',
			secure: useSecureCookies(),
			path: '/',
			maxAge: 10 * 60
		}
	);
	// Any new OTP request invalidates prior verification.
	cookies.delete('signup_otp_verified', { path: '/' });

	const transport = getSmtpTransport();
	const from = getFromAddress();
	if (!transport || !from) {
		if (dev) {
			return json({ success: true, devOtp: otp });
		}
		throw error(
			500,
			'SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM.'
		);
	}

	try {
		await transport.sendMail({
			from,
			to: email,
			subject: 'Your verification code',
			text: `Your verification code is: ${otp}\n\nThis code expires in 10 minutes.`
		});
	} catch (e: unknown) {
		console.error('[signup/send-otp] sendMail failed:', e);
		const msg = e instanceof Error ? e.message : '';
		throw error(
			500,
			dev
				? `Failed to send OTP email: ${msg || 'SMTP error'}`
				: 'Failed to send OTP email (SMTP error).'
		);
	}

	return json({ success: true });
};
