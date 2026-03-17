(() => {
	'use strict';

	const SKIP_TAGS = new Set([
		'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'NOSCRIPT',
		'IFRAME', 'CANVAS', 'SVG', 'CODE', 'PRE'
	]);

	let replacements = [];
	let globalEnabled = true;
	let observer = null;
	let processing = false;

	/**
	 * Builds a RegExp for a single replacement rule.
	 * @param {Object} rule - The replacement rule object.
	 * @returns {RegExp|null}
	 */
	function buildRegex(rule) {
		try {
			const escaped = rule.from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const pattern = rule.wholeWord ? `\\b${escaped}\\b` : escaped;
			const flags = rule.caseSensitive ? 'g' : 'gi';
			return new RegExp(pattern, flags);
		} catch {
			return null;
		}
	}

	/**
	 * Applies all enabled replacement rules to a single text node.
	 * @param {Text} node - The DOM text node to process.
	 */
	function processTextNode(node) {
		if (!node.nodeValue || !node.nodeValue.trim()) return;

		let text = node.nodeValue;
		let changed = false;

		for (const rule of replacements) {
			if (!rule.enabled || !rule.from || !rule.to) continue;
			const regex = buildRegex(rule);
			if (!regex) continue;
			const next = text.replace(regex, rule.to);
			if (next !== text) {
				text = next;
				changed = true;
			}
		}

		if (changed) {
			node.nodeValue = text;
		}
	}

	/**
	 * Walks all text nodes within a root element and applies replacements.
	 * @param {Element} root - The root element to walk.
	 */
	function walkAndReplace(root) {
		const walker = document.createTreeWalker(
			root,
			NodeFilter.SHOW_TEXT,
			{
				acceptNode(node) {
					const parent = node.parentElement;
					if (!parent) return NodeFilter.FILTER_REJECT;
					if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
					if (parent.isContentEditable) return NodeFilter.FILTER_REJECT;
					return NodeFilter.FILTER_ACCEPT;
				}
			}
		);

		const nodes = [];
		let node;
		while ((node = walker.nextNode())) nodes.push(node);
		nodes.forEach(processTextNode);
	}

	/**
	 * Runs replacements across the entire document body.
	 */
	function applyToPage() {
		if (!globalEnabled || replacements.length === 0) return;
		if (!document.body) return;
		walkAndReplace(document.body);
	}

	/**
	 * Sets up a MutationObserver to handle dynamically added content.
	 */
	function startObserver() {
		if (observer) observer.disconnect();

		observer = new MutationObserver((mutations) => {
			if (!globalEnabled || replacements.length === 0 || processing) return;
			processing = true;

			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (node.nodeType === Node.TEXT_NODE) {
						processTextNode(node);
					} else if (node.nodeType === Node.ELEMENT_NODE) {
						if (!SKIP_TAGS.has(node.tagName)) {
							walkAndReplace(node);
						}
					}
				}
			}

			processing = false;
		});

		observer.observe(document.body, {
			childList: true,
			subtree: true
		});
	}

	/**
	 * Loads settings from storage and initialises the extension.
	 */
	function init() {
		chrome.storage.sync.get(['replacements', 'globalEnabled'], (data) => {
			replacements = data.replacements || [];
			globalEnabled = data.globalEnabled !== false;
			applyToPage();
			startObserver();
		});
	}

	chrome.storage.onChanged.addListener((changes) => {
		if (changes.replacements) replacements = changes.replacements.newValue || [];
		if (changes.globalEnabled) globalEnabled = changes.globalEnabled.newValue !== false;
	});

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
