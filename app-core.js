const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const currency = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 });
const formatCurrency = (amount) => currency.format(amount);
const storageKey = 'accounting-cycle-transactions';
const setupStorageKey = 'accounting-cycle-workspace';
const draftStorageKey = 'accounting-cycle-transaction-draft';
const localISODate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = localISODate();
let workspaceSetup = null;
try { workspaceSetup = JSON.parse(localStorage.getItem(setupStorageKey) || 'null'); } catch { workspaceSetup = null; }
let entries = [];
try { entries = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (!Array.isArray(entries)) entries = []; } catch { entries = []; }

const topbar = document.querySelector('.topbar');
const updateTopbar = () => topbar?.classList.toggle('scrolled', window.scrollY > 12);
updateTopbar();
window.addEventListener('scroll', updateTopbar, { passive: true });

const revealTargets = document.querySelectorAll(
  '.dashboard-grid > section, .dashboard-shell > section, .workspace-heading, .workspace-grid > section, .workspace-main > section, .workspace-main > .back-link'
);
if (prefersReducedMotion || !('IntersectionObserver' in window)) {
  revealTargets.forEach((element) => element.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -36px 0px' });
  revealTargets.forEach((element, index) => {
    element.classList.add('scroll-reveal');
    element.style.setProperty('--reveal-delay', `${Math.min(index % 3, 2) * 70}ms`);
    revealObserver.observe(element);
  });
}

function formatDate(value) {
  if (!value) return '\u2014';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? '\u2014' : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date);
}
function getEntryDate(entry) { return entry.entryDate || (entry.date ? entry.date.slice(0, 10) : today); }
function escapeHTML(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }
