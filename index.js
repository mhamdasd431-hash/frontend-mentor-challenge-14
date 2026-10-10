document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    searchForm: document.querySelector('.search-form'),
    searchInput: document.querySelector('#search-input'),
    searchWrapper: document.querySelector('.search-wrapper'),
    currentLocation: document.querySelector('#current-location'),
    currentDate: document.querySelector('.current-date'),
    tempValue: document.querySelector('.temp-value'),
    weatherIcon: document.querySelector('.temperature-display img'),
    metricCards: document.querySelectorAll('.metric-card'),
    dailyContainer: document.querySelector('.daily-cards-container'),
    hourlyList: document.querySelector('.hourly-list'),
    dashboard: document.querySelector('.weather-dashboard'),
    unitsBtn: document.querySelector('.units-btn'),
    daySelectBtn: document.querySelector('.day-select-btn'),
    daySelectLabel: document.querySelector('.day-select-btn span')
  };

  let appState = {
    currentData: null,
    cityName: '',
    countryName: '',
    unitSystem: 'metric',
    selectedDayIndex: 0
  };

  const suggestionsBox = document.createElement('div');
  suggestionsBox.className = 'search-suggestions';
  if (elements.searchWrapper) {
    elements.searchWrapper.appendChild(suggestionsBox);
  }

  const getWeatherIcon = (code) => {
    if (code === 0) return './assets/images/icon-sunny.webp';
    if ([1, 2, 3].includes(code)) return './assets/images/icon-partly-cloudy.webp';
    if ([45, 48].includes(code)) return './assets/images/icon-fog.webp';
    if ([51, 53, 55, 61, 63, 65].includes(code)) return './assets/images/icon-rain.webp';
    if ([71, 73, 75, 77].includes(code)) return './assets/images/icon-snow.webp';
    if ([95, 96, 99].includes(code)) return './assets/images/icon-storm.webp';
    return './assets/images/icon-overcast.webp';
  };

  const updateMetrics = (current, isImperial) => {
    elements.metricCards.forEach(card => {
      const titleEl = card.querySelector('h3');
      const valueEl = card.querySelector('.metric-value');
      if (!titleEl || !valueEl) return;
      const title = titleEl.textContent.trim();

      if (title === 'Feels Like') {
        let val = current.apparent_temperature;
        if (isImperial) val = (val * 9/5) + 32;
        valueEl.textContent = `${Math.round(val)}°`;
      } else if (title === 'Humidity') {
        valueEl.textContent = `${current.relative_humidity_2m}%`;
      } else if (title === 'Wind') {
        let val = current.wind_speed_10m;
        if (isImperial) val = val * 0.621371;
        valueEl.textContent = `${val.toFixed(1)} ${isImperial ? 'mph' : 'km/h'}`;
      } else if (title === 'Precipitation') {
        valueEl.textContent = `${current.precipitation} mm`;
      }
    });
  };

  const updateUI = () => {
    if (!appState.currentData) return;
    const data = appState.currentData;
    const isImperial = appState.unitSystem === 'imperial';

    if (elements.currentLocation) {
      elements.currentLocation.textContent = `${appState.cityName}, ${appState.countryName}`;
    }
    if (elements.currentDate) {
      const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
      elements.currentDate.textContent = new Date().toLocaleDateString('en-US', options);
    }

    const current = data.current;
    let temp = current.temperature_2m;
    if (isImperial) temp = (temp * 9/5) + 32;

    if (elements.tempValue) elements.tempValue.textContent = `${Math.round(temp)}°`;
    if (elements.weatherIcon) elements.weatherIcon.src = getWeatherIcon(current.weather_code);

    updateMetrics(current, isImperial);

    if (elements.dailyContainer && data.daily) {
      elements.dailyContainer.innerHTML = '';
      const daily = data.daily;

      for (let i = 0; i < daily.time.length; i++) {
        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        
        let maxT = daily.temperature_2m_max[i];
        let minT = daily.temperature_2m_min[i];
        if (isImperial) {
          maxT = (maxT * 9/5) + 32;
          minT = (minT * 9/5) + 32;
        }

        const iconSrc = getWeatherIcon(daily.weather_code[i]);
        const dayCard = document.createElement('article');
        dayCard.className = `day-card ${i === appState.selectedDayIndex ? 'active' : ''}`;
        dayCard.style.cursor = 'pointer';
        dayCard.innerHTML = `
          <h3>${dayName}</h3>
          <img src="${iconSrc}" alt="" width="36" height="36">
          <div class="day-temps">
            <span class="max-temp">${Math.round(maxT)}°</span>
            <span class="min-temp">${Math.round(minT)}°</span>
          </div>
        `;

        dayCard.onclick = () => {
          appState.selectedDayIndex = i;
          updateUI();
        };

        elements.dailyContainer.appendChild(dayCard);
      }
    }

    updateHourlyForecast();
  };

  const updateHourlyForecast = () => {
    if (!elements.hourlyList || !appState.currentData?.hourly) return;
    elements.hourlyList.innerHTML = '';

    const hourly = appState.currentData.hourly;
    const isImperial = appState.unitSystem === 'imperial';
    const startIndex = appState.selectedDayIndex * 24;
    const endIndex = startIndex + 24;

    if (appState.currentData.daily?.time[appState.selectedDayIndex]) {
      const dayDate = new Date(appState.currentData.daily.time[appState.selectedDayIndex]);
      const fullDayName = dayDate.toLocaleDateString('en-US', { weekday: 'long' });
      if (elements.daySelectLabel) elements.daySelectLabel.textContent = fullDayName;
    }

    for (let i = startIndex; i < endIndex; i += 3) {
      if (!hourly.time[i]) break;
      const dateObj = new Date(hourly.time[i]);
      const timeString = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });

      let temp = hourly.temperature_2m[i];
      if (isImperial) temp = (temp * 9/5) + 32;

      const iconSrc = getWeatherIcon(hourly.weather_code[i]);
      const li = document.createElement('li');
      li.innerHTML = `
        <span class="hour-time"><img src="${iconSrc}" width="24" height="24" alt=""> ${timeString}</span>
        <span class="hour-temp">${Math.round(temp)}°</span>
      `;
      elements.hourlyList.appendChild(li);
    }
  };

  const fetchWeatherData = async (lat, lon, cityName, countryName, saveLast = true) => {
    const cacheKey = `weather_${cityName.toLowerCase().trim()}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        appState.currentData = parsed.data;
        appState.cityName = parsed.cityName;
        appState.countryName = parsed.countryName;
        appState.selectedDayIndex = 0;
        
        if (saveLast) {
          localStorage.setItem('last_weather_city', JSON.stringify({ lat, lon, cityName, countryName }));
        }
        
        updateUI();
        return;
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }
    }

    try {
      elements.dashboard?.classList.add('loading-state');

      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,weather_code&timezone=auto`
      );
      const weatherData = await res.json();

      appState.currentData = weatherData;
      appState.cityName = cityName;
      appState.countryName = countryName || '';
      appState.selectedDayIndex = 0;

      localStorage.setItem(cacheKey, JSON.stringify({
        cityName,
        countryName,
        data: weatherData
      }));

      if (saveLast) {
        localStorage.setItem('last_weather_city', JSON.stringify({ lat, lon, cityName, countryName }));
      }

      updateUI();
    } catch (error) {
      console.error('Fetch error:', error);
      alert('Failed to fetch weather data.');
    } finally {
      elements.dashboard?.classList.remove('loading-state');
    }
  };

  let debounceTimer;
  const fetchSuggestions = async (query) => {
    if (!query || query.length < 2) {
      suggestionsBox.classList.remove('show');
      return;
    }

    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5`);
      const data = await res.json();

      if (!data.results || data.results.length === 0) {
        suggestionsBox.classList.remove('show');
        return;
      }

      suggestionsBox.innerHTML = '';
      data.results.forEach(loc => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.textContent = `${loc.name}, ${loc.country || ''} ${loc.admin1 ? '(' + loc.admin1 + ')' : ''}`;
        
        item.onclick = () => {
          elements.searchInput.value = loc.name;
          suggestionsBox.classList.remove('show');
          fetchWeatherData(loc.latitude, loc.longitude, loc.name, loc.country);
        };

        suggestionsBox.appendChild(item);
      });

      suggestionsBox.classList.add('show');
    } catch (error) {
      console.error('Autocomplete error:', error);
    }
  };

  elements.searchInput?.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchSuggestions(query), 300);
  });

  if (elements.unitsBtn) {
    let unitsMenu = document.querySelector('.units-menu');
    if (!unitsMenu) {
      unitsMenu = document.createElement('div');
      unitsMenu.className = 'units-menu';
      unitsMenu.innerHTML = `
        <div data-unit="metric">Metric (°C, km/h)</div>
        <div data-unit="imperial">Imperial (°F, mph)</div>
      `;
      elements.unitsBtn.parentElement.style.position = 'relative';
      elements.unitsBtn.parentElement.appendChild(unitsMenu);
    }

    elements.unitsBtn.onclick = (e) => {
      e.stopPropagation();
      unitsMenu.classList.toggle('show');
    };

    unitsMenu.querySelectorAll('div').forEach(item => {
      item.onclick = () => {
        appState.unitSystem = item.getAttribute('data-unit');
        unitsMenu.classList.remove('show');
        updateUI();
      };
    });
  }

  if (elements.daySelectBtn) {
    let dayMenu = document.querySelector('.day-select-menu');
    if (!dayMenu) {
      dayMenu = document.createElement('div');
      dayMenu.className = 'day-select-menu';
      elements.daySelectBtn.parentElement.style.position = 'relative';
      elements.daySelectBtn.parentElement.appendChild(dayMenu);
    }

    elements.daySelectBtn.onclick = (e) => {
      e.stopPropagation();
      if (!appState.currentData?.daily) return;
      
      dayMenu.innerHTML = '';
      appState.currentData.daily.time.forEach((timeStr, idx) => {
        const date = new Date(timeStr);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const opt = document.createElement('div');
        opt.textContent = dayName;
        opt.onclick = () => {
          appState.selectedDayIndex = idx;
          dayMenu.classList.remove('show');
          updateUI();
        };
        dayMenu.appendChild(opt);
      });

      dayMenu.classList.toggle('show');
    };
  }

  document.addEventListener('click', (e) => {
    const uMenu = document.querySelector('.units-menu');
    const dMenu = document.querySelector('.day-select-menu');
    if (uMenu) uMenu.classList.remove('show');
    if (dMenu) dMenu.classList.remove('show');
    if (!elements.searchWrapper?.contains(e.target)) suggestionsBox.classList.remove('show');
  });

  if (elements.searchForm) {
    elements.searchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      suggestionsBox.classList.remove('show');
      const query = elements.searchInput?.value.trim();
      if (!query) return;

      try {
        elements.dashboard?.classList.add('loading-state');
        const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`);
        const data = await res.json();

        if (!data.results || data.results.length === 0) {
          alert('City not found!');
          return;
        }

        const { latitude, longitude, name, country } = data.results[0];
        fetchWeatherData(latitude, longitude, name, country);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        elements.dashboard?.classList.remove('loading-state');
      }
    });
  }
  const savedLastCity = localStorage.getItem('last_weather_city');
  if (savedLastCity) {
    try {
      const cityInfo = JSON.parse(savedLastCity);
      fetchWeatherData(cityInfo.lat, cityInfo.lon, cityInfo.cityName, cityInfo.countryName, false);
    } catch (e) {
      fetchWeatherData(52.52, 13.405, 'Berlin', 'Germany');
    }
  } else {
    fetchWeatherData(52.52, 13.405, 'Berlin', 'Germany');
  }
});