
document.addEventListener("DOMContentLoaded", () => {
  // Backend API URL
  const API_BASE_URL = "http://localhost:5000";

  const $ = (id) => document.getElementById(id);

  const state = {
    items: [],
    billChecks: 0,
    flaggedItems: 0,
    reports: [],
    loadingReports: false
  };

  // -------------------------------
  // COMMON FUNCTIONS
  // -------------------------------

  const money = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR"
    }).format(Number(value) || 0);

  function showMessage(element, message, type = "info") {
    if (!element) return;
    element.className = `result-box ${type}`;
    element.textContent = message;
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function updateStats() {
    if ($("totalChecks")) {
      $("totalChecks").textContent = state.billChecks;
    }

    if ($("totalFlags")) {
      $("totalFlags").textContent = state.flaggedItems;
    }

    if ($("totalReports")) {
      $("totalReports").textContent = state.reports.length;
    }

    if ($("totalSafety")) {
      $("totalSafety").textContent = "100%";
    }
  }

  // -------------------------------
  // SIDEBAR NAVIGATION
  // -------------------------------

  const sidebar = $("sidebar");
  const menuToggle = $("menuToggle");

  menuToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
  });

  document.querySelectorAll(".nav-link, .quick-card").forEach((link) => {
    link.addEventListener("click", () => {
      if (sidebar) sidebar.classList.remove("open");

      document.querySelectorAll(".nav-link").forEach((item) => {
        item.classList.remove("active");
      });

      const matchingLink = document.querySelector(
        `.nav-link[href="${link.getAttribute("href")}"]`
      );

      matchingLink?.classList.add("active");
    });
  });

  // -------------------------------
  // BACKEND HEALTH CHECK
  // -------------------------------

  async function checkBackend() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);

      if (!response.ok) {
        throw new Error("Backend health check failed");
      }

      console.log("HealthGuard backend connected.");
    } catch (error) {
      console.error("Backend connection error:", error);
    }
  }

  // -------------------------------
  // BILL IMAGE PREVIEW
  // -------------------------------

  $("billImage")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    const preview = $("billPreview");

    if (!file || !preview) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image.");
      event.target.value = "";
      return;
    }

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
  });

  // -------------------------------
  // BILL CHECKER
  // -------------------------------

  function renderBillItems() {
    const table = $("billItems");
    if (!table) return;

    table.innerHTML = "";

    state.items.forEach((item, index) => {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = item.name;

      const priceCell = document.createElement("td");
      priceCell.textContent = money(item.price);

      const actionCell = document.createElement("td");
      const removeButton = document.createElement("button");

      removeButton.textContent = "Remove";
      removeButton.className = "btn btn-dark";
      removeButton.style.marginTop = "0";
      removeButton.addEventListener("click", () => {
        state.items.splice(index, 1);
        renderBillItems();
      });

      actionCell.appendChild(removeButton);
      row.append(nameCell, priceCell, actionCell);
      table.appendChild(row);
    });

    const total = state.items.reduce(
      (sum, item) => sum + item.price,
      0
    );

    if ($("billTotal")) {
      $("billTotal").textContent = money(total);
    }
  }

  $("addItemBtn")?.addEventListener("click", () => {
    const name = $("itemName")?.value.trim();
    const price = Number($("itemPrice")?.value);

    if (!name || $("itemPrice")?.value === "" ||
        !Number.isFinite(price) || price < 0) {
      alert("Please enter a valid item name and amount.");
      return;
    }

    const duplicate = state.items.some(
      (item) => item.name.toLowerCase() === name.toLowerCase()
    );

    state.items.push({ name, price, duplicate });
    $("itemName").value = "";
    $("itemPrice").value = "";

    renderBillItems();
  });

  $("checkBillBtn")?.addEventListener("click", () => {
    const result = $("billResult");

    if (state.items.length === 0) {
      showMessage(result, "Please add at least one bill item.", "error");
      return;
    }

    state.billChecks++;

    const counts = {};
    state.items.forEach((item) => {
      const key = item.name.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });

    const duplicates = Object.entries(counts)
      .filter(([, count]) => count > 1)
      .map(([name]) => name);

    state.flaggedItems += duplicates.length;

    if (duplicates.length > 0) {
      showMessage(
        result,
        `Possible duplicate entries found: ${duplicates.join(", ")}. Please verify these items against your original bill.`,
        "error"
      );
    } else {
      showMessage(
        result,
        "No duplicate item names were found in the entries you added. This does not confirm that the bill is medically or financially correct.",
        "success"
      );
    }

    updateStats();
  });

  // -------------------------------
  // GOVERNMENT DOCUMENT SCANNER
  // -------------------------------

  let selectedDocumentFile = null;

  $("documentImage")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    const preview = $("documentPreview");

    selectedDocumentFile = null;

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      event.target.value = "";
      return;
    }

    selectedDocumentFile = file;

    if (preview) {
      preview.src = URL.createObjectURL(file);
      preview.style.display = "block";
    }

    if ($("documentResult")) {
      $("documentResult").style.display = "none";
    }

    if ($("ocrText")) {
      $("ocrText").value = "";
    }

    if ($("scanProgress")) {
      $("scanProgress").textContent = "";
    }
  });

  function getDocumentRules(type, text) {
    const normalized = text.toUpperCase();

    if (type === "pan") {
      const panPattern = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/;
      const match = normalized.match(panPattern);

      return {
        found: Boolean(match),
        value: match ? match[0] : "",
        message: match
          ? "PAN-like number format found."
          : "PAN number format was not detected."
      };
    }

    if (type === "aadhaar") {
      const digits = text.replace(/\D/g, "");
      const match = digits.match(/\d{12}/);

      return {
        found: Boolean(match),
        value: match ? match[0] : "",
        message: match
          ? "12-digit Aadhaar-like number format found."
          : "12-digit number format was not detected."
      };
    }

    if (type === "voter") {
      const voterPattern = /\b[A-Z]{3}[0-9]{7}\b/;
      const match = normalized.match(voterPattern);

      return {
        found: Boolean(match),
        value: match ? match[0] : "",
        message: match
          ? "Voter ID-like format found."
          : "Voter ID format was not detected."
      };
    }

    if (type === "driving") {
      const compact = normalized.replace(/[^A-Z0-9]/g, "");
      const dlPattern = /[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7,11}/;
      const match = compact.match(dlPattern);

      return {
        found: Boolean(match),
        value: match ? match[0] : "",
        message: match
          ? "Driving Licence-like number pattern found."
          : "Driving Licence number pattern was not detected. Some state formats may differ."
      };
    }

    return {
      found: false,
      value: "",
      message: "Document type not supported."
    };
  }

  function maskSensitiveText(text, type) {
    if (type === "aadhaar") {
      return text.replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, (number) => {
        const digits = number.replace(/\D/g, "");
        return `XXXX-XXXX-${digits.slice(-4)}`;
      });
    }

    return text;
  }

  $("scanDocumentBtn")?.addEventListener("click", async () => {
    const file = selectedDocumentFile;
    const type = $("documentType")?.value;
    const result = $("documentResult");
    const progress = $("scanProgress");
    const textArea = $("ocrText");
    const button = $("scanDocumentBtn");

    if (!file) {
      showMessage(result, "Please upload a document image first.", "error");
      return;
    }

    if (!window.Tesseract) {
      showMessage(
        result,
        "OCR library could not load. Check your internet connection and refresh the page.",
        "error"
      );
      return;
    }

    button.disabled = true;
    button.textContent = "Scanning...";
    progress.textContent = "Preparing OCR engine...";

    try {
      const worker = await Tesseract.createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            progress.textContent =
              `Reading document: ${Math.round(message.progress * 100)}%`;
          } else {
            progress.textContent = message.status;
          }
        }
      });

      const recognition = await worker.recognize(file);
      await worker.terminate();

      const extractedText = recognition.data.text || "";

      const rules = getDocumentRules(type, extractedText);

      // Mask Aadhaar number before displaying OCR output.
      if (textArea) {
        textArea.value = maskSensitiveText(extractedText, type);
      }

      const documentNames = {
        pan: "PAN Card",
        driving: "Driving Licence",
        voter: "Voter ID",
        aadhaar: "Aadhaar Card"
      };

      const maskedValue = type === "aadhaar" && rules.value
        ? `XXXX-XXXX-${rules.value.slice(-4)}`
        : rules.value;

      const message = rules.found
        ? `${documentNames[type]}: ${rules.message} Detected value: ${maskedValue}. This is only a format check, not official verification.`
        : `${documentNames[type]}: ${rules.message} Please check the image quality and document details.`;

      showMessage(
        result,
        message,
        rules.found ? "success" : "error"
      );

      progress.textContent = "Document scanning completed.";
    } catch (error) {
      console.error("OCR error:", error);
      showMessage(
        result,
        "Unable to scan this image. Try a clearer image with good lighting.",
        "error"
      );
      progress.textContent = "Scanning failed.";
    } finally {
      button.disabled = false;
      button.textContent = "Scan Document";
    }
  });

  // -------------------------------
  // REPORT ISSUE - BACKEND API
  // -------------------------------

  $("complaintForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const category = $("category")?.value;
    const description = $("description")?.value.trim();
    const contactPreference = $("contactPreference")?.value;
    const messageBox = $("formMessage");

    if (!category || !description) {
      showMessage(
        messageBox,
        "Please fill in all required fields.",
        "error"
      );
      return;
    }

    const submitButton = event.target.querySelector(
      'button[type="submit"]'
    );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Submitting...";
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/complaints`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          category,
          description,
          contactPreference
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to submit report.");
      }

      showMessage(
        messageBox,
        `Your report has been submitted successfully. Reference: ${data.reference || data.complaint?.reference || "Check the case tracker"}`,
        "success"
      );

      event.target.reset();
      await loadComplaints();
    } catch (error) {
      console.error("Complaint submission error:", error);

      showMessage(
        messageBox,
        `Report submission failed: ${error.message}. Please check that the backend is running.`,
        "error"
      );
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Submit Report";
      }
    }
  });

  // -------------------------------
  // CASE TRACKER - GET API
  // -------------------------------

  function getComplaintList(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.complaints)) return data.complaints;
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  async function loadComplaints() {
    if (state.loadingReports) return;

    state.loadingReports = true;

    const table = $("caseTable");

    if (table) {
      table.innerHTML =
        '<tr><td colspan="5">Loading reports...</td></tr>';
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/complaints`);

      if (!response.ok) {
        throw new Error("Could not load complaints.");
      }

      const data = await response.json();

      state.reports = getComplaintList(data);

      renderComplaints();
      updateStats();
    } catch (error) {
      console.error("Complaint loading error:", error);

      if (table) {
        table.innerHTML =
          '<tr><td colspan="5">Unable to load reports. Check backend connection.</td></tr>';
      }

      if ($("filterMessage")) {
        $("filterMessage").textContent = error.message;
      }
    } finally {
      state.loadingReports = false;
    }
  }

  function renderComplaints() {
    const table = $("caseTable");
    if (!table) return;

    const search = ($("complaintSearch")?.value || "").toLowerCase();
    const category = $("categoryFilter")?.value || "";
    const status = $("statusFilter")?.value || "";

    const filtered = state.reports.filter((report) => {
      const reference = String(report.reference || "").toLowerCase();
      const description = String(report.description || "").toLowerCase();

      const matchesSearch =
        reference.includes(search) || description.includes(search);

      const matchesCategory =
        !category || report.category === category;

      const matchesStatus =
        !status || report.status === status;

      return matchesSearch && matchesCategory && matchesStatus;
    });

    table.innerHTML = "";

    if (filtered.length === 0) {
      table.innerHTML =
        '<tr><td colspan="5">No matching reports found.</td></tr>';
    } else {
      filtered.forEach((report) => {
        const row = document.createElement("tr");

        let statusClass = "";

        if (report.status === "Resolved") {
          statusClass = "resolved";
        } else if (report.status === "Under Review") {
          statusClass = "review";
        }

        const date = report.createdAt
          ? new Date(report.createdAt).toLocaleDateString("en-IN")
          : "—";

        row.innerHTML = `
          <td>${escapeHTML(report.reference || "—")}</td>
          <td>${escapeHTML(report.category || "—")}</td>
          <td>${escapeHTML(report.description || "—")}</td>
          <td>
            <span class="status-pill ${statusClass}">
              ${escapeHTML(report.status || "Pending")}
            </span>
          </td>
          <td>${escapeHTML(date)}</td>
        `;

        table.appendChild(row);
      });
    }

    if ($("filterMessage")) {
      $("filterMessage").textContent =
        `Showing ${filtered.length} of ${state.reports.length} reports.`;
    }
  }

  $("complaintSearch")?.addEventListener("input", renderComplaints);
  $("categoryFilter")?.addEventListener("change", renderComplaints);
  $("statusFilter")?.addEventListener("change", renderComplaints);

  $("refreshCases")?.addEventListener("click", loadComplaints);

  // -------------------------------
  // INITIALIZE APPLICATION
  // -------------------------------

  checkBackend();
  loadComplaints();
  renderBillItems();
  updateStats();
});
