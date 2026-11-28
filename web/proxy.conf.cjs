const target = process.env.CAMBA_DEV_API_ORIGIN ?? 'http://127.0.0.1:8000';

module.exports = {
  '/api/**': { target },
  '/sanctum/**': { target },
  '/email/verify/**': { target },
  '/storage/**': { target },
};
