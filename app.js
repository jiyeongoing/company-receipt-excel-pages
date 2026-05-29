const StaticExpenseApp = (() => {
  const STORAGE_KEY = "companyReceiptExcel.static.v1";
  const money = new Intl.NumberFormat("ko-KR");
  const encoder = new TextEncoder();
  const COMMON_RECEIPTS = [
    { label: "야근식대 · 서브웨이", category: "식대", description: "야근식대", merchant: "서브웨이 여의도국회의사당" },
    { label: "야근식대 · 아임샐러드", category: "식대", description: "야근식대", merchant: "아임샐러드 영등포" },
    { label: "주말식대 · KFC", category: "식대", description: "주말식대", merchant: "KFC 여의도점" },
    { label: "단체커피 · 더벤티", category: "식대", description: "단체커피", merchant: "더벤티 국회대로점" },
    { label: "단체커피 · 우지커피", category: "식대", description: "단체커피", merchant: "우지커피 서여의도점" },
    { label: "비품 · GS25", category: "비품", description: "비품 구매", merchant: "GS25" },
    { label: "단체간식 · 오피스디포", category: "비품", description: "단체간식", merchant: "여의도점-(주)오피스디포코리아" }
  ];

  let state = loadState();

  function init() {
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    byId("receiptMonth").value = currentMonth;
    byId("usageDate").value = today.toISOString().slice(0, 10);
    byId("budgetYear").value = today.getFullYear();
    byId("budgetQuarter").value = String(Math.floor(today.getMonth() / 3) + 1);
    byId("exportName").value = state.settings.name;
    byId("exportProject").value = state.settings.project;
    byId("user").value = state.settings.name;

    document.querySelectorAll(".tab").forEach((button) => {
      button.addEventListener("click", () => switchView(button.dataset.view));
    });

    byId("exportName").addEventListener("change", saveSettings);
    byId("exportProject").addEventListener("change", saveSettings);
    byId("receiptMonth").addEventListener("change", renderReceipts);
    byId("receiptForm").addEventListener("submit", saveReceipt);
    byId("resetReceipt").addEventListener("click", resetReceiptForm);
    byId("exportExcel").addEventListener("click", exportCurrentMonth);

    byId("budgetYear").addEventListener("change", renderBudget);
    byId("budgetQuarter").addEventListener("change", renderBudget);
    byId("saveMonths").addEventListener("click", saveBudgetMonths);
    byId("budgetItemForm").addEventListener("submit", saveBudgetItem);
    byId("resetBudgetItem").addEventListener("click", resetBudgetItemForm);

    byId("downloadBackup").addEventListener("click", downloadBackup);
    byId("importBackup").addEventListener("change", importBackup);
    byId("clearData").addEventListener("click", clearAllData);

    renderQuickPicks();
    renderReceipts();
    renderBudget();
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function switchView(view) {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    document.querySelectorAll(".view").forEach((panel) => panel.classList.remove("active"));
    document.querySelector(`[data-view="${view}"]`).classList.add("active");
    byId(`${view}View`).classList.add("active");
  }

  function setStatus(text) {
    byId("statusText").textContent = text;
  }

  function loadState() {
    const empty = {
      settings: { name: "이병수", project: "블루월넛" },
      receipts: [],
      budgets: {}
    };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return empty;
      const parsed = JSON.parse(raw);
      return {
        settings: { ...empty.settings, ...(parsed.settings || {}) },
        receipts: Array.isArray(parsed.receipts) ? parsed.receipts : [],
        budgets: parsed.budgets && typeof parsed.budgets === "object" ? parsed.budgets : {}
      };
    } catch {
      return empty;
    }
  }

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function saveSettings() {
    state.settings.name = byId("exportName").value.trim() || "이병수";
    state.settings.project = byId("exportProject").value.trim() || "블루월넛";
    if (!byId("user").value.trim()) {
      byId("user").value = state.settings.name;
    }
    persist();
  }

  function saveReceipt(event) {
    event.preventDefault();
    saveSettings();
    const id = byId("receiptId").value || crypto.randomUUID();
    const entry = {
      id,
      usageDate: byId("usageDate").value,
      category: byId("category").value,
      description: byId("description").value.trim(),
      merchant: byId("merchant").value.trim(),
      amount: Number(byId("amount").value || 0),
      user: byId("user").value.trim(),
      receiptStatus: byId("receiptStatus").value,
      paymentMethod: byId("paymentMethod").value.trim(),
      invoiceStatus: byId("invoiceStatus").value,
      note: byId("note").value.trim(),
      createdAt: new Date().toISOString()
    };
    state.receipts = state.receipts.filter((item) => item.id !== id).concat(entry);
    state.receipts.sort((a, b) => a.usageDate.localeCompare(b.usageDate) || a.createdAt.localeCompare(b.createdAt));
    persist();
    resetReceiptForm();
    renderQuickPicks();
    renderReceipts();
    setStatus("영수증을 저장했습니다.");
  }

  function resetReceiptForm() {
    const today = new Date().toISOString().slice(0, 10);
    byId("receiptId").value = "";
    byId("receiptForm").reset();
    byId("usageDate").value = today;
    byId("user").value = state.settings.name;
    byId("receiptStatus").value = "유";
    byId("invoiceStatus").value = "미발행";
  }

  function renderReceipts() {
    const month = byId("receiptMonth").value;
    const entries = receiptsByMonth(month);
    const total = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    byId("receiptTotal").textContent = won(total);

    const list = byId("receiptList");
    list.innerHTML = "";
    if (entries.length === 0) {
      list.innerHTML = `<div class="empty">저장된 영수증이 없습니다.</div>`;
      return;
    }

    entries.forEach((entry) => {
      const item = document.createElement("article");
      item.className = "entry";
      item.innerHTML = `
        <div class="entry-main">
          <div class="entry-title">
            <strong>${escapeHtml(entry.description)}</strong>
            <span>${escapeHtml(entry.category)}</span>
            <span class="amount">${won(entry.amount)}</span>
          </div>
          <div class="entry-meta">${entry.usageDate} · ${escapeHtml(entry.merchant)} · ${escapeHtml(entry.user)}</div>
        </div>
        <div class="entry-actions">
          <button type="button" data-action="edit">수정</button>
          <button class="danger" type="button" data-action="delete">삭제</button>
        </div>
      `;
      item.querySelector('[data-action="edit"]').addEventListener("click", () => editReceipt(entry));
      item.querySelector('[data-action="delete"]').addEventListener("click", () => deleteReceipt(entry.id));
      list.appendChild(item);
    });
  }

  function receiptsByMonth(month) {
    return state.receipts
      .filter((entry) => entry.usageDate && entry.usageDate.startsWith(month))
      .sort((a, b) => a.usageDate.localeCompare(b.usageDate) || a.createdAt.localeCompare(b.createdAt));
  }

  function editReceipt(entry) {
    byId("receiptId").value = entry.id;
    byId("usageDate").value = entry.usageDate;
    byId("category").value = entry.category;
    byId("description").value = entry.description;
    byId("merchant").value = entry.merchant;
    byId("amount").value = entry.amount;
    byId("user").value = entry.user;
    byId("receiptStatus").value = entry.receiptStatus;
    byId("paymentMethod").value = entry.paymentMethod;
    byId("invoiceStatus").value = entry.invoiceStatus;
    byId("note").value = entry.note;
    byId("description").focus();
  }

  function renderQuickPicks() {
    const list = byId("quickPickList");
    list.innerHTML = "";
    quickPickItems().forEach((item) => {
      const button = document.createElement("button");
      button.className = "chip";
      button.type = "button";
      button.textContent = item.label;
      button.addEventListener("click", () => applyQuickPick(item));
      list.appendChild(button);
    });
  }

  function quickPickItems() {
    const recent = [];
    const seen = new Set();
    state.receipts.slice().reverse().forEach((entry) => {
      const key = `${entry.category}|${entry.description}|${entry.merchant}`;
      if (!entry.description || !entry.merchant || seen.has(key)) return;
      seen.add(key);
      recent.push({
        label: `${entry.description} · ${entry.merchant}`,
        category: entry.category,
        description: entry.description,
        merchant: entry.merchant
      });
    });
    return [...recent.slice(0, 4), ...COMMON_RECEIPTS]
      .filter((item, index, array) => array.findIndex((candidate) =>
        candidate.category === item.category &&
        candidate.description === item.description &&
        candidate.merchant === item.merchant
      ) === index)
      .slice(0, 10);
  }

  function applyQuickPick(item) {
    byId("category").value = item.category;
    byId("description").value = item.description;
    byId("merchant").value = item.merchant;
    byId("amount").focus();
  }

  function deleteReceipt(id) {
    if (!confirm("이 영수증을 삭제할까요?")) return;
    state.receipts = state.receipts.filter((entry) => entry.id !== id);
    persist();
    renderQuickPicks();
    renderReceipts();
    setStatus("영수증을 삭제했습니다.");
  }

  function exportCurrentMonth() {
    saveSettings();
    const month = byId("receiptMonth").value;
    const entries = receiptsByMonth(month);
    const bytes = buildWorkbookBytes({
      month,
      name: state.settings.name,
      project: state.settings.project,
      entries
    });
    const fileName = `Expenses List_법인_${state.settings.project}_${month.replace("-", "")}.xlsx`;
    downloadBytes(bytes, fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    setStatus("엑셀 파일을 만들었습니다.");
  }

  function currentBudgetKey() {
    return `${byId("budgetYear").value}-Q${byId("budgetQuarter").value}`;
  }

  function getBudget() {
    const year = Number(byId("budgetYear").value);
    const quarter = Number(byId("budgetQuarter").value);
    const key = `${year}-Q${quarter}`;
    if (!state.budgets[key]) {
      state.budgets[key] = { year, quarter, allowances: [0, 0, 0], items: [] };
    }
    return state.budgets[key];
  }

  function renderBudget() {
    const budget = getBudget();
    const months = quarterMonths(Number(byId("budgetQuarter").value));
    months.forEach((month, index) => {
      byId(`month${index + 1}Label`).textContent = `${month}월`;
      byId(`month${index + 1}Amount`).value = budget.allowances[index] || "";
    });

    const monthSelect = byId("budgetItemMonth");
    const selected = monthSelect.value;
    monthSelect.innerHTML = "";
    months.forEach((month) => {
      const option = document.createElement("option");
      option.value = String(month);
      option.textContent = `${month}월`;
      monthSelect.appendChild(option);
    });
    if (selected) monthSelect.value = selected;

    const totalAllowance = budget.allowances.reduce((sum, value) => sum + Number(value || 0), 0);
    const totalPlanned = budget.items.reduce((sum, item) => sum + Number(item.plannedAmount || 0), 0);
    const totalActual = budget.items.reduce((sum, item) => sum + Number(item.actualAmount || 0), 0);
    byId("totalAllowance").textContent = won(totalAllowance);
    byId("totalPlanned").textContent = won(totalPlanned);
    byId("totalActual").textContent = won(totalActual);
    byId("remainingBudget").textContent = won(totalAllowance - totalActual);
    byId("unallocatedBudget").textContent = `${won(totalAllowance - totalPlanned)} 미배정`;

    const list = byId("budgetList");
    list.innerHTML = "";
    if (budget.items.length === 0) {
      list.innerHTML = `<div class="empty">저장된 예산 항목이 없습니다.</div>`;
      return;
    }
    budget.items
      .slice()
      .sort((a, b) => Number(a.month) - Number(b.month) || a.name.localeCompare(b.name))
      .forEach((item) => {
        const remain = Number(item.plannedAmount || 0) - Number(item.actualAmount || 0);
        const article = document.createElement("article");
        article.className = "entry";
        article.innerHTML = `
          <div class="entry-main">
            <div class="entry-title">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${item.month}월</span>
              <span class="amount">잔액 ${won(remain)}</span>
            </div>
            <div class="entry-meta">예산 ${won(item.plannedAmount)} · 실사용 ${won(item.actualAmount)} · ${escapeHtml(item.note)}</div>
          </div>
          <div class="entry-actions">
            <button type="button" data-action="edit">수정</button>
            <button class="danger" type="button" data-action="delete">삭제</button>
          </div>
        `;
        article.querySelector('[data-action="edit"]').addEventListener("click", () => editBudgetItem(item));
        article.querySelector('[data-action="delete"]').addEventListener("click", () => deleteBudgetItem(item.id));
        list.appendChild(article);
      });
  }

  function saveBudgetMonths() {
    const budget = getBudget();
    budget.allowances = [1, 2, 3].map((index) => Number(byId(`month${index}Amount`).value || 0));
    persist();
    renderBudget();
    setStatus("월별 지급금을 저장했습니다.");
  }

  function saveBudgetItem(event) {
    event.preventDefault();
    const budget = getBudget();
    const id = byId("budgetItemId").value || crypto.randomUUID();
    const item = {
      id,
      month: Number(byId("budgetItemMonth").value),
      name: byId("budgetItemName").value.trim(),
      plannedAmount: Number(byId("plannedAmount").value || 0),
      actualAmount: Number(byId("actualAmount").value || 0),
      note: byId("budgetNote").value.trim()
    };
    budget.items = budget.items.filter((current) => current.id !== id).concat(item);
    persist();
    resetBudgetItemForm();
    renderBudget();
    setStatus("예산 항목을 저장했습니다.");
  }

  function editBudgetItem(item) {
    byId("budgetItemId").value = item.id;
    byId("budgetItemMonth").value = item.month;
    byId("budgetItemName").value = item.name;
    byId("plannedAmount").value = item.plannedAmount;
    byId("actualAmount").value = item.actualAmount;
    byId("budgetNote").value = item.note;
    byId("budgetItemName").focus();
  }

  function resetBudgetItemForm() {
    byId("budgetItemId").value = "";
    byId("budgetItemForm").reset();
  }

  function deleteBudgetItem(id) {
    if (!confirm("이 예산 항목을 삭제할까요?")) return;
    const budget = getBudget();
    budget.items = budget.items.filter((item) => item.id !== id);
    persist();
    renderBudget();
    setStatus("예산 항목을 삭제했습니다.");
  }

  function quarterMonths(quarter) {
    const first = (quarter - 1) * 3 + 1;
    return [first, first + 1, first + 2];
  }

  function downloadBackup() {
    const bytes = encoder.encode(JSON.stringify(state, null, 2));
    downloadBytes(bytes, `company-receipt-backup-${new Date().toISOString().slice(0, 10)}.json`, "application/json");
  }

  async function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.receipts) || !parsed.budgets || !parsed.settings) {
        throw new Error("백업 파일 형식이 맞지 않습니다.");
      }
      state = parsed;
      persist();
      location.reload();
    } catch (error) {
      setStatus(error.message);
    }
  }

  function clearAllData() {
    if (!confirm("이 브라우저에 저장된 모든 데이터를 삭제할까요?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = loadState();
    location.reload();
  }

  function won(value) {
    return `${money.format(Number(value || 0))}원`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function downloadBytes(bytes, fileName, type) {
    const blob = new Blob([bytes], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function buildWorkbookBytes({ month, name, project, entries }) {
    const total = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const files = {
      "_rels/.rels": relsXml(),
      "docProps/app.xml": appPropsXml(),
      "docProps/core.xml": corePropsXml(),
      "xl/_rels/workbook.xml.rels": workbookRelsXml(),
      "xl/workbook.xml": workbookXml(),
      "xl/styles.xml": stylesXml(),
      "xl/worksheets/sheet1.xml": expensesSheetXml({ entries, total, name, project }),
      "[Content_Types].xml": contentTypesXml()
    };
    return zipStore(files);
  }

  function expensesSheetXml({ entries, total, name, project }) {
    const totalRow = 7 + entries.length;
    const rows = [];
    rows.push(row(1, [
      textCell("A1", 2, "성명"), textCell("B1", 38, name), ...topBlankCells(1)
    ], "14"));
    rows.push(row(2, [
      textCell("A2", 2, "프로젝트명"), textCell("B2", 38, project), ...topBlankCells(2)
    ], "14"));
    rows.push(row(3, [
      textCell("A3", 2, "총결제금액"), formulaCell("B3", 43, `E${totalRow}`, total), ...topBlankCells(3)
    ], "14"));
    rows.push(row(4, [
      blankCell("A4", 3), blankCell("B4", 44), ...topBlankCells(4)
    ], "14"));
    rows.push(row(5, [
      blankCell("A5", 45), blankCell("B5", 46), blankCell("C5", 47), blankCell("D5", 47),
      blankCell("E5", 48), blankCell("F5", 48), blankCell("G5", 49), blankCell("H5", 48),
      blankCell("I5", 47), blankCell("J5", 47)
    ], "14"));
    rows.push(row(6, [
      textCell("A6", 2, "사용일자"),
      textCell("B6", 2, "구분"),
      textCell("C6", 2, "사용내역"),
      textCell("D6", 2, "사용처"),
      textCell("E6", 2, "사용금액"),
      textCell("F6", 2, "사용자"),
      textCell("G6", 2, "영수증"),
      textCell("H6", 2, "결제수단"),
      textCell("I6", 2, "세금계산서"),
      textCell("J6", 2, "비고")
    ], "12.75"));
    entries.forEach((entry, index) => {
      const rowNumber = 7 + index;
      rows.push(row(rowNumber, [
        numberCell(`A${rowNumber}`, 51, excelSerial(entry.usageDate)),
        textCell(`B${rowNumber}`, 8, entry.category),
        textCell(`C${rowNumber}`, 52, entry.description),
        textCell(`D${rowNumber}`, 52, entry.merchant),
        numberCell(`E${rowNumber}`, 53, Number(entry.amount || 0)),
        textCell(`F${rowNumber}`, 8, entry.user),
        textCell(`G${rowNumber}`, 7, entry.receiptStatus),
        textOrBlankCell(`H${rowNumber}`, 8, entry.paymentMethod),
        textCell(`I${rowNumber}`, 8, entry.invoiceStatus),
        textOrBlankCell(`J${rowNumber}`, 54, entry.note)
      ], "14"));
    });
    rows.push(row(totalRow, [
      textCell(`A${totalRow}`, 56, "합계"),
      blankCell(`B${totalRow}`, 57),
      blankCell(`C${totalRow}`, 57),
      blankCell(`D${totalRow}`, 57),
      entries.length ? formulaCell(`E${totalRow}`, 58, `SUM(E7:E${totalRow - 1})`, total) : numberCell(`E${totalRow}`, 58, 0),
      blankCell(`F${totalRow}`, 17),
      blankCell(`G${totalRow}`, 59),
      blankCell(`H${totalRow}`, 19),
      blankCell(`I${totalRow}`, 19),
      blankCell(`J${totalRow}`, 19)
    ], "13"));

    return xmlHeader(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
      <dimension ref="A1:J${totalRow}"/>
      <sheetViews><sheetView workbookViewId="0" showGridLines="0" defaultGridColor="1"/></sheetViews>
      <sheetFormatPr defaultColWidth="12.5" defaultRowHeight="13" customHeight="1"/>
      <cols>
        <col min="1" max="1" width="10.8516" style="37" customWidth="1"/>
        <col min="2" max="2" width="13.6719" style="37" customWidth="1"/>
        <col min="3" max="3" width="51" customWidth="1"/>
        <col min="4" max="4" width="26.9531" style="37" customWidth="1"/>
        <col min="5" max="5" width="10.5" style="37" customWidth="1"/>
        <col min="6" max="7" width="9" style="37" customWidth="1"/>
        <col min="8" max="8" width="9.85156" style="37" customWidth="1"/>
        <col min="9" max="9" width="11.8516" style="37" customWidth="1"/>
        <col min="10" max="10" width="12.6719" style="37" customWidth="1"/>
      </cols>
      <sheetData>${rows.join("")}</sheetData>
      <mergeCells count="1"><mergeCell ref="A${totalRow}:C${totalRow}"/></mergeCells>
      <pageMargins left="0.354331" right="0.314961" top="0.748031" bottom="0.787402" header="0.511811" footer="0.511811"/>
      <pageSetup firstPageNumber="1" fitToHeight="1" fitToWidth="1" scale="100" useFirstPageNumber="0" orientation="landscape" pageOrder="downThenOver"/>
      <headerFooter><oddHeader>&amp;L&amp;&quot;돋움,Regular&quot;&amp;11&amp;K000000Expenses List_법인</oddHeader><oddFooter>&amp;L&amp;&quot;돋움,Regular&quot;&amp;11&amp;K000000&amp;P 쪽</oddFooter></headerFooter>
    </worksheet>`);
  }

  function topBlankCells(rowNumber) {
    return [
      blankCell(`C${rowNumber}`, 39),
      blankCell(`D${rowNumber}`, 40),
      blankCell(`E${rowNumber}`, 41),
      blankCell(`F${rowNumber}`, 41),
      blankCell(`G${rowNumber}`, 42),
      blankCell(`H${rowNumber}`, 41),
      blankCell(`I${rowNumber}`, 40),
      blankCell(`J${rowNumber}`, 40)
    ];
  }

  function row(index, cells, height = "") {
    const attrs = height ? ` ht="${height}" customHeight="1"` : "";
    return `<row r="${index}"${attrs}>${cells.join("")}</row>`;
  }

  function textCell(ref, style, value) {
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
  }

  function numberCell(ref, style, value) {
    return `<c r="${ref}" s="${style}"><v>${Number(value || 0)}</v></c>`;
  }

  function formulaCell(ref, style, formula, value) {
    return `<c r="${ref}" s="${style}"><f>${formula}</f><v>${Number(value || 0)}</v></c>`;
  }

  function blankCell(ref, style) {
    return `<c r="${ref}" s="${style}"/>`;
  }

  function textOrBlankCell(ref, style, value) {
    return value ? textCell(ref, style, value) : blankCell(ref, style);
  }

  function excelSerial(dateText) {
    const [year, month, day] = dateText.split("-").map(Number);
    const date = Date.UTC(year, month - 1, day);
    const epoch = Date.UTC(1899, 11, 30);
    return Math.round((date - epoch) / 86400000);
  }

  function stylesXml() {
    const defaultXf = `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`;
    const bordered = `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>`;
    const header = `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>`;
    const headerMuted = `<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>`;
    const topValue = `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>`;
    const moneyValue = `<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>`;
    const dateValue = `<xf numFmtId="14" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>`;
    const wrapped = `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>`;
    const centered = `<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>`;
    const totalLabel = `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>`;
    const totalMoney = `<xf numFmtId="164" fontId="1" fillId="2" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>`;
    const xfs = Array.from({ length: 60 }, () => bordered);
    xfs[0] = defaultXf;
    [2, 3, 50].forEach((index) => { xfs[index] = header; });
    [38, 44].forEach((index) => { xfs[index] = topValue; });
    xfs[43] = moneyValue;
    [39, 40, 41, 42, 45, 46, 47, 48, 49].forEach((index) => { xfs[index] = bordered; });
    xfs[51] = dateValue;
    xfs[52] = wrapped;
    xfs[53] = moneyValue;
    xfs[7] = centered;
    xfs[8] = centered;
    xfs[54] = wrapped;
    xfs[56] = totalLabel;
    xfs[57] = headerMuted;
    xfs[58] = totalMoney;
    xfs[17] = headerMuted;
    xfs[19] = headerMuted;
    xfs[59] = headerMuted;
    return xmlHeader(`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0"/></numFmts>
      <fonts count="2">
        <font><sz val="9"/><name val="돋움"/></font>
        <font><b/><sz val="9"/><name val="돋움"/></font>
      </fonts>
      <fills count="4">
        <fill><patternFill patternType="none"/></fill>
        <fill><patternFill patternType="gray125"/></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFD9E2F3"/><bgColor indexed="64"/></patternFill></fill>
        <fill><patternFill patternType="solid"><fgColor rgb="FFEDEDED"/><bgColor indexed="64"/></patternFill></fill>
      </fills>
      <borders count="2">
        <border><left/><right/><top/><bottom/><diagonal/></border>
        <border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border>
      </borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>
      <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
    </styleSheet>`);
  }

  function workbookXml() {
    return xmlHeader(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets>
        <sheet name="Expenses List_법인" sheetId="1" r:id="rId1"/>
      </sheets>
    </workbook>`);
  }

  function workbookRelsXml() {
    return xmlHeader(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
    </Relationships>`);
  }

  function relsXml() {
    return xmlHeader(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
      <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
    </Relationships>`);
  }

  function contentTypesXml() {
    return xmlHeader(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
      <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
      <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    </Types>`);
  }

  function corePropsXml() {
    return xmlHeader(`<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
      <dc:creator>Company Receipt Excel</dc:creator>
      <cp:lastModifiedBy>Company Receipt Excel</cp:lastModifiedBy>
      <dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
      <dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified>
    </cp:coreProperties>`);
  }

  function appPropsXml() {
    return xmlHeader(`<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
      <Application>Company Receipt Excel</Application>
    </Properties>`);
  }

  function xmlHeader(body) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${body}`;
  }

  function xmlEscape(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&apos;");
  }

  function zipStore(files) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    Object.entries(files).forEach(([name, content]) => {
      const nameBytes = encoder.encode(name);
      const data = typeof content === "string" ? encoder.encode(content) : content;
      const crc = crc32(data);
      const local = new Uint8Array(30 + nameBytes.length);
      const localView = new DataView(local.buffer);
      localView.setUint32(0, 0x04034b50, true);
      localView.setUint16(4, 20, true);
      localView.setUint16(6, 0, true);
      localView.setUint16(8, 0, true);
      localView.setUint16(10, 0, true);
      localView.setUint16(12, 0, true);
      localView.setUint32(14, crc, true);
      localView.setUint32(18, data.length, true);
      localView.setUint32(22, data.length, true);
      localView.setUint16(26, nameBytes.length, true);
      local.set(nameBytes, 30);
      localParts.push(local, data);

      const central = new Uint8Array(46 + nameBytes.length);
      const centralView = new DataView(central.buffer);
      centralView.setUint32(0, 0x02014b50, true);
      centralView.setUint16(4, 20, true);
      centralView.setUint16(6, 20, true);
      centralView.setUint16(8, 0, true);
      centralView.setUint16(10, 0, true);
      centralView.setUint16(12, 0, true);
      centralView.setUint16(14, 0, true);
      centralView.setUint32(16, crc, true);
      centralView.setUint32(20, data.length, true);
      centralView.setUint32(24, data.length, true);
      centralView.setUint16(28, nameBytes.length, true);
      centralView.setUint32(42, offset, true);
      central.set(nameBytes, 46);
      centralParts.push(central);
      offset += local.length + data.length;
    });

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const end = new Uint8Array(22);
    const endView = new DataView(end.buffer);
    endView.setUint32(0, 0x06054b50, true);
    endView.setUint16(8, centralParts.length, true);
    endView.setUint16(10, centralParts.length, true);
    endView.setUint32(12, centralSize, true);
    endView.setUint32(16, offset, true);
    return concatUint8([...localParts, ...centralParts, end]);
  }

  function concatUint8(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const output = new Uint8Array(total);
    let position = 0;
    parts.forEach((part) => {
      output.set(part, position);
      position += part.length;
    });
    return output;
  }

  let crcTable = null;
  function crc32(data) {
    if (!crcTable) {
      crcTable = Array.from({ length: 256 }, (_, index) => {
        let value = index;
        for (let bit = 0; bit < 8; bit++) {
          value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
        }
        return value >>> 0;
      });
    }
    let crc = 0xffffffff;
    for (let index = 0; index < data.length; index++) {
      crc = crcTable[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  return {
    init,
    buildWorkbookBytes,
    excelSerial,
    zipStore
  };
})();

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", StaticExpenseApp.init);
}

if (typeof module !== "undefined") {
  module.exports = StaticExpenseApp;
}
