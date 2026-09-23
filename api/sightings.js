const KEY = process.env.EBIRD_API_KEY;
const BASE = 'https://api.ebird.org/v2';
const headers = { 'X-eBirdApiToken': KEY };

async function ebird(path) {
  const res = await fetch(BASE + path, { headers });
  return res.json();
}

function mapRecord(r) {
  return {
    species:    r.comName,
    scientific: r.sciName,
    // eBird's own code for the species ("indpit1"). The site uses it to
    // link a record through to that species' page on ebird.org.
    speciesCode: r.speciesCode,
    count:      r.howMany ?? '?',
    locality:   r.locName,
    locId:      r.locId,
    when:       r.obsDt,
    lat:        r.lat,
    lng:        r.lng,
    status:     r.obsValid ? 'Confirmed' : 'Under review',
    rare:       r.obsReviewed === false
  };
}

const MOCK = [
  { species:'Purple Sunbird', scientific:'Cinnyris asiaticus', count:3, locality:'Hussain Sagar', locId:'L123', when:'2026-09-12 07:30', lat:17.41, lng:78.47, status:'Confirmed', rare:false },
  { species:'Indian Roller', scientific:'Coracias benghalensis', count:1, locality:'KBR Park', locId:'L124', when:'2026-09-12 06:15', lat:17.41, lng:78.43, status:'Confirmed', rare:false },
  { species:'Black-crowned Night Heron', scientific:'Nycticorax nycticorax', count:2, locality:'Ameenpur Lake', locId:'L125', when:'2026-09-11 18:45', lat:17.51, lng:78.33, status:'Confirmed', rare:false },
  { species:'Painted Stork', scientific:'Mycteria leucocephala', count:12, locality:'Sultanpur Lake', locId:'L126', when:'2026-09-11 07:00', lat:17.39, lng:78.29, status:'Confirmed', rare:false }
];

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (!KEY) {
      res.json({ mock: true, data: MOCK });
      return;
    }

    const region = req.query.region || 'IN';
    const tab = req.query.tab;

    if (tab === 'recent') {
      // 30 days is eBird's maximum for this endpoint. The species lookup
      // on the site searches this feed, so the window is also how far
      // back "where can I see it now" can see.
      const data = await ebird(`/data/obs/${region}/recent?back=30`);
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
      res.json({ data: data.map(mapRecord) });
      return;
    }

    if (tab === 'notable') {
      const data = await ebird(`/data/obs/${region}/recent/notable?detail=full`);
      res.setHeader('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=1800');
      res.json({ data: data.map(mapRecord) });
      return;
    }

    if (tab === 'hotspots') {
      const data = await ebird(`/ref/hotspot/${region}?fmt=json`);
      const top5 = data
        .sort((a, b) => b.numSpeciesAllTime - a.numSpeciesAllTime)
        .slice(0, 5)
        .map(h => ({ locId: h.locId, name: h.locName, species: h.numSpeciesAllTime, checklists: h.numChecklists, lat: h.lat, lng: h.lng }));
      res.setHeader('Cache-Control', 'public, s-maxage=86400');
      res.json({ data: top5 });
      return;
    }

    // Every species ever recorded in the region, name and code only. The
    // site's species lookup searches this so that a bird nobody has
    // reported lately is still findable — it can then say "no records in
    // the last 30 days" and link to eBird, rather than claiming no such
    // species exists. India is ~1,400 of the taxonomy's ~17,000 rows.
    if (tab === 'taxonomy') {
      const [codes, taxonomy] = await Promise.all([
        ebird(`/product/spplist/${region}`),
        ebird('/ref/taxonomy/ebird?fmt=json&cat=species'),
      ]);
      if (!Array.isArray(codes) || !Array.isArray(taxonomy)) {
        res.status(502).json({ error: true, message: 'eBird did not return a species list' });
        return;
      }
      const wanted = new Set(codes);
      const data = taxonomy
        .filter(t => wanted.has(t.speciesCode))
        .map(t => ({ species: t.comName, scientific: t.sciName, speciesCode: t.speciesCode }));
      res.setHeader('Cache-Control', 'public, s-maxage=604800, stale-while-revalidate=86400');
      res.json({ data });
      return;
    }

    if (tab === 'hotspot_species') {
      const { locId } = req.query;
      const data = await ebird(`/product/spplist/${locId}`);
      res.setHeader('Cache-Control', 'public, s-maxage=86400');
      res.json({ data });
      return;
    }

    if (tab === 'onthisday') {
      const m = req.query.m || String(new Date().getMonth() + 1).padStart(2, '0');
      const d = req.query.d || String(new Date().getDate()).padStart(2, '0');
      const year = new Date().getFullYear();
      const years = Array.from({ length: 10 }, (_, i) => year - i);
      const results = await Promise.all(
        years.map(y => ebird(`/data/obs/${region}/historic/${y}/${m}/${d}`).catch(() => []))
      );
      const flat = results.flat().map(mapRecord);
      const best = {};
      flat.forEach(r => {
        if (!best[r.species] || (r.count !== '?' && r.count > best[r.species].count)) best[r.species] = r;
      });
      const top20 = Object.values(best).sort((a, b) => b.count - a.count).slice(0, 20);
      res.setHeader('Cache-Control', 'public, s-maxage=86400');
      res.json({ data: top20 });
      return;
    }

    if (tab === 'lookup') {
      const { speciesCode } = req.query;
      if (!speciesCode) {
        res.status(400).json({ error: true, message: 'speciesCode is required' });
        return;
      }
      // dist is capped at 50 km by eBird and back at 30 days; asking for
      // more makes it return an error object rather than a list.
      const data = await ebird(`/data/nearest/geo/recent/${speciesCode}?lat=17.385&lng=78.4867&dist=50&back=30`);
      if (!Array.isArray(data)) {
        res.status(502).json({ error: true, message: data.errors?.[0]?.title || 'eBird rejected the request' });
        return;
      }
      res.setHeader('Cache-Control', 'public, s-maxage=900');
      res.json({ data: data.map(mapRecord) });
      return;
    }

    // An unknown tab used to fall through to MOCK, which handed the site
    // four invented sightings that looked entirely real. Mock data is for
    // a missing API key during setup, not for a typo in a query string.
    res.status(400).json({ error: true, message: `Unknown tab: ${tab || '(none)'}` });
  } catch (e) {
    res.json({ error: true, message: e.message });
  }
};
