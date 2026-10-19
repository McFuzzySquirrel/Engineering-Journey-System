import { renderMarkdown } from './markdown.js';
import './styles.css';

interface Project {
  id: string;
  name: string;
  type: string;
  origin?: string;
}

interface RecordItem {
  projectId: string;
  id: string;
  type: 'adr' | 'sdr';
  title: string;
  status: string;
  appliesTo: string[];
  tags: string[];
  rules: { id: string; modality: string; text: string }[];
  verify: { check: string; expected: string }[];
  body: string;
  path: string;
  contentHash: string;
  date?: string;
  updatedAt: string;
  snippet?: string;
}

interface Facets {
  types: RecordItem['type'][];
  statuses: string[];
  tags: string[];
}

interface RecordDetail {
  record: RecordItem;
  relationships: {
    kind: string;
    direction: 'incoming' | 'outgoing';
    record: RecordItem;
  }[];
}

type FacetName = 'project' | 'type' | 'status' | 'tag';

const searchForm = element<HTMLFormElement>('#search-form');
const searchInput = element<HTMLInputElement>('#search-input');
const clearSearchButton = element<HTMLButtonElement>('#clear-search');
const resetFiltersButton = element<HTMLButtonElement>('#reset-filters');
const filterDisclosure = element<HTMLDetailsElement>('#filter-disclosure');
const filterGroups = element<HTMLDivElement>('#filter-groups');
const resultCount = element<HTMLParagraphElement>('#result-count');
const searchError = element<HTMLParagraphElement>('#search-error');
const resultsLoading = element<HTMLParagraphElement>('#results-loading');
const resultsList = element<HTMLOListElement>('#results-list');
const noResults = element<HTMLParagraphElement>('#no-results');
const selectionStatus = element<HTMLParagraphElement>('#selection-status');
const inspector = element<HTMLElement>('#inspector');
const inspectorHeading = element<HTMLHeadingElement>('#inspector-heading');
const detailPlaceholder = element<HTMLParagraphElement>('#detail-placeholder');
const detailLoading = element<HTMLParagraphElement>('#detail-loading');
const detailError = element<HTMLParagraphElement>('#detail-error');
const detailContent = element<HTMLElement>('#detail-content');
const recordBadges = element<HTMLDivElement>('#record-badges');
const recordProvenance = element<HTMLDListElement>('#record-provenance');
const recordBody = element<HTMLDivElement>('#record-body');
const relationshipsSection = element<HTMLElement>('#relationships');
const relationshipList = element<HTMLUListElement>('#relationship-list');

const state = {
  projects: [] as Project[],
  facets: { types: [], statuses: [], tags: [] } as Facets,
  selectedProjects: new Set<string>(),
  selectedTypes: new Set<RecordItem['type']>(),
  selectedStatuses: new Set<string>(),
  selectedTags: new Set<string>(),
  selectedRecord: '',
  results: [] as RecordItem[],
  query: '',
};

let searchController: AbortController | undefined;
let facetController: AbortController | undefined;
let detailController: AbortController | undefined;
let searchRequest = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

if (window.matchMedia('(max-width: 720px)').matches) {
  filterDisclosure.open = false;
}

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  state.query = searchInput.value.trim();
  void searchRecords();
});

searchInput.addEventListener('input', () => {
  state.query = searchInput.value.trim();
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void searchRecords(), 180);
});

clearSearchButton.addEventListener('click', () => {
  searchInput.value = '';
  state.query = '';
  searchInput.focus();
  void searchRecords();
});

resetFiltersButton.addEventListener('click', () => {
  state.selectedProjects.clear();
  state.selectedTypes.clear();
  state.selectedStatuses.clear();
  state.selectedTags.clear();
  void refreshFacetsAndSearch();
});

filterGroups.addEventListener('change', (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== 'checkbox') return;
  const selection = selectionFor(input.dataset.facet as FacetName | undefined);
  if (!selection) return;
  if (input.checked) selection.add(input.value);
  else selection.delete(input.value);

  if (input.dataset.facet === 'project') {
    void refreshFacetsAndSearch();
  } else {
    void searchRecords();
  }
});

async function initialize(): Promise<void> {
  try {
    state.projects = await fetchJson<Project[]>('/projects');
    renderFilters();
    await refreshFacets();
    await searchRecords();
  } catch (error) {
    showError(
      searchError,
      `Unable to load decision records: ${messageOf(error)}`,
    );
    resultCount.textContent = 'Records unavailable';
  }
}

async function refreshFacetsAndSearch(): Promise<void> {
  try {
    await refreshFacets();
    await searchRecords();
  } catch (error) {
    if (!isAbortError(error)) {
      showError(searchError, `Unable to update filters: ${messageOf(error)}`);
    }
  }
}

async function refreshFacets(): Promise<void> {
  facetController?.abort();
  facetController = new AbortController();
  const params = new URLSearchParams();
  for (const project of state.selectedProjects)
    params.append('project', project);
  const query = params.size > 0 ? `?${params}` : '';
  const facets = await fetchJson<Facets>(
    `/facets${query}`,
    facetController.signal,
  );
  state.facets = facets;
  state.selectedTypes = intersect(state.selectedTypes, new Set(facets.types));
  state.selectedStatuses = intersect(
    state.selectedStatuses,
    new Set(facets.statuses),
  );
  state.selectedTags = intersect(state.selectedTags, new Set(facets.tags));
  renderFilters();
}

async function searchRecords(): Promise<void> {
  const currentRequest = ++searchRequest;
  searchController?.abort();
  searchController = new AbortController();
  searchError.hidden = true;
  resultsLoading.hidden = false;
  noResults.hidden = true;
  resultCount.textContent = 'Searching...';
  const params = new URLSearchParams({ q: state.query });
  for (const project of state.selectedProjects)
    params.append('project', project);
  for (const type of state.selectedTypes) params.append('type', type);
  for (const status of state.selectedStatuses) params.append('status', status);
  for (const tag of state.selectedTags) params.append('tag', tag);

  try {
    const results = await fetchJson<RecordItem[]>(
      `/search?${params}`,
      searchController.signal,
    );
    if (currentRequest !== searchRequest) return;
    state.results = results;
    renderResults();
  } catch (error) {
    if (isAbortError(error)) return;
    if (currentRequest === searchRequest) {
      showError(searchError, `Search failed: ${messageOf(error)}`);
      resultCount.textContent = 'Search failed';
      resultsList.replaceChildren();
    }
  } finally {
    if (currentRequest === searchRequest) resultsLoading.hidden = true;
  }
}

function renderFilters(): void {
  filterGroups.replaceChildren(
    createFacetGroup(
      'Projects',
      'project',
      state.projects.map((project) => ({
        value: project.id,
        label: project.name,
        description: project.type,
      })),
      state.selectedProjects,
    ),
    createFacetGroup(
      'Record type',
      'type',
      state.facets.types.map((type) => ({
        value: type,
        label: type.toUpperCase(),
      })),
      state.selectedTypes,
    ),
    createFacetGroup(
      'Status',
      'status',
      state.facets.statuses.map((status) => ({
        value: status,
        label: status,
      })),
      state.selectedStatuses,
    ),
    createFacetGroup(
      'Tags',
      'tag',
      state.facets.tags.map((tag) => ({ value: tag, label: tag })),
      state.selectedTags,
      false,
    ),
  );
}

function createFacetGroup(
  title: string,
  facet: FacetName,
  options: { value: string; label: string; description?: string }[],
  selected: Set<string>,
  open = true,
): HTMLDetailsElement {
  const details = document.createElement('details');
  details.className = 'facet-group';
  details.open = open;
  const summary = document.createElement('summary');
  summary.textContent = `${title} (${selected.size || options.length})`;
  const list = document.createElement('div');
  list.className = 'facet-options';
  if (options.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'facet-empty';
    empty.textContent = 'No options available';
    list.append(empty);
  }
  for (const option of options) {
    const label = document.createElement('label');
    label.className = 'facet-option';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = option.value;
    input.checked = selected.has(option.value);
    input.dataset.facet = facet;
    const text = document.createElement('span');
    text.className = 'facet-label';
    text.textContent = option.label;
    label.append(input, text);
    if (option.description) {
      const description = document.createElement('span');
      description.className = 'facet-description';
      description.textContent = option.description;
      label.append(description);
    }
    list.append(label);
  }
  details.append(summary, list);
  return details;
}

function renderResults(): void {
  resultsList.replaceChildren();
  const projectById = new Map(
    state.projects.map((project) => [project.id, project]),
  );
  const items = state.results.map((record) => {
    const item = document.createElement('li');
    item.className = 'result-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'result-card';
    button.setAttribute(
      'aria-pressed',
      recordKey(record) === state.selectedRecord ? 'true' : 'false',
    );
    button.addEventListener('click', () => void openRecord(record));

    const title = document.createElement('span');
    title.className = 'result-title';
    title.textContent = record.title;
    const metadata = document.createElement('span');
    metadata.className = 'result-metadata';
    const project = projectById.get(record.projectId);
    metadata.textContent = `${record.type.toUpperCase()} · ${record.status} · ${project?.name ?? record.projectId}`;
    button.append(title, metadata);

    if (record.snippet) {
      const snippet = document.createElement('span');
      snippet.className = 'result-snippet';
      snippet.textContent = record.snippet
        .replaceAll('>>>', '')
        .replaceAll('<<<', '');
      button.append(snippet);
    }
    item.append(button);
    return item;
  });
  resultsList.append(...items);
  const count = state.results.length;
  resultCount.textContent = `${count} ${count === 1 ? 'record' : 'records'}`;
  noResults.hidden = count > 0;
}

async function openRecord(record: RecordItem): Promise<void> {
  const key = recordKey(record);
  state.selectedRecord = key;
  renderResults();
  detailController?.abort();
  detailController = new AbortController();
  detailPlaceholder.hidden = true;
  detailContent.hidden = true;
  detailError.hidden = true;
  detailLoading.hidden = false;
  selectionStatus.textContent = `Loading ${record.title}`;
  try {
    const detail = await fetchJson<RecordDetail>(
      `/records/${encodeURIComponent(record.projectId)}/${encodeURIComponent(record.id)}`,
      detailController.signal,
    );
    if (state.selectedRecord !== key) return;
    renderDetail(detail);
    selectionStatus.textContent = `Showing ${detail.record.title}`;
    if (window.matchMedia('(max-width: 720px)').matches) {
      inspector.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  } catch (error) {
    if (isAbortError(error)) return;
    if (state.selectedRecord === key) {
      detailLoading.hidden = true;
      showError(detailError, `Unable to load record: ${messageOf(error)}`);
    }
  }
}

function renderDetail(detail: RecordDetail): void {
  const record = detail.record;
  inspectorHeading.textContent = record.title;
  recordBadges.replaceChildren();
  recordBadges.append(
    badge(record.type.toUpperCase(), 'badge-type'),
    badge(record.status, 'badge-status'),
  );
  for (const tag of record.tags) recordBadges.append(badge(tag, 'badge-tag'));

  recordProvenance.replaceChildren();
  appendProvenance('Project', projectName(record.projectId));
  appendProvenance('Record ID', record.id);
  appendProvenance('Source', record.path);
  const updated = document.createElement('time');
  updated.dateTime = record.updatedAt;
  updated.textContent = formatDate(record.updatedAt);
  appendProvenance('Updated', updated);

  recordBody.replaceChildren(renderMarkdown(record.body));

  relationshipList.replaceChildren();
  for (const relationship of detail.relationships) {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'relationship-link';
    button.textContent = `${relationship.kind.replaceAll('_', ' ')} · ${relationship.direction} · ${relationship.record.id}: ${relationship.record.title}`;
    button.addEventListener(
      'click',
      () => void openRecord(relationship.record),
    );
    item.append(button);
    relationshipList.append(item);
  }
  relationshipsSection.hidden = detail.relationships.length === 0;
  detailPlaceholder.hidden = true;
  detailLoading.hidden = true;
  detailError.hidden = true;
  detailContent.hidden = false;
}

function appendProvenance(label: string, value: string | HTMLElement): void {
  const term = document.createElement('dt');
  term.textContent = label;
  const description = document.createElement('dd');
  if (typeof value === 'string') description.textContent = value;
  else description.append(value);
  recordProvenance.append(term, description);
}

function badge(text: string, className: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.className = `badge ${className}`;
  span.textContent = text;
  return span;
}

function selectionFor(facet: FacetName | undefined): Set<string> | undefined {
  switch (facet) {
    case 'project':
      return state.selectedProjects;
    case 'type':
      return state.selectedTypes;
    case 'status':
      return state.selectedStatuses;
    case 'tag':
      return state.selectedTags;
  }
}

function intersect<T>(selected: Set<T>, allowed: Set<T>): Set<T> {
  return new Set([...selected].filter((item) => allowed.has(item)));
}

function recordKey(record: Pick<RecordItem, 'projectId' | 'id'>): string {
  return `${record.projectId}\u0000${record.id}`;
}

function projectName(projectId: string): string {
  return (
    state.projects.find((project) => project.id === projectId)?.name ??
    projectId
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    headers: { accept: 'application/json' },
    signal,
  });
  const payload: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      'error' in payload &&
      typeof payload.error === 'string'
        ? payload.error
        : response.statusText;
    throw new Error(`${response.status}: ${message}`);
  }
  return payload as T;
}

function showError(element: HTMLElement, message: string): void {
  element.textContent = message;
  element.hidden = false;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function element<T extends HTMLElement>(selector: string): T {
  const found = document.querySelector<T>(selector);
  if (!found) throw new Error(`Required UI element is missing: ${selector}`);
  return found;
}

void initialize();
