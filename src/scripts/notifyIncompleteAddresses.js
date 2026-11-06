require('dotenv').config();
const sequelize = require('../config/database');
const { User, Address } = require('../models');
const notificationService = require('../services/notificationService');
const { validateStreet, validateCity } = require('../utils/addressCheck');

// Finds saved addresses whose street is not a full address (min 20 chars with a comma) or whose
// city is not a Tamil Nadu city / district, and notifies each affected customer once.
//
//   node src/scripts/notifyIncompleteAddresses.js            -> dry run (lists who WOULD be notified)
//   node src/scripts/notifyIncompleteAddresses.js --send     -> sends the push notifications
//   add --limit=N to cap how many customers are notified in one run

// First 3 digits of the PIN -> city / district (Tamil Nadu). Used only to suggest the right city in the message.
const PIN_PREFIX_CITY = {
  600: 'Chennai', 601: 'Tiruvallur', 602: 'Tiruvallur', 603: 'Chengalpattu', 604: 'Viluppuram', 605: 'Viluppuram',
  606: 'Tiruvannamalai', 607: 'Cuddalore', 608: 'Cuddalore', 609: 'Mayiladuthurai', 610: 'Tiruvarur',
  611: 'Nagapattinam', 612: 'Kumbakonam', 613: 'Thanjavur', 614: 'Thanjavur', 620: 'Tiruchirappalli',
  621: 'Tiruchirappalli', 622: 'Pudukkottai', 623: 'Ramanathapuram', 624: 'Dindigul', 625: 'Madurai',
  626: 'Virudhunagar', 627: 'Tirunelveli', 628: 'Thoothukudi', 629: 'Nagercoil', 630: 'Sivaganga',
  631: 'Kanchipuram', 632: 'Vellore', 635: 'Krishnagiri', 636: 'Salem', 637: 'Namakkal', 638: 'Erode',
  639: 'Karur', 641: 'Coimbatore', 642: 'Tiruppur', 643: 'Udhagamandalam',
};
const cityFromPin = (pin) => PIN_PREFIX_CITY[String(pin || '').slice(0, 3)] || null;

async function run() {
  const send = process.argv.includes('--send');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity;

  await sequelize.authenticate();
  const addresses = await Address.findAll({ raw: true });

  // user_id -> list of problems
  const byUser = new Map();
  for (const a of addresses) {
    const streetErr = validateStreet(a.street || '');
    const cityErr = validateCity(a.city || '');
    if (!streetErr && !cityErr) continue;
    if (!byUser.has(a.user_id)) byUser.set(a.user_id, []);
    byUser.get(a.user_id).push({
      title: a.title,
      street: a.street,
      city: a.city,
      pincode: a.pincode,
      streetBad: !!streetErr,
      cityBad: !!cityErr,
      suggestedCity: cityFromPin(a.pincode),
    });
  }

  const users = byUser.size
    ? await User.findAll({ where: { id: [...byUser.keys()], role: 'CUSTOMER' }, attributes: ['id', 'name', 'push_token'], raw: true })
    : [];

  console.log(`Addresses checked: ${addresses.length}. Customers with incomplete addresses: ${users.length}.`);
  let sent = 0;
  for (const u of users) {
    if (sent >= limit) break;
    const issues = byUser.get(u.id);
    const first = issues[0];
    const parts = [];
    if (issues.some((i) => i.cityBad)) {
      const hint = issues.find((i) => i.cityBad && i.suggestedCity);
      parts.push(hint
        ? `enter your city / district name (for PIN ${hint.pincode} it is ${hint.suggestedCity})`
        : 'enter your city / district name');
    }
    if (issues.some((i) => i.streetBad)) parts.push('give the full street address (door no. & street, building / block, ward) in at least 20 characters');
    const body = `Your saved address "${first.title}" needs an update. Please ${parts.join(' and ')} so deliveries reach you without delay.`;

    console.log(`- ${u.name || u.id} | token:${u.push_token ? 'yes' : 'no'} | ${issues.map((i) => `[${i.title}] "${i.street}", ${i.city} ${i.pincode}`).join(' ; ')}`);
    if (send) {
      // No socketEvent: a socket emit needs the running server's io instance, and would skip the push here.
      await notificationService.notifyUser({
        userId: u.id,
        title: 'Please update your delivery address',
        body,
        data: { type: 'ADDRESS_UPDATE_REQUIRED', screen: 'Addresses' },
      });
      sent += 1;
    }
  }
  console.log(send ? `Notifications sent: ${sent}.` : 'Dry run only - nothing was sent. Re-run with --send to notify these customers.');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
