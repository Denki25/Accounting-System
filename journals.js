const journalList = document.getElementById('savedJournalList');
const journalLibraryStatus = document.getElementById('journalLibraryStatus');
const deleteJournalDialog = document.getElementById('deleteJournalDialog');
const deleteJournalForm = document.getElementById('deleteJournalForm');
let pendingDeleteJournalId = null;
function loadSavedJournals() {
  try {
    const parsed = JSON.parse(localStorage.getItem(journalArchiveKey) || '[]');
    if (!Array.isArray(parsed)) return [];
    const companies = new Map();
    parsed.forEach((journal) => {
      const companyName = journal.companyName || 'Company name';
      const companyId = journal.companyId || companyName.trim().toLocaleLowerCase();
      const record = companies.get(companyId) || { ...journal, id: `company-${encodeURIComponent(companyId)}`, companyId, companyName, entries: [] };
      const byTransaction = new Map(record.entries.map((entry, index) => [entry.transactionId || `legacy-${index}`, entry]));
      (journal.entries || []).forEach((entry, index) => byTransaction.set(entry.transactionId || `${journal.id}-legacy-${index}`, entry));
      record.entries = [...byTransaction.values()];
      if ((journal.date || '') >= (record.date || '')) Object.assign(record, journal, { id: `company-${encodeURIComponent(companyId)}`, companyId, entries: record.entries });
      companies.set(companyId, record);
    });
    return [...companies.values()];
  } catch { return []; }
}
function renderSavedJournals() {
  const journals = loadSavedJournals().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  journalLibraryStatus.textContent = `${journals.length} saved ${journals.length === 1 ? 'journal' : 'journals'}`;
  if (!journals.length) {
    journalList.innerHTML = '<div class="journal-library-empty"><span>＋</span><h2>No saved journals yet</h2><p>Add a balanced transaction in the workspace and it will appear here.</p><a class="btn btn-solid" href="transactions.html">Go to transactions</a></div>';
    return;
  }
  journalList.innerHTML = journals.map((journal) => {
    const transactions = new Map();
    (journal.entries || []).forEach((entry, index) => {
      if (entry.type !== 'Debit') return;
      transactions.set(entry.transactionId || `legacy-${index}`, (transactions.get(entry.transactionId || `legacy-${index}`) || 0) + Math.round((Number(entry.amount) || 0) * 100));
    });
    const entryCount = transactions.size;
    const total = [...transactions.values()].reduce((sum, amount) => sum + amount, 0) / 100;
    return `<article class="saved-journal-card"><div class="saved-journal-top"><span class="saved-journal-date">${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}</span><span class="saved-journal-amount">${formatCurrency(total)}</span></div><h2>${escapeHTML(journal.companyName || 'Company name')}</h2><p class="saved-journal-pair">${formatCurrency(total)} total across ${entryCount} ${entryCount === 1 ? 'transaction' : 'transactions'}</p><div class="saved-journal-actions"><a class="btn btn-solid" href="transactions.html?journal=${encodeURIComponent(journal.id)}">Open journal <span aria-hidden="true">→</span></a><button class="saved-journal-delete" type="button" data-delete-journal="${escapeHTML(journal.id)}" aria-label="Delete journal for ${escapeHTML(journal.companyName || 'company')}">Delete</button></div></article>`;
  }).join('');
}
journalList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-journal]');
  if (!button) return;
  pendingDeleteJournalId = button.dataset.deleteJournal;
  const companyName = loadSavedJournals().find((journal) => journal.id === pendingDeleteJournalId)?.companyName || 'this company';
  document.getElementById('deleteJournalCompany').textContent = companyName;
  deleteJournalDialog.showModal();
});
deleteJournalForm?.addEventListener('submit', (event) => {
  if (event.submitter?.value !== 'delete' || !pendingDeleteJournalId) { pendingDeleteJournalId = null; return; }
  event.preventDefault();
  try {
    const remaining = loadSavedJournals().filter((journal) => journal.id !== pendingDeleteJournalId);
    if (!safeSetItem(journalArchiveKey, JSON.stringify(remaining))) throw new Error('Storage unavailable');
    deleteJournalDialog.close();
    pendingDeleteJournalId = null;
    renderSavedJournals();
  } catch { journalLibraryStatus.textContent = 'Could not update saved journals on this device.'; }
});
window.addEventListener('storage', (event) => { if (event.key === journalArchiveKey) renderSavedJournals(); });
renderSavedJournals();
