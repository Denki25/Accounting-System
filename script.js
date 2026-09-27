const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 });
const formatCurrency = (amount) => currency.format(amount);

const topbar = document.querySelector('.topbar');
window.addEventListener('scroll', () => topbar?.classList.toggle('scrolled', window.scrollY > 12));

const engineNodes = document.querySelectorAll('.engine-node');
engineNodes.forEach((node) => {
  const activate = () => {
    engineNodes.forEach((item) => item.classList.toggle('active', item === node));
    const label = document.querySelector('.detail-label');
    const copy = document.querySelector('.detail-copy');
    if (label) label.textContent = node.dataset.label || 'JOURNAL';
    if (copy) copy.textContent = node.dataset.copy || '';
  };
  node.addEventListener('mouseenter', activate);
  node.addEventListener('focus', activate);
  node.addEventListener('click', activate);
});

const revealElements = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !prefersReducedMotion) {
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
  }), { threshold: 0.12 });
  revealElements.forEach((element) => observer.observe(element));
} else revealElements.forEach((element) => element.classList.add('visible'));

const storyVisual = document.querySelector('.story-visual');
if (storyVisual && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { storyVisual.classList.add('visible'); observer.disconnect(); }
  }, { threshold: 0.2 });
  observer.observe(storyVisual);
}

const form = document.getElementById('transactionForm');
const rows = document.getElementById('journalRows');
const status = document.getElementById('journalStatus');
const storageKey = 'accounting-cycle-transactions';
const setupStorageKey = 'accounting-cycle-workspace';
const setupOverlay = document.getElementById('workspaceSetupOverlay');
const setupForm = document.getElementById('workspaceSetupForm');
const setupError = document.getElementById('setupError');
const localISODate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = localISODate();
let workspaceSetup = null;
try { workspaceSetup = JSON.parse(localStorage.getItem(setupStorageKey) || 'null'); } catch { workspaceSetup = null; }
let entries = [];
try { entries = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (!Array.isArray(entries)) entries = []; } catch { entries = []; }
let draftEntries = [];

function openWorkspaceSetup() {
  if (!setupOverlay || !setupForm) return;
  const settingsButton = document.getElementById('editWorkspaceSetup');
  if (settingsButton) settingsButton.textContent = workspaceSetup ? 'Workspace settings' : 'Set up workspace';
  setupForm.elements.companyName.value = workspaceSetup?.companyName || '';
  setupForm.elements.asOfDate.value = workspaceSetup?.asOfDate || today;
  setupForm.elements.yearEndDate.value = workspaceSetup?.yearEndDate || `${today.slice(0, 4)}-12-31`;
  if (setupError) setupError.textContent = '';
  setupOverlay.hidden = false;
  document.querySelector('.workspace-main')?.setAttribute('inert', '');
  document.querySelector('.workspace-page > .topbar')?.setAttribute('inert', '');
  document.querySelector('.workspace-page > .professional-footer')?.setAttribute('inert', '');
  setupForm.elements.companyName.focus();
}
function requireWorkspace() {
  if (workspaceSetup) return true;
  openWorkspaceSetup();
  return false;
}
if (setupOverlay && !workspaceSetup) openWorkspaceSetup();
if (setupOverlay && workspaceSetup) setupOverlay.hidden = true;
setupForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const companyName = setupForm.elements.companyName.value.trim();
  const asOfDate = setupForm.elements.asOfDate.value;
  const yearEndDate = setupForm.elements.yearEndDate.value;
  if (!companyName || !asOfDate || !yearEndDate) return;
  workspaceSetup = { companyName, asOfDate, yearEndDate };
  localStorage.setItem(setupStorageKey, JSON.stringify(workspaceSetup));
  const settingsButton = document.getElementById('editWorkspaceSetup');
  if (settingsButton) settingsButton.textContent = 'Workspace settings';
  const companyNameDisplay = document.getElementById('workspaceCompanyName');
  if (companyNameDisplay) companyNameDisplay.textContent = `${companyName} · Journal period through ${formatDate(yearEndDate)}`;
  setupOverlay.hidden = true;
  document.querySelector('.workspace-main')?.removeAttribute('inert');
  document.querySelector('.workspace-page > .topbar')?.removeAttribute('inert');
  document.querySelector('.workspace-page > .professional-footer')?.removeAttribute('inert');
  const entryDate = document.getElementById('entryDate');
  if (entryDate && !entryDate.value) entryDate.value = asOfDate;
  renderEntries();
});
document.getElementById('editWorkspaceSetup')?.addEventListener('click', openWorkspaceSetup);
document.getElementById('cancelSetup')?.addEventListener('click', () => {
  if (!setupOverlay) return;
  if (!workspaceSetup) {
    window.location.href = 'index.html';
    return;
  }
  setupOverlay.hidden = true;
  document.querySelector('.workspace-main')?.removeAttribute('inert');
  document.querySelector('.workspace-page > .topbar')?.removeAttribute('inert');
  document.querySelector('.workspace-page > .professional-footer')?.removeAttribute('inert');
});
document.querySelectorAll('[data-calendar-for]').forEach((button) => button.addEventListener('click', () => {
  const input = document.getElementById(button.dataset.calendarFor);
  if (!input) return;
  if (input.closest('.workspace-main') && !requireWorkspace()) return;
  try { if (typeof input.showPicker === 'function') input.showPicker(); else { input.focus(); input.click(); } }
  catch { input.focus(); }
}));

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date);
}
function getEntryDate(entry) { return entry.entryDate || (entry.date ? entry.date.slice(0, 10) : today); }

function renderEntries() {
  if (!rows) return;
  const fmt = (n) => formatCurrency(n);
  const groups = new Map();
  entries.forEach((entry, index) => {
    const key = entry.transactionId || `legacy-${index}`;
    const group = groups.get(key) || { entryDate: getEntryDate(entry), note: entry.note || '', saved: true };
    group[entry.type === 'Debit' ? 'debit' : 'credit'] = { account: entry.account, amount: Number(entry.amount) };
    groups.set(key, group);
  });
  const journalGroups = [...groups.values(), ...draftEntries.map((entry) => ({ ...entry, saved: false }))];
  rows.innerHTML = journalGroups.map((group) => {
    const hasDebit = Boolean(group.debit);
    const hasCredit = Boolean(group.credit);
    const lineCount = Number(hasDebit) + Number(hasCredit) + Number(Boolean(group.note));
    const dateCell = `<td class="journal-date-cell" rowspan="${Math.max(lineCount,1)}">${formatDate(group.entryDate)}${group.saved ? '' : '<small class="draft-label">Draft</small>'}</td>`;
    const debitRow = hasDebit ? `<tr class="journal-entry-row${group.saved ? '' : ' is-draft'}">${dateCell}<td class="particular-debit"><strong>${escapeHTML(group.debit.account)}</strong></td><td class="debit-cell">${fmt(group.debit.amount)}</td><td></td></tr>` : '';
    const creditDateCell = hasDebit ? '' : dateCell;
    const creditRow = hasCredit ? `<tr class="journal-entry-row${group.saved ? '' : ' is-draft'}">${creditDateCell}<td class="particular-credit"><strong>${escapeHTML(group.credit.account)}</strong></td><td></td><td class="credit-cell">${fmt(group.credit.amount)}</td></tr>` : '';
    const noteRow = group.note ? `<tr class="journal-note-row${group.saved ? '' : ' is-draft'}">${!hasDebit && !hasCredit ? dateCell : ''}<td class="journal-note-cell" colspan="3">${escapeHTML(group.note)}</td></tr>` : '';
    return `${debitRow}${creditRow}${noteRow}`;
  }).join('');
  const debit = entries.filter((entry) => entry.type === 'Debit').reduce((sum, entry) => sum + Number(entry.amount), 0) + draftEntries.reduce((sum, entry) => sum + entry.debitAmount, 0);
  const credit = entries.filter((entry) => entry.type === 'Credit').reduce((sum, entry) => sum + Number(entry.amount), 0) + draftEntries.reduce((sum, entry) => sum + entry.creditAmount, 0);
  document.getElementById('debitTotal')?.replaceChildren(document.createTextNode(fmt(debit)));
  document.getElementById('creditTotal')?.replaceChildren(document.createTextNode(fmt(credit)));
  document.getElementById('differenceValue')?.replaceChildren(document.createTextNode(fmt(Math.abs(debit - credit))));
  const balanced = journalGroups.length > 0 && Math.round(debit * 100) === Math.round(credit * 100);
  if (status) { status.textContent = !journalGroups.length ? 'Add an entry to start your journal.' : draftEntries.length ? `${draftEntries.length} draft ${draftEntries.length === 1 ? 'entry' : 'entries'} added. Finish & Save Journal to post them.` : balanced ? '✓ Journal saved and balanced.' : 'Saved entries need balancing.'; status.className = `journal-status${balanced ? ' success' : journalGroups.length ? ' error' : ''}`; }
  const summaryStatus = document.getElementById('balanceLabel');
  if (summaryStatus) summaryStatus.textContent = !journalGroups.length ? 'No entries yet' : balanced ? 'Journal is balanced' : 'Journal needs balancing';
  const journalSummaryStatus = document.getElementById('journalSummaryStatus');
  if (journalSummaryStatus) journalSummaryStatus.textContent = !journalGroups.length ? 'No entries yet.' : balanced ? 'All journal entries are balanced.' : 'Review the saved entries; debits and credits differ.';
  document.getElementById('entryCount')?.replaceChildren(document.createTextNode(String(journalGroups.length)));
  document.getElementById('emptyJournal')?.classList.toggle('is-hidden', journalGroups.length > 0);
  localStorage.setItem(storageKey, JSON.stringify(entries));
}
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!requireWorkspace()) return;
  const debitAccount = document.getElementById('debitAccountName').value.trim();
  const debitAmount = Number(document.getElementById('debitAmountValue').value);
  const creditAccount = document.getElementById('creditAccountName').value.trim();
  const creditAmount = Number(document.getElementById('creditAmountValue').value);
  const entryDate = document.getElementById('entryDate')?.value;
  const note = document.getElementById('entryNote')?.value.trim() || '';
  if (!debitAccount || !creditAccount || !Number.isFinite(debitAmount) || !Number.isFinite(creditAmount) || debitAmount <= 0 || creditAmount <= 0 || !entryDate) { status.textContent = 'Complete the date, both accounts, and both amounts.'; status.className = 'journal-status error'; return; }
  if (Math.round(debitAmount * 100) !== Math.round(creditAmount * 100)) { status.textContent = 'Debit and credit amounts must match before you add this entry.'; status.className = 'journal-status error'; return; }
  draftEntries.push({ debitAccount, debitAmount, creditAccount, creditAmount, note, entryDate });
  const savedDate = entryDate;
  form.reset();
  document.getElementById('entryDate').value = savedDate;
  renderEntries();
  document.getElementById('debitAccountName')?.focus();
});
document.getElementById('finishJournal')?.addEventListener('click', () => {
  if (!requireWorkspace()) return;
  if (!draftEntries.length) {
    if (status) { status.textContent = 'Add at least one entry before saving the journal.'; status.className = 'journal-status error'; }
    return;
  }
  draftEntries.forEach((entry) => {
    const transactionId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    entries.push({ transactionId, account: entry.debitAccount, amount: entry.debitAmount, type: 'Debit', note: entry.note, entryDate: entry.entryDate });
    entries.push({ transactionId, account: entry.creditAccount, amount: entry.creditAmount, type: 'Credit', note: entry.note, entryDate: entry.entryDate });
  });
  draftEntries = [];
  renderEntries();
});
document.getElementById('clearEntries')?.addEventListener('click', () => {
  if (!requireWorkspace()) return;
  if (!entries.length && !draftEntries.length) return;
  entries = [];
  draftEntries = [];
  renderEntries();
});
window.addEventListener('storage', (event) => { if (event.key === storageKey) { try { entries = JSON.parse(event.newValue || '[]'); } catch { entries = []; } renderEntries(); renderHomeDashboard(); } });
window.addEventListener('storage', (event) => {
  if (event.key === setupStorageKey) {
    try { workspaceSetup = JSON.parse(event.newValue || 'null'); } catch { workspaceSetup = null; }
    if (workspaceSetup && setupOverlay) {
      setupOverlay.hidden = true;
      document.querySelector('.workspace-main')?.removeAttribute('inert');
      document.querySelector('.workspace-page > .topbar')?.removeAttribute('inert');
      document.querySelector('.workspace-page > .professional-footer')?.removeAttribute('inert');
    }
    const companyNameDisplay = document.getElementById('workspaceCompanyName');
    if (companyNameDisplay && workspaceSetup) companyNameDisplay.textContent = `${workspaceSetup.companyName} · Journal period through ${formatDate(workspaceSetup.yearEndDate)}`;
    renderHomeDashboard();
  }
});
if (workspaceSetup) {
  const companyNameDisplay = document.getElementById('workspaceCompanyName');
  if (companyNameDisplay) companyNameDisplay.textContent = `${workspaceSetup.companyName} · Journal period through ${formatDate(workspaceSetup.yearEndDate)}`;
  const entryDate = document.getElementById('entryDate');
  if (entryDate && !entryDate.value) entryDate.value = workspaceSetup?.asOfDate || today;
}
else {
  const entryDate = document.getElementById('entryDate');
  if (entryDate && !entryDate.value) entryDate.value = today;
}
renderEntries();

const homeDashboard = document.getElementById('activityChartContent');
let chartRange = 'monthly';
function renderHomeDashboard() {
  if (!document.getElementById('homeDebits')) return;
  const validEntries = entries.filter((entry) => Number.isFinite(Number(entry.amount)) && Number(entry.amount) >= 0);
  const debitTotal = validEntries.filter((entry) => entry.type === 'Debit').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const creditTotal = validEntries.filter((entry) => entry.type === 'Credit').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const difference = Math.abs(debitTotal - creditTotal);
  const setText = (id, value) => { const element = document.getElementById(id); if (element) element.textContent = value; };
  setText('homeDebits', formatCurrency(debitTotal));
  setText('homeCredits', formatCurrency(creditTotal));
  setText('homeDifference', formatCurrency(difference));
  setText('homeEntryCount', String(validEntries.length));
  setText('homeBalanceCaption', !validEntries.length ? 'No entries yet' : difference === 0 ? 'Journal is balanced' : 'Journal needs balancing');
  const promptTitle = document.getElementById('workspacePromptTitle');
  const promptDescription = document.getElementById('workspacePromptDescription');
  const promptAction = document.getElementById('workspacePromptAction');
  if (promptTitle) promptTitle.textContent = workspaceSetup ? `${workspaceSetup.companyName} workspace is ready` : 'Set up your workspace when you’re ready';
  if (promptDescription) promptDescription.textContent = workspaceSetup ? `Your journal is set up through ${formatDate(workspaceSetup.yearEndDate)}. You can open it whenever you need.` : 'Add your organization and reporting dates before you start recording transactions.';
  if (promptAction) promptAction.textContent = workspaceSetup ? 'Open workspace →' : 'Set up workspace →';

  const recentList = document.getElementById('homeRecentTransactions');
  if (recentList) {
    const latest = [...validEntries].sort((a, b) => getEntryDate(b).localeCompare(getEntryDate(a))).slice(0, 5);
    recentList.innerHTML = latest.length ? latest.map((entry) => {
      const isDebit = entry.type === 'Debit';
      return `<li class="recent-item${isDebit ? ' is-debit' : ''}"><span class="recent-item-icon" aria-hidden="true">${isDebit ? '↙' : '↗'}</span><span class="recent-item-copy"><strong>${escapeHTML(entry.account || 'Account')}</strong><small>${formatDate(getEntryDate(entry))} · ${isDebit ? 'Debit' : 'Credit'}</small></span><strong class="recent-item-amount">${isDebit ? '−' : '+'}${formatCurrency(Number(entry.amount))}</strong></li>`;
    }).join('') : '<li class="recent-empty"><span class="empty-mark">＋</span><strong>No transactions yet</strong><small>Your latest entries will appear here.</small></li>';
  }
  renderActivityCharts(validEntries);
}

function renderActivityCharts(sourceEntries) {
  if (!homeDashboard) return;
  const dates = sourceEntries.map((entry) => getEntryDate(entry)).filter(Boolean).sort();
  const anchor = dates.length ? new Date(`${dates[dates.length - 1]}T00:00:00`) : new Date();
  let periods = [];
  if (chartRange === 'quarterly') {
    const currentQuarter = Math.floor(anchor.getMonth() / 3);
    periods = Array.from({ length: 4 }, (_, index) => {
      const date = new Date(anchor.getFullYear(), (currentQuarter - 3 + index) * 3, 1);
      return { key: `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`, label: `Q${Math.floor(date.getMonth() / 3) + 1} '${String(date.getFullYear()).slice(-2)}` };
    });
  } else if (chartRange === 'yearly') {
    periods = Array.from({ length: 5 }, (_, index) => {
      const year = anchor.getFullYear() - 4 + index;
      return { key: String(year), label: String(year) };
    });
  } else {
    periods = Array.from({ length: 12 }, (_, index) => {
      const date = new Date(anchor.getFullYear(), anchor.getMonth() - 11 + index, 1);
      return { key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: new Intl.DateTimeFormat('en', { month: 'short' }).format(date) };
    });
  }
  const totals = periods.map(() => ({ debit: 0, credit: 0 }));
  const matches = (entry, key) => {
    const dateValue = getEntryDate(entry);
    if (!dateValue) return false;
    const year = dateValue.slice(0, 4);
    const month = Number(dateValue.slice(5, 7));
    if (chartRange === 'yearly') return year === key;
    if (chartRange === 'quarterly') return `${year}-Q${Math.ceil(month / 3)}` === key;
    return dateValue.slice(0, 7) === key;
  };
  sourceEntries.forEach((entry) => {
    const index = periods.findIndex((period) => matches(entry, period.key));
    if (index >= 0) totals[index][entry.type === 'Debit' ? 'debit' : 'credit'] += Number(entry.amount);
  });
  const values = totals.flatMap((period) => [period.debit, period.credit]);
  const max = Math.max(...values, 0);
  const ceiling = max > 0 ? max * 1.12 : 1000;
  const left = 55, right = 724, top = 24, bottom = 218;
  const xAt = (index) => left + (periods.length === 1 ? 0 : (right - left) * index / (periods.length - 1));
  const yAt = (value) => bottom - value / ceiling * (bottom - top);
  const debitPoints = totals.map((item, index) => `${xAt(index)},${yAt(item.debit)}`).join(' ');
  const creditPoints = totals.map((item, index) => `${xAt(index)},${yAt(item.credit)}`).join(' ');
  const ticks = [0, 1, 2, 3].map((step) => {
    const value = ceiling * step / 3;
    const y = yAt(value);
    const label = value >= 1000 ? `₱${(value / 1000).toFixed(value >= 10000 ? 0 : 1).replace('.0', '')}k` : `₱${Math.round(value)}`;
    return `<line class="chart-grid-line" x1="${left}" y1="${y}" x2="${right}" y2="${y}"/><text class="chart-axis-label" x="${left - 8}" y="${y + 4}" text-anchor="end">${label}</text>`;
  }).join('');
  const labels = periods.map((period, index) => `<text class="chart-axis-label chart-x-label" x="${xAt(index)}" y="246">${period.label}</text>`).join('');
  const points = totals.map((item, index) => `<circle class="chart-point-debit" cx="${xAt(index)}" cy="${yAt(item.debit)}" r="3.6"><title>${periods[index].label}: Debits ${formatCurrency(item.debit)}</title></circle><circle class="chart-point-credit" cx="${xAt(index)}" cy="${yAt(item.credit)}" r="3.6"><title>${periods[index].label}: Credits ${formatCurrency(item.credit)}</title></circle>`).join('');
  homeDashboard.innerHTML = `<g>${ticks}</g><polyline class="chart-line-debit" points="${debitPoints}"/><polyline class="chart-line-credit" points="${creditPoints}"/>${points}${labels}`;
  const emptyNote = document.getElementById('chartEmptyNote');
  const rangeEntries = sourceEntries.filter((entry) => periods.some((period) => matches(entry, period.key)));
  if (emptyNote) emptyNote.hidden = rangeEntries.length > 0;
  const rangeLabel = document.getElementById('accountRangeLabel');
  if (rangeLabel) rangeLabel.textContent = chartRange[0].toUpperCase() + chartRange.slice(1);

  const accountTotals = new Map();
  rangeEntries.forEach((entry) => accountTotals.set(entry.account || 'Account', (accountTotals.get(entry.account || 'Account') || 0) + Number(entry.amount)));
  const sortedAccounts = [...accountTotals.entries()].sort((a, b) => b[1] - a[1]);
  const topAccounts = sortedAccounts.slice(0, 5);
  if (sortedAccounts.length > 5) topAccounts.push(['Other accounts', sortedAccounts.slice(5).reduce((sum, item) => sum + item[1], 0)]);
  const activityTotal = topAccounts.reduce((sum, item) => sum + item[1], 0);
  const donut = document.getElementById('accountDonut');
  const donutTotal = document.getElementById('accountTotal');
  const legend = document.getElementById('accountLegend');
  const colors = ['#3180d2', '#edb233', '#55b988', '#f07a3b', '#8599bd', '#9c78dc'];
  if (donutTotal) donutTotal.textContent = formatCurrency(activityTotal);
  if (donut && activityTotal > 0) {
    let edge = 0;
    const segments = topAccounts.map(([, value], index) => {
      const next = edge + value / activityTotal * 100;
      const part = `${colors[index % colors.length]} ${edge}% ${next}%`;
      edge = next;
      return part;
    });
    donut.style.background = `conic-gradient(${segments.join(',')})`;
  } else if (donut) donut.style.background = 'conic-gradient(#e8eef6 0 100%)';
  if (legend) legend.innerHTML = topAccounts.length ? topAccounts.map(([name, value], index) => `<div class="account-legend-item"><i class="account-legend-dot" style="background:${colors[index % colors.length]}"></i><span>${escapeHTML(name)}</span><strong>${Math.round(value / activityTotal * 100)}%</strong></div>`).join('') : '<p class="donut-empty">Account activity will appear here.</p>';
}

document.querySelectorAll('[data-chart-range]').forEach((button) => button.addEventListener('click', () => {
  chartRange = button.dataset.chartRange || 'monthly';
  document.querySelectorAll('[data-chart-range]').forEach((item) => item.classList.toggle('is-active', item === button));
  renderHomeDashboard();
}));
renderHomeDashboard();

const greetingTarget = document.getElementById('typedGreeting');
if (greetingTarget) {
  const greeting = 'Hello, Bianca!';
  if (prefersReducedMotion) greetingTarget.textContent = greeting;
  else {
    let letter = 0;
    let erasing = false;
    const typeNext = () => {
      letter += erasing ? -1 : 1;
      greetingTarget.textContent = greeting.slice(0, letter);
      if (letter === greeting.length) {
        erasing = true;
        window.setTimeout(typeNext, 1450);
      } else if (letter === 0) {
        erasing = false;
        window.setTimeout(typeNext, 450);
      } else {
        window.setTimeout(typeNext, erasing ? 42 : 78);
      }
    };
    window.setTimeout(typeNext, 250);
  }
}

const insightTarget = document.getElementById('typedInsight');
if (insightTarget) {
  const phrases = ['financial clarity.', 'balanced books.', 'clearer insight.'];
  if (prefersReducedMotion) insightTarget.textContent = phrases[0];
  else {
    let letter = 0;
    let erasing = false;
    let phraseIndex = 0;
    const typeNext = () => {
      const phrase = phrases[phraseIndex];
      letter += erasing ? -1 : 1;
      insightTarget.textContent = phrase.slice(0, letter);
      if (letter === phrase.length) {
        erasing = true;
        window.setTimeout(typeNext, 1500);
      } else if (letter === 0) {
        erasing = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
        window.setTimeout(typeNext, 500);
      } else window.setTimeout(typeNext, erasing ? 65 : 120);
    };
    window.setTimeout(typeNext, 700);
  }
}

const calculator = document.getElementById('profitCalculator');
if (calculator) {
  const revenueInput = document.getElementById('calcRevenue');
  const expensesInput = document.getElementById('calcExpenses');
  const netOutput = document.getElementById('calcNetIncome');
  const marginOutput = document.getElementById('calcMargin');
  const messageOutput = document.getElementById('calculatorMessage');
  const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 });
  const updateCalculator = () => {
    const revenue = Math.max(0, Number(revenueInput.value) || 0);
    const expenses = Math.max(0, Number(expensesInput.value) || 0);
    const income = revenue - expenses;
    netOutput.textContent = money.format(income);
    netOutput.classList.toggle('is-loss', income < 0);
    marginOutput.textContent = revenue > 0 ? `${((income / revenue) * 100).toFixed(1)}%` : '—';
    messageOutput.textContent = income < 0 ? 'Expenses are higher than revenue. Review your costs.' : revenue === 0 ? 'Add revenue to calculate your profit margin.' : 'Based on the numbers you entered.';
  };
  calculator.addEventListener('input', updateCalculator);
  calculator.addEventListener('reset', () => window.setTimeout(updateCalculator, 0));
  updateCalculator();
}
