/**
 * Cashfree Payment Gateway Service (React Native / iOS / Android)
 * API Version: 2025-01-01
 * Supports:
 *  - Create Order
 *  - Verify Payment
 *  - Refund Payment
 */

const https = require("https");
const http = require("http");

// Environment Variables
const CASHFREE_APP_ID = process.env.CASHFREE_APP_ID;
const CASHFREE_SECRET_KEY = process.env.CASHFREE_SECRET_KEY;
const CASHFREE_ENV = process.env.CASHFREE_ENV || "TEST"; // TEST | PROD

// Cashfree PG Base URL
const BASE_URL =
  CASHFREE_ENV === "PROD"
    ? "https://api.cashfree.com/pg"
    : "https://sandbox.cashfree.com/pg";

// Latest API Version
const API_VERSION = "2025-01-01";

/**
 * Generic Cashfree Request Helper
 */
function cashfreeRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${BASE_URL}${endpoint}`);
    const transport = url.protocol === "https:" ? https : http;

    const bodyString = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method,
      headers: {
        "x-client-id": CASHFREE_APP_ID,
        "x-client-secret": CASHFREE_SECRET_KEY,
        "x-api-version": API_VERSION,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    };

    if (bodyString) {
      options.headers["Content-Length"] = Buffer.byteLength(bodyString);
    }

    // Debug Logs (Remove in Production)
    console.log("Cashfree URL:", `${BASE_URL}${endpoint}`);
    console.log("Cashfree Headers:", options.headers);
    console.log("Cashfree Payload:", body);

    const req = transport.request(options, (res) => {
      let response = "";

      res.on("data", (chunk) => {
        response += chunk;
      });

      res.on("end", () => {
        try {
          const json = JSON.parse(response);

          console.log("Cashfree Response:", json);

          if (res.statusCode >= 400) {
            return reject({
              statusCode: res.statusCode,
              error: json,
            });
          }

          resolve(json);
        } catch (err) {
          reject({
            statusCode: res.statusCode,
            error: response,
          });
        }
      });
    });

    req.on("error", (err) => reject(err));

    if (bodyString) {
      req.write(bodyString);
    }

    req.end();
  });
}

// Initialize Cashfree order session for React Native SDK drop-in UI
async function createCashfreeOrder(order, user) {
  const payload = {
    order_id: order.id,
    order_amount: Number(order.total_amount),
    order_currency: "INR",

    customer_details: {
      customer_id: String(user.id),
      customer_name: user.name || "Customer",
      customer_email:
        user.email || `user_${user.id}@dailymeat.in`,
      customer_phone: String(user.phone),
    },

    order_meta: {
      notify_url: `${process.env.APP_BASE_URL}/api/payments/webhook`,
      return_url:
        "dailymeat://payment-success?order_id={order_id}",
    },

    order_note: "Daily Meat Order",
  };

  const response = await cashfreeRequest(
    "POST",
    "/orders",
    payload
  );

  return {
    cf_order_id: response.cf_order_id,
    payment_session_id: response.payment_session_id,
    order_status: response.order_status,
  };
}

// Check Cashfree payment status by Order ID
async function verifyPayment(orderId) {
  return cashfreeRequest("GET", `/orders/${orderId}`);
}

// Fetch all payment attempt transactions for an order
async function getPaymentDetails(orderId) {
  return cashfreeRequest(
    "GET",
    `/orders/${orderId}/payments`
  );
}

// Trigger instant refund to customer's original payment source
async function initiateRefund(orderId, amount, refundId) {
  const payload = {
    refund_amount: Number(amount),
    refund_id: refundId,
    refund_note: "Customer cancelled the order",
  };

  return cashfreeRequest(
    "POST",
    `/orders/${orderId}/refunds`,
    payload
  );
}

module.exports = {
  createCashfreeOrder,
  verifyPayment,
  getPaymentDetails,
  initiateRefund,
};