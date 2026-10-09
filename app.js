'use strict';

const DIYANET = 'https://namazvakitleri.diyanet.gov.tr';
const READER = 'https://r.jina.ai/';
const NOMINATIM = 'https://nominatim.openstreetmap.org';
const monthNumbers = { OCAK:'01', SUBAT:'02', MART:'03', NISAN:'04', MAYIS:'05', HAZIRAN:'06', TEMMUZ:'07', AGUSTOS:'08', EYLUL:'09', EKIM:'10', KASIM:'11', ARALIK:'12' };
const countryAliases = { TURKIYE:'TURKEY', 'UNITED STATES':'USA', 'UNITED STATES OF AMERICA':'USA', CZECHIA:'CZECH REPUBLIC', 'NORTH MACEDONIA':'MACEDONIA', RUSSIA:'RUSSIAN FEDERATION' };
const prayers = [
  ['imsak', 'Imsak'], ['gunes', 'Sonnenaufgang'], ['ogle', 'Mittag'],
  ['ikindi', 'Nachmittag'], ['aksam', 'Abend'], ['yatsi', 'Nacht']
];

const form = document.querySelector('#search-form');
const locationInput = document.querySelector('#location');
const dateInput = document.querySelector('#date');
const statusEl = document.querySelector('#status');
const matchesEl = document.querySelector('#matches');
const resultEl = document.querySelector('#result');
const emptyEl = document.querySelector('#empty');
const submitButton = form.querySelector('button[type="submit"]');
const locateButton = document.querySelector('#locate-button');
const template = document.querySelector('#prayer-template');
let theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
let selectedLocation = null;
let clockTimer = null;
let countriesCache = null;

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

document.documentElement.dataset.theme = theme;
dateInput.value = localDateString();

const themeButton = document.querySelector('[data-theme-toggle]');
themeButton.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  const dark = theme === 'dark';
  themeButton.setAttribute('aria-label', dark ? 'Hellmodus einschalten' : 'Dunkelmodus einschalten');
  themeButton.innerHTML = dark
    ? '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>'
    : '<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>';
});

function setStatus(message = '', isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('error', isError);
}

function setLoading(loading) {
  submitButton.disabled = loading;
  submitButton.querySelector('span').textContent = loading ? 'Wird geladen …' : 'Gebetszeiten anzeigen';
}

async function fetchText(url) {
  const response = await fetch(`${READER}${url}`, { headers: { Accept: 'text/plain' } });
  if (!response.ok) throw new Error(`Abruf der Diyanet-Seite fehlgeschlagen (${response.status}).`);
  return response.text();
}

function extractJson(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start < 0 || end <= start) throw new Error('Die offizielle Diyanet-Ortsliste konnte nicht gelesen werden.');
  return JSON.parse(text.slice(start, end + 1));
}

function normalize(value) {
  return String(value || '').trim().toLocaleUpperCase('tr-TR')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/İ/g,'I').replace(/Ş/g,'S').replace(/Ğ/g,'G').replace(/Ü/g,'U').replace(/Ö/g,'O').replace(/Ç/g,'C')
    .replace(/[^A-Z0-9]+/g, ' ').trim();
}

async function getCountries() {
  if (!countriesCache) countriesCache = extractJson(await fetchText(`${DIYANET}/assets/locations/countries.json`));
  return countriesCache;
}

async function geocode(query) {
  const url = `${NOMINATIM}/search?format=jsonv2&addressdetails=1&limit=8&accept-language=en&q=${encodeURIComponent(query)}`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error('Der Ortsname konnte nicht geografisch zugeordnet werden.');
  return response.json();
}

function officialCountryName(country, officialCountries) {
  const wanted = countryAliases[normalize(country)] || normalize(country);
  return officialCountries.find(item => normalize(item.CountryName) === wanted)?.CountryName || null;
}

async function searchLocations(query) {
  const geoResults = await geocode(query);
  const officialCountries = await getCountries();
  const groups = new Map();
  geoResults.forEach(result => {
    const country = officialCountryName(result.address?.country, officialCountries);
    if (!country) return;
    const city = result.address?.city || result.address?.town || result.address?.village || result.address?.municipality || result.address?.county || query;
    if (!groups.has(country)) groups.set(country, new Set());
    groups.get(country).add(city);
  });
  const found = [];
  for (const [country, terms] of [...groups].slice(0, 3)) {
    const locations = extractJson(await fetchText(`${DIYANET}/assets/locations/${encodeURIComponent(country)}.json`));
    const needles = [...terms, query].map(normalize).filter(Boolean);
    locations.forEach(item => {
      const city = normalize(item.City);
      if (needles.some(term => city === term || city.includes(term) || term.includes(city)))
        found.push({ id:item.CityID, name:item.City, state:item.State, country:item.Country });
    });
  }
  const unique = [...new Map(found.map(item => [item.id, item])).values()];
  const exact = unique.find(item => normalize(item.name) === normalize(query));
  if (exact) return { choice: exact, all: unique };
  if (unique.length === 1) return { choice: unique[0], all: unique };
  return { choice: null, all: unique.slice(0, 10) };
}

function showMatches(locations) {
  matchesEl.replaceChildren();
  locations.forEach(place => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'match-button';
    button.innerHTML = `<strong>${escapeHtml(place.name)}</strong><span>${escapeHtml([place.state, place.country].filter(Boolean).join(', '))}</span>`;
    button.addEventListener('click', () => {
      selectedLocation = place;
      locationInput.value = place.name;
      matchesEl.hidden = true;
      loadPrayerTime(place);
    });
    matchesEl.append(button);
  });
  matchesEl.hidden = !locations.length;
}

function escapeHtml(text) {
  const element = document.createElement('span');
  element.textContent = String(text || '');
  return element.innerHTML;
}

function slugify(text) { return normalize(text).toLowerCase().replace(/\s+/g, '-'); }

function parseTurkishDate(value) {
  const parts = value.trim().split(/\s+/);
  const month = monthNumbers[normalize(parts[1])];
  return parts.length >= 3 && month ? `${parts[2]}-${month}-${parts[0].padStart(2,'0')}` : null;
}

function parseDiyanetPage(markdown, requestedDate) {
  for (const line of markdown.split('\n').filter(line => /^\|\s*\d{1,2}\s+\S+\s+\d{4}\s+/.test(line))) {
    const cells = line.split('|').slice(1,-1).map(cell => cell.trim());
    if (cells.length >= 8 && parseTurkishDate(cells[0]) === requestedDate)
      return { hijri:cells[1], times:{ imsak:cells[2], gunes:cells[3], ogle:cells[4], ikindi:cells[5], aksam:cells[6], yatsi:cells[7] } };
  }
  return null;
}

async function loadPrayerTime(place) {
  setLoading(true);
  setStatus('Die offizielle Diyanet-Seite wird geladen und geparst …');
  try {
    const officialUrl = `${DIYANET}/tr-TR/${encodeURIComponent(place.id)}/${slugify(place.name)}-icin-namaz-vakti`;
    const row = parseDiyanetPage(await fetchText(officialUrl), dateInput.value);
    if (!row) throw new Error('Dieses Datum ist auf der aktuellen Diyanet-Seite nicht enthalten. Wähle einen von Diyanet veröffentlichten Zeitraum.');
    renderResult(row, place, officialUrl);
    setStatus('');
  } catch (error) {
    setStatus(error.message || 'Die offizielle Diyanet-Seite konnte nicht ausgewertet werden.', true);
  } finally { setLoading(false); }
}

function renderResult(row, place, officialUrl) {
  document.querySelector('#result-location').textContent = [place.name, place.state, place.country].filter(Boolean).join(' · ');
  document.querySelector('#result-date').textContent = new Intl.DateTimeFormat('de-DE', { weekday:'long', day:'2-digit', month:'long', year:'numeric' }).format(new Date(`${dateInput.value}T12:00:00`));
  const grid = document.querySelector('#prayer-grid');
  grid.replaceChildren();
  prayers.forEach(([key,label], index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector('.prayer-index').textContent = String(index+1).padStart(2,'0');
    card.querySelector('h3').textContent = label;
    card.querySelector('time').textContent = row.times[key];
    card.querySelector('time').dateTime = `${dateInput.value}T${row.times[key]}:00`;
    card.dataset.key = key;
    grid.append(card);
  });
  const source = document.querySelector('#source-note');
  source.replaceChildren('Direkt aus der offiziellen Diyanet-Seite geparst · ', row.hijri, ' · ');
  const link = document.createElement('a');
  link.href = officialUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Original öffnen';
  source.append(link);
  resultEl.hidden = false; emptyEl.hidden = true;
  updateNextPrayer(row.times);
  clearInterval(clockTimer);
  if (dateInput.value === localDateString()) clockTimer = setInterval(() => updateNextPrayer(row.times),30000);
  resultEl.scrollIntoView({ behavior:'smooth', block:'start' });
}

function updateNextPrayer(times) {
  const box = document.querySelector('#next-prayer');
  document.querySelectorAll('.prayer-card').forEach(card => card.classList.remove('current'));
  if (dateInput.value !== localDateString()) {
    box.hidden = true;
    return;
  }
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const next = prayers.find(([key]) => {
    const [hours, minutes] = times[key].split(':').map(Number);
    return hours * 60 + minutes > currentMinutes;
  });
  if (!next) {
    box.hidden = false;
    document.querySelector('#next-prayer-name').textContent = 'Imsak morgen';
    document.querySelector('#next-prayer-time').textContent = times.imsak;
    return;
  }
  const [key, label] = next;
  box.hidden = false;
  document.querySelector('#next-prayer-name').textContent = label;
  document.querySelector('#next-prayer-time').textContent = times[key];
  document.querySelector(`.prayer-card[data-key="${key}"]`)?.classList.add('current');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const query = locationInput.value.trim();
  if (query.length < 2) return setStatus('Bitte mindestens zwei Zeichen für den Ort eingeben.', true);
  setLoading(true);
  setStatus('Ort wird mit der offiziellen Diyanet-Ortsliste abgeglichen …');
  matchesEl.hidden = true;
  try {
    if (selectedLocation && normalize(selectedLocation.name) === normalize(query)) {
      await loadPrayerTime(selectedLocation);
      return;
    }
    const result = await searchLocations(query);
    if (result.choice) {
      selectedLocation = result.choice;
      locationInput.value = result.choice.name;
      await loadPrayerTime(result.choice);
    } else if (result.all.length) {
      showMatches(result.all);
      setStatus('Mehrere Diyanet-Orte gefunden. Bitte den passenden Ort auswählen.');
    } else {
      setStatus('Der Ort wurde in der offiziellen Diyanet-Ortsliste nicht gefunden. Ergänze bei Bedarf Land oder Region.', true);
    }
  } catch (error) {
    setStatus(`Abruf fehlgeschlagen: ${error.message}`, true);
  } finally {
    setLoading(false);
  }
});

locationInput.addEventListener('input', () => { selectedLocation = null; });
dateInput.addEventListener('change', () => { if (selectedLocation) loadPrayerTime(selectedLocation); });

locateButton.addEventListener('click', () => {
  if (!navigator.geolocation) return setStatus('Dein Browser unterstützt keine Standortabfrage.', true);
  setStatus('Standort wird ermittelt …');
  locateButton.disabled = true;
  navigator.geolocation.getCurrentPosition(async position => {
    try {
      const { latitude, longitude } = position.coords;
      const response = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=en`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Ortsname konnte nicht bestimmt werden.');
      const data = await response.json();
      const city = data.address.city || data.address.town || data.address.municipality || data.address.county;
      if (!city) throw new Error('Kein passender Ortsname gefunden.');
      locationInput.value = `${city}, ${data.address.country || ''}`;
      selectedLocation = null;
      form.requestSubmit();
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      locateButton.disabled = false;
    }
  }, error => {
    const message = error.code === 1 ? 'Standortzugriff wurde nicht erlaubt.' : 'Der Standort konnte nicht ermittelt werden.';
    setStatus(message, true);
    locateButton.disabled = false;
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
});
