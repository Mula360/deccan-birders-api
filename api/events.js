const CAL_ID = process.env.GOOGLE_CALENDAR_ID;
const API_KEY = process.env.GOOGLE_API_KEY;

const MOCK = [
  { id:'1', title:'Field Trip — Ameenpur Lake', place:'Ameenpur Lake, Hyderabad', date:'2026-10-11T06:00:00+05:30', note:'Bring water and binoculars. Loaner bins available.', loanerBins:true, fee:null },
  { id:'2', title:'Monthly Bird Walk — KBR Park', place:'KBR National Park, Gate 1', date:'2026-10-18T06:30:00+05:30', note:'Easy walk, suitable for beginners.', loanerBins:false, fee:null },
  { id:'3', title:'Waterfowl Pre-census Survey', place:'Hussain Sagar Lake', date:'2026-11-02T06:00:00+05:30', note:'Census preparation trip. ₹50 contribution.', loanerBins:false, fee:50 }
];

function extractFee(desc) {
  const match = (desc || '').match(/₹\s*(\d+)/);
  return match ? parseInt(match[1]) : null;
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (!CAL_ID) {
      res.json({ mock: true, data: MOCK });
      return;
    }

    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL_ID)}/events`
      + `?key=${API_KEY}&timeMin=${new Date().toISOString()}&singleEvents=true&orderBy=startTime&maxResults=12`;

    const raw = await fetch(url).then(r => r.json());
    if (raw.error) {
      res.json({ error: true, message: raw.error.message || 'Google Calendar API error' });
      return;
    }
    const data = (raw.items || []).map(e => ({
      id:         e.id,
      title:      e.summary || '',
      place:      e.location || '',
      date:       e.start.dateTime || e.start.date,
      endDate:    e.end.dateTime || e.end.date,
      note:       e.description || '',
      loanerBins: (e.description || '').toLowerCase().includes('loaner'),
      fee:        extractFee(e.description)
    }));

    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    res.json({ data });
  } catch (e) {
    res.json({ error: true, message: e.message });
  }
};
