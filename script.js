
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

  const money = (value) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2
    }).format(Number(value) || 0);

  function showMessage(element, message, type = "success") {
    if (!element) return;

    element.textContent = message;
    element.className =
      `result-box ${type === "error" ? "error" : type === "warning" ? "warning" : ""}`;
    element.hidden = false;
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function updateStats() {
    if ($("totalFlags")) {
      $("totalFlags").textContent = state.flaggedItems;
    }

    if ($("totalChecks")) {
      $("totalChecks").textContent = state.billChecks;
    }

    if ($("totalReports")) {
      $("totalReports").textContent = state.reports.length;
    }

    if ($("totalSafety")) {
      $("totalSafety").textContent = state.reports.filter((report) => {
        const category = String(report.category || "").toLowerCase();
        return category.includes("safety") || category.includes("negligence");
      }).length;
    }
  }

  // Sidebar
  const sidebar = $("sidebar");

  $("menuToggle")?.addEventListener("click", () => {
    sidebar?.classList.toggle("open");
  });

  document.querySelectorAll(".nav-link, .brand, .top-action").forEach((link) => {
    link.addEventListener("click", () => sidebar?.classList.remove("open"));
  });

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", () => {
      document.querySelectorAll(".nav-link").forEach((item) => {
        item.classList.remove("active");
      });

      link.classList.add("active");
    });
  });

  // Bill image preview
  $("billImage")?.addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    const preview = $("preview");

    if (!file || !preview) return;

    if (!file.type.startsWith("image/")) {
      showMessage($("billResult"), "Please choose a valid image file.", "error");
      event.target.value = "";
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showMessage(
        $("billResult"),
        "Image is too large. Please choose an image under 8 MB.",
        "error"
      );

      event.target.value = "";
      return;
    }

    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    preview.alt = `Preview of ${file.name}`;

    showMessage(
      $("billResult"),
      "Bill image selected. Add the bill items manually below to run the duplicate-name check.",
      "warning"
    );
  });

  // Bill item management
  function renderItems() {
    const container = $("items");
    if (!container) return;

    if ($("itemCount")) {
      $("itemCount").textContent =
        `${state.items.length} ${state.items.length === 1 ? "item" : "items"}`;
    }

    const total = state.items.reduce((sum, item) => sum + item.price, 0);

    if ($("billTotal")) {
      $("billTotal").textContent = money(total);
    }

    if (!state.items.length) {
      container.innerHTML =
        '<div class="empty-state">Your added items will appear here.</div>';
      return;
    }

    container.innerHTML = state.items.map((item, index) => `
      <div class="bill-item-row">
        <span class="bill-item-name">${escapeHTML(item.name)}</span>
        <span class="bill-item-price">${money(item.price)}</span>
        <button
          type="button"
          class="remove-item"
          data-remove="${index}"
          aria-label="Remove ${escapeHTML(item.name)}"
        >×</button>
      </div>
    `).join("");
  }

  $("addItem")?.addEventListener("click", () => {
    const nameInput = $("itemName");
    const priceInput = $("itemPrice");

    if (!nameInput || !priceInput) return;

    const name = nameInput.value.trim();
    const priceText = priceInput.value.trim();
    const price = Number(priceText);

    if (!name) {
      nameInput.focus();
      showMessage($("billResult"), "Please enter a bill item name.", "error");
      return;
    }

    if (priceText === "" || !Number.isFinite(price) || price < 0) {
      priceInput.focus();
      showMessage(
        $("billResult"),
        "Please enter a valid amount of ₹0 or more.",
        "error"
      );
      return;
    }

    state.items.push({ name, price });

    nameInput.value = "";
    priceInput.value = "";

    renderItems();
    nameInput.focus();

    if ($("billResult")) $("billResult").hidden = true;
  });

  ["itemName", "itemPrice"].forEach((id) => {
    $(id)?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        $("addItem")?.click();
      }
    });
  });

  $("items")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-remove]");
    if (!button) return;

    const index = Number(button.dataset.remove);

    if (Number.isInteger(index)) {
      state.items.splice(index, 1);
      renderItems();
    }
  });

  $("checkBill")?.addEventListener("click", () => {
    if (!state.items.length) {
      showMessage(
        $("billResult"),
        "Add at least one bill item before running the check.",
        "warning"
      );
      return;
    }

    state.billChecks += 1;

    const counts = new Map();

    state.items.forEach((item) => {
      const key = normalizeText(item.name);
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    const duplicates = [...counts.entries()].filter(([, count]) => count > 1);

    state.flaggedItems = duplicates.reduce(
      (sum, [, count]) => sum + count - 1,
      0
    );

    updateStats();

    if (duplicates.length) {
      const names = duplicates
        .map(([name, count]) => `"${name}" (${count} entries)`)
        .join(", ");

      showMessage(
        $("billResult"),
        `Potential duplicate names found: ${names}. Review the original bill to decide whether these entries are legitimate.`,
        "warning"
      );
    } else {
      showMessage(
        $("billResult"),
        "No repeated item names were found in the entries you added. This does not confirm that the bill is correct or fraud-free.",
        "success"
      );
    }
  });

  // Check backend health
  async function checkServer() {
    const status = $("serverStatus");
    if (!status) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/health`);

      if (!response.ok) {
        throw new Error("Health endpoint returned an error");
      }

      const data = await response.json();

      if (data.success === false) {
        throw new Error("Health check unsuccessful");
      }

      status.textContent = "System connected";
      status.title = "Backend health endpoint responded successfully";
    } catch (error) {
      console.error("Backend health check failed:", error);

      status.textContent = "Connection issue";
      status.title = "Check backend server and CORS configuration";
    }
  }

  // Reports helpers
  function extractReports(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.complaints)) return data.complaints;
    if (Array.isArray(data?.reports)) return data.reports;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.data?.complaints)) return data.data.complaints;

    return null;
  }

  function getReference(report) {
    return report.reference ||
      report.referenceNumber ||
      report.complaintId ||
      report._id ||
      report.id ||
      "—";
  }

  function getStatus(report) {
    return String(report.status || report.state || "Pending").trim();
  }

  function getDate(report) {
    const value =
      report.createdAt ||
      report.created_at ||
      report.submittedAt ||
      report.date;

    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function statusClass(status) {
    const normalized = normalizeText(status).replace(/\s+/g, "-");

    if (["resolved", "closed", "completed"].includes(normalized)) {
      return normalized;
    }

    if (["under-review", "in-progress"].includes(normalized)) {
      return normalized;
    }

    if (normalized === "open") return "open";

    return "";
  }

  function renderReports() {
    const tbody = $("caseTable");
    if (!tbody) return;

    const search = normalizeText($("complaintSearch")?.value);
    const category = normalizeText($("categoryFilter")?.value);
    const status = normalizeText($("statusFilter")?.value);

    const filtered = state.reports.filter((report) => {
      const ref = String(getReference(report));
      const description = String(
        report.description || report.message || report.complaint || ""
      );
      const reportCategory = String(report.category || "Other");
      const reportStatus = getStatus(report);

      const searchable = normalizeText(
        `${ref} ${description} ${reportCategory} ${reportStatus}`
      );

      return (!search || searchable.includes(search)) &&
        (!category || normalizeText(reportCategory) === category) &&
        (!status || normalizeText(reportStatus) === status);
    });

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">${
        state.reports.length
          ? "No reports match these filters."
          : "No reports found. Submitted reports will appear here when available."
      }</td></tr>`;
    } else {
      tbody.innerHTML = filtered.map((report) => {
        const ref = getReference(report);
        const categoryName = report.category || "Other";
        const description =
          report.description ||
          report.message ||
          report.complaint ||
          "No description provided";
        const statusName = getStatus(report);

        return `
          <tr>
            <td><span class="reference-text">${escapeHTML(ref)}</span></td>
            <td>${escapeHTML(categoryName)}</td>
            <td class="description-cell">${escapeHTML(description)}</td>
            <td>
              <span class="status-badge ${escapeHTML(statusClass(statusName))}">
                ${escapeHTML(statusName)}
              </span>
            </td>
            <td>${escapeHTML(getDate(report))}</td>
          </tr>
        `;
      }).join("");
    }

    const feedback = $("filterMessage");

    if (feedback) {
      feedback.textContent =
        `Showing ${filtered.length} of ${state.reports.length} report${state.reports.length === 1 ? "" : "s"}.`;
    }

    updateStats();
  }

  async function loadReports() {
    if (state.loadingReports) return;

    state.loadingReports = true;

    const refreshButton = $("refreshCases");

    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.textContent = "↻ Loading...";
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/complaints`);

      let data;

      try {
        data = await response.json();
      } catch {
        throw new Error("The server returned an invalid response.");
      }

      if (!response.ok || data?.success === false) {
        throw new Error(data?.message || "Unable to load reports.");
      }

      const reports = extractReports(data);

      if (!reports) {
        throw new Error("The reports response format is not recognized.");
      }

      state.reports = reports;
      renderReports();
    } catch (error) {
      console.error("Loading reports failed:", error);

      const feedback = $("filterMessage");

      if (feedback) {
        feedback.textContent =
          error.message || "Unable to load reports. Check your backend connection.";
      }

      const tbody = $("caseTable");

      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="5" class="table-empty">Could not load reports. Check the backend and API connection.</td></tr>';
      }
    } finally {
      state.loadingReports = false;

      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.textContent = "↻ Refresh reports";
      }
    }
  }

  $("refreshCases")?.addEventListener("click", loadReports);
  $("complaintSearch")?.addEventListener("input", renderReports);
  $("categoryFilter")?.addEventListener("change", renderReports);
  $("statusFilter")?.addEventListener("change", renderReports);

  // Complaint submission
  const complaintForm = $("complaintForm");

  if (complaintForm) {
    complaintForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const category = $("complaintCategory")?.value;
      const description = $("complaintText")?.value.trim();
      const contactPreference = $("contactMethod")?.value || "none";
      const button = $("submitReport");
      const result = $("reportResult");

      if (!category || !description || description.length < 10) {
        showMessage(
          result,
          "Please select a category and describe the concern in at least 10 characters.",
          "error"
        );
        return;
      }

      if (button) {
        button.disabled = true;
        button.textContent = "Submitting report...";
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

        let data;

        try {
          data = await response.json();
        } catch {
          throw new Error("The server returned an invalid response.");
        }

        if (!response.ok || data?.success === false) {
          throw new Error(data?.message || "Unable to submit the report.");
        }

        const complaint =
          data.complaint || data.report || data.data?.complaint || data.data;

        const reference =
          complaint && typeof complaint === "object"
            ? getReference(complaint)
            : null;

        showMessage(
          result,
          `Your report was submitted successfully.${
            reference && reference !== "—" ? ` Reference: ${reference}.` : ""
          } Keep this reference for your records.`,
          "success"
        );

        complaintForm.reset();
        await loadReports();
      } catch (error) {
        console.error("Complaint submission failed:", error);

        showMessage(
          result,
          `${error.message || "Unable to submit the report."} Check the backend server and CORS settings.`,
          "error"
        );
      } finally {
        if (button) {
          button.disabled = false;
          button.innerHTML = 'Submit safety report <span>→</span>';
        }
      }
    });
  } else {
    console.error(
      'HealthGuard: form with id="complaintForm" was not found in index.html.'
    );
  }

  renderItems();
  updateStats();
  checkServer();
  loadReports();
});
