
import express from "express";
import fs from "fs";
import path from "path";
import fetch from "node-fetch"; 
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config(); 

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataPath = path.join(__dirname, "data", "indian_cities.json");
let citiesData = [];

try {
 const raw = fs.readFileSync(dataPath, "utf8");
 const parsed = JSON.parse(raw);
 if (!parsed.cities || !Array.isArray(parsed.cities)) throw new Error("JSON.cities is not an array");
 citiesData = parsed.cities;
 console.log(`✅ Loaded ${citiesData.length} cities`);
} catch (err) {
 console.error("❌ Failed to load JSON:", err);
 process.exit(1);
}

app.use(express.static(path.join(__dirname, "public")));
app.use((req, res, next) => {
 res.setHeader("Cache-Control", "no-store");
 next();
});

app.get("/api/states", (req, res) => {
 const query = (req.query.query || "").toLowerCase();
 const states = [...new Set(citiesData.map(c => c.state))];
 const filtered = states.filter(s => s.toLowerCase().includes(query));
 res.json(filtered.slice(0, 10));
});

app.get("/api/cities", (req, res) => {
 const state = (req.query.state || "").toLowerCase();
 const query = (req.query.query || "").toLowerCase();

 if (!state) return res.json([]);

 const filteredCities = citiesData
 .filter(c => c.state.toLowerCase() === state && c.name.toLowerCase().includes(query))
 .map(c => c.name);

 const uniqueCities = [...new Set(filteredCities)];
 res.json(uniqueCities.slice(0, 10));
});

app.get("/api/weather", async (req, res) => {
 const city = req.query.city;
 if (!city) return res.status(400).json({ error: "City required" });

 try {
 const API_KEY = process.env.API_KEY;
 if (!API_KEY) throw new Error("API_KEY missing in .env");

 const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},IN&appid=${API_KEY}&units=metric`;
 const weatherResp = await fetch(weatherUrl);
 if (!weatherResp.ok) throw new Error("City not found or weather API error");
 const weatherData = await weatherResp.json();

 let aqiDisplay = "-";
 if (weatherData.coord) {
  const { lat, lon } = weatherData.coord;
  const aqiUrl = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`;
  const aqiResp = await fetch(aqiUrl);
  if (aqiResp.ok) {
  const aqiData = await aqiResp.json();
  if (aqiData.list && aqiData.list[0] && aqiData.list[0].components) {
   const pm25 = aqiData.list[0].components.pm2_5 || 0;

   function getAQI(pm25Val) {
   if (pm25Val <= 12) return { value: Math.round(pm25Val*50/12), label: "Good" };
   else if (pm25Val <= 35.4) return { value: Math.round((pm25Val-12.1)*50/23.3+51), label: "Moderate" };
   else if (pm25Val <= 55.4) return { value: Math.round((pm25Val-35.5)*50/19.9+101), label: "Unhealthy for Sensitive" };
   else if (pm25Val <= 150.4) return { value: Math.round((pm25Val-55.5)*100/94.9+151), label: "Unhealthy" };
   else if (pm25Val <= 250.4) return { value: Math.round((pm25Val-150.5)*100/99.9+201), label: "Very Unhealthy" };
   else return { value: 301, label: "Hazardous" };
   }

   const aqiObj = getAQI(pm25);
   aqiDisplay = `${aqiObj.value} (${aqiObj.label})`;
  }
  }
 }

 res.json({ weather: weatherData, aqi: aqiDisplay });

 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

app.get("/api/forecastTemps", async (req, res) => {
 const city = req.query.city;
  const range = req.query.range || 'daily'; 
 if (!city) return res.status(400).json({ error: "City required" });

 try {
 const API_KEY = process.env.API_KEY;
 if (!API_KEY) throw new Error("API_KEY missing in .env");

 const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${encodeURIComponent(city)},IN&appid=${API_KEY}&units=metric`;
 
 const forecastResp = await fetch(forecastUrl);
 if (!forecastResp.ok) {
  const errorData = await forecastResp.json();
  console.error("5-Day Forecast API Error:", errorData);
  throw new Error(errorData.message || "Failed to fetch 5-day forecast.");
 }
 const forecastData = await forecastResp.json();

 if (!forecastData.list || forecastData.list.length === 0) {
  throw new Error("No forecast data found in API response.");
 }

    let dates = [];
    let temps = [];

    if (range === 'hourly') {
        forecastData.list.slice(0, 16).forEach(item => {
            const d = new Date(item.dt * 1000);
            const time = d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
            const day = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
            dates.push(`${day}, ${time}`);
            temps.push(item.main.temp);
        });

    } else {
        const dailyMaxTemps = new Map();
        for (const item of forecastData.list) {
            const d = new Date(item.dt * 1000);
            const dateKey = `${d.getDate()}/${d.getMonth() + 1}`;
            const currentMax = dailyMaxTemps.get(dateKey) || -Infinity;
            dailyMaxTemps.set(dateKey, Math.max(currentMax, item.main.temp_max));
        }
        dates = [...dailyMaxTemps.keys()].slice(0, 5);
        temps = [...dailyMaxTemps.values()].slice(0, 5);
    }

 res.json({ dates: dates, temps: temps });

 } catch (err) {
 console.error(err);
 res.status(500).json({ error: err.message });
 }
});

app.get("/api/config", (req, res) => {
 res.json({
 supabaseUrl: process.env.SUPABASE_URL,
 supabaseAnonKey: process.env.SUPABASE_ANON_KEY
 });
});


app.listen(PORT, () => {
 console.log(`🌐 Server running at http://localhost:${PORT}`);
});

