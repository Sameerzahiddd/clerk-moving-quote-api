const https = require('https');

// ─── Distance Helpers ────────────────────────────────────────────────────────

function getGoogleMapsDistance(originZip, destinationZip, apiKey) {
  return new Promise((resolve, reject) => {
    const origin = encodeURIComponent(originZip + ' USA');
    const dest = encodeURIComponent(destinationZip + ' USA');
    const url =
      `https://maps.googleapis.com/maps/api/distancematrix/json` +
      `?origins=${origin}&destinations=${dest}&units=imperial&key=${apiKey}`;

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const element = json.rows?.[0]?.elements?.[0];
          if (!element || element.status !== 'OK') {
            return reject(new Error('Google Maps returned no result'));
          }
          resolve({
            distanceMiles: element.distance.value / 1609.344,
            driveTimeHours: element.duration.value / 3600,
          });
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function fallbackDistance(originZip, destinationZip) {
  const o = parseInt(originZip, 10) || 44115;
  const d = parseInt(destinationZip, 10) || 44115;
  const diff = Math.abs(o - d);

  let distanceMiles;
  if (diff < 100)        distanceMiles = diff * 0.5;
  else if (diff < 1000)  distanceMiles = diff * 0.15;
  else if (diff < 5000)  distanceMiles = diff * 0.05;
  else                   distanceMiles = diff * 0.02;

  distanceMiles = Math.max(distanceMiles, 5);
  const driveTimeHours = distanceMiles / 45;

  return { distanceMiles, driveTimeHours };
}

// ─── Input Parsing ───────────────────────────────────────────────────────────

function parseYesNo(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const lower = value.trim().toLowerCase();
    return lower === 'yes' || lower === 'true' || lower === '1';
  }
  return Boolean(value);
}

function parseZip(value) {
  if (value == null) return null;
  const str = String(value).trim();
  if (/^\d{5}$/.test(str)) return str;
  const digits = str.replace(/\D/g, '').slice(0, 5);
  return digits.length === 5 ? digits : null;
}

// ─── Pricing Logic ───────────────────────────────────────────────────────────

function truckCharge(distanceMiles) {
  if (distanceMiles <= 50)  return 215;
  if (distanceMiles <= 100) return 275;
  if (distanceMiles <= 150) return 335;
  return 425;
}

function calculateQuote({ rooms, driveTimeHours, distanceMiles, packingNeeded, disposalNeeded }) {
  const rawHours = 2.0 + rooms * 0.75 + driveTimeHours;
  const totalHours = Math.ceil(rawHours / 0.25) * 0.25;

  const BASE_HOURS = 3;
  const BASE_RATE  = 825;
  const OVERTIME   = 170;

  let moveCost;
  if (totalHours <= BASE_HOURS) {
    moveCost = BASE_RATE;
  } else {
    moveCost = BASE_RATE + (totalHours - BASE_HOURS) * OVERTIME;
  }

  const packingCost  = packingNeeded  ? Math.round(moveCost * 0.5) : 0;
  const disposalCost = disposalNeeded ? 500 : 0;
  const truck        = truckCharge(distanceMiles);
  const totalCost    = moveCost + packingCost + disposalCost + truck;

  return { totalHours, moveCost, packingCost, disposalCost, truckCharge: truck, totalCost };
}

// ─── Response Formatters ─────────────────────────────────────────────────────

function spokenDollars(n) {
  return `$${n.toLocaleString('en-US')}`;
}

function buildVerbalScript(customerName, quote, distanceMiles, usingFallback) {
  const firstName = customerName || 'there';
  const { totalHours, moveCost, packingCost, disposalCost, truckCharge, totalCost } = quote;

  const miles = Math.round(distanceMiles);
  const hours = totalHours % 1 === 0 ? `${totalHours}` : `${totalHours}`;

  const lines = [
    `Great news, ${firstName}! I have your Clerk Moving Assistant estimate ready.`,
    `Based on roughly ${miles} miles of travel and your move details, we're estimating about ${hours} hours for the move.`,
    `Your base moving labor comes to ${spokenDollars(moveCost)}.`,
  ];

  if (packingCost > 0) {
    lines.push(`Our full packing service adds ${spokenDollars(packingCost)}.`);
  }
  if (disposalCost > 0) {
    lines.push(`The furniture disposal service is a flat ${spokenDollars(disposalCost)}.`);
  }

  lines.push(`The truck and distance surcharge for your move is ${spokenDollars(truckCharge)}.`);
  lines.push(`So your total estimated cost comes to ${spokenDollars(totalCost)}.`);
  lines.push(
    `This is an estimate based on the information you've provided. ` +
    `Actual costs may vary depending on the final inventory and access conditions at both locations.`
  );

  if (usingFallback) {
    lines.push(
      `I used an estimated distance for your quote today. ` +
      `A consultant will verify the exact mileage when confirming your booking.`
    );
  }

  return lines.join(' ');
}

function buildSmsBody(customerName, quote, distanceMiles, originZip, destinationZip) {
  const firstName = customerName || 'there';
  const { totalHours, moveCost, packingCost, disposalCost, truckCharge, totalCost } = quote;
  const miles = Math.round(distanceMiles);

  const lines = [
    `Hi ${firstName}! Here's your moving quote from Clerk Moving Assistant.`,
    ``,
    `${originZip} → ${destinationZip} (${miles} mi)`,
    `Estimated hours: ${totalHours}`,
    ``,
    `Quote Breakdown:`,
    `  Move labor:  ${spokenDollars(moveCost)}`,
  ];

  if (packingCost > 0)  lines.push(`  Packing:     ${spokenDollars(packingCost)}`);
  if (disposalCost > 0) lines.push(`  Disposal:    ${spokenDollars(disposalCost)}`);
  lines.push(`  Truck fee:   ${spokenDollars(truckCharge)}`);
  lines.push(`  ─────────────────`);
  lines.push(`  TOTAL:       ${spokenDollars(totalCost)}`);
  lines.push(``);
  lines.push(`Want to lock in your date? Call us at (415) 423-7212 or reply here.`);
  lines.push(`— Clerk Moving Assistant`);

  return lines.join('\n');
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const body = req.body || {};

  const originZip      = parseZip(body.originZip);
  const destinationZip = parseZip(body.destinationZip);

  if (!originZip || !destinationZip) {
    return res.status(400).json({ success: false, error: 'originZip and destinationZip are required (5-digit US ZIP)' });
  }

  const numRooms = parseInt(body.rooms, 10);
  if (isNaN(numRooms) || numRooms < 1 || numRooms > 20) {
    return res.status(400).json({ success: false, error: 'rooms must be a number between 1 and 20' });
  }

  const packingNeeded  = parseYesNo(body.packingNeeded);
  const disposalNeeded = parseYesNo(body.disposalNeeded);
  const customerName   = String(body.customerName  || '').trim();
  const customerEmail  = String(body.customerEmail || '').trim();

  let distanceMiles, driveTimeHours, usingFallback = false;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (apiKey) {
    try {
      ({ distanceMiles, driveTimeHours } = await getGoogleMapsDistance(originZip, destinationZip, apiKey));
    } catch (err) {
      console.error('Google Maps error, using fallback:', err.message);
      ({ distanceMiles, driveTimeHours } = fallbackDistance(originZip, destinationZip));
      usingFallback = true;
    }
  } else {
    console.warn('GOOGLE_MAPS_API_KEY not set — using fallback distance estimation');
    ({ distanceMiles, driveTimeHours } = fallbackDistance(originZip, destinationZip));
    usingFallback = true;
  }

  const quote = calculateQuote({
    rooms: numRooms,
    driveTimeHours,
    distanceMiles,
    packingNeeded,
    disposalNeeded,
  });

  const verbalScript = buildVerbalScript(customerName, quote, distanceMiles, usingFallback);
  const smsBody      = buildSmsBody(customerName, quote, distanceMiles, originZip, destinationZip);

  return res.status(200).json({
    success: true,
    distanceMiles: parseFloat(distanceMiles.toFixed(2)),
    driveTimeHours: parseFloat(driveTimeHours.toFixed(2)),
    usingFallbackDistance: usingFallback,
    quote: {
      totalHours:   quote.totalHours,
      moveCost:     quote.moveCost,
      packingCost:  quote.packingCost,
      disposalCost: quote.disposalCost,
      truckCharge:  quote.truckCharge,
      totalCost:    quote.totalCost,
    },
    verbalScript,
    smsBody,
    customerName,
    customerEmail,
  });
};
