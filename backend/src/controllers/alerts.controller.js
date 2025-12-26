const { executeTrinoQuery } = require('../services/trino.service');

/**
 * Lấy danh sách Alert thời gian thực từ bảng Bronze
 * Sử dụng ai_timestamp làm ID vì bảng không có cột event_id
 */
const getBronzeAlerts = async (req, res) => {
  try {
    const query = `
      SELECT 
        ai_timestamp, camera_id, event_time, score, risk_level, is_violent, evidence_url, ward
      FROM iceberg.default.bronzeviolence
      ORDER BY event_time DESC
      LIMIT 50
    `;

    const rawData = await executeTrinoQuery(query);

    const alerts = rawData.map(row => ({
      event_id: row[0],     
      camera_id: row[1],    
      timestamp: row[2],    
      score: row[3] ? parseFloat(row[3]) : 0, 
      label: row[4],        
      is_violent: row[5],   
      frame_url: row[6],
      ward: row[7] // Lấy cột ward từ kết quả query
    }));

    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch bronze alerts' });
  }
};
/**
 * Xóa một sự kiện khỏi database dựa trên ai_timestamp
 * Yêu cầu bảng bronzeviolence phải là Iceberg v2
 */
const deleteAlert = async (req, res) => {
  try {
    const { id } = req.params; // Đây chính là ai_timestamp gửi từ frontend

    if (!id) {
      return res.status(400).json({ error: 'Event ID (ai_timestamp) is required' });
    }

    const query = `DELETE FROM iceberg.default.bronzeviolence WHERE ai_timestamp = '${id}'`;
    
    await executeTrinoQuery(query);

    res.json({ 
      message: 'Event deleted successfully from Bronze layer',
      event_id: id 
    });
  } catch (err) {
    console.error('Delete Alert Error:', err.message);
    res.status(500).json({ 
      error: 'Delete failed', 
      details: 'Ensure Iceberg table is v2. Run: ALTER TABLE bronzeviolence SET PROPERTIES (format_version=2)' 
    });
  }
};

/**
 * Logic cho trang Dashboard chính (Star Schema)
 */
const getLiveAlerts = async (req, res) => {
  try {
    const query = `
      SELECT 
        f.fact_id, c.camera_id, l.street, l.district, 
        f.window_start, f.evidence_url, f.max_risk_score
      FROM iceberg.default.fact_camera_monitoring AS f
      LEFT JOIN iceberg.default.dim_camera AS c ON f.camera_key = c.camera_key
      LEFT JOIN iceberg.default.dim_location AS l ON f.location_key = l.location_key
      WHERE f.is_violent_window = true
      ORDER BY f.window_start DESC
      LIMIT 20
    `;

    const rawData = await executeTrinoQuery(query);
    const alerts = rawData.map(row => ({
      event_id: row[0],
      location: `${row[1]} - ${row[2]}, ${row[3]}`, 
      timestamp: row[4], 
      frame_url: row[5] || 'https://via.placeholder.com/640x360?text=No+Evidence',
      label: 'Violence Detected',
      violence_score: parseFloat(row[6]).toFixed(4), 
      status: 'Unreviewed'
    }));

    res.json(alerts);
  } catch (err) {
    console.error('Live Alerts Error:', err.message);
    res.status(500).json({ error: 'Live alerts query failed' });
  }
};

module.exports = { 
  getLiveAlerts, 
  getBronzeAlerts, 
  deleteAlert 
};