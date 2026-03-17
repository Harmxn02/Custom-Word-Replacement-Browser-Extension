'use strict';

const $ = (id) => document.getElementById(id);

const inputFrom      = $('inputFrom');
const inputTo        = $('inputTo');
const optWholeWord   = $('optWholeWord');
const optCaseSens    = $('optCaseSensitive');
const addBtn         = $('addBtn');
const rulesList      = $('rulesList');
const emptyState     = $('emptyState');
const entryCount     = $('entryCount');
const globalToggle   = $('globalToggle');
const errorMsg       = $('errorMsg');
const clearBtn       = $('clearBtn');
const listHeader     = $('listHeader');

let rules = [];
let globalEnabled = true;

/* ─── Storage helpers ─── */

function save() {
	chrome.storage.sync.set({ replacements: rules, globalEnabled });
}

function load(callback) {
	chrome.storage.sync.get(['replacements', 'globalEnabled'], (data) => {
		rules = data.replacements || [];
		globalEnabled = data.globalEnabled !== false;
		callback();
	});
}

/* ─── Rendering ─── */

function updateCount() {
	const n = rules.length;
	entryCount.textContent = `${n} ${n === 1 ? 'rule' : 'rules'}`;
}

function renderBadges(rule) {
	const badges = [];
	if (rule.wholeWord)      badges.push('whole word');
	if (rule.caseSensitive)  badges.push('case sensitive');
	if (badges.length === 0) return '';
	return `<div class="badge-row">${badges.map(b => `<span class="badge">${b}</span>`).join('')}</div>`;
}

function renderRules() {
	const items = rulesList.querySelectorAll('.rule-row');
	items.forEach(el => el.remove());

	emptyState.style.display = rules.length === 0 ? '' : 'none';
	listHeader.style.visibility = rules.length === 0 ? 'hidden' : 'visible';

	rules.forEach((rule, index) => {
		const row = document.createElement('div');
		row.className = `rule-row${rule.enabled ? '' : ' disabled'}`;
		row.innerHTML = `
			<span class="rule-text from" title="${escHtml(rule.from)}">${escHtml(rule.from)}</span>
			<span class="rule-arrow">→</span>
			<span class="rule-text to" title="${escHtml(rule.to)}">${escHtml(rule.to)}</span>
			<div class="rule-actions">
				<button class="btn-icon toggle-rule" title="${rule.enabled ? 'Disable' : 'Enable'}" data-index="${index}">
					${rule.enabled ? '◉' : '◎'}
				</button>
				<button class="btn-icon delete" title="Delete rule" data-index="${index}">✕</button>
			</div>
			${renderBadges(rule)}
		`;
		rulesList.appendChild(row);
	});

	updateCount();
}

function escHtml(str) {
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ─── Validation ─── */

function validate() {
	const from = inputFrom.value.trim();
	const to   = inputTo.value.trim();
	errorMsg.textContent = '';
	addBtn.disabled = !from || !to;

	if (!from) return;
	try {
		const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		new RegExp(escaped);
	} catch {
		errorMsg.textContent = 'Invalid pattern.';
		addBtn.disabled = true;
	}

	if (rules.some(r => r.from === from && r.caseSensitive === optCaseSens.checked && r.wholeWord === optWholeWord.checked)) {
		errorMsg.textContent = 'A rule for this word already exists.';
		addBtn.disabled = true;
	}
}

/* ─── Event handlers ─── */

inputFrom.addEventListener('input', validate);
inputTo.addEventListener('input', validate);
optCaseSens.addEventListener('change', validate);
optWholeWord.addEventListener('change', validate);

addBtn.addEventListener('click', () => {
	const from = inputFrom.value.trim();
	const to   = inputTo.value.trim();
	if (!from || !to) return;

	rules.push({
		id: Date.now().toString(36) + Math.random().toString(36).slice(2),
		from,
		to,
		wholeWord: optWholeWord.checked,
		caseSensitive: optCaseSens.checked,
		enabled: true
	});

	save();
	renderRules();

	inputFrom.value = '';
	inputTo.value   = '';
	errorMsg.textContent = '';
	addBtn.disabled = true;
	inputFrom.focus();
});

inputTo.addEventListener('keydown', (e) => {
	if (e.key === 'Enter' && !addBtn.disabled) addBtn.click();
});

inputFrom.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') inputTo.focus();
});

rulesList.addEventListener('click', (e) => {
	const toggleBtn = e.target.closest('.toggle-rule');
	const deleteBtn = e.target.closest('.delete');

	if (toggleBtn) {
		const idx = parseInt(toggleBtn.dataset.index, 10);
		rules[idx].enabled = !rules[idx].enabled;
		save();
		renderRules();
	}

	if (deleteBtn) {
		const idx = parseInt(deleteBtn.dataset.index, 10);
		rules.splice(idx, 1);
		save();
		renderRules();
		validate();
	}
});

globalToggle.addEventListener('change', () => {
	globalEnabled = globalToggle.checked;
	save();
});

clearBtn.addEventListener('click', () => {
	if (rules.length === 0) return;
	if (!confirm('Delete all rules?')) return;
	rules = [];
	save();
	renderRules();
	validate();
});

/* ─── Init ─── */

load(() => {
	globalToggle.checked = globalEnabled;
	renderRules();
	validate();
});
