import { showChart, refreshChartTheme } from './chart.js';

let supabase;

async function initializeSupabase() {
  try {
    const response = await fetch('/api/config');
    if (!response.ok) throw new Error('Failed to fetch config');
    const config = await response.json();

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      throw new Error('Supabase URL or Key is missing from config');
    }

    supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    
    await checkUser(); 

  } catch (e) {
    console.error("Supabase client failed to initialize:", e.message);
    if (authStatusDiv) {
        authStatusDiv.innerHTML = `<span style="color: red;">Failed to load auth.</span>`;
    }
  }
}

const stateInput = document.getElementById('stateSearch');
const cityInput = document.getElementById('citySearch');
const stateContainer = document.getElementById('state-autocomplete-list');
const cityContainer = document.getElementById('city-autocomplete-list');
const getWeatherBtn = document.getElementById('getWeatherBtn');
const resultDiv = document.getElementById('result');
const favouritesList = document.getElementById('favouritesList');
const toggleBtn = document.getElementById('darkModeToggle');
const chartContainer = document.getElementById('chartContainer');
const chartControls = document.getElementById('chartControls');
const hideChartBtn = document.getElementById('hideChartBtn');
const chartTypeSel = document.getElementById('chartType');
const rangeTypeSel = document.getElementById('rangeType');
const authModal = document.getElementById('auth-modal');
const authModalContent = authModal.querySelector('.auth-modal-content'); 
const authModalClose = document.getElementById('auth-modal-close');
const authModalTitle = document.getElementById('auth-modal-title'); 
const authForm = document.getElementById('auth-form');
const authEmailInput = document.getElementById('auth-email');
const authPasswordInput = document.getElementById('auth-password');
const authPasswordToggle = document.getElementById('password-toggle-icon'); 
const authLoginBtn = document.getElementById('auth-login-btn');
const authSignupBtn = document.getElementById('auth-signup-btn');
const authMessage = document.getElementById('auth-message');
const authPrompt = document.getElementById('auth-prompt'); 
const authToggleLink = document.getElementById('auth-toggle-link'); 
const authStatusDiv = document.createElement('div');
authStatusDiv.id = 'auth-status';

let favourites = []; 
let currentAutocompleteIndex = -1;
let currentUser = null;
let isLoginMode = true; 
function escapeHtml(s) { return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'", '&#39;'); }

function togglePasswordVisibility() {
  if (authPasswordInput.type === 'password') {
    authPasswordInput.type = 'text';
    authPasswordToggle.textContent = '🙈';
  } else {
    authPasswordInput.type = 'password';
    authPasswordToggle.textContent = '👁️';
  }
}

function toggleAuthMode(e) {
    if (e) e.preventDefault();
    isLoginMode = !isLoginMode; 
    
    if (isLoginMode) {
        authModalTitle.textContent = 'Login';
        authModalContent.classList.remove('modal-state-signup');
        
    } else {
        authModalTitle.textContent = 'Sign Up';
        authModalContent.classList.add('modal-state-signup');
        
    }
    
    authPrompt.innerHTML = isLoginMode
      ? 'New to the page? <a href="#" id="auth-toggle-link">Click here to Sign Up!</a>'
      : 'Already have an account? <a href="#" id="auth-toggle-link">Click here to Login!</a>';
    
    document.getElementById('auth-toggle-link').onclick = toggleAuthMode;
    setAuthMessage('');
}

function showAuthModal(mode = 'login') {
  if (!authModal) return;
  authMessage.textContent = '';

  authEmailInput.value = '';
  authPasswordInput.value = '';

  authModal.style.display = 'flex';
  
  authPasswordInput.type = 'password';
  if (authPasswordToggle) authPasswordToggle.textContent = '👁️';
      isLoginMode = (mode === 'login'); 
      if (isLoginMode) {
          authModalTitle.textContent = 'Login';
          authModalContent.classList.remove('modal-state-signup');
          authPrompt.innerHTML = 'New to the page? <a href="#" id="auth-toggle-link">Click here to Sign Up!</a>';
      } else {
          authModalTitle.textContent = 'Sign Up';
          authModalContent.classList.add('modal-state-signup');
          authPrompt.innerHTML = 'Already have an account? <a href="#" id="auth-toggle-link">Click here to Login!</a>';
      }
      document.getElementById('auth-toggle-link').onclick = toggleAuthMode; 
  setTimeout(() => {
    authModal.style.opacity = 1;
    authModal.querySelector('.auth-modal-content').style.transform = 'translateY(0)';
  }, 10);
}

function hideAuthModal() {
  if (!authModal) return;
  authModal.style.opacity = 0;
  authModal.querySelector('.auth-modal-content').style.transform = 'translateY(-20px)';
  setTimeout(() => {
    authModal.style.display = 'none';
  }, 300);
}

function setAuthMessage(message, isError = false) {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.className = isError ? 'auth-message error' : 'auth-message success';
}

async function handleSignUp(e) {
  e.preventDefault();
  if (!supabase) return;
  const email = authEmailInput.value;
  const password = authPasswordInput.value;
  setAuthMessage('Signing up...', false);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
  if (signUpError) {
    setAuthMessage(signUpError.message, true);
  } else {
      setAuthMessage('Success! Check your email for verification link.', false);
      setTimeout(() => {
        hideAuthModal();
      }, 2000);
  } 
}

async function handleLogin(e) {
  e.preventDefault();
  if (!supabase) return;
  setAuthMessage('Logging in...', false);
  const email = authEmailInput.value;
  const password = authPasswordInput.value;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    setAuthMessage(error.message, true);
  } else if (data && data.user) {
    currentUser = data.user;
    
    setTimeout(() => {
        hideAuthModal();
        location.reload(); 
    }, 1000);
  } else {
    setAuthMessage('An unknown error occurred during login.', true);
  }
}

async function handleLogout() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('Error logging out:', error.message);
  } else {
    currentUser = null;
    
    favourites = []; 
    
    
    location.reload(); 
  }
}

async function checkUser() {
  if (!supabase) return;
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    console.error("Error getting session:", sessionError.message);
  }
  if (session) {    
    currentUser = session.user;
  } else {
    currentUser = null;
  }  
  updateAuthUI();
  await loadFavourites(); 
}

function updateAuthUI() {
  if (!authStatusDiv) return; 
  if (currentUser) { 
    let displayName = currentUser.email.split('@')[0];
    authStatusDiv.innerHTML = `
      <span id="auth-status-text">Hi, ${escapeHtml(displayName)}</span>
      <button id="logout-btn">Logout</button>
    `;
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.onclick = handleLogout;    
  } else {    
    authStatusDiv.innerHTML = `
      <span id="auth-status-text">Guest</span>
      <button id="login-btn">Login</button>
    `;
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) loginBtn.onclick = () => showAuthModal('login');
  }
    
  const loginBtn = document.getElementById('login-btn');
   if (loginBtn) loginBtn.onclick = () => showAuthModal('login');
  
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) logoutBtn.onclick = handleLogout;
  
  

  
}



async function loadFavourites() {
  if (!currentUser || !supabase) {
    favourites = [];
    renderFavourites();
    return;
  }
  
  const { data, error } = await supabase
    .from('favourites')
    .select('*')
    .eq('user_id', currentUser.id);

  if (error) {
    console.error('Error loading favourites:', error.message);
    favourites = [];
  } else {
    favourites = data;
  }
  renderFavourites();
}


async function addToFavourites(city, state, temp = '-') {
  if (!currentUser) {
    showAuthModal('login'); 
    setAuthMessage('Please log in to save favourites.', true);
    return;
  }
  if (!city || !state || isFavourite(city)) return;

  const newFav = {
    user_id: currentUser.id,
    city: city,
    state: state,
    temp: temp
  };

  const { data, error } = await supabase
    .from('favourites')
    .insert(newFav)
    .select(); 

  if (error) {
    
    if (error.code === '23505') { 
        console.warn(`Favourite for ${city} already exists.`);
    } else {
        console.error('Error adding favourite:', error.message);
    }
  } else if (data && data.length > 0) {
    favourites.push(data[0]);
    renderFavourites();
    updateResultHeart(city); 
  }
}


async function removeFromFavourites(city) {
  if (!currentUser) return;

  const fav = favourites.find(f => f.city === city);
  if (!fav) return;

  const { error } = await supabase
    .from('favourites')
    .delete()
    .eq('id', fav.id); 

  if (error) {
    console.error('Error removing favourite:', error.message);
  } else {
    favourites = favourites.filter(f => f.city !== city);
    renderFavourites();
    updateResultHeart(city); 
  }
}


function isFavourite(city) {
  return favourites.some(f => f.city === city);
}


function renderFavourites() {
if(!favouritesList) return;
favouritesList.innerHTML = '';
if(favourites.length===0){ favouritesList.innerHTML=`<div class="empty-favs" style="opacity:.8;padding:8px;">${currentUser ? 'No favourites yet' : 'Login to see favourites'}</div>`; return; }

 favourites.forEach(f=>{
 const entry = document.createElement('div'); entry.className='favourite-entry';
 const left = document.createElement('div'); left.textContent=`${f.city} - ${f.temp}°C`;
 const right = document.createElement('div'); right.style.display='flex'; right.style.gap='8px'; right.style.alignItems='center';

 const openBtn = document.createElement('button'); openBtn.className='plot-btn'; openBtn.textContent='Open';
  openBtn.onclick = ()=>{ 
    stateInput.value = f.state; 
    cityInput.value = f.city; 
    cityInput.disabled = false;
    closeAllLists(); 
    renderWeather(f.city, f.state); 
    updateResultHeart(f.city); 
  };

 const removeBtn = document.createElement('button'); removeBtn.className='remove-btn'; removeBtn.title='Remove'; removeBtn.innerHTML='✖';
 removeBtn.onclick = ()=>removeFromFavourites(f.city);

 right.appendChild(openBtn); right.appendChild(removeBtn);
 entry.appendChild(left); entry.appendChild(right);
 favouritesList.appendChild(entry);
 });
}



async function fetchWeather(city) {
const resp = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
if (!resp.ok) throw new Error('Could not fetch weather');
return resp.json();
}
async function fetchForecast(city, range = 'daily') {
const resp = await fetch(`/api/forecastTemps?city=${encodeURIComponent(city)}&range=${range}`);
if (!resp.ok) {
  const errData = await resp.json();
  throw new Error(errData.error || 'Could not fetch forecast');
 }
return resp.json();
}


function updateResultHeart(city){
const heart=document.getElementById('resultFavBtn');
if(!heart) return;
if(!city){ heart.classList.remove('active'); heart.textContent='♡'; return; }
if(isFavourite(city)){ heart.classList.add('active'); heart.textContent='♥'; }
else { heart.classList.remove('active'); heart.textContent='♡'; }
}


let currentChartParams = null;
async function updateChart() {
  if (!currentChartParams) return;
  const { city, state } = currentChartParams;
  if (!city) return;
  const chartType = chartTypeSel ? chartTypeSel.value : 'line';
  const rangeType = rangeTypeSel ? rangeTypeSel.value : 'daily';
  const rangeText = rangeType === 'daily' ? '5-day' : '48-hour';
  try {
    const { dates, temps } = await fetchForecast(city, rangeType);
    if(chartContainer) chartContainer.style.display='block'; 
    if(chartControls) chartControls.style.display='flex';
    const showChartBtn = document.getElementById('showChartBtn');
    if (showChartBtn) showChartBtn.textContent = `📈 Show ${rangeText} Forecast`;
    showChart(dates, temps, city, chartType, rangeType);
  } catch(err) { console.error(err); }
}


async function renderWeather(city, state){ 
try{
 resultDiv.classList.add('loading'); resultDiv.innerHTML=''; 
  if(chartContainer) chartContainer.style.display='none'; 
  if(chartControls) chartControls.style.display='none';
  currentChartParams = { city, state }; 

 const json = await fetchWeather(city); const weather=json.weather; const aqi=json.aqi;
 resultDiv.classList.remove('loading');
  const rangeType = rangeTypeSel ? rangeTypeSel.value : 'daily';
  const rangeText = rangeType === 'daily' ? '5-day' : '48-hour';

 resultDiv.innerHTML = `
  <div class="result">
   <h3>Weather in ${escapeHtml(weather.name)}, ${escapeHtml(weather.sys.country)}</h3>
   <button id="resultFavBtn" class="fav-btn" title="Add to favourites">♡</button>
   <p><strong>Temperature:</strong> ${weather.main.temp} °C</p>
   <p><strong>Condition:</strong> ${escapeHtml(weather.weather[0].description)}</p>
   <p><strong>Humidity:</strong> ${weather.main.humidity}%</p>
   <p><strong>Wind:</strong> ${weather.wind.speed} m/s</p>
   <p><strong>AQI:</strong> ${escapeHtml(String(aqi))}</p>
   <div style="margin-top:10px;">
    <button id="showChartBtn" class="plot-btn">📈 Show ${rangeText} Forecast</button>
   </div>
  </div>
 `;

 const heart=document.getElementById('resultFavBtn'); updateResultHeart(city);
 heart.onclick=()=>{ 
    if(isFavourite(city)) {
     removeFromFavourites(city); 
    } else {
     
     addToFavourites(city, state, weather.main.temp); 
    }
    
  };

 const showChartBtn=document.getElementById('showChartBtn');
 if (showChartBtn) showChartBtn.onclick = updateChart; 

  
 if(hideChartBtn) hideChartBtn.onclick=()=>{ 
    if(chartContainer) chartContainer.style.display='none'; 
    if(chartControls) chartControls.style.display='none'; 
  };
}catch(err){ 
  resultDiv.classList.remove('loading'); 
  resultDiv.innerHTML=`<div class="result"><p style="color: yellow;">⚠ ${escapeHtml(err.message||String(err))}</p></div>`; 
  currentChartParams = null; 
 }
}


const suggestionCache = new Map();
let lastQueryIdAuto = 0;
const FETCH_TIMEOUT_MS = 4000;
function debounce(fn, delay=300){ let timer=null; return (...args)=>{ if(timer) clearTimeout(timer); timer=setTimeout(()=>fn(...args), delay); }; }
async function fetchSuggestions(query, type='state', state='') {
if (!query) return [];
const cacheKey = `${type}::${state}::${query}`;
if (suggestionCache.has(cacheKey)) return suggestionCache.get(cacheKey);
let url = '';
if (type === 'state') {
 url = `/api/states?query=${encodeURIComponent(query)}`;
} else if (type === 'city') {
 if (!state) return [];
 url = `/api/cities?state=${encodeURIComponent(state)}&query=${encodeURIComponent(query)}`;
 } else return []; 
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
try {
 const resp = await fetch(url, { signal: controller.signal });
 clearTimeout(timeout);
 if (!resp.ok) return [];
 let data = await resp.json();
 if (!Array.isArray(data)) return [];
 const normalized = data.map(item => item);
 suggestionCache.set(cacheKey, normalized);
 return normalized;
} catch (err) {
 clearTimeout(timeout);
 if (err && err.name !== 'AbortError') console.warn('fetchSuggestions error', err); 
 return [];
}
}
function buildSuggestion(text,container,inputValue,onClick){
const div=document.createElement('div'); div.className='item';
const idx=text.toLowerCase().indexOf(inputValue.toLowerCase());
if(idx>=0){
 const before=text.slice(0,idx); const match=text.slice(idx,idx+inputValue.length); const after=text.slice(idx+inputValue.length);
 div.innerHTML=`${escapeHtml(before)}<span class="match">${escapeHtml(match)}</span>${escapeHtml(after)}`;
 }else div.textContent=text; 
div.addEventListener('click',()=>onClick(text));
container.appendChild(div); container.style.display='block';
}
function showLoading(container){ if(container) { container.innerHTML=`<div class="loading">Searching...</div>`; container.style.display='block'; } }
function showNoResults(container,msg='No results found'){ if(container) { container.innerHTML=`<div class="no-results">${msg}</div>`; container.style.display='block'; } }
const handleStateInput=debounce(async(e)=>{
 const query=e.target.value.trim(); const queryId=++lastQueryIdAuto; const container=stateContainer; 
 currentAutocompleteIndex = -1; 
if(!query){ if(container){ container.style.display='none'; } cityInput.disabled=true; return; }
cityInput.value=''; cityInput.disabled=true; if(cityContainer){ cityContainer.innerHTML=''; cityContainer.style.display='none'; }
showLoading(container);
const suggestions=await fetchSuggestions(query,'state');
if(queryId!==lastQueryIdAuto) return;
if(container) container.innerHTML='';
if(!suggestions.length){ showNoResults(container); return; }
 suggestions.forEach(s=>buildSuggestion(s,container,query,(selected)=>{ stateInput.value=selected; cityInput.disabled=false; cityInput.focus(); if(container) container.style.display='none'; })); 
});
const handleCityInput=debounce(async(e)=>{
const query=e.target.value.trim(); const stateVal=stateInput.value.trim(); const queryId=++lastQueryIdAuto; const container=cityContainer;
 currentAutocompleteIndex = -1; 
if(!query){ if(container) { container.style.display='none'; } return; }
if(!stateVal){ showNoResults(container,'Select a state first'); return; }
 showLoading(container); 
const suggestions=await fetchSuggestions(query,'city',stateVal);
if(queryId!==lastQueryIdAuto) return;
if(container) container.innerHTML='';
 if(!suggestions.length){ showNoResults(container); return; } 
 suggestions.forEach(s=>buildSuggestion(s,container,query,(selected)=>{ cityInput.value=selected; if(container){ container.style.display='none'; } if(getWeatherBtn) getWeatherBtn.click(); })); 
});
if(stateInput) stateInput.addEventListener('input',handleStateInput);
if(cityInput) cityInput.addEventListener('input',handleCityInput);
function handleAutocompleteKeydown(e, container) {
  if (!container) return;
  const items = container.querySelectorAll('.item');
  if (!items.length) { currentAutocompleteIndex = -1; return; }
  const prevIndex = currentAutocompleteIndex;
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    currentAutocompleteIndex++;
    if (currentAutocompleteIndex >= items.length) currentAutocompleteIndex = 0; 
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    currentAutocompleteIndex--;
    if (currentAutocompleteIndex < 0) currentAutocompleteIndex = items.length - 1; 
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (currentAutocompleteIndex > -1 && items[currentAutocompleteIndex]) {
      items[currentAutocompleteIndex].click(); 
    } else if (items.length === 1) { 
      items[0].click();
    } else if (e.target === cityInput && cityInput.value.trim()) {
      getWeatherBtn.click(); 
    }
    currentAutocompleteIndex = -1; 
    return;
  } else if (e.key === 'Escape') {
    closeAllLists();
    return;
  } else {
    return; 
  }
  if (prevIndex > -1 && items[prevIndex]) {
    items[prevIndex].classList.remove('autocomplete-active');
  }
  if (items[currentAutocompleteIndex]) {
    items[currentAutocompleteIndex].classList.add('autocomplete-active');
    items[currentAutocompleteIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
if(stateInput) stateInput.addEventListener('keydown', (e) => handleAutocompleteKeydown(e, stateContainer));
if(cityInput) cityInput.addEventListener('keydown', (e) => handleAutocompleteKeydown(e, cityContainer));
document.addEventListener('click',(e)=>{
if(e.target!==stateInput && e.target!==cityInput && e.target.closest('.autocomplete-items')===null){
 closeAllLists();
}
});


if(getWeatherBtn) getWeatherBtn.onclick=()=>{
const city=cityInput.value.trim();
 const state=stateInput.value.trim(); 
if(!city || !state){ alert('Please select a state and city'); return; }
closeAllLists(); 
 renderWeather(city, state); 
};
function closeAllLists(){ [stateContainer,cityContainer].forEach(list=>{ if(list){ list.style.display='none'; list.innerHTML=''; } }); }

if(chartTypeSel) chartTypeSel.onchange = updateChart;
if(rangeTypeSel) rangeTypeSel.onchange = updateChart;

if(toggleBtn) toggleBtn.onclick=()=>{
const isDark=document.body.classList.toggle('dark'); toggleBtn.textContent=isDark?'☀️ Light Mode':'🌙 Dark Mode';
try{ localStorage.setItem('weather_dark_v1',isDark?'on':'off'); }catch{} 
  refreshChartTheme(); 
};


window.onload=()=>{
  
  const mainHeader = document.querySelector('.main-header');
  if (mainHeader) {
      mainHeader.appendChild(authStatusDiv);
  } else {
      document.body.appendChild(authStatusDiv); 
  }
  
  if (authModalClose) authModalClose.onclick = hideAuthModal;
  if (authLoginBtn) authLoginBtn.onclick = handleLogin; 
  if (authSignupBtn) authSignupBtn.onclick = handleSignUp; 
  if (authPasswordToggle) authPasswordToggle.onclick = togglePasswordVisibility; 
  if (authToggleLink) authToggleLink.onclick = toggleAuthMode; 
  
  if (authModal) authModal.onclick = (e) => {
    if (e.target === authModal) hideAuthModal();
  };

  
  initializeSupabase(); 

  if(cityInput) cityInput.disabled=!stateInput||!stateInput.value.trim(); 
try{
 if(localStorage.getItem('weather_dark_v1')==='on'){ document.body.classList.add('dark'); if(toggleBtn) toggleBtn.textContent='☀️ Light Mode'; setTimeout(refreshChartTheme,120); }
}catch{}
if(cityInput) cityInput.onchange=()=>updateResultHeart(cityInput.value.trim());
if(chartContainer) chartContainer.style.display='none';
 if(chartControls) chartControls.style.display='none'; 
};

