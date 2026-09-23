const { authorize } = require('./_auth');
const CH_ID = process.env.YOUTUBE_CHANNEL_ID;
const YT_KEY = process.env.YOUTUBE_API_KEY;

const MOCK = [
  { videoId:'dQw4w9WgXcQ', title:'Deccan Birders — Waterfowl Census 2025', thumbnail:'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', duration:'8:24', views:'1.2K' },
  { videoId:'dQw4w9WgXcQ', title:'Bird Race 2024 Highlights', thumbnail:'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', duration:'12:05', views:'847' },
  { videoId:'dQw4w9WgXcQ', title:'Purple Sunbird — Behaviour Study', thumbnail:'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg', duration:'4:33', views:'2.4K' }
];

function formatDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const h = parseInt(m[1] || 0), min = parseInt(m[2] || 0), s = parseInt(m[3] || 0);
  return h > 0 ? `${h}:${String(min).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${min}:${String(s).padStart(2, '0')}`;
}

function formatViews(n) {
  const v = parseInt(n);
  return v >= 1000000 ? (v / 1000000).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(1) + 'K' : String(v);
}

module.exports = async (req, res) => {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (!authorize(req, res)) return;

  try {
    if (!CH_ID) {
      res.json({ mock: true, data: MOCK });
      return;
    }

    const chRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CH_ID}&key=${YT_KEY}`).then(r => r.json());
    if (chRes.error || !chRes.items || !chRes.items.length) {
      res.json({ error: true, message: (chRes.error && chRes.error.message) || 'YouTube channel not found' });
      return;
    }
    const uploadsId = chRes.items[0].contentDetails.relatedPlaylists.uploads;

    const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsId}&maxResults=12&key=${YT_KEY}`).then(r => r.json());
    const items = plRes.items || [];
    const videoIds = items.map(i => i.snippet.resourceId.videoId).join(',');

    const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds}&key=${YT_KEY}`).then(r => r.json());
    const meta = {};
    (vRes.items || []).forEach(v => { meta[v.id] = v; });

    const data = items.map(i => {
      const vid = i.snippet.resourceId.videoId;
      const m = meta[vid] || {};
      return {
        videoId:   vid,
        title:     i.snippet.title,
        thumbnail: `https://img.youtube.com/vi/${vid}/hqdefault.jpg`,
        duration:  m.contentDetails ? formatDuration(m.contentDetails.duration) : '?',
        views:     m.statistics ? formatViews(m.statistics.viewCount) : '?'
      };
    });

    res.setHeader('Cache-Control', 'public, s-maxage=21600');
    res.json({ data });
  } catch (e) {
    res.json({ error: true, message: e.message });
  }
};
