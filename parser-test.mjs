const GST_RATE = 0.18;
const TDS_RATE = 0.10;

function parseAmount(value) {
  if (!value) return 0;
  return findMeaningfulAmounts(value)[0] || 0;
}

function findMeaningfulAmounts(text) {
  const amounts = [];
  const amountPattern = /(?:rs\.?|inr|₹)?\s*([0-9]{1,3}(?:,[0-9]{2,3})+|[0-9]+)(?:\.\d+)?(?:\s*\/-)?/gi;
  for (const match of text.matchAll(amountPattern)) {
    const raw = match[0];
    const numeric = Number(match[1].replaceAll(",", ""));
    if (!numeric) continue;
    const hasCurrencySignal = /rs\.?|inr|₹|,|\/-/i.test(raw);
    const looksLikeYear = numeric >= 1900 && numeric <= 2100 && !hasCurrencySignal;
    const looksLikeDay = numeric >= 1 && numeric <= 31 && !hasCurrencySignal;
    if (!looksLikeYear && !looksLikeDay) amounts.push(numeric);
  }
  return amounts;
}

function findFirstAmount(text) {
  const labelled = valueAfterLabel(text, [
    "Bank",
    "Bank\\s*(?:Amount\\s*)?(?:Received|Credit)",
    "Amount\\s*(?:Received|Credited)",
    "Received",
    "Credit",
    "Cr",
    "Deposit",
  ]);
  if (labelled) return parseAmount(labelled);

  const matches = findMeaningfulAmounts(text);
  return matches.length ? Math.max(...matches) : 0;
}

function valueAfterLabel(text, labels) {
  for (const label of labels) {
    const pattern = new RegExp(`(?:^|\\n)\\s*${label}\\b\\s*[:\\-]?\\s*([^\\n]+)`, "i");
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return "";
}

function normalizeDate(value) {
  const normalized = value.replaceAll("/", "-").replace(/\s+/g, "-");
  if (/^[A-Za-z]{3,9}-\d{4}$/.test(normalized)) {
    const [month, year] = normalized.split("-");
    const date = new Date(`${month} 1, ${year}`);
    if (Number.isNaN(date.getTime())) return value;
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).replaceAll(" ", "-");
  }
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replaceAll(" ", "-");
}

function parseMonth(text) {
  const labelled = valueAfterLabel(text, ["Months?", "Date", "Month"]);
  const source = labelled || text;
  const match = source.match(/\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4}|[A-Za-z]{3,9}\s+\d{4})\b/);
  return match ? normalizeDate(match[1]) : "";
}

function financialYear(dateText) {
  const date = new Date(dateText.replaceAll("-", " "));
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function billingPeriod(dateText) {
  const date = new Date(dateText.replaceAll("-", " "));
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month >= 3 && month <= 5) return `Apr-Jun ${year}`;
  if (month >= 6 && month <= 8) return `Jul-Sep ${year}`;
  if (month >= 9 && month <= 11) return `Oct-Dec ${year}`;
  return `Jan-Mar ${year}`;
}

function parseMessage(text) {
  const month = parseMonth(text);
  const billingText = valueAfterLabel(text, ["Bill", "Billing", "Lecture\\s*Fees?", "Fees?", "Billing\\s*Amount", "Amount"]);
  const bankText = valueAfterLabel(text, [
    "Bank",
    "Bank\\s*(?:Amount\\s*)?(?:Received|Credit)",
    "Amount\\s*(?:Received|Credited)",
    "Received",
    "Credit",
    "Cr",
    "Deposit",
  ]);
  const explicitlyBank = /\bbank\b/i.test(text);
  const explicitlyBill = /\bbill(?:ing)?\b/i.test(text);
  const hasBankReceipt = explicitlyBank || Boolean(bankText) || (!explicitlyBill && /\b(veranda|jk\s*shah|j\.?\s*k\.?\s*shah|credited|credit|cr|neft|rtgs|imps|upi)\b/i.test(text));
  const hasBilling = !hasBankReceipt && Boolean(billingText);
  const bankReceived = hasBankReceipt ? findFirstAmount(text) : 0;
  const billing = hasBilling ? parseAmount(billingText) : bankReceived / (1 + GST_RATE - TDS_RATE);
  const gst = billing * GST_RATE;
  const gross = billing + gst;
  const tds = billing * TDS_RATE;
  return {
    month,
    financialYear: financialYear(month),
    name: valueAfterLabel(text, ["Full\\s*Name", "Name", "Faculty", "Teacher"]),
    billing,
    gst,
    gross,
    tds,
    bank: hasBilling ? gross - tds : bankReceived,
  };
}

const message = `Months : 31 May 2026
Name : Dilip Vishwakarma
Lecture Fees : 192,000`;

const parsed = parseMessage(message);
console.log(JSON.stringify(parsed, null, 2));

if (
  parsed.month !== "31-May-2026" ||
  parsed.financialYear !== "2026-27" ||
  parsed.name !== "Dilip Vishwakarma" ||
  parsed.billing !== 192000 ||
  parsed.gst !== 34560 ||
  parsed.gross !== 226560 ||
  parsed.tds !== 19200 ||
  parsed.bank !== 207360
) {
  throw new Error("Parser calculation test failed");
}

const realMessage = `Full Name:       Dilip Vishwakarma
March 2026
Lecture Fees : Rs  81000`;

const realParsed = parseMessage(realMessage);
console.log(JSON.stringify(realParsed, null, 2));

if (
  realParsed.month !== "31-Mar-2026" ||
  realParsed.financialYear !== "2025-26" ||
  realParsed.name !== "Dilip Vishwakarma" ||
  realParsed.billing !== 81000 ||
  realParsed.gst !== 14580 ||
  realParsed.gross !== 95580 ||
  realParsed.tds !== 8100 ||
  realParsed.bank !== 87480
) {
  throw new Error("Real message parser calculation test failed");
}

const bankMessage = "Veranda credited Rs 87480 for March 2026";
const bankParsed = parseMessage(bankMessage);
console.log(JSON.stringify(bankParsed, null, 2));

if (
  bankParsed.month !== "31-Mar-2026" ||
  bankParsed.financialYear !== "2025-26" ||
  Math.round(bankParsed.billing) !== 81000 ||
  Math.round(bankParsed.gst) !== 14580 ||
  Math.round(bankParsed.gross) !== 95580 ||
  Math.round(bankParsed.tds) !== 8100 ||
  bankParsed.bank !== 87480
) {
  throw new Error("Bank receipt reverse calculation test failed");
}

const amountFormats = [
  ["Lecture Fees : Rs 81,000", 81000],
  ["Lecture Fees : Rs 81000", 81000],
  ["Lecture Fees : 81,000", 81000],
  ["Lecture Fees : 81000", 81000],
  ["Lecture Fees 81000", 81000],
  ["Lecture Fees INR 81,000/-", 81000],
  ["Veranda credited 87480 for March 2026", 87480],
  ["JK Shah Classes CR Rs 87,480 March 2026", 87480],
  ["Amount Received: 87480", 87480],
  ["Amount Credited INR 87,480/- for March 2026", 87480],
];

for (const [line, expected] of amountFormats) {
  const amount = /lecture/i.test(line)
    ? parseAmount(valueAfterLabel(line, ["Lecture\\s*Fees?", "Fees?", "Billing\\s*Amount", "Amount"]))
    : findFirstAmount(line);
  console.log(`${line} => ${amount}`);
  if (amount !== expected) throw new Error(`Amount format failed: ${line}`);
}

const fyBoundaries = [
  ["March 2026", "31-Mar-2026", "2025-26", "Jan-Mar 2026"],
  ["April 2026", "30-Apr-2026", "2026-27", "Apr-Jun 2026"],
  ["31 March 2026", "31-Mar-2026", "2025-26", "Jan-Mar 2026"],
  ["1 April 2026", "01-Apr-2026", "2026-27", "Apr-Jun 2026"],
  ["May 2026", "31-May-2026", "2026-27", "Apr-Jun 2026"],
  ["June 2026", "30-Jun-2026", "2026-27", "Apr-Jun 2026"],
];

for (const [input, expectedDate, expectedFy, expectedPeriod] of fyBoundaries) {
  const parsedMonth = parseMonth(input);
  const parsedFy = financialYear(parsedMonth);
  const parsedPeriod = billingPeriod(parsedMonth);
  console.log(`${input} => ${parsedMonth}, ${parsedFy}, ${parsedPeriod}`);
  if (parsedMonth !== expectedDate || parsedFy !== expectedFy || parsedPeriod !== expectedPeriod) {
    throw new Error(`Financial year boundary failed: ${input}`);
  }
}

const bankKeyword = parseMessage(`Bank 87480
March 2026`);
console.log(JSON.stringify(bankKeyword, null, 2));
if (Math.round(bankKeyword.billing) !== 81000 || bankKeyword.bank !== 87480) {
  throw new Error("Bank keyword reverse calculation failed");
}

const billKeyword = parseMessage(`Bill 81000
March 2026`);
console.log(JSON.stringify(billKeyword, null, 2));
if (billKeyword.billing !== 81000 || billKeyword.bank !== 87480) {
  throw new Error("Bill keyword forward calculation failed");
}
