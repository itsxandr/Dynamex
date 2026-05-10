(() => {
    const CTX = window.CTX || "";

    function tick() {
        const d = new Date().toLocaleString("en-PH", { hour12: false });
        const el = document.getElementById("clock");
        if (el) el.textContent = d;
    }
    tick(); setInterval(tick, 1000);

    const peso = c => "₱" + Number(c).toLocaleString("en-PH", {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c =>
            ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    }
    function toast(msg, type = "") {
        const el = document.getElementById("toast");
        el.textContent = msg;
        el.className = "toast show " + type;
        setTimeout(() => { el.className = "toast " + type; }, 2200);
    }

    const algoSelect = document.getElementById("algoSelect");
    const savedAlgo = localStorage.getItem("posAlgo") || "dp";
    algoSelect.value = savedAlgo;
    algoSelect.addEventListener("change", (e) => {
        const val = e.target.value;
        localStorage.setItem("posAlgo", val);
        toast(`Engine set to ${val === 'dp' ? 'Bounded DP' : 'Bounded Greedy'}`, "success");
    });

    async function loadMetrics() {
        try {
            const r = await fetch(`${CTX}/api/metrics`);
            const m = await r.json();
            
            document.getElementById("mDatasetSize").textContent = m.datasetSize.toLocaleString();
            document.getElementById("mBinaryTime").textContent = (m.binaryTimeNs / 1000).toFixed(1) + " μs";
            document.getElementById("mBinaryComp").textContent = `${m.binaryComparisons} steps`;
            document.getElementById("mLinearTime").textContent = (m.linearTimeNs / 1000).toFixed(1) + " μs";

            const speedup = m.binaryTimeNs > 0 ? (m.linearTimeNs / m.binaryTimeNs).toFixed(1) + "× faster" : "—";
            document.getElementById("mSpeedup").textContent = speedup;

            const dpUnits = m.dpUnits;
            const greedyUnits = m.greedyUnits;
            const dpEl = document.getElementById("mDpUnits");
            const greedyEl = document.getElementById("mGreedyUnits");
            const gainEl = document.getElementById("mEfficiencyGain");

            dpEl.textContent = dpUnits >= 0 ? dpUnits : "N/A";
            
            greedyEl.textContent = greedyUnits >= 0 ? `${greedyUnits} units` : "Fails";

            if (dpUnits >= 0 && greedyUnits >= 0) {
                if (greedyUnits > dpUnits) {
                    const saved = greedyUnits - dpUnits;
                    gainEl.textContent = `+${saved} Units Saved`;
                    gainEl.style.color = "var(--accent-strong)";
                } else {
                    gainEl.textContent = "Optimal";
                    gainEl.style.color = "var(--muted-2)";
                }
            } else if (dpUnits >= 0 && greedyUnits < 0) {
                gainEl.textContent = "Greedy Failed";
                gainEl.style.color = "var(--danger)";
            } else {
                gainEl.textContent = "Infeasible";
                gainEl.style.color = "var(--danger)";
            }
        } catch (err) {
            console.error("Failed to load metrics", err);
        }
    }

    document.getElementById("refreshMetricsBtn").addEventListener("click", () => {
        loadMetrics();
        toast("Algorithm Test Complete", "success");
    });

    let page = 1, size = 25, totalPages = 1, query = "";

    async function loadInventory() {
        const r = await fetch(`${CTX}/api/inventory?page=${page}&size=${size}` + (query ? `&q=${encodeURIComponent(query)}` : ""));
        const data = await r.json();
        totalPages = data.totalPages;

        const tbody = document.getElementById("invBody");
        if (data.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4"><div class="cart-empty">No items found.</div></td></tr>';
        } else {
            tbody.innerHTML = data.items.map(p => `
                <tr>
                    <td><strong>#${p.id}</strong></td>
                    <td>${escapeHtml(p.name)}</td>
                    <td style="text-align:right;">${peso(p.price)}</td>
                    <td style="text-align:right;">${p.stock.toLocaleString()}</td>
                </tr>
            `).join("");
        }
        document.getElementById("pageInfo").textContent = `Page ${page} of ${totalPages}`;
        document.getElementById("prevBtn").disabled = page <= 1;
        document.getElementById("nextBtn").disabled = page >= totalPages;
    }

    document.getElementById("firstBtn").onclick = () => { page = 1; loadInventory(); };
    document.getElementById("prevBtn").onclick  = () => { if (page > 1) { page--; loadInventory(); } };
    document.getElementById("nextBtn").onclick  = () => { if (page < totalPages) { page++; loadInventory(); } };
    document.getElementById("lastBtn").onclick  = () => { page = totalPages; loadInventory(); };

    const invSearch = document.getElementById("invSearch");
    if (invSearch) {
        let qTimer;
        invSearch.addEventListener("input", e => {
            clearTimeout(qTimer);
            qTimer = setTimeout(() => {
                query = e.target.value.trim();
                page = 1;
                loadInventory();
            }, 200);
        });
    }

    let denomCache = [];

    function formAvailUpdate(denom, available) {
        return new URLSearchParams({ denom, available }).toString();
    }
    function formQtyUpdate(denom, quantity) {
        return new URLSearchParams({ denom, quantity }).toString();
    }
    function formDelta(denom, delta) {
        return new URLSearchParams({ denom, delta }).toString();
    }

    async function postDenom(body) {
        const r = await fetch(`${CTX}/api/denominations`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body
        });
        if (!r.ok) {
            try {
                const err = await r.json();
                throw new Error(err.error || "Update failed");
            } catch (e) { throw new Error("Update failed"); }
        }
        return r.json();
    }

    function renderRegister() {
        const list = document.getElementById("registerList");
        if (!list) return;

        let totalCash = 0, billCount = 0, coinCount = 0, activeCount = 0;

        list.innerHTML = denomCache.map(d => {
            if (d.available && d.quantity > 0) activeCount++;
            const valuePeso = d.denom / 100;
            const subtotal = valuePeso * d.quantity;
            totalCash += subtotal;
            if (d.isBill) billCount += d.quantity; else coinCount += d.quantity;

            const cls = !d.available ? "disabled" : (d.quantity === 0 ? "empty" : "");
            const tagCls = d.isBill ? "bill" : "coin";
            const tagText = d.isBill ? "Bill" : "Coin";

            return `
                <div class="register-card ${cls}" data-denom="${d.denom}">
                    <div class="reg-head">
                        <div class="reg-label">${escapeHtml(d.label)}</div>
                        <span class="reg-tag ${tagCls}">${tagText}</span>
                    </div>
                    <div class="reg-qty">
                        <button data-act="dec" data-denom="${d.denom}" ${(!d.available || d.quantity <= 0) ? "disabled" : ""}>−</button>
                        <input type="number" class="reg-qty-input" min="0" step="1"
                               value="${d.quantity}" data-denom="${d.denom}"
                               ${!d.available ? "disabled" : ""} />
                        <button data-act="inc" data-denom="${d.denom}" ${!d.available ? "disabled" : ""}>+</button>
                    </div>
                    <div class="reg-foot">
                        <span>Face value: <span class="reg-value">${peso(valuePeso)}</span></span>
                        <span>Subtotal: <span class="reg-value">${peso(subtotal)}</span></span>
                    </div>
                </div>
            `;
        }).join("");

        document.getElementById("regTotalCash").textContent  = peso(totalCash);
        document.getElementById("regBillCount").textContent  = billCount.toLocaleString();
        document.getElementById("regCoinCount").textContent  = coinCount.toLocaleString();
        document.getElementById("regActiveCount").textContent = activeCount.toString();

        list.querySelectorAll("button[data-act]").forEach(btn => {
            btn.addEventListener("click", async () => {
                const denom = btn.dataset.denom;
                const delta = btn.dataset.act === "inc" ? 1 : -1;
                try {
                    const data = await postDenom(formDelta(denom, delta));
                    denomCache = data.denominations;
                    renderRegister();
                    renderDenomToggles();
                    loadMetrics();
                } catch (e) {
                    toast(e.message, "error");
                }
            });
        });

        list.querySelectorAll("input.reg-qty-input").forEach(inp => {
            inp.addEventListener("change", async () => {
                const denom = inp.dataset.denom;
                const q = Math.max(0, parseInt(inp.value, 10) || 0);
                try {
                    const data = await postDenom(formQtyUpdate(denom, q));
                    denomCache = data.denominations;
                    renderRegister();
                    renderDenomToggles();
                    loadMetrics();
                    toast(`Quantity updated`, "success");
                } catch (e) {
                    toast(e.message, "error");
                }
            });
            inp.addEventListener("focus", () => inp.select());
        });
    }

    function renderDenomToggles() {
        const list = document.getElementById("denomList");
        if (!list) return;
        list.innerHTML = denomCache.map(d => `
            <div class="denom-toggle-card ${d.available ? "" : "disabled"}" data-denom="${d.denom}">
                <div>
                    <div class="name">${escapeHtml(d.label)}</div>
                    <div class="status">${d.available ? "Available · Qty " + d.quantity : "Out of Stock"}</div>
                </div>
                <label class="toggle">
                    <input type="checkbox" ${d.available ? "checked" : ""} data-denom="${d.denom}" />
                    <span class="slider"></span>
                </label>
            </div>
        `).join("");

        list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener("change", async (e) => {
                const denom = e.target.dataset.denom;
                const available = e.target.checked;
                try {
                    const data = await postDenom(formAvailUpdate(denom, available));
                    denomCache = data.denominations;
                    renderRegister();
                    renderDenomToggles();
                    loadMetrics();
                } catch (err) {
                    toast(err.message, "error");
                }
            });
        });
    }

    async function loadDenoms() {
        const r = await fetch(`${CTX}/api/denominations`);
        const data = await r.json();
        denomCache = data.denominations;
        renderRegister();
        renderDenomToggles();
    }

    loadMetrics(); loadInventory(); loadDenoms();
})();
