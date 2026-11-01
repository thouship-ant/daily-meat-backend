/**
 * Turns a saved address pin into the short "Locality / area" label shown on the admin Customer
 * Details page (e.g. "Crawford"), using reverse geocoding so free-typed street text doesn't have
 * to be parsed. Google when GOOGLE_MAPS_API_KEY is set, otherwise OpenStreetMap Nominatim.
 */
const cache = new Map();
let lastNominatimCall = 0;

const uniq = (list) => [...new Set(list.filter(Boolean))];
const titleCase = (s) => s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

async function viaGoogle(lat, lng) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=en&region=in&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  const data = await (await fetch(url)).json();
  const comps = data.results?.[0]?.address_components || [];
  const pick = (type) => comps.find((c) => c.types.includes(type))?.long_name;
  return uniq([pick('neighborhood'), pick('sublocality_level_2'), pick('sublocality_level_1') || pick('sublocality')]);
}

async function viaNominatim(lat, lng) {
  const wait = lastNominatimCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&zoom=16&addressdetails=1&lat=${lat}&lon=${lng}`;
  const data = await (await fetch(url, { headers: { 'User-Agent': 'daily-meat-backend/1.0' } })).json();
  const a = data?.address || {};
  return uniq([a.neighbourhood, a.suburb || a.city_district || a.quarter]);
}

/** @returns {Promise<string>} e.g. "Crawford", or '' when it can't be resolved */
async function getLocality(latitude, longitude) {
  if (latitude == null || longitude == null) return '';
  const key = `${Number(latitude).toFixed(4)},${Number(longitude).toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);
  try {
    const parts = process.env.GOOGLE_MAPS_API_KEY
      ? await viaGoogle(latitude, longitude)
      : await viaNominatim(latitude, longitude);
    const label = parts.slice(0, 2).map(titleCase).join(', ');
    cache.set(key, label);
    return label;
  } catch (error) {
    console.error('Locality lookup error:', error.message);
    return ''; // transient: don't cache
  }
}

/** "Locality / area, City - Pincode", dropping whatever isn't known */
function formatLocation({ locality, city, pincode }) {
  const place = [locality, city].filter(Boolean).join(', ');
  const pin = pincode && pincode !== 'N/A' && pincode !== '000000' ? pincode : '';
  return [place, pin].filter(Boolean).join(' - ');
}

module.exports = { getLocality, formatLocation };
