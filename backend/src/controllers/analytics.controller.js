const { executeTrinoQuery } = require('../services/trino.service');

const getAnalyticsData = async (req, res) => {
  try {
    const query = `
      SELECT 
        f.window_start, l.district, l.ward, c.camera_id,
        f.is_violent_window, f.max_risk_score, f.total_duration_sec,
        f.avg_fps, f.avg_latency_ms, f.alert_count
      FROM iceberg.default.fact_camera_monitoring AS f
      LEFT JOIN iceberg.default.dim_location AS l ON f.location_key = l.location_key
      LEFT JOIN iceberg.default.dim_camera AS c ON f.camera_key = c.camera_key
      ORDER BY f.window_start DESC
      LIMIT 1000
    `;

    const rawData = await executeTrinoQuery(query);

    // Map dữ liệu cho Frontend Recharts
    const analyticsData = rawData.map(row => ({
      timestamp: row[0],
      district: row[1] || 'Unknown',
      ward: row[2] || 'Unknown',
      camera_id: row[3],
      is_violent: row[4],
      risk_score: row[5] ? parseFloat(row[5]) : 0,
      duration: row[6] ? parseFloat(row[6]) : 0,
      fps: row[7] ? parseFloat(row[7]) : 0,
      latency: row[8] ? parseFloat(row[8]) : 0,
      alert_count: row[9] ? parseInt(row[9]) : 0
    }));

    res.json(analyticsData);

  } catch (err) {
    console.error('Analytics Controller Error:', err.message);
    res.status(500).json({ error: 'Analytics Query failed' });
  }
};

module.exports = { getAnalyticsData };