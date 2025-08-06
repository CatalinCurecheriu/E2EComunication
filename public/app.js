// Import Supabase client (ESM)
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ====== Supabase init ======
const SUPABASE_URL = window.__SUPABASE_URL__;
const SUPABASE_ANON_KEY = window.__SUPABASE_ANON_KEY__;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase credentials. Set window.__SUPABASE_URL__ and window.__SUPABASE_ANON_KEY__.');
}
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 5 } }
});

// ====== DOM elements ======
const htmlEl = document.documentElement;
const themeSelect = document.getElementById('theme-select');
const headerSection = document.getElementById('header-section');
const expandBtn = document.getElementById('expand-btn');
const collapseBtn = document.getElementById('collapse-btn');

const teamToggle = document.getElementById('team-toggle');
const toggleLabelLeft = document.getElementById('toggle-label-left');
const toggleLabelRight = document.getElementById('toggle-label-right');
const testCaseIdInput = document.getElementById('test-case-id');
const testCaseDescriptionInput = document.getElementById('test-case-description');
const saveButton = document.getElementById('save-button');
const listContainer = document.getElementById('test-case-list-container');

// Track rendered items to avoid duplicates on realtime
const rendered = new Set();

// ====== Theme handling ======
function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  if (t === 'dark') htmlEl.setAttribute('data-theme', 'dark'); else htmlEl.removeAttribute('data-theme');
  themeSelect.value = t; localStorage.setItem('theme', t);
}
applyTheme(localStorage.getItem('theme') || 'light');

themeSelect.addEventListener('change', (e) => applyTheme(e.target.value));

// ====== Collapse/Expand header ======
function collapseHeader() {
  headerSection.style.maxHeight = headerSection.scrollHeight + 'px';
  requestAnimationFrame(() => { headerSection.classList.add('hidden'); expandBtn.style.display = 'block'; });
}
function expandHeader() {
  headerSection.classList.remove('hidden');
  headerSection.style.maxHeight = headerSection.scrollHeight + 'px';
  setTimeout(() => { headerSection.style.maxHeight = ''; }, 400);
  expandBtn.style.display = 'none';
}
collapseBtn.addEventListener('click', collapseHeader);
expandBtn.addEventListener('click', expandHeader);

// ====== Helpers ======
function sanitize(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function applyItemStatusColor(itemEl, status) {
  itemEl.classList.remove('status-new', 'status-done', 'status-not-impacted');
  if (status === 'New') itemEl.classList.add('status-new');
  else if (status === 'Done') itemEl.classList.add('status-done');
  else if (status === 'Not impacted') itemEl.classList.add('status-not-impacted');
}
function styleStatusSelect(select, status) {
  select.classList.remove('status-new', 'status-in-progress', 'status-done', 'status-not-impacted');
  if (status === 'New') select.classList.add('status-new');
  else if (status === 'In progress') select.classList.add('status-in-progress');
  else if (status === 'Done') select.classList.add('status-done');
  else if (status === 'Not impacted') select.classList.add('status-not-impacted');
}

function teamClass(team) {
  return team === 'Quotation to Pricing' ? 'quotation-to-pricing' : 'pricing-to-quotation';
}

// ====== Render ======
function renderItem(row) {
  if (rendered.has(row.id)) return; // avoid duplicates
  rendered.add(row.id);

  const item = document.createElement('div');
  item.className = `test-case-item ${teamClass(row.team)}`;
  item.dataset.id = row.id;

  const ts = new Date(row.created_at).toLocaleString('en-GB', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  const header = document.createElement('div');
  header.className = 'test-case-header';

  const left = document.createElement('div');
  left.className = 'header-left';
  left.innerHTML = `<span>ID: ${row.test_case_id} – <span class="team">${row.team}</span></span><span class="timestamp">Added on ${ts}</span>`;

  const right = document.createElement('div');
  right.className = 'header-right';
  const statusLabel = document.createElement('label');
  statusLabel.textContent = 'Status:';
  const statusSelect = document.createElement('select');
  statusSelect.className = 'status-select';
  ;['New','In progress','Done','Not impacted','Delete'].forEach(val => {
    const o = document.createElement('option'); o.value = val; o.textContent = val; statusSelect.appendChild(o);
  });
  statusSelect.value = row.status;
  styleStatusSelect(statusSelect, statusSelect.value);

  statusSelect.addEventListener('change', async () => {
    const val = statusSelect.value;
    if (val === 'Delete') {
      // delete row in DB -> realtime will remove for all clients
      const { error } = await supabase.from('test_cases').delete().eq('id', row.id);
      if (error) console.error(error);
      return;
    }
    // update status in DB
    const { error } = await supabase.from('test_cases').update({ status: val }).eq('id', row.id);
    if (error) console.error(error);
  });

  right.appendChild(statusLabel);
  right.appendChild(statusSelect);

  header.appendChild(left);
  header.appendChild(right);

  const desc = document.createElement('div');
  desc.className = 'test-case-description';
  desc.innerHTML = sanitize(row.description);

  item.appendChild(header);
  item.appendChild(desc);

  applyItemStatusColor(item, row.status);

  listContainer.appendChild(item);
}

function updateItem(row) {
  const item = listContainer.querySelector(`[data-id="${row.id}"]`);
  if (!item) { renderItem(row); return; }
  // update status only (description edits are not in UI for now)
  const select = item.querySelector('select.status-select') || item.querySelector('select');
  if (select) { select.value = row.status; styleStatusSelect(select, row.status); }
  applyItemStatusColor(item, row.status);
}

function removeItem(id) {
  rendered.delete(id);
  const item = listContainer.querySelector(`[data-id="${id}"]`);
  if (!item) return;
  item.classList.add('removing');
  setTimeout(() => item.remove(), 200);
}

// ====== Load existing ======
async function loadInitial() {
  const { data, error } = await supabase.from('test_cases').select('*').order('created_at', { ascending: true });
  if (error) { console.error(error); return; }
  data.forEach(renderItem);
  // scroll to bottom
  listContainer.scrollTop = listContainer.scrollHeight;
}

// ====== Realtime sync ======
function subscribeRealtime() {
  supabase
    .channel('public:test_cases')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'test_cases' }, payload => {
      renderItem(payload.new);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'test_cases' }, payload => {
      updateItem(payload.new);
    })
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'test_cases' }, payload => {
      removeItem(payload.old.id);
    })
    .subscribe();
}

// ====== Form logic (create) ======
teamToggle.addEventListener('change', () => {
  toggleLabelLeft.classList.toggle('inactive');
  toggleLabelRight.classList.toggle('inactive');
});

saveButton.addEventListener('click', async () => {
  const idRaw = (testCaseIdInput.value || '').trim();
  const descriptionRaw = (testCaseDescriptionInput.value || '').trim();
  const isQ2P = teamToggle.checked;
  if (!idRaw || !descriptionRaw) { alert('Please fill in both the Test Case ID and the Description.'); return; }
  const idNum = parseInt(idRaw, 10);
  if (Number.isNaN(idNum)) { alert('Test Case ID must be a number.'); return; }

  const team = isQ2P ? 'Quotation to Pricing' : 'Pricing to Quotation';
  const { error } = await supabase.from('test_cases').insert({
    test_case_id: idNum,
    team,
    description: descriptionRaw,
    status: 'New'
  });
  if (error) { console.error(error); alert('Insert failed'); return; }

  // Reset form + close accordion
  testCaseIdInput.value = '';
  testCaseDescriptionInput.value = '';
  const details = document.querySelector('.collapsible-section');
  if (details && details.hasAttribute('open')) details.removeAttribute('open');
});

// ====== Bootstrap ======
loadInitial();
subscribeRealtime();