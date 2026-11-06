// Port of daily-meat-application/src/utils/addressUtils.ts (keep in sync)
// Address checks and clean-up for the Add / Edit Address screen.
//  - The "City" must be a real Tamil Nadu city or town (not a locality like "Koranattu Karuppur II").
//  - The "House No. / Street" must be a full address line (door no. & street, building, ward / zone ...).

// Tamil Nadu district headquarters, municipal corporations and larger towns
const TN_CITIES = [
  'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Tirunelveli', 'Tiruppur', 'Erode', 'Vellore',
  'Thoothukudi', 'Dindigul', 'Thanjavur', 'Ranipet', 'Sivakasi', 'Karur', 'Udhagamandalam', 'Hosur', 'Nagercoil',
  'Kanchipuram', 'Kumbakonam', 'Rajapalayam', 'Pudukkottai', 'Ambur', 'Karaikudi', 'Neyveli', 'Nagapattinam',
  'Viluppuram', 'Tiruvannamalai', 'Cuddalore', 'Tambaram', 'Avadi', 'Tiruvallur', 'Krishnagiri', 'Dharmapuri',
  'Namakkal', 'Perambalur', 'Ariyalur', 'Ramanathapuram', 'Virudhunagar', 'Sivaganga', 'Theni', 'Tenkasi',
  'Tirupathur', 'Kallakurichi', 'Chengalpattu', 'Mayiladuthurai', 'Tiruvarur', 'Thiruvarur', 'Kanyakumari',
  'Pollachi', 'Mettupalayam', 'Gudalur', 'Coonoor', 'Kotagiri', 'Valparai', 'Udumalaipettai', 'Palani', 'Kodaikanal',
  'Bodinayakanur', 'Cumbum', 'Periyakulam', 'Usilampatti', 'Melur', 'Thirumangalam', 'Paramakudi',
  'Rameswaram', 'Devakottai', 'Manamadurai', 'Aruppukkottai', 'Srivilliputhur', 'Sattur', 'Kovilpatti', 'Tiruchendur',
  'Srivaikuntam', 'Sankarankovil', 'Ambasamudram', 'Cheranmahadevi', 'Palayamkottai', 'Kuzhithurai', 'Marthandam',
  'Thuckalay', 'Padmanabhapuram', 'Colachel', 'Mannargudi', 'Papanasam', 'Pattukkottai', 'Orathanadu', 'Peravurani',
  'Budalur', 'Thiruvaiyaru', 'Tiruvidaimarudur', 'Swamimalai', 'Sirkazhi', 'Vedaranyam', 'Thirukkuvalai', 'Koothanallur',
  'Lalgudi', 'Srirangam', 'Musiri', 'Thuraiyur', 'Manapparai', 'Thottiyam', 'Kulithalai', 'Aravakurichi', 'Krishnarayapuram',
  'Gobichettipalayam', 'Bhavani', 'Perundurai', 'Sathyamangalam', 'Anthiyur', 'Kangeyam', 'Dharapuram', 'Avinashi',
  'Palladam', 'Mettur', 'Attur', 'Omalur', 'Edappadi', 'Sankagiri', 'Tiruchengode', 'Rasipuram', 'Paramathi Velur',
  'Harur', 'Palacode', 'Pennagaram', 'Denkanikottai', 'Uthangarai', 'Vaniyambadi', 'Gudiyatham', 'Arakkonam', 'Arcot',
  'Walajapet', 'Sholinghur', 'Tirupattur', 'Jolarpet', 'Chidambaram', 'Panruti', 'Virudhachalam', 'Vadalur', 'Tindivanam',
  'Gingee', 'Ulundurpettai', 'Sankarapuram', 'Chengam', 'Polur', 'Arani', 'Vandavasi', 'Cheyyar', 'Maduranthakam',
  'Mahabalipuram', 'Sriperumbudur', 'Poonamallee', 'Ponneri', 'Gummidipoondi', 'Tiruttani', 'Tirumangalam', 'Thiruchirappalli',
];

// Common other spellings / names people use
const ALIASES = {
  trichy: 'Tiruchirappalli',
  tiruchchirappalli: 'Tiruchirappalli',
  thiruchirappalli: 'Tiruchirappalli',
  trichirappalli: 'Tiruchirappalli',
  tanjore: 'Thanjavur',
  tanjavur: 'Thanjavur',
  madras: 'Chennai',
  kovai: 'Coimbatore',
  tuticorin: 'Thoothukudi',
  kumbakkonam: 'Kumbakonam',
  kumbakonam: 'Kumbakonam',
  ooty: 'Udhagamandalam',
  ootacamund: 'Udhagamandalam',
  tirupur: 'Tiruppur',
  tirunelveli: 'Tirunelveli',
  nellai: 'Tirunelveli',
  kanchipuram: 'Kanchipuram',
  conjeevaram: 'Kanchipuram',
  villupuram: 'Viluppuram',
  thiruvannamalai: 'Tiruvannamalai',
  pudukottai: 'Pudukkottai',
  karaikkudi: 'Karaikudi',
  nagarcoil: 'Nagercoil',
  cuddalore: 'Cuddalore',
  mayavaram: 'Mayiladuthurai',
  mayiladuthurai: 'Mayiladuthurai',
};

const norm = (s) => s.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim();

const CITY_BY_NORM = new Map();
TN_CITIES.forEach((c) => CITY_BY_NORM.set(norm(c), c));
Object.entries(ALIASES).forEach(([k, v]) => CITY_BY_NORM.set(norm(k), v));
const CITY_KEYS = Array.from(CITY_BY_NORM.keys()).sort((a, b) => b.length - a.length); // longest first

/** Returns the proper city name if `text` is (or clearly names) a Tamil Nadu city, e.g. "Kumbakonam Taluk" -> "Kumbakonam". */
function matchCity(text) {
  const n = norm(text || '');
  if (!n) return null;
  const exact = CITY_BY_NORM.get(n);
  if (exact) return exact;
  // a district / taluk label such as "Thanjavur District" or "Kumbakonam Taluk": a whole-word match of a city name
  const stripped = n.replace(/\b(district|taluk|taluka|municipality|corporation|city|town|tk|dt)\b/g, '').replace(/\s+/g, ' ').trim();
  const exact2 = CITY_BY_NORM.get(stripped);
  if (exact2) return exact2;
  return null;
}

// Google "plus codes" such as X9MV+PVM are not an address a delivery person can use
const PLUS_CODE = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,}$/i;
const isPlusCode = (s) => PLUS_CODE.test(s.trim());

/** The street line must be a full address: door no. & street, building / block, ward / zone ... (min 20 characters, with a comma). */
function validateStreet(street) {
  const s = street.trim();
  if (!s) return 'Please enter your door number and street.';
  const segments = s.split(',').map((p) => p.trim()).filter(Boolean);
  const hasLetters = /[a-zA-Z]/.test(s);
  if (isPlusCode(s) || !hasLetters || s.length < 20 || segments.length < 2) {
    return 'Please enter the full address with commas, for example: 12, Gandhi Street, Block A, Sunrise Apartments, Ward 5. (At least 20 characters.)';
  }
  return null;
}

/** The city must be a Tamil Nadu city / town. */
function validateCity(city) {
  if (!city.trim()) return 'Please enter your city.';
  if (!matchCity(city)) {
    return `"${city.trim()}" is not a recognised city. Enter your city or town (for example Tiruchirappalli, Thanjavur or Kumbakonam) and put your locality or village name in the street field.`;
  }
  return null;
}

module.exports = { matchCity, validateStreet, validateCity };
