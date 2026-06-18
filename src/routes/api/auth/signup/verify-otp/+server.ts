import { VerifyOtpBodyEmailInterface } from '$lib/model/interface/auth.interface';
import { hashOtp, unsealSignupOtpCookie } from '$lib/server/signup-otp';
import { useSecureCookies } from '$lib/server/public-origin';
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const body = await request.json().catch(() => null);
	const parsed = VerifyOtpBodyEmailInterface.safeParse(body);
	if (!parsed.success) throw error(400, 'Invalid OTP');

	const email = parsed.data.email.toLowerCase().trim();
	const cookie = cookies.get('signup_otp');
	if (!cookie) throw error(400, 'OTP expired. Please request a new one.');

	const sealed = unsealSignupOtpCookie(cookie);
	if (!sealed) throw error(400, 'OTP expired. Please request a new one.');
	if (sealed.email !== email) throw error(400, 'OTP does not match this email.');
	if (Date.now() > sealed.expiresAt) throw error(400, 'OTP expired. Please request a new one.');

	const providedHash = hashOtp(email, parsed.data.otp);
	if (providedHash !== sealed.otpHash) throw error(401, 'Invalid OTP');

	// Mark verified for a short window to complete signup.
	cookies.set('signup_otp_verified', String(sealed.expiresAt), {
		httpOnly: true,
		sameSite: 'lax',
		secure: useSecureCookies(),
		path: '/',
		maxAge: 10 * 60
	});

	return json({ success: true });
};
