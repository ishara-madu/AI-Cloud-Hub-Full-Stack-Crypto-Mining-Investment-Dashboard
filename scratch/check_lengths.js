// Test JSON lengths for both old and new responses to find which equals 123 bytes

const testOldResponse = (url, usd, rate) => {
  return JSON.stringify({
    invoice_url: url,
    usd_amount: usd,
    exchange_rate: rate
  }).length;
};

const testNewResponse = (addr, amt, cur, pid, usd, rate) => {
  return JSON.stringify({
    pay_address: addr,
    pay_amount: amt,
    pay_currency: cur,
    payment_id: pid,
    usd_amount: usd,
    exchange_rate: rate
  }).length;
};

console.log("=== Old Format (using Invoice URL) ===");
// Example typical URLs and rates
console.log("Invoice 46-char URL, rate 300.0:", testOldResponse("https://nowpayments.io/payment?iid=5552399222", 3.33, 300.0));
console.log("Invoice 60-char URL, rate 300.0:", testOldResponse("https://api.nowpayments.io/invoice?id=5552399222", 3.33, 300.0));
console.log("Invoice 66-char URL, rate 299.12345:", testOldResponse("https://invoice.nowpayments.io/invoice?id=5552399222", 3.33, 299.12345));

console.log("\n=== New Format (On-Site Details) ===");
console.log("New format with BTC (34-char addr):", testNewResponse("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", 0.0005, "btc", "5552399222", 3.33, 300.0));
console.log("New format with USDT (34-char addr):", testNewResponse("TL6bxzyp83920194857201934857291034", 3.33, "usdttrc20", "5552399222", 3.33, 300.0));
console.log("New format with USDT (minimum size):", testNewResponse("TL6bxzyp83920194857201934857291034", 3, "usdttrc20", "555239", 3, 300));
