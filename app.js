'use strict';

const API = 'https://ezanvakti.imsakiyem.com/api';
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

async function request(path) {
  const response = await fetch(`${API}${path}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Serverantwort ${response.status}`);
  const payload = await response.json();
  if (!payload.success) throw new Error(payload.message || 'Die Anfrage konnte nicht verarbeitet werden.');
  return payload.data || [];
}

function normalize(value) {
  return value.trim().toLocaleUpperCase('de-DE');
}

async function searchLocations(query) {
  const data = await request(`/locations/search/districts?q=${encodeURIComponent(query)}`);
  const exact = data.find(item => normalize(item.name) === normalize(query));
  if (exact) return { choice: exact, all: data };
  if (data.length === 1) return { choice: data[0], all: data };
  return { choice: null, all: data.slice(0, 8) };
}

function showMatches(locations) {
  matchesEl.replaceChildren();
  if (!locations.length) {
    matchesEl.hidden = true;
    return;
  }
  locations.forEach(place => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'match-button';
    const state = place.state?.name_en || place.state?.name || '';
    const country = place.country?.name_en || place.country?.name || '';
    button.innerHTML = `<strong>${escapeHtml(place.name_en || place.name)}</strong><span>${escapeHtml([state, country].filter(Boolean).join(', '))}</span>`;
    button.addEventListener('click', () => {
      selectedLocation = place;
      locationInput.value = place.name_en || place.name;
      matchesEl.hidden = true;
      loadPrayerTime(place);
    });
    matchesEl.append(button);
  });
  matchesEl.hidden = false;
}

function escapeHtml(text) {
  const element = document.createElement('span');
  element.textContent = String(text || '');
  return element.innerHTML;
}

async function loadPrayerTime(place) {
  setLoading(true);
  setStatus('Gebetszeiten werden abgerufen …');
  try {
    const date = dateInput.value;
    const rows = await request(`/prayer-times/${encodeURIComponent(place._id)}/range?startDate=${date}&endDate=${date}`);
    if (!rows.length) throw new Error('Für diesen Ort und dieses Datum liegen keine Daten vor. Probiere ein Datum im verfügbaren Datenbestand.');
    renderResult(rows[0], place);
    setStatus('');
  } catch (error) {
    setStatus(error.message || 'Die Gebetszeiten konnten nicht geladen werden.', true);
  } finally {
    setLoading(false);
  }
}

function renderResult(row, place) {
  document.querySelector('#result-location').textContent = locationLabel(row, place);
  document.querySelector('#result-date').textContent = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(`${dateInput.value}T12:00:00`));
  const grid = document.querySelector('#prayer-grid');
  grid.replaceChildren();
  prayers.forEach(([key, label], index) => {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector('.prayer-index').textContent = String(index + 1).padStart(2, '0');
    card.querySelector('h3').textContent = label;
    card.querySelector('time').textContent = row.times[key];
    card.querySelector('time').dateTime = `${dateInput.value}T${row.times[key]}:00`;
    card.dataset.key = key;
    grid.append(card);
  });
  document.querySelector('#source-note').textContent = `Quelle laut Datensatz: ${row.meta?.source || 'Diyanet İşleri Başkanlığı'} · ${row.hijri_date?.full_date || ''}`;
  resultEl.hidden = false;
  emptyEl.hidden = true;
  updateNextPrayer(row.times);
  clearInterval(clockTimer);
  if (dateInput.value === localDateString()) clockTimer = setInterval(() => updateNextPrayer(row.times), 30000);
  resultEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function locationLabel(row, fallback) {
  const district = row.district_id || fallback;
  const city = district.name_en || district.name || locationInput.value;
  const state = district.state_id?.name_en || district.state_id?.name || '';
  const country = district.country_id?.name_en || district.country_id?.name || '';
  return [city, state, country].filter(Boolean).join(' · ');
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
  setStatus('Ort wird gesucht …');
  matchesEl.hidden = true;
  try {
    if (selectedLocation && normalize(selectedLocation.name) === normalize(query)) {
      await loadPrayerTime(selectedLocation);
      return;
    }
    const result = await searchLocations(query);
    if (result.choice) {
      selectedLocation = result.choice;
      locationInput.value = result.choice.name_en || result.choice.name;
      await loadPrayerTime(result.choice);
    } else if (result.all.length) {
      showMatches(result.all);
      setStatus('Mehrere Orte gefunden. Bitte den passenden Ort auswählen.');
    } else {
      setStatus('Kein passender Ort gefunden. Versuche die internationale Schreibweise oder eine größere Stadt in der Nähe.', true);
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
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=10&accept-language=en`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Ortsname konnte nicht bestimmt werden.');
      const data = await response.json();
      const city = data.address.city || data.address.town || data.address.municipality || data.address.county;
      if (!city) throw new Error('Kein passender Ortsname gefunden.');
      locationInput.value = city;
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
