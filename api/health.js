module.exports = (req, res) => {
  res.json({
    ebird:    !!process.env.EBIRD_API_KEY,
    calendar: !!process.env.GOOGLE_CALENDAR_ID,
    youtube:  !!process.env.YOUTUBE_CHANNEL_ID,
    ts:       Date.now()
  });
};
