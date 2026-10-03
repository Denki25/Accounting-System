const form = document.getElementById('transactionForm');
const rows = document.getElementById('journalRows');
const status = document.getElementById('journalStatus');
const setupOverlay = document.getElementById('workspaceSetupOverlay');
const setupForm = document.getElementById('workspaceSetupForm');
const setupError = document.getElementById('setupError');
const draftFields = ['entryDate', 'debitAccountName', 'debitAmountValue', 'creditAccountName', 'creditAmountValue', 'entryNote'];
const trialBalanceCategory = (name) => {
  const value = name.toLocaleLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/accumulated depreciation|allowance for doubtful|contra asset/.test(value)) return 0;
  if (/prepaid|supplies on hand|inventory|cash|receivable|equipment|building|land|asset/.test(value)) return 0;
  if (/draw|withdraw/.test(value)) return 3;
  if (/payable|loan|mortgage|unearned|liabilit|deferred revenue/.test(value)) return 1;
  if (/capital|equity|retained earning|owner/.test(value)) return 2;
  if (/cost of (goods )?sales|cost of sales|expense|supplies used|depreciation|loss|rent|salary|wage|utilities|insurance|advertis|interest expense|bad debt/.test(value)) return 5;
  if (/revenue|income|sales|service|interest earned|gain/.test(value)) return 4;
  return 0;
};
const trialBalanceCategoryNames = ['ASSETS', 'LIABILITIES', 'EQUITY / CAPITAL', 'DRAWINGS', 'INCOME / REVENUE', 'EXPENSES'];
const toCents = (amount) => Math.round((Number(amount) || 0) * 100);
function canonicalAccountName(name) {
  const cleaned = String(name || '').trim();
  const existing = entries.find((entry) => String(entry.account || '').trim().toLocaleLowerCase() === cleaned.toLocaleLowerCase());
  return existing ? String(existing.account).trim() : cleaned;
}
const savedJournalId = new URLSearchParams(location.search).get('journal');
let viewingSavedJournal = false;
function readJournalArchive() {
  try {
    const value = JSON.parse(localStorage.getItem(journalArchiveKey) || '[]');
    if (!Array.isArray(value)) return [];
    const companies = new Map();
    value.forEach((journal) => {
      const companyName = journal.companyName || 'Company name';
      const companyId = journal.companyId || companyName.trim().toLocaleLowerCase();
      const record = companies.get(companyId) || { ...journal, id: `company-${encodeURIComponent(companyId)}`, companyId, companyName, entries: [] };
      const byTransaction = new Map(record.entries.map((entry, index) => [entry.transactionId || `legacy-${index}`, entry]));
      (journal.entries || []).forEach((entry, index) => byTransaction.set(entry.transactionId || `${journal.id}-legacy-${index}`, entry));
      record.entries = [...byTransaction.values()];
      if ((journal.date || '') >= (record.date || '')) Object.assign(record, journal, { id: `company-${encodeURIComponent(companyId)}`, companyId, entries: record.entries });
      companies.set(companyId, record);
    });
    const normalized = [...companies.values()];
    normalized.forEach((journal) => {
      if (journal.companyId === journal.companyName.trim().toLocaleLowerCase()) {
        journal.companyId = window.crypto?.randomUUID?.() || `company-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        journal.id = `company-${encodeURIComponent(journal.companyId)}`;
        if (journal.workspace) journal.workspace = { ...journal.workspace, companyId: journal.companyId };
      }
    });
    if (JSON.stringify(normalized) !== JSON.stringify(value)) safeSetItem(journalArchiveKey, JSON.stringify(normalized));
    return normalized;
  } catch { return []; }
}
if (workspaceSetup && !workspaceSetup.companyId) {
  const matching = readJournalArchive().find((journal) => journal.companyName?.trim().toLocaleLowerCase() === workspaceSetup.companyName?.trim().toLocaleLowerCase());
  if (matching?.companyId) {
    workspaceSetup = { ...workspaceSetup, companyId: matching.companyId };
    safeSetItem(setupStorageKey, JSON.stringify(workspaceSetup));
  }
}
function archiveExistingEntries() {
  const archive = readJournalArchive();
  if (!entries.length) return;
  const companyName = workspaceSetup?.companyName || 'Company name';
  const companyId = workspaceSetup?.companyId || companyName.trim().toLocaleLowerCase();
  const debits = entries.filter((entry) => entry.type === 'Debit');
  const lastDebit = debits.at(-1);
  if (!lastDebit) return;
  const existing = archive.find((journal) => journal.companyId === companyId || (!journal.companyId && journal.companyName?.trim().toLocaleLowerCase() === companyId));
  const mergedEntries = new Map();
  [...(existing?.entries || []), ...entries].forEach((entry, index) => mergedEntries.set(entry.transactionId || `legacy-${index}-${entry.type}-${entry.account}-${entry.amount}`, entry));
  const record = { id: existing?.id || `company-${encodeURIComponent(companyId)}`, companyId, companyName, workspace: workspaceSetup || null, date: getEntryDate(lastDebit), note: lastDebit.note || '', debitAccount: lastDebit.account, creditAccount: entries.filter((entry) => entry.type === 'Credit').at(-1)?.account || '', amount: Number(lastDebit.amount), entries: [...mergedEntries.values()] };
  if (existing) Object.assign(existing, record); else archive.unshift(record);
  return safeSetItem(journalArchiveKey, JSON.stringify(archive));
}
function readTransactionDraft() {
  try { return JSON.parse(localStorage.getItem(draftStorageKey) || 'null'); } catch { return null; }
}
function updateTransactionDraft() {
  if (!form) return;
  const draft = Object.fromEntries(draftFields.map((id) => [id, document.getElementById(id)?.value || '']));
  const hasDetails = draftFields.slice(1).some((id) => draft[id].trim());
  if (hasDetails) safeSetItem(draftStorageKey, JSON.stringify(draft));
  else localStorage.removeItem(draftStorageKey);
}
const savedDraft = readTransactionDraft();
if (form && savedDraft) draftFields.forEach((id) => {
  const field = document.getElementById(id);
  if (field && typeof savedDraft[id] === 'string') field.value = savedDraft[id];
});
form?.addEventListener('input', updateTransactionDraft);
form?.addEventListener('change', updateTransactionDraft);
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
if (setupOverlay && workspaceSetup) setupOverlay.hidden = true;
setupForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const companyName = setupForm.elements.companyName.value.trim();
  const asOfDate = setupForm.elements.asOfDate.value;
  const yearEndDate = setupForm.elements.yearEndDate.value;
  if (!companyName || !asOfDate || !yearEndDate) return;
  if (asOfDate > yearEndDate) { if (setupError) setupError.textContent = 'The as of date must be on or before the year ended date.'; return; }
  const previousCompanyName = workspaceSetup?.companyName || '';
  const previousStorageKey = storageKey;
  const archive = readJournalArchive();
  const matchingArchive = archive.find((journal) => (workspaceSetup?.companyId && journal.companyId === workspaceSetup.companyId) || (!workspaceSetup?.companyId && journal.companyName?.trim().toLocaleLowerCase() === previousCompanyName.trim().toLocaleLowerCase()) || (!previousCompanyName && journal.companyName?.trim().toLocaleLowerCase() === companyName.toLocaleLowerCase()));
  const companyId = workspaceSetup?.companyId || matchingArchive?.companyId || (window.crypto?.randomUUID?.() || `company-${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const nextStorageKey = transactionStorageKeyForCompany(companyName, companyId);
  if (previousStorageKey !== nextStorageKey) {
    if (localStorage.getItem(nextStorageKey) === null || previousCompanyName.toLocaleLowerCase() !== companyName.toLocaleLowerCase()) safeSetItem(nextStorageKey, JSON.stringify(entries));
    storageKey = nextStorageKey;
    try { entries = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (!Array.isArray(entries)) entries = []; } catch { entries = []; }
  }
  workspaceSetup = { companyId, companyName, asOfDate, yearEndDate };
  if (!safeSetItem(setupStorageKey, JSON.stringify(workspaceSetup))) { if (setupError) setupError.textContent = 'Could not save workspace settings on this device.'; return; }
  const settingsButton = document.getElementById('editWorkspaceSetup');
  if (settingsButton) settingsButton.textContent = 'Workspace settings';
  const companyNameDisplay = document.getElementById('workspaceCompanyName');
  if (companyNameDisplay) companyNameDisplay.textContent = `${companyName} · Journal period through ${formatDate(yearEndDate)}`;
  setupOverlay.hidden = true;
  document.querySelector('.workspace-main')?.removeAttribute('inert');
  document.querySelector('.workspace-page > .topbar')?.removeAttribute('inert');
  document.querySelector('.workspace-page > .professional-footer')?.removeAttribute('inert');
  const entryDate = document.getElementById('entryDate');
  if (entryDate) { entryDate.min = asOfDate; entryDate.max = yearEndDate; if (!entryDate.value) entryDate.value = asOfDate; }
  renderEntries();
  renderTrialBalance();
  if (previousStorageKey !== storageKey) safeSetItem(storageKey, JSON.stringify(entries));
});
document.getElementById('editWorkspaceSetup')?.addEventListener('click', openWorkspaceSetup);
document.getElementById('startNewCompany')?.addEventListener('click', () => {
  if (!window.confirm('Start a new company workspace? Current entries will be saved to the journal archive first.')) return;
  if (entries.length && !archiveExistingEntries()) {
    if (status) { status.textContent = 'Could not save the current journal. Free storage space before starting a new company.'; status.className = 'journal-status error'; }
    return;
  }
  try { localStorage.removeItem(setupStorageKey); localStorage.removeItem(draftStorageKey); } catch { /* Continue into setup even when storage is unavailable. */ }
  workspaceSetup = null;
  storageKey = legacyStorageKey;
  entries = [];
  openWorkspaceSetup();
});
document.getElementById('cancelSetup')?.addEventListener('click', () => {
  location.href = 'index.html';
});
document.querySelectorAll('[data-calendar-for]').forEach((button) => button.addEventListener('click', () => {
  const input = document.getElementById(button.dataset.calendarFor);
  if (!input) return;
  if (input.closest('.workspace-main') && !requireWorkspace()) return;
  try { if (typeof input.showPicker === 'function') input.showPicker(); else { input.focus(); input.click(); } }
  catch { input.focus(); }
}));

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
  const journalGroups = [...groups.values()];
  const journalCompanyName = document.getElementById('journalCompanyName');
  if (journalCompanyName) journalCompanyName.textContent = workspaceSetup?.companyName || 'Company name';
  const journalDate = document.getElementById('journalLastTransactionDate');
  if (journalDate) {
    const lastTransactionDate = journalGroups.map((group) => group.entryDate).filter(Boolean).sort().at(-1);
    journalDate.textContent = lastTransactionDate ? ` ${formatDate(lastTransactionDate)}` : 'No transactions yet';
  }
  rows.innerHTML = journalGroups.map((group) => {
    const hasDebit = Boolean(group.debit);
    const hasCredit = Boolean(group.credit);
    const lineCount = Number(hasDebit) + Number(hasCredit) + Number(Boolean(group.note));
    const dateCell = `<td class="journal-date-cell" rowspan="${Math.max(lineCount,1)}">${formatDate(group.entryDate)}</td>`;
    const debitRow = hasDebit ? `<tr class="journal-entry-row">${dateCell}<td class="particular-debit"><strong>${escapeHTML(group.debit.account)}</strong></td><td class="debit-cell">${fmt(group.debit.amount)}</td><td></td></tr>` : '';
    const creditDateCell = hasDebit ? '' : dateCell;
    const creditRow = hasCredit ? `<tr class="journal-entry-row">${creditDateCell}<td class="particular-credit"><strong>${escapeHTML(group.credit.account)}</strong></td><td></td><td class="credit-cell">${fmt(group.credit.amount)}</td></tr>` : '';
    const noteRow = group.note ? `<tr class="journal-note-row">${!hasDebit && !hasCredit ? dateCell : ''}<td class="journal-note-cell" colspan="3">${escapeHTML(group.note)}</td></tr>` : '';
    return `${debitRow}${creditRow}${noteRow}`;
  }).join('');
  const debit = entries.filter((entry) => entry.type === 'Debit').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const credit = entries.filter((entry) => entry.type === 'Credit').reduce((sum, entry) => sum + Number(entry.amount), 0);
  const balanced = journalGroups.length > 0 && Math.round(debit * 100) === Math.round(credit * 100);
  if (status) { status.textContent = !journalGroups.length ? 'Add an entry to post it to the general journal.' : balanced ? '✓ Journal entries are posted and balanced.' : 'Journal entries need balancing.'; status.className = `journal-status${balanced ? ' success' : journalGroups.length ? ' error' : ''}`; }
  const journalSummaryStatus = document.getElementById('journalSummaryStatus');
  if (journalSummaryStatus) journalSummaryStatus.textContent = !journalGroups.length ? 'No entries yet.' : balanced ? 'All journal entries are balanced.' : 'Debits and credits differ.';
  document.getElementById('entryCount')?.replaceChildren(document.createTextNode(String(journalGroups.length)));
  document.getElementById('emptyJournal')?.classList.toggle('is-hidden', journalGroups.length > 0);
  if (!viewingSavedJournal) safeSetItem(storageKey, JSON.stringify(entries));
  renderTrialBalance();
  if (!journalGroups.length) {
    const ledgerSection = document.getElementById('ledgerSection');
    if (ledgerSection) ledgerSection.hidden = true;
  } else if (document.getElementById('ledgerSection')?.hidden === false) renderLedger();
}
function renderTrialBalance() {
  const body = document.getElementById('tbRows');
  if (!body) return;
  const accounts = new Map();
  entries.forEach((entry) => {
    const name = String(entry.account || 'Unnamed account').trim() || 'Unnamed account';
    const key = name.toLocaleLowerCase();
    const account = accounts.get(key) || { name, debit: 0, credit: 0 };
    account[entry.type === 'Debit' ? 'debit' : 'credit'] += toCents(entry.amount);
    accounts.set(key, account);
  });
  const groups = trialBalanceCategoryNames.map(() => []);
  for (const account of accounts.values()) {
    const net = account.debit - account.credit;
    if (!net) continue;
    groups[trialBalanceCategory(account.name)].push({ name: account.name, debit: net > 0 ? net / 100 : 0, credit: net < 0 ? -net / 100 : 0 });
  }
  groups.forEach((group) => group.sort((a, b) => a.name.localeCompare(b.name)));
  const fmt = (amount) => amount ? formatCurrency(amount) : '';
  let debitTotalCents = 0, creditTotalCents = 0;
  body.innerHTML = groups.map((group) => {
    if (!group.length) return '';
    const accountRows = group.map((account) => {
      debitTotalCents += toCents(account.debit); creditTotalCents += toCents(account.credit);
      return `<tr><td>${escapeHTML(account.name)}</td><td class="tb-debit">${fmt(account.debit)}</td><td class="tb-credit">${fmt(account.credit)}</td></tr>`;
    }).join('');
    return accountRows;
  }).join('');
  const hasAccounts = groups.some((group) => group.length);
  document.getElementById('tbTableWrap').hidden = !hasAccounts;
  document.getElementById('tbAccountCount').textContent = String(accounts.size);
  document.getElementById('tbDebitTotal').textContent = formatCurrency(debitTotalCents / 100);
  document.getElementById('tbCreditTotal').textContent = formatCurrency(creditTotalCents / 100);
  const company = workspaceSetup?.companyName || 'Company name';
  document.getElementById('tbCompanyName').textContent = company;
  document.getElementById('tbAccountingDate').textContent = workspaceSetup?.asOfDate ? `As of ${formatDate(workspaceSetup.asOfDate)}` : `As of ${formatDate(today)}`;
}
function renderLedger() {
  const ledgerAccounts = document.getElementById('ledgerAccounts');
  if (!ledgerAccounts) return;
  const accountFilter = document.getElementById('ledgerAccountFilter');
  const selectedAccount = accountFilter?.value || '';
  const searchTerm = document.getElementById('ledgerSearch')?.value.trim().toLocaleLowerCase() || '';
  const accounts = new Map();
  entries.forEach((entry) => {
    const name = String(entry.account || 'Unnamed account').trim() || 'Unnamed account';
    const key = name.toLocaleLowerCase();
    const account = accounts.get(key) || { name, debit: 0, credit: 0, rows: [] };
    const amount = toCents(entry.amount);
    const isDebit = entry.type === 'Debit';
    account[isDebit ? 'debit' : 'credit'] += amount;
    account.rows.push({ date: getEntryDate(entry), note: entry.note || '', debit: isDebit ? amount : null, credit: isDebit ? null : amount });
    accounts.set(key, account);
  });
  const sortedAccounts = [...accounts.values()].sort((a, b) => a.name.localeCompare(b.name));
  const count = document.getElementById('ledgerAccountCount');
  if (count) count.textContent = String(sortedAccounts.length);
  if (accountFilter) {
    accountFilter.innerHTML = `<option value="">All Accounts</option>${sortedAccounts.map(({ name }) => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`).join('')}`;
    if (sortedAccounts.some(({ name }) => name === selectedAccount)) accountFilter.value = selectedAccount;
  }
  const visibleAccounts = sortedAccounts.filter(({ name }) => (!selectedAccount || name === selectedAccount) && (!searchTerm || name.toLocaleLowerCase().includes(searchTerm)));
  ledgerAccounts.innerHTML = visibleAccounts.length ? visibleAccounts.map((account) => {
    const name = account.name;
    const rowsHTML = account.rows.sort((a, b) => a.date.localeCompare(b.date)).map((row) => `<tr><td><span>${formatDate(row.date)}</span>${row.note ? `<small>${escapeHTML(row.note)}</small>` : ''}</td><td class="ledger-debit">${row.debit === null ? '' : formatCurrency(row.debit / 100)}</td><td class="ledger-credit">${row.credit === null ? '' : formatCurrency(row.credit / 100)}</td></tr>`).join('');
    const balance = Math.abs(account.debit - account.credit);
    const balanceLabel = account.debit === account.credit ? 'Balanced' : account.debit > account.credit ? 'Debit balance' : 'Credit balance';
    return `<article class="ledger-account-card"><div class="ledger-account-title"><h3>${escapeHTML(name)}</h3><span>${account.rows.length} ${account.rows.length === 1 ? 'entry' : 'entries'}</span></div><div class="t-account-scroll"><table class="t-account-table"><thead><tr><th>Date / Note</th><th>Debit</th><th>Credit</th></tr></thead><tbody>${rowsHTML}</tbody><tfoot><tr><th>Total</th><th>${formatCurrency(account.debit / 100)}</th><th>${formatCurrency(account.credit / 100)}</th></tr></tfoot></table></div><div class="ledger-balance"><span>${balanceLabel}</span><strong>${formatCurrency(balance / 100)}</strong></div></article>`;
  }).join('') : '<p class="ledger-no-results">No accounts match these filters.</p>';
}
document.getElementById('ledgerSearch')?.addEventListener('input', renderLedger);
document.getElementById('ledgerAccountFilter')?.addEventListener('change', renderLedger);
form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!requireWorkspace()) return;
  const debitAccount = canonicalAccountName(document.getElementById('debitAccountName').value);
  const debitAmount = Number(document.getElementById('debitAmountValue').value);
  const creditAccount = canonicalAccountName(document.getElementById('creditAccountName').value);
  const creditAmount = Number(document.getElementById('creditAmountValue').value);
  const entryDate = document.getElementById('entryDate')?.value;
  const note = document.getElementById('entryNote')?.value.trim() || '';
  if (!debitAccount || !creditAccount || !Number.isFinite(debitAmount) || !Number.isFinite(creditAmount) || debitAmount <= 0 || creditAmount <= 0 || !entryDate) { status.textContent = 'Complete the date, both accounts, and both amounts.'; status.className = 'journal-status error'; return; }
  if (Math.round(debitAmount * 100) !== Math.round(creditAmount * 100)) { status.textContent = 'Debit and credit amounts must match before you add this entry.'; status.className = 'journal-status error'; return; }
  if (workspaceSetup?.asOfDate && (entryDate < workspaceSetup.asOfDate || entryDate > workspaceSetup.yearEndDate)) { status.textContent = `Transaction date must fall between ${formatDate(workspaceSetup.asOfDate)} and ${formatDate(workspaceSetup.yearEndDate)}.`; status.className = 'journal-status error'; return; }
  const transactionId = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  entries.push({ transactionId, account: debitAccount, amount: debitAmount, type: 'Debit', note, entryDate });
  entries.push({ transactionId, account: creditAccount, amount: creditAmount, type: 'Credit', note, entryDate });
  const savedDate = entryDate;
  form.reset();
  localStorage.removeItem(draftStorageKey);
  document.getElementById('entryDate').value = savedDate;
  renderEntries();
});
document.getElementById('finishJournal')?.addEventListener('click', () => {
  if (!requireWorkspace()) return;
  if (!entries.length) {
    if (status) { status.textContent = 'Add at least one journal entry before viewing the ledger.'; status.className = 'journal-status error'; }
    return;
  }
  if (!archiveExistingEntries()) {
    if (status) { status.textContent = 'Could not save this journal on the device. Free storage space and try again.'; status.className = 'journal-status error'; }
    return;
  }
  const companyId = workspaceSetup?.companyId || (workspaceSetup?.companyName || '').trim().toLocaleLowerCase();
  const saved = readJournalArchive().find((journal) => journal.companyId === companyId);
  if (!saved) return;
  location.href = `transactions.html?journal=${encodeURIComponent(saved.id)}`;
});
document.getElementById('backToJournal')?.addEventListener('click', () => {
  document.querySelector('.journal-card')?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
});
document.getElementById('clearEntries')?.addEventListener('click', () => {
  if (!requireWorkspace()) return;
  if (!entries.length) return;
  entries = [];
  renderEntries();
});
window.addEventListener('storage', (event) => { if (!viewingSavedJournal && event.key === storageKey) { try { entries = JSON.parse(event.newValue || '[]'); } catch { entries = []; } renderEntries(); } });
window.addEventListener('storage', (event) => {
  if (viewingSavedJournal) return;
  if (event.key === setupStorageKey) {
    const previousKey = storageKey;
    try { workspaceSetup = JSON.parse(event.newValue || 'null'); } catch { workspaceSetup = null; }
    storageKey = workspaceSetup?.companyName ? transactionStorageKeyForCompany(workspaceSetup.companyName, workspaceSetup.companyId) : legacyStorageKey;
    if (storageKey !== previousKey) {
      try { entries = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (!Array.isArray(entries)) entries = []; } catch { entries = []; }
      renderEntries();
    }
    if (workspaceSetup && setupOverlay) {
      setupOverlay.hidden = true;
      document.querySelector('.workspace-main')?.removeAttribute('inert');
      document.querySelector('.workspace-page > .topbar')?.removeAttribute('inert');
      document.querySelector('.workspace-page > .professional-footer')?.removeAttribute('inert');
    }
    const companyNameDisplay = document.getElementById('workspaceCompanyName');
    if (companyNameDisplay && workspaceSetup) companyNameDisplay.textContent = `${workspaceSetup.companyName} · Journal period through ${formatDate(workspaceSetup.yearEndDate)}`;
    const entryDate = document.getElementById('entryDate');
    if (entryDate) { entryDate.min = workspaceSetup?.asOfDate || ''; entryDate.max = workspaceSetup?.yearEndDate || ''; }
    renderTrialBalance();
  }
});
if (workspaceSetup) {
  const companyNameDisplay = document.getElementById('workspaceCompanyName');
  if (companyNameDisplay) companyNameDisplay.textContent = `${workspaceSetup.companyName} · Journal period through ${formatDate(workspaceSetup.yearEndDate)}`;
  const entryDate = document.getElementById('entryDate');
  if (entryDate) { entryDate.min = workspaceSetup?.asOfDate || ''; entryDate.max = workspaceSetup?.yearEndDate || ''; if (!entryDate.value) entryDate.value = workspaceSetup?.asOfDate || today; }
}
else {
  const entryDate = document.getElementById('entryDate');
  if (entryDate && !entryDate.value) entryDate.value = today;
}
if (savedJournalId) {
  const saved = readJournalArchive().find((journal) => journal.id === savedJournalId);
  if (saved) {
    viewingSavedJournal = true;
    entries = saved.entries || [];
    workspaceSetup = saved.workspace || { companyName: saved.companyName, asOfDate: saved.date, yearEndDate: saved.date };
    document.querySelector('.workspace-heading h1').textContent = 'Saved Journal';
    document.querySelector('.workspace-heading > div > p:not(.eyebrow)').textContent = saved.companyName;
    document.querySelector('.entry-card').hidden = true;
    document.getElementById('savedJournalViews').hidden = false;
    document.getElementById('editWorkspaceSetup').hidden = true;
    document.getElementById('startNewCompany').hidden = true;
    document.querySelector('.journal-card #clearEntries')?.remove();
    document.querySelector('.workspace-heading-actions')?.insertAdjacentHTML('beforeend', '<a class="text-button" href="journals.html">← All Journals</a>');
    const ledgerSection = document.getElementById('ledgerSection');
    if (ledgerSection) ledgerSection.hidden = false;
    document.getElementById('TrialBalanceSection')?.removeAttribute('hidden');
  }
}
else if (!workspaceSetup) {
  openWorkspaceSetup();
}
document.getElementById('savedJournalViews')?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-report-view]');
  if (!button || !viewingSavedJournal) return;
  const view = button.dataset.reportView;
  document.querySelector('.journal-card').hidden = view !== 'all' && view !== 'journal';
  document.getElementById('ledgerSection').hidden = view !== 'all' && view !== 'ledger';
  document.getElementById('TrialBalanceSection').hidden = view !== 'all' && view !== 'trial-balance';
  document.querySelectorAll('#savedJournalViews [data-report-view]').forEach((option) => {
    option.setAttribute('aria-pressed', String(option === button));
  });
});
renderEntries();
if (savedJournalId && viewingSavedJournal) renderLedger();
renderTrialBalance();
