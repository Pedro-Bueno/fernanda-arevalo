// netlify/functions/crear-pago.js
exports.handler = async (event) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Metodo no permitido' }) };
  }

  try {
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    if (!ACCESS_TOKEN) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Falta MP_ACCESS_TOKEN' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { total, descripcion, pedido_id, email } = body;

    const monto = Number(total);
    if (!monto || isNaN(monto) || monto <= 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Monto invalido' }) };
    }
    if (!pedido_id || typeof pedido_id !== 'string') {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Falta pedido_id' }) };
    }

    const SITE_URL = process.env.URL || 'https://fernandaarevalo.netlify.app';

    const preference = {
      items: [{
        id: pedido_id,
        title: (descripcion || 'Tratamiento - Dra. Fernanda Arevalo').slice(0, 250),
        description: 'Pago de tratamiento medico estetico',
        quantity: 1,
        currency_id: 'MXN',
        unit_price: Number(monto.toFixed(2)),
      }],
      payer: email ? { email: String(email).slice(0, 254) } : undefined,
      external_reference: pedido_id,
      statement_descriptor: 'DRA FERNANDA AREVALO',
      back_urls: {
        success: SITE_URL + '/pago-exitoso.html?ref=' + encodeURIComponent(pedido_id),
        pending: SITE_URL + '/pago-pendiente.html?ref=' + encodeURIComponent(pedido_id),
        failure: SITE_URL + '/pago-error.html?ref=' + encodeURIComponent(pedido_id),
      },
      auto_return: 'approved',
      metadata: { pedido_id: pedido_id, clinica: 'Dra. Fernanda Arevalo' },
      payment_methods: { excluded_payment_types: [], installments: 12 },
    };

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + ACCESS_TOKEN,
        'X-Idempotency-Key': pedido_id + '-' + Date.now(),
      },
      body: JSON.stringify(preference),
    });

    const data = await mpRes.json();

    if (!mpRes.ok) {
      console.error('Error de Mercado Pago:', data);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ error: 'No se pudo generar el pago', detalle: data.message || 'Error desconocido' }),
      };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ url: data.init_point, preference_id: data.id, pedido_id: pedido_id }),
    };

  } catch (err) {
    console.error('Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error interno', detalle: err.message }) };
  }
};
