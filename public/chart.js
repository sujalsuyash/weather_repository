let chartInstance = null;
let lastState = null; 

export function showChart(labels, data, city, type = 'line', range = 'daily') {
 lastState = { labels, data, city, type, range }; 

 const canvas = document.getElementById('tempChart');
 if (!canvas) {
  console.warn('tempChart canvas not found');
  return;
 }
 const ctx = canvas.getContext('2d');

 if (chartInstance) chartInstance.destroy();

 const isDark = document.body.classList.contains('dark');

 const borderColor = isDark ? '#3dd3c1' : '#27496d';
  const bgColor = hexToRgba(borderColor, isDark ? 0.18 : 0.12);
 const labelColor = isDark ? '#e6e6e6' : '#222';
 const gridCol = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';

  const title = range === 'hourly' 
    ? `Hourly Forecast - ${city}` 
    : `Daily Forecast - ${city}`;
  const xAxisLabel = range === 'hourly' 
    ? 'Time (Next 48h)' 
    : 'Days (Next 5 Days)';

 const datasets = [{
  label: title,
  data: data,
  backgroundColor: bgColor,
  borderColor: borderColor,
  pointBackgroundColor: borderColor,
  pointBorderColor: '#fff',
  fill: type === 'line' ? false : true,
  tension: 0.25,
  pointRadius: 5,
  borderWidth: 3
 }];

 chartInstance = new Chart(ctx, {
  type: type,
  data: {
   labels: labels,
   datasets
  },
  options: {
   responsive: true,
   plugins: {
    legend: {
     display: true,
     labels: { color: labelColor, boxWidth: 12, padding: 8 }
    }
   },
   scales: {
    x: {
     title: { display: true, text: xAxisLabel, color: labelColor }, 
     ticks: { color: labelColor },
     grid: { color: gridCol }
    },
    y: {
     title: { display: true, text: 'Temperature (°C)', color: labelColor },
     ticks: { color: labelColor },
     grid: { color: gridCol }
    }
   },
   animation: { duration: 700, easing: 'easeOutQuart' }
 }
 });
}

export function refreshChartTheme() {
 if (!lastState) return;
 showChart(lastState.labels, lastState.data, lastState.city, lastState.type, lastState.range);
}

function hexToRgba(hex, alpha = 1) {
 const h = hex.replace('#', '');
 const r = parseInt(h.substring(0,2),16);
 const g = parseInt(h.substring(2,4),16);
 const b = parseInt(h.substring(4,6),16);
 return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function getChartInstance() {
 return chartInstance;
}
