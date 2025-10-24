const fs = require('fs');
const path = require('path');
const indianCities = require('indian-cities-json'); 

const folder = path.join(__dirname, 'data');

if (!fs.existsSync(folder)) {
  fs.mkdirSync(folder);
}

const filePath = path.join(folder, 'indian_cities.json');

const citiesByState = {};

Object.keys(indianCities).forEach(state => {
  citiesByState[state] = indianCities[state];
});

fs.writeFileSync(filePath, JSON.stringify(citiesByState, null, 2), 'utf-8');
console.log('indian_cities.json generated at', filePath);
