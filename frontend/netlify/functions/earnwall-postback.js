// EarnWall postback receiver.
// EarnWall calls: GET /.netlify/functions/earnwall-postback?subId=...&transId=...&reward=...&status=...&signature=...
// This function forwards all params to the NestJS backend which validates
// the MD5 signature and credits AP. Response must be exactly "ok".

exports.handler = async (event) => {
  const backendUrl =
    process.env.BACKEND_URL ||
    'https://ai119-bot-production.up.railway.app';

  const params = event.queryStringParameters || {};
  const query = new URLSearchParams(params).toString();

  try {
    const res = await fetch(`${backendUrl}/api/earnwall/postback?${query}`);
    const body = await res.text();

    if (body === 'ok') {
      return { statusCode: 200, body: 'ok' };
    }
    return { statusCode: 400, body: body || 'ERROR' };
  } catch (err) {
    console.error('[EarnWall postback] fetch error:', err);
    return { statusCode: 500, body: 'ERROR' };
  }
};
