const axios = require('axios');
const config = require('../config');

/**
 * Hàm thực thi SQL dùng chung cho Trino (hỗ trợ SELECT, DELETE, v.v.)
 */
const executeTrinoQuery = async (query) => {
  try {
    // 1. Gửi query ban đầu
    const response = await axios.post(
      `http://${config.trino.host}:${config.trino.port}/v1/statement`,
      query,
      {
        headers: {
          'X-Trino-User': config.trino.user,
          'X-Trino-Catalog': config.trino.catalog,
          'X-Trino-Schema': config.trino.schema,
        },
      }
    );

    let data = [];
    let nextUri = response.data.nextUri;
    
    // Lấy data ngay từ response đầu tiên (nếu có)
    if (response.data.data) {
      data = data.concat(response.data.data);
    }

    // 2. Loop để lấy hết các trang kết quả hoặc đợi query DELETE hoàn tất
    while (nextUri) {
      const nextRes = await axios.get(nextUri, {
        headers: {
          'X-Trino-User': config.trino.user,
          'X-Trino-Catalog': config.trino.catalog,
          'X-Trino-Schema': config.trino.schema,
        },
      });
      
      // Kiểm tra lỗi SQL trong quá trình thực thi
      if (nextRes.data.error) {
        console.error("Trino SQL Error:", nextRes.data.error);
        throw new Error(`Trino Error: ${nextRes.data.error.message}`);
      }

      if (nextRes.data.data) {
        data = data.concat(nextRes.data.data);
      }

      nextUri = nextRes.data.nextUri;

      // Tránh spam request quá nhanh nếu Trino đang xử lý
      if (nextUri) await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return data;
  } catch (error) {
    console.error('Trino Service Error:', error.response?.data || error.message);
    throw error;
  }
};

module.exports = { executeTrinoQuery };