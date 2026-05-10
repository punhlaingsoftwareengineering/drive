/**
 * Turn Markdown ` ```mermaid ` fences (rendered as `<pre><code class="language-mermaid">`)
 * into SVG diagrams using the Mermaid runtime (client-only).
 */
let mermaidInit: Promise<typeof import('mermaid').default> | null = null;

function loadMermaid() {
	if (!mermaidInit) {
		mermaidInit = import('mermaid').then((mod) => {
			const mermaid = mod.default;
			mermaid.initialize({
				startOnLoad: false,
				theme: 'neutral',
				securityLevel: 'loose',
				fontFamily: 'ui-sans-serif, system-ui, sans-serif'
			});
			return mermaid;
		});
	}
	return mermaidInit;
}

export async function enhanceDocsMermaid(container: HTMLElement): Promise<void> {
	if (typeof window === 'undefined') return;

	const pres = container.querySelectorAll<HTMLPreElement>('pre');
	const toRender: HTMLElement[] = [];

	for (const pre of pres) {
		const code = pre.querySelector<HTMLElement>(':scope > code');
		if (!code) continue;
		const isMermaid =
			code.classList.contains('language-mermaid') ||
			pre.classList.contains('mermaid') ||
			pre.dataset.language === 'mermaid';
		if (!isMermaid) continue;
		const src = (code.textContent ?? '').trim();
		if (!src) continue;

		const shell = document.createElement('div');
		shell.className =
			'not-prose my-6 w-full overflow-x-auto rounded-lg border border-base-300 bg-base-200/30 px-3 py-4';
		const graph = document.createElement('div');
		graph.className = 'mermaid mx-auto';
		graph.textContent = src;
		shell.appendChild(graph);
		pre.replaceWith(shell);
		toRender.push(graph);
	}

	if (toRender.length === 0) return;

	const mermaid = await loadMermaid();

	try {
		await mermaid.run({ nodes: toRender });
	} catch (e) {
		console.error('[docs mermaid]', e);
	}
}
