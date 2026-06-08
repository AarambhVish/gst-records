const GST_RATE = 0.18;
const TDS_RATE = 0.10;
const SESSION_KEY = "gst-records-active-user";
const MASTER_STORAGE_KEY = "gst-records-master-v1";
const USERS = {
  DV: {
    id: "DV",
    name: "Dilip Vishwakarma",
    address: "B32 303 SCN, Thakur Complex, Kandivali-East, Mumbai 400101",
    pan: "AEEPV1448M",
    gstin: "27AEEPV1448M1Z2",
    signature: "Dilip",
  },
  SG: {
    id: "SG",
    name: "SG",
    address: "",
    pan: "",
    gstin: "",
    signature: "SG",
  },
};

const DEFAULT_BILL_TO = {
  name: "J. K. Shah Classes (Unit of Veranda XL Learning Solutions Private Limited)",
  addressLines: [
    "1,3,4,5, 504, Shraddha Building, Old",
    "Nagardas Road, Andheri East, Mumbai,",
    "Mumbai Suburban, Maharashtra, 400069",
  ],
  gstin: "27AARCA7516R1ZR",
  placeOfService: "Maharashtra",
  hsnSac: "999293",
};

const loginView = document.querySelector("#loginView");
const appView = document.querySelector("#appView");
const loginId = document.querySelector("#loginId");
const loginButton = document.querySelector("#loginButton");
const loginError = document.querySelector("#loginError");
const logoutButton = document.querySelector("#logoutButton");
const activeUserName = document.querySelector("#activeUserName");
const messageBox = document.querySelector("#messageBox");
const addRecordButton = document.querySelector("#addRecord");
const exportButton = document.querySelector("#exportCsv");
const downloadBackupButton = document.querySelector("#downloadBackup");
const restoreBackupButton = document.querySelector("#restoreBackup");
const restoreFile = document.querySelector("#restoreFile");
const saveStatus = document.querySelector("#saveStatus");
const parsedGrid = document.querySelector("#parsedGrid");
const parsedCard = document.querySelector("#parsedCard");
const recordsBody = document.querySelector("#recordsBody");
const recordCount = document.querySelector("#recordCount");
const editModal = document.querySelector("#editModal");
const editForm = document.querySelector("#editForm");
const closeEdit = document.querySelector("#closeEdit");
const cancelEdit = document.querySelector("#cancelEdit");
const editMonth = document.querySelector("#editMonth");
const editName = document.querySelector("#editName");
const editHours = document.querySelector("#editHours");
const editSource = document.querySelector("#editSource");
const editAmount = document.querySelector("#editAmount");
const editStatus = document.querySelector("#editStatus");
const editFilingForm = document.querySelector("#editFilingForm");
const editFilingDueDate = document.querySelector("#editFilingDueDate");
const editPreview = document.querySelector("#editPreview");

const moneyFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 2,
});

let activeUser = null;
let records = [];
let editingRecordId = null;

function storageKeyFor(userId) {
  return `gst-records-v2-${userId}`;
}

function loadRecords() {
  try {
    const current = readStoredRecords(storageKeyFor(activeUser.id));
    const backup = readStoredRecords(`gst-records-backup-${activeUser.id}`);
    const master = readMasterRecords(activeUser.id);
    const history = readHistoryRecords(activeUser.id);
    const legacy = activeUser.id === "DV" ? readStoredRecords("gst-records-v1") : [];
    const starter = activeUser.id === "DV" && current.length === 0 && backup.length === 0 && master.length === 0 && history.length === 0 && legacy.length === 0 ? [{
      id: crypto.randomUUID(),
      month: "31-May-2026",
      financialYear: "2026-27",
      name: "Dilip Vishwakarma",
      hours: 0,
      billing: 192000,
      gst: 34560,
      gross: 226560,
      tds: 19200,
      bank: 207360,
      status: "Unpaid",
      createdAt: new Date().toISOString(),
    }] : [];
    const merged = normalizeRecords(uniqueRecords([...master, ...current, ...backup, ...history, ...legacy, ...starter]));
    writeRecordsEverywhere(activeUser.id, merged);
    return merged;
  } catch {
    return [];
  }
}

function readStoredRecords(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]") || [];
  } catch {
    return [];
  }
}

function readMaster() {
  try {
    return JSON.parse(localStorage.getItem(MASTER_STORAGE_KEY) || "{}") || {};
  } catch {
    return {};
  }
}

function readMasterRecords(userId) {
  const master = readMaster();
  return Array.isArray(master[userId]) ? master[userId] : [];
}

function readHistoryRecords(userId) {
  try {
    const snapshots = JSON.parse(localStorage.getItem(`gst-records-history-${userId}`) || "[]") || [];
    return snapshots.flatMap((snapshot) => Array.isArray(snapshot.records) ? snapshot.records : []);
  } catch {
    return [];
  }
}

function writeRecordsEverywhere(userId, list) {
  const normalized = normalizeRecords(uniqueRecords(list));
  localStorage.setItem(storageKeyFor(userId), JSON.stringify(normalized));
  localStorage.setItem(`gst-records-backup-${userId}`, JSON.stringify(normalized));
  const master = readMaster();
  master[userId] = normalized;
  localStorage.setItem(MASTER_STORAGE_KEY, JSON.stringify(master));
  writeHistorySnapshot(userId, normalized);
  verifySaved(userId, normalized.length);
}

function verifySaved(userId, expectedCount) {
  const profileCount = readStoredRecords(storageKeyFor(userId)).length;
  const backupCount = readStoredRecords(`gst-records-backup-${userId}`).length;
  const masterCount = readMasterRecords(userId).length;
  const saved = profileCount >= expectedCount && backupCount >= expectedCount && masterCount >= expectedCount;
  const time = new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  saveStatus.textContent = saved ? `Saved ${time}` : "Save failed";
  saveStatus.className = `save-status ${saved ? "ok" : "error"}`;
}

function writeHistorySnapshot(userId, list) {
  const key = `gst-records-history-${userId}`;
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(key) || "[]") || [];
  } catch {
    history = [];
  }
  history.unshift({
    savedAt: new Date().toISOString(),
    count: list.length,
    records: list,
  });
  localStorage.setItem(key, JSON.stringify(history.slice(0, 20)));
}

function uniqueRecords(list) {
  const seen = new Set();
  return list.filter((record) => {
    const key = [
      record.month,
      record.name,
      Math.round(Number(record.billing || 0)),
      Math.round(Number(record.bank || 0)),
      record.createdAt || "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeRecords(list) {
  return list.map((record) => {
    const amount = record.source === "Bank receipt" ? record.bank : record.billing;
    return calculateRecord({
      id: record.id,
      month: record.month,
      name: record.name,
      hours: record.hours,
      source: record.source === "Bank receipt" ? "Bank receipt" : "Forward",
      amount,
      status: record.status || "Unpaid",
      filingForm: record.filingForm || "GSTR-3B",
      filingDueDate: record.filingDueDate || defaultFilingDueDate(record.month),
      createdAt: record.createdAt || new Date().toISOString(),
    });
  });
}

function saveRecords() {
  records = normalizeRecords(uniqueRecords(records));
  writeRecordsEverywhere(activeUser.id, records);
}

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

function parseHours(text) {
  const patterns = [
    /(?:total\s*)?(?:hrs?|hours?)\s*[:\-]?\s*([\d.]+)/i,
    /([\d.]+)\s*(?:hrs?|hours?)\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return Number(match[1]) || 0;
  }
  return 0;
}

function valueAfterLabel(text, labels) {
  for (const label of labels) {
    const pattern = new RegExp(`(?:^|\\n)\\s*${label}\\b\\s*[:\\-]?\\s*([^\\n]+)`, "i");
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return "";
}

function parseMonth(text) {
  const labelled = valueAfterLabel(text, ["Months?", "Date", "Month"]);
  const source = labelled || text;
  const datePatterns = [
    /\b(\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})\b/,
    /\b(\d{1,2}[-/][A-Za-z]{3,9}[-/]\d{4})\b/,
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/,
    /\b([A-Za-z]{3,9}\s+\d{4})\b/,
  ];
  for (const pattern of datePatterns) {
    const match = source.match(pattern);
    if (match) return normalizeDate(match[1]);
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

function parseMessage(text) {
  const month = parseMonth(text);
  const name = valueAfterLabel(text, ["Full\\s*Name", "Name", "Faculty", "Teacher"]) || activeUser.name;
  const filingForm = valueAfterLabel(text, ["Filing\\s*Form", "GST\\s*Form", "Form"]) || "GSTR-3B";
  const filingDueDateText = valueAfterLabel(text, ["Filing\\s*Due\\s*Date", "Due\\s*Date"]);
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
  const hours = parseHours(text);
  const gst = billing * GST_RATE;
  const gross = billing + gst;
  const tds = billing * TDS_RATE;
  const bank = hasBilling ? gross - tds : bankReceived;

  return {
    id: crypto.randomUUID(),
    month,
    financialYear: financialYear(month),
    billingPeriod: billingPeriod(month),
    name,
    hours,
    billing,
    gst,
    gross,
    tds,
    bank,
    filingForm,
    filingDueDate: filingDueDateText ? normalizeDate(filingDueDateText) : defaultFilingDueDate(month),
    status: "Unpaid",
    source: hasBilling ? "Forward" : "Bank receipt",
    createdAt: new Date().toISOString(),
  };
}

function calculateRecord({ id, month, name, hours, source, amount, status, filingForm, filingDueDate, createdAt }) {
  const normalizedMonth = normalizeDate(month);
  const billing = source === "Bank receipt"
    ? amount / (1 + GST_RATE - TDS_RATE)
    : amount;
  const gst = billing * GST_RATE;
  const gross = billing + gst;
  const tds = billing * TDS_RATE;
  const bank = source === "Bank receipt" ? amount : gross - tds;
  return {
    id,
    month: normalizedMonth,
    financialYear: financialYear(normalizedMonth),
    billingPeriod: billingPeriod(normalizedMonth),
    name,
    hours: Number(hours) || 0,
    billing,
    gst,
    gross,
    tds,
    bank,
    status,
    filingForm: filingForm || "GSTR-3B",
    filingDueDate: filingDueDate ? normalizeDate(filingDueDate) : defaultFilingDueDate(normalizedMonth),
    source,
    createdAt,
  };
}

function financialYear(dateText) {
  const date = new Date(dateText.replaceAll("-", " "));
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const start = date.getMonth() >= 3 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function billingPeriod(dateText) {
  const date = toDate(dateText);
  if (!date) return "";
  const month = date.getMonth();
  const year = date.getFullYear();
  if (month >= 3 && month <= 5) return `Apr-Jun ${year}`;
  if (month >= 6 && month <= 8) return `Jul-Sep ${year}`;
  if (month >= 9 && month <= 11) return `Oct-Dec ${year}`;
  return `Jan-Mar ${year}`;
}

function defaultFilingDueDate(monthText) {
  const date = toDate(monthText);
  if (!date) return "";
  return formatDate(new Date(date.getFullYear(), date.getMonth() + 1, 20));
}

function toDate(dateText) {
  const date = new Date(String(dateText || "").replaceAll("-", " "));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(date) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replaceAll(" ", "-");
}

function formatMoney(value) {
  return moneyFormatter.format(Math.round(value || 0));
}

function formatHours(value) {
  return decimalFormatter.format(value || 0);
}

function renderParsed() {
  const parsed = parseMessage(messageBox.value);
  const items = [
    ["Month", parsed.month || "Missing"],
    ["Name", parsed.name],
    ["Mode", parsed.source],
    ["Hours", formatHours(parsed.hours)],
    ["Billing", formatMoney(parsed.billing)],
    ["GST", formatMoney(parsed.gst)],
    ["TDS", formatMoney(parsed.tds)],
    ["Bank", formatMoney(parsed.bank)],
    ["FY", parsed.financialYear || "Missing"],
    ["Period", parsed.billingPeriod || "Missing"],
    ["Form", parsed.filingForm || "GSTR-3B"],
    ["Due Date", parsed.filingDueDate || "Missing"],
  ];

  parsedGrid.innerHTML = items.map(([label, value]) => `
    <div class="parsed-item">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");

  parsedCard.hidden = !messageBox.value.trim();
}

function totalsFor(list) {
  return list.reduce((sum, record) => {
    sum.hours += record.hours || 0;
    sum.billing += record.billing || 0;
    sum.gst += record.gst || 0;
    sum.gstPayable += record.status === "Paid" ? 0 : record.gst || 0;
    sum.gross += record.gross || 0;
    sum.tds += record.tds || 0;
    sum.bank += record.bank || 0;
    return sum;
  }, { hours: 0, billing: 0, gst: 0, gstPayable: 0, gross: 0, tds: 0, bank: 0 });
}

function renderTotals() {
  const totals = totalsFor(records);
  document.querySelector("#totalHours").textContent = formatHours(totals.hours);
  document.querySelector("#totalBilling").textContent = formatMoney(totals.billing);
  document.querySelector("#gstPayable").textContent = formatMoney(totals.gstPayable);
  document.querySelector("#totalTds").textContent = formatMoney(totals.tds);
  document.querySelector("#bankReceived").textContent = formatMoney(totals.bank);

}

function renderRecords() {
  const sorted = [...records].sort((a, b) => new Date(b.month.replaceAll("-", " ")) - new Date(a.month.replaceAll("-", " ")));
  const fyCount = new Set(records.map((record) => record.financialYear)).size;
  recordCount.textContent = `${records.length} ${records.length === 1 ? "entry" : "entries"} across ${fyCount} FY`;
  let lastGroup = "";
  recordsBody.innerHTML = sorted.map((record) => {
    const period = record.billingPeriod || billingPeriod(record.month);
    const group = `${record.financialYear}|${period}`;
    const fyHeader = group !== lastGroup
      ? `<tr class="fy-break"><td colspan="12">Financial Year ${record.financialYear} - Period ${period}</td></tr>`
      : "";
    lastGroup = group;
    return `
      ${fyHeader}
      <tr>
        <td title="${record.month}">${record.month}</td>
        <td>${record.financialYear}</td>
        <td class="num">${formatHours(record.hours)}</td>
        <td class="num">${formatMoney(record.billing)}</td>
        <td class="num">${formatMoney(record.gst)}</td>
        <td class="num">${formatMoney(record.gross)}</td>
        <td class="num">${formatMoney(record.tds)}</td>
        <td class="num">${formatMoney(record.bank)}</td>
        <td>${record.filingForm || "GSTR-3B"}</td>
        <td>${record.filingDueDate || defaultFilingDueDate(record.month)}</td>
        <td>
          <select data-action="status" data-id="${record.id}">
            <option ${record.status === "Unpaid" ? "selected" : ""}>Unpaid</option>
            <option ${record.status === "Paid" ? "selected" : ""}>Paid</option>
          </select>
        </td>
        <td>
          <div class="row-actions">
            <button class="icon-btn" data-action="invoice" data-id="${record.id}" title="Generate invoice">PDF</button>
            <button class="icon-btn" data-action="edit" data-id="${record.id}" title="Edit record">Edit</button>
            <button class="icon-btn danger-icon" data-action="delete" data-id="${record.id}" title="Delete record">Del</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

function render() {
  if (!activeUser) return;
  activeUserName.textContent = `${activeUser.id} - ${activeUser.name}`;
  renderParsed();
  renderTotals();
  renderRecords();
}

function showApp(user) {
  activeUser = user;
  sessionStorage.setItem(SESSION_KEY, user.id);
  records = loadRecords();
  loginView.hidden = true;
  appView.hidden = false;
  render();
  verifySaved(activeUser.id, records.length);
}

function showLogin() {
  activeUser = null;
  records = [];
  sessionStorage.removeItem(SESSION_KEY);
  loginError.hidden = true;
  appView.hidden = true;
  loginView.hidden = false;
}

function login() {
  const id = loginId.value.trim().toUpperCase();
  const user = USERS[id];
  if (!user) {
    loginError.hidden = false;
    return;
  }
  showApp(user);
}

function addRecord() {
  const parsed = parseMessage(messageBox.value);
  if (!parsed.month || !parsed.billing) {
    alert("Month and either Lecture Fees or Bank Amount Received are required.");
    return;
  }
  records.push(parsed);
  saveRecords();
  messageBox.value = "";
  render();
}

function openEdit(recordId) {
  const record = records.find((item) => item.id === recordId);
  if (!record) return;
  editingRecordId = recordId;
  editMonth.value = record.month;
  editName.value = record.name;
  editHours.value = record.hours || 0;
  editSource.value = record.source === "Bank receipt" ? "Bank receipt" : "Forward";
  editAmount.value = Math.round((record.source === "Bank receipt" ? record.bank : record.billing) * 100) / 100;
  editStatus.value = record.status || "Unpaid";
  editFilingForm.value = record.filingForm || "GSTR-3B";
  editFilingDueDate.value = record.filingDueDate || defaultFilingDueDate(record.month);
  renderEditPreview();
  editModal.hidden = false;
}

function closeEditModal() {
  editingRecordId = null;
  editModal.hidden = true;
}

function editedRecordDraft() {
  const existing = records.find((item) => item.id === editingRecordId);
  return calculateRecord({
    id: editingRecordId,
    month: editMonth.value,
    name: editName.value.trim() || activeUser.name,
    hours: editHours.value,
    source: editSource.value,
    amount: Number(editAmount.value) || 0,
    status: editStatus.value,
    filingForm: editFilingForm.value.trim() || "GSTR-3B",
    filingDueDate: editFilingDueDate.value || defaultFilingDueDate(editMonth.value),
    createdAt: existing?.createdAt || new Date().toISOString(),
  });
}

function renderEditPreview() {
  if (!editingRecordId) return;
  const draft = editedRecordDraft();
  editPreview.textContent = `FY ${draft.financialYear} | ${draft.filingForm} due ${draft.filingDueDate} | Billing ${formatMoney(draft.billing)} | GST ${formatMoney(draft.gst)} | TDS ${formatMoney(draft.tds)} | Bank ${formatMoney(draft.bank)}`;
}

function saveEditedRecord(event) {
  event.preventDefault();
  const draft = editedRecordDraft();
  if (!draft.month || !draft.billing) {
    alert("Month and amount are required.");
    return;
  }
  records = records.map((record) => record.id === editingRecordId ? draft : record);
  saveRecords();
  closeEditModal();
  render();
}

function invoiceNumberFor(record) {
  const fyRecords = records
    .filter((item) => item.financialYear === record.financialYear)
    .sort((a, b) => new Date(a.month.replaceAll("-", " ")) - new Date(b.month.replaceAll("-", " ")));
  const index = fyRecords.findIndex((item) => item.id === record.id) + 1;
  return `${String(Math.max(index, 1)).padStart(2, "0")}/${record.financialYear}`;
}

function monthName(record) {
  const date = toDate(record.month);
  return date ? date.toLocaleDateString("en-GB", { month: "long", year: "numeric" }) : record.month;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function invoiceHtml(record) {
  const user = activeUser;
  const sgst = record.gst / 2;
  const cgst = record.gst / 2;
  const invoiceNo = invoiceNumberFor(record);
  const billTo = DEFAULT_BILL_TO;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Tax Invoice ${escapeHtml(invoiceNo)}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Times New Roman", serif; color: #000; }
    .invoice { width: 100%; border: 2px solid #000; }
    .center { text-align: center; }
    .row { border-bottom: 1px solid #000; padding: 4px 6px; }
    .name { font-size: 23px; font-weight: 700; line-height: 1.1; }
    .address { font-size: 15px; font-weight: 700; }
    .title { font-size: 22px; font-weight: 700; }
    .details { display: grid; grid-template-columns: 1fr 170px; min-height: 185px; border-bottom: 1px solid #000; }
    .to { padding: 38px 6px 8px; font-size: 15px; line-height: 1.42; }
    .bill { padding: 6px; font-size: 15px; line-height: 1.45; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #000; padding: 5px; font-size: 15px; vertical-align: top; }
    th { text-align: center; font-weight: 700; }
    .sr { width: 120px; text-align: right; }
    .amount { width: 145px; text-align: right; }
    .particulars { height: 160px; }
    .tax-line { display: grid; grid-template-columns: 1fr 120px; margin-top: 34px; }
    .total-row td { font-weight: 700; }
    .footer { min-height: 120px; display: grid; grid-template-columns: 1fr 190px; border-top: 1px solid #000; }
    .meta { padding: 12px 6px; font-size: 15px; line-height: 1.55; }
    .sign { display: grid; place-items: center; font-size: 31px; color: #064ecf; font-family: "Brush Script MT", cursive; transform: rotate(-10deg); }
    .print { margin: 14px 0; text-align: center; }
    .print button { min-height: 38px; padding: 0 16px; font: 700 14px Arial, sans-serif; }
    @media print { .print { display: none; } }
  </style>
</head>
<body>
  <div class="print"><button onclick="window.print()">Print / Save as PDF</button></div>
  <section class="invoice">
    <div class="row center name">${escapeHtml(user.name)}</div>
    <div class="row center address">${escapeHtml(user.address)}</div>
    <div class="row center title">Tax Invoice</div>
    <div class="details">
      <div class="to">
        <div>To,</div>
        <div>${escapeHtml(billTo.name)}</div>
        ${billTo.addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}
        <div>GST NO : ${escapeHtml(billTo.gstin)}</div>
      </div>
      <div class="bill">
        <div>Bill No :- ${escapeHtml(invoiceNo)}</div>
        <div>Date :- ${escapeHtml(record.month)}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th class="sr">Sr. No.</th>
          <th>Particulars</th>
          <th class="amount">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="sr">1</td>
          <td class="particulars">
            <div>Professional Fees For the Month of ${escapeHtml(monthName(record))}</div>
            <div class="tax-line"><span>Add: SGST @9%</span><span>${formatMoney(sgst)}</span></div>
            <div class="tax-line" style="margin-top: 8px;"><span>Add CGST @9%</span><span>${formatMoney(cgst)}</span></div>
            <div class="tax-line" style="margin-top: 8px;"><span>Add IGST @18%</span><span>-</span></div>
          </td>
          <td class="amount">${formatMoney(record.billing)}</td>
        </tr>
        <tr class="total-row">
          <td></td>
          <td><span>E &amp; O.E</span><span style="float:right;">Total</span></td>
          <td class="amount">${formatMoney(record.gross)}</td>
        </tr>
      </tbody>
    </table>
    <div class="footer">
      <div class="meta">
        <div>Income Tax Pan No ${escapeHtml(user.pan)}</div>
        <div>GST No :- &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${escapeHtml(user.gstin)}</div>
        <div>Place of service :- &nbsp;&nbsp;&nbsp; ${escapeHtml(billTo.placeOfService)}</div>
        <div>HSN/SAC Code :- &nbsp;&nbsp; ${escapeHtml(billTo.hsnSac)}</div>
      </div>
      <div class="sign">${escapeHtml(user.signature)}</div>
    </div>
    <div class="row">&nbsp;</div>
  </section>
</body>
</html>`;
}

function openInvoice(recordId) {
  const record = records.find((item) => item.id === recordId);
  if (!record) return;
  const invoiceWindow = window.open("", "_blank");
  if (!invoiceWindow) {
    alert("Please allow popups to generate the invoice.");
    return;
  }
  invoiceWindow.document.open();
  invoiceWindow.document.write(invoiceHtml(record));
  invoiceWindow.document.close();
}

function exportCsv() {
  const headers = ["Month", "Financial Year", "Billing Period", "Name", "Hours", "Billing", "GST", "Gross", "TDS", "Bank Received", "Filing Form", "Filing Due Date", "GST Status"];
  const lines = [headers, ...records.map((record) => [
    record.month,
    financialYear(record.month),
    record.billingPeriod || billingPeriod(record.month),
    record.name,
    record.hours,
    record.billing,
    record.gst,
    record.gross,
    record.tds,
    record.bank,
    record.filingForm || "GSTR-3B",
    record.filingDueDate || defaultFilingDueDate(record.month),
    record.status,
  ])];
  const csv = lines.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "gst-records.csv";
  link.click();
  URL.revokeObjectURL(link.href);
}

function downloadBackup() {
  const payload = {
    app: "GST Records",
    version: 1,
    user: activeUser.id,
    exportedAt: new Date().toISOString(),
    records: normalizeRecords(records),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `gst-records-${activeUser.id}-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function restoreBackupFile(file) {
  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      const payload = JSON.parse(reader.result);
      const imported = Array.isArray(payload) ? payload : payload.records;
      if (!Array.isArray(imported)) throw new Error("No records array found");
      const before = records.length;
      records = normalizeRecords(uniqueRecords([...records, ...imported]));
      saveRecords();
      render();
      alert(`Restored ${records.length - before} new record(s). Total records: ${records.length}.`);
    } catch {
      alert("Could not restore this backup file.");
    } finally {
      restoreFile.value = "";
    }
  });
  reader.readAsText(file);
}

messageBox.addEventListener("input", renderParsed);
loginButton.addEventListener("click", login);
loginId.addEventListener("keydown", (event) => {
  if (event.key === "Enter") login();
});
logoutButton.addEventListener("click", showLogin);
addRecordButton.addEventListener("click", addRecord);
exportButton.addEventListener("click", exportCsv);
downloadBackupButton.addEventListener("click", downloadBackup);
restoreBackupButton.addEventListener("click", () => restoreFile.click());
restoreFile.addEventListener("change", () => {
  const file = restoreFile.files?.[0];
  if (file) restoreBackupFile(file);
});
recordsBody.addEventListener("change", (event) => {
  const id = event.target.dataset.id;
  if (event.target.dataset.action === "status") {
    const record = records.find((item) => item.id === id);
    if (record) record.status = event.target.value;
    saveRecords();
    render();
  }
});

recordsBody.addEventListener("click", (event) => {
  const id = event.target.dataset.id;
  if (event.target.dataset.action === "edit") {
    openEdit(id);
  }
  if (event.target.dataset.action === "invoice") {
    openInvoice(id);
  }
  if (event.target.dataset.action === "delete") {
    const record = records.find((item) => item.id === id);
    const label = record ? `${record.month} - ${record.name} - ${formatMoney(record.billing)}` : "this record";
    if (!confirm(`Delete ${label}?`)) return;
    records = records.filter((item) => item.id !== id);
    saveRecords();
    render();
  }
});

for (const input of [editMonth, editName, editHours, editSource, editAmount, editStatus, editFilingForm, editFilingDueDate]) {
  input.addEventListener("input", renderEditPreview);
  input.addEventListener("change", renderEditPreview);
}
editForm.addEventListener("submit", saveEditedRecord);
closeEdit.addEventListener("click", closeEditModal);
cancelEdit.addEventListener("click", closeEditModal);
editModal.addEventListener("click", (event) => {
  if (event.target === editModal) closeEditModal();
});

const savedUserId = sessionStorage.getItem(SESSION_KEY);
if (savedUserId && USERS[savedUserId]) {
  showApp(USERS[savedUserId]);
} else {
  showLogin();
}
