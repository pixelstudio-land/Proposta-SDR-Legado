const axios = require('axios');

async function test() {
  const query = `[out:json][timeout:25];
area["name"="Campinas"]->.a;
(
  node["shop"="hairdresser"](area.a);
  node["amenity"="restaurant"](area.a);
  node["amenity"="dentist"](area.a);
);
out body 10;`;

  try {
    const res = await axios.post('https://overpass-api.de/api/interpreter', 'data=' + encodeURIComponent(query), {
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'AgenteSDR/1.0 (local contact miner)'
      }
    });
    console.log('Result count:', res.data.elements.length);
    for (const el of res.data.elements) {
      console.log('Item:', el.tags?.name, '| Phone:', el.tags?.phone || el.tags?.['contact:phone'] || el.tags?.['contact:whatsapp']);
    }
  } catch (e) {
    console.error('Error:', e.message, e.response?.status, e.response?.data);
  }
}

test();
