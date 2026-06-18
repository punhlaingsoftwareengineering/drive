<script lang="ts">
	import { togglePasswordVisibility } from '$lib/tool/password.tool';
	import { LucideCircleArrowLeft, LucideEye, LucideEyeClosed, LucideHouse } from '@lucide/svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	function goBack() {
		if (typeof window !== 'undefined' && window.history.length > 1) {
			window.history.back();
		} else {
			goto(resolve('/onboarding'));
		}
	}

	let email = $state('');
	let password = $state('');
	let isPasswordVisible = $state(false);
	let showResetSuccess = $state(false);
	let showSessionExpired = $state(false);
	let socialError = $state<string | null>(null);
	let loginError = $state<string | null>(null);
	let isSubmitting = $state(false);

	type SocialProvider = 'github' | 'google';

	async function logIn(e: SubmitEvent) {
		e.preventDefault();
		loginError = null;
		isSubmitting = true;
		try {
			const res = await fetch(resolve('/api/auth/login'), {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					accept: 'application/json'
				},
				body: JSON.stringify({ email, password })
			});
			if (!res.ok) {
				const text = await res.text().catch(() => '');
				loginError = text || 'Invalid email or password';
				return;
			}
			await goto(resolve('/home'));
		} catch {
			loginError = 'Network error. Please try again.';
		} finally {
			isSubmitting = false;
		}
	}

	async function signInWithSocial(provider: SocialProvider) {
		socialError = null;
		try {
			const res = await fetch(resolve('/api/auth/social'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					provider,
					callbackURL: resolve('/home')
				})
			});

			if (!res.ok) {
				const message = await res.text().catch(() => '');
				socialError = message || 'Social login failed. Please try again.';
				return;
			}

			const data = (await res.json().catch(() => ({}))) as { url?: string };
			if (data.url) {
				window.location.assign(data.url);
			} else {
				await goto(resolve('/home'));
			}
		} catch {
			socialError = 'Network error. Please try again.';
		}
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		showResetSuccess = params.get('reset') === '1';
		showSessionExpired = params.get('reason') === 'session';
	});
</script>

<section class="m-auto max-w-xl">
	<div class="d-card border border-base-content/10 bg-base-100 shadow-sm">
		<div class="d-card-body">
			<div class="flex justify-between">
				<div class="d-tooltip d-tooltip-primary" data-tip="go back">
					<button
						type="button"
						class="d-btn d-btn-circle d-btn-sm d-btn-primary"
						onclick={goBack}
						aria-label="Go back"
					>
						<LucideCircleArrowLeft class="size-6" />
					</button>
				</div>
				<div class="d-tooltip" data-tip="go home">
					<a class="d-btn d-btn-circle d-btn-sm" href={resolve(`/(public)/onboarding`)}>
						<LucideHouse class="size-6" />
					</a>
				</div>
			</div>
			<!-- Login Form -->
			<fieldset class="d-fieldset w-xs rounded-box border border-base-300 bg-base-200 p-4">
				<legend class="my-ft-h1 d-fieldset-legend">LOGIN</legend>
				<!-- Email Login -->
				<form class="flex flex-col gap-5" onsubmit={logIn}>
					{#if loginError}
						<div class="d-alert d-alert-error">
							<span>{loginError}</span>
						</div>
					{/if}
					{#if showSessionExpired}
						<div class="d-alert d-alert-warning">
							<span>Your session expired. Sign in again to continue.</span>
						</div>
					{/if}
					{#if showResetSuccess}
						<div class="d-alert d-alert-success">
							<span>Password reset successful. Please log in.</span>
						</div>
					{/if}
					<input type="text" class="d-input" placeholder="Email" bind:value={email} name="email" />
					<div class="d-join">
						<input
							type={isPasswordVisible ? 'text' : 'password'}
							class="d-input d-join-item"
							placeholder="Password"
							bind:value={password}
							name="password"
						/>
						<button
							type="button"
							class="d-btn d-join-item d-btn-primary"
							onclick={() => (isPasswordVisible = togglePasswordVisibility(isPasswordVisible))}
							aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
						>
							{#if isPasswordVisible}
								<LucideEye class="size-6" />
							{:else}
								<LucideEyeClosed class="size-6" />
							{/if}
						</button>
					</div>

					<button class="d-btn d-btn-primary" type="submit" disabled={isSubmitting}>
						{isSubmitting ? 'Signing in…' : 'Confirm'}
					</button>
				</form>

				<div class="mt-3 flex flex-col gap-4">
					<div class="text-xs">
						Don't have an account? <a href={resolve(`/auth/signup`)} class="d-link d-link-info"
							>SIGNUP</a
						>
					</div>
					<div class="text-xs">
						Forgot password? <a href={resolve(`/auth/forget-password`)} class="d-link d-link-info"
							>FORGET PASSWORD</a
						>
					</div>
				</div>
				<div class="d-divider">OR</div>
				<!-- Social Login -->
				<!-- GitHub -->
				<div class="flex flex-col gap-3">
					{#if socialError}
						<div class="d-alert d-alert-error">
							<span>{socialError}</span>
						</div>
					{/if}

					<button
						type="button"
						class="d-btn border-black bg-black text-white"
						onclick={() => signInWithSocial('github')}
					>
						<svg
							aria-label="GitHub logo"
							width="16"
							height="16"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							><path
								fill="white"
								d="M12,2A10,10 0 0,0 2,12C2,16.42 4.87,20.17 8.84,21.5C9.34,21.58 9.5,21.27 9.5,21C9.5,20.77 9.5,20.14 9.5,19.31C6.73,19.91 6.14,17.97 6.14,17.97C5.68,16.81 5.03,16.5 5.03,16.5C4.12,15.88 5.1,15.9 5.1,15.9C6.1,15.97 6.63,16.93 6.63,16.93C7.5,18.45 8.97,18 9.54,17.76C9.63,17.11 9.89,16.67 10.17,16.42C7.95,16.17 5.62,15.31 5.62,11.5C5.62,10.39 6,9.5 6.65,8.79C6.55,8.54 6.2,7.5 6.75,6.15C6.75,6.15 7.59,5.88 9.5,7.17C10.29,6.95 11.15,6.84 12,6.84C12.85,6.84 13.71,6.95 14.5,7.17C16.41,5.88 17.25,6.15 17.25,6.15C17.8,7.5 17.45,8.54 17.35,8.79C18,9.5 18.38,10.39 18.38,11.5C18.38,15.32 16.04,16.16 13.81,16.41C14.17,16.72 14.5,17.33 14.5,18.26C14.5,19.6 14.5,20.68 14.5,21C14.5,21.27 14.66,21.59 15.17,21.5C19.14,20.16 22,16.42 22,12A10,10 0 0,0 12,2Z"
							></path></svg
						>
						GitHub
					</button>

					<!-- Google -->
					<button
						type="button"
						class="d-btn border-[#e5e5e5] bg-white text-black"
						onclick={() => signInWithSocial('google')}
					>
						<svg
							aria-label="Google logo"
							width="16"
							height="16"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 512 512"
							><g
								><path d="m0 0H512V512H0" fill="#fff"></path><path
									fill="#34a853"
									d="M153 292c30 82 118 95 171 60h62v48A192 192 0 0190 341"
								></path><path fill="#4285f4" d="m386 400a140 175 0 0053-179H260v74h102q-7 37-38 57"
								></path><path fill="#fbbc02" d="m90 341a208 200 0 010-171l63 49q-12 37 0 73"
								></path><path
									fill="#ea4335"
									d="m153 219c22-69 116-109 179-50l55-54c-78-75-230-72-297 55"
								></path></g
							></svg
						>
						Google
					</button>
				</div>
			</fieldset>
		</div>
	</div>
</section>
