const journalList = document.getElementById('savedJournalList');
const journalLibraryStatus = document.getElementById('journalLibraryStatus');
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
  journalList.innerHTML = journals.map((journal) => `<article class="saved-journal-card"><div class="saved-journal-top"><span class="saved-journal-date">${escapeHTML(formatDate(journal.date))}</span><span class="saved-journal-amount">${formatCurrency(Number(journal.amount) || 0)}</span></div><h2>${escapeHTML(journal.companyName || 'Company name')}</h2><p class="saved-journal-pair"><span>${escapeHTML(journal.debitAccount || 'Debit')}</span><span aria-hidden="true">→</span><span>${escapeHTML(journal.creditAccount || 'Credit')}</span></p>${journal.note ? `<p class="saved-journal-note">${escapeHTML(journal.note)}</p>` : ''}<div class="saved-journal-actions"><a class="btn btn-solid" href="transactions.html?journal=${encodeURIComponent(journal.id)}">Open journal <span aria-hidden="true">→</span></a><button class="saved-journal-delete" type="button" data-delete-journal="${escapeHTML(journal.id)}" aria-label="Delete journal for ${escapeHTML(journal.companyName || 'company')}">Delete</button></div></article>`).join('');
}
journalList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-journal]');
  if (!button) return;
  const id = button.dataset.deleteJournal;
  try {
    const remaining = loadSavedJournals().filter((journal) => journal.id !== id);
    localStorage.setItem(journalArchiveKey, JSON.stringify(remaining));
    renderSavedJournals();
  } catch { journalLibraryStatus.textContent = 'Could not update saved journals on this device.'; }
});
window.addEventListener('storage', (event) => { if (event.key === journalArchiveKey) renderSavedJournals(); });
renderSavedJournals();
