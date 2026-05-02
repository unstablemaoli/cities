"use strict";

/*
  Laboratory work №5
  Topic: using external data sources and integrating with an external API.

  API: GeoDB Cities
  Endpoint: GET https://wft-geo-db.p.rapidapi.com/v1/geo/cities

  This file is independent from script.js. It controls only cities.html:
  - reads form data;
  - creates URL parameters;
  - sends fetch() request;
  - handles loading, success, empty result and error states;
  - renders city cards;
  - supports demo data, theme switch and back-to-top button.
*/

const GEO_DB_ENDPOINT = "https://wft-geo-db.p.rapidapi.com/v1/geo/cities";
const GEO_DB_HOST = "wft-geo-db.p.rapidapi.com";
const CITY_PAGE_STATE_KEY = "tamara-cities-page-state";

const demoCities = [
  {
    name: "Kyiv",
    country: "Ukraine",
    countryCode: "UA",
    region: "Kyiv City",
    latitude: 50.45,
    longitude: 30.52,
    population: 2950800,
    timezone: "Europe/Kyiv",
    type: "CITY"
  },
  {
    name: "Lviv",
    country: "Ukraine",
    countryCode: "UA",
    region: "Lviv Oblast",
    latitude: 49.84,
    longitude: 24.03,
    population: 717510,
    timezone: "Europe/Kyiv",
    type: "CITY"
  },
  {
    name: "Kharkiv",
    country: "Ukraine",
    countryCode: "UA",
    region: "Kharkiv Oblast",
    latitude: 49.99,
    longitude: 36.23,
    population: 1430885,
    timezone: "Europe/Kyiv",
    type: "CITY"
  }
];

const cityPageState = loadCityPageState();

document.addEventListener("DOMContentLoaded", () => {
  initStatusText();
  initThemeToggle();
  initBackToTop();
  initRevealBlocks();
  initCityApiForm();
});

function loadCityPageState() {
  const defaults = {
    theme: "light",
    countryIds: "UA",
    namePrefix: "Ky",
    minPopulation: "100000",
    limit: "5"
  };

  try {
    const saved = JSON.parse(localStorage.getItem(CITY_PAGE_STATE_KEY));
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

function saveCityPageState() {
  const safeState = { ...cityPageState };
  localStorage.setItem(CITY_PAGE_STATE_KEY, JSON.stringify(safeState));
}

function initStatusText() {
  const status = document.getElementById("visitStatus");
  if (!status) return;

  const formattedDate = new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());

  status.textContent = `JavaScript is active. Page opened: ${formattedDate}.`;
}

function initThemeToggle() {
  const button = document.getElementById("themeToggle");
  applyTheme(cityPageState.theme);

  if (!button) return;

  button.addEventListener("click", () => {
    cityPageState.theme = document.body.classList.contains("dark-theme") ? "light" : "dark";
    applyTheme(cityPageState.theme);
    saveCityPageState();
    showToast(cityPageState.theme === "dark" ? "Dark theme enabled" : "Light theme enabled");
  });
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.body.classList.toggle("dark-theme", isDark);

  const button = document.getElementById("themeToggle");
  if (button) {
    button.textContent = isDark ? "Light theme" : "Dark theme";
    button.setAttribute("aria-pressed", String(isDark));
  }
}

function initBackToTop() {
  const button = document.getElementById("backToTop");
  if (!button) return;

  const updateButton = () => {
    button.classList.toggle("visible", window.scrollY > 450);
  };

  window.addEventListener("scroll", updateButton, { passive: true });
  button.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
  updateButton();
}

function initRevealBlocks() {
  const blocks = document.querySelectorAll(".reveal-target");
  if (!blocks.length) return;

  if (!("IntersectionObserver" in window)) {
    blocks.forEach((block) => block.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.16 });

  blocks.forEach((block) => observer.observe(block));
}

function initCityApiForm() {
  const form = document.getElementById("citySearchForm");
  const demoButton = document.getElementById("demoDataButton");
  const clearButton = document.getElementById("clearApiButton");

  if (!form) return;

  restoreFormValues(form);

  form.addEventListener("input", () => saveFormValues(form));
  form.addEventListener("change", () => saveFormValues(form));

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    saveFormValues(form);
    await loadCities(form);
  });

  demoButton?.addEventListener("click", () => {
    setStatus("Demo data is shown. Use a RapidAPI key to receive live data from GeoDB Cities.", "success");
    renderCities(demoCities);
    showToast("Demo cities rendered");
  });

  clearButton?.addEventListener("click", () => {
    form.reset();
    form.elements.apiKey.value = "";
    form.elements.countryIds.value = "UA";
    form.elements.namePrefix.value = "Ky";
    form.elements.minPopulation.value = "100000";
    form.elements.limit.value = "5";

    saveFormValues(form);
    renderCities([]);
    setStatus("Results cleared. Enter search parameters and load cities again.", "default");
    showToast("Results cleared");
  });
}

function restoreFormValues(form) {
  form.elements.countryIds.value = cityPageState.countryIds || "UA";
  form.elements.namePrefix.value = cityPageState.namePrefix || "Ky";
  form.elements.minPopulation.value = cityPageState.minPopulation || "100000";
  form.elements.limit.value = cityPageState.limit || "5";
}

function saveFormValues(form) {
  cityPageState.countryIds = form.elements.countryIds.value;
  cityPageState.namePrefix = form.elements.namePrefix.value;
  cityPageState.minPopulation = form.elements.minPopulation.value;
  cityPageState.limit = form.elements.limit.value;
  saveCityPageState();
}

async function loadCities(form) {
  const apiKey = form.elements.apiKey.value.trim();

  if (!apiKey) {
    setStatus("Please enter your RapidAPI key first. Without it GeoDB Cities will return an authorization error.", "error");
    renderCities([]);
    return;
  }

  const url = buildCitiesUrl(form);
  setStatus("Loading data from GeoDB Cities API...", "loading");

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": GEO_DB_HOST
      }
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const cities = Array.isArray(json.data) ? json.data : [];

    if (!cities.length) {
      setStatus("The API returned no cities for these filters. Try another prefix, country or population value.", "warning");
      renderCities([]);
      return;
    }

    setStatus(`Loaded ${cities.length} cities from GeoDB Cities API.`, "success");
    renderCities(cities);
    showToast("Live API data loaded");
  } catch (error) {
    setStatus(`Error: ${error.message}. Check the API key, Internet connection or request limit.`, "error");
    renderCities([]);
  }
}

function buildCitiesUrl(form) {
  const params = new URLSearchParams();
  const countryIds = form.elements.countryIds.value.trim();
  const namePrefix = form.elements.namePrefix.value.trim();
  const minPopulation = form.elements.minPopulation.value.trim();
  const limit = form.elements.limit.value.trim() || "5";

  if (countryIds) params.set("countryIds", countryIds);
  if (namePrefix) params.set("namePrefix", namePrefix);
  if (minPopulation) params.set("minPopulation", minPopulation);
  params.set("limit", limit);
  params.set("sort", "-population");

  return `${GEO_DB_ENDPOINT}?${params.toString()}`;
}

function renderCities(cities) {
  const results = document.getElementById("cityResults");
  const counter = document.getElementById("cityCounter");

  if (!results || !counter) return;

  counter.textContent = `${cities.length} cities`;

  if (!cities.length) {
    results.innerHTML = `
      <article class="panel empty-card">
        <h3>No cities to display</h3>
        <p>Use the form above to request data from the external API.</p>
      </article>
    `;
    return;
  }

  results.innerHTML = cities.map((city) => `
    <article class="panel city-card">
      <div class="city-card-header">
        <span class="badge">${escapeHtml(city.countryCode || "N/A")}</span>
        <span class="city-type">${escapeHtml(city.type || "CITY")}</span>
      </div>
      <h3>${escapeHtml(city.name || "Unknown city")}</h3>
      <p>${escapeHtml(city.country || "Unknown country")}${city.region ? `, ${escapeHtml(city.region)}` : ""}</p>
      <dl class="city-stats">
        <div>
          <dt>Population</dt>
          <dd>${formatNumber(city.population)}</dd>
        </div>
        <div>
          <dt>Latitude</dt>
          <dd>${formatCoordinate(city.latitude)}</dd>
        </div>
        <div>
          <dt>Longitude</dt>
          <dd>${formatCoordinate(city.longitude)}</dd>
        </div>
        <div>
          <dt>Timezone</dt>
          <dd>${escapeHtml(city.timezone || "—")}</dd>
        </div>
      </dl>
    </article>
  `).join("");
}

function setStatus(message, type = "default") {
  const status = document.getElementById("apiStatus");
  if (!status) return;

  status.textContent = message;
  status.className = `status-card status-${type}`;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("visible");
  }, 2200);
}

function formatNumber(value) {
  if (typeof value !== "number") return "—";
  return new Intl.NumberFormat("uk-UA").format(value);
}

function formatCoordinate(value) {
  if (typeof value !== "number") return "—";
  return value.toFixed(4);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
