/**
 * Converts a typed delivery address into coordinates so the map pin matches the address
 * the customer entered, not the device location they happened to be at when ordering.
 *
 * Uses Google Geocoding when GOOGLE_MAPS_API_KEY is set (recommended, much better for Indian
 * addresses), otherwise falls back to OpenStreetMap Nominatim.
 */
const cache = new Map();
let lastNominatimCall = 0;

const buildQuery = ({ street, city, pincode }) =>
  [street, city, pincode && pincode !== 'N/A' && pincode !== '000000' ? pincode : null, 'India']
    .filter(Boolean)
    .join(', ');

// Full address, then the same without a leading door number, then city + pincode so the pin at
// least lands in the right area. Trailing parts are never used on their own: a lone word like
// "Airport" matches the airport itself, which is a confidently wrong pin.
const buildCandidates = ({ street, city, pincode }) => {
  // Addresses can contain line breaks ("60, Wireless Road \n Tiruchirapalli"); treat them as commas
  const parts = street.split(/[,\n\r]+/).map((p) => p.trim()).filter(Boolean);
  const withoutDoorNo = parts.length > 1 && /^[\w/-]{1,6}$/.test(parts[0]) && /\d/.test(parts[0])
    ? parts.slice(1)
    : parts;
  return [...new Set([
    buildQuery({ street: parts.join(', '), city, pincode }),
    buildQuery({ street: withoutDoorNo.join(', '), city, pincode }),
    buildQuery({ street: '', city, pincode })
  ])];
};

async function geocodeWithGoogle(query) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=in&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  const loc = data.results?.[0]?.geometry?.location;
  return loc ? { latitude: loc.lat, longitude: loc.lng } : null;
}

async function geocodeWithNominatim(query) {
  // Nominatim usage policy: max 1 request per second
  const wait = lastNominatimCall + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastNominatimCall = Date.now();

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'daily-meat-backend/1.0' } });
  const data = await res.json();
  const hit = data?.[0];
  return hit ? { latitude: parseFloat(hit.lat), longitude: parseFloat(hit.lon) } : null;
}

/**
 * @param {{street: string, city: string, pincode?: string}} address
 * @returns {Promise<{latitude: number, longitude: number} | null>} null when it can't be resolved
 */
async function geocodeAddress(address) {
  if (!address?.street) return null;
  const query = buildQuery(address);
  if (cache.has(query)) return cache.get(query);

  const lookup = process.env.GOOGLE_MAPS_API_KEY ? geocodeWithGoogle : geocodeWithNominatim;
  let result = null;
  try {
    for (const candidate of buildCandidates(address)) {
      result = await lookup(candidate);
      if (result) break;
    }
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null; // transient failure: don't cache, retry next time
  }

  cache.set(query, result);
  return result;
}

module.exports = { geocodeAddress };
