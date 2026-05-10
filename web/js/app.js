(() => {
    const CTX = window.CTX || "";
    const TAX_RATE = 0.12;

    const cart = new Map();

    function tick() {
        const d = new Date();
        const t = d.toLocaleString("en-PH", { hour12: false });
        const el = document.getElementById("clock");
        if (el) el.textContent = t;
    }
    tick(); setInterval(tick, 1000);

    const peso = c => "₱" + c.toLocaleString("en-PH", {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });

    function recalc() {
        let count = 0, sub = 0;
        for (const { product, qty } of cart.values()) {
            count += qty;
            sub += product.price * qty;
        }
        const tax = sub * TAX_RATE;
        const total = sub + tax;

        document.getElementById("sumCount").textContent = count;
        document.getElementById("sumSubtotal").textContent = peso(sub);
        document.getElementById("sumTax").textContent = peso(tax);
        document.getElementById("sumTotal").textContent = peso(total);
        document.getElementById("checkoutBtn").disabled = cart.size === 0;
        renderCart();
        return { sub, tax, total, count };
    }

    function renderCart() {
        const tbody = document.getElementById("cartBody");
        if (cart.size === 0) {
            tbody.innerHTML =
                '<tr><td colspan="6"><div class="cart-empty">' +
                '<div class="big">🛒</div>' +
                '<div>Your cart is empty.</div>' +
                '<div style="font-size:12.5px;margin-top:4px;">Search a Product ID to begin.</div>' +
                '</div></td></tr>';
            return;
        }
        const rows = [];
        for (const [id, item] of cart.entries()) {
            const sub = item.product.price * item.qty;
            rows.push(
                `<tr data-id="${id}">
                    <td><strong>#${id}</strong></td>
                    <td>${escapeHtml(item.product.name)}</td>
                    <td style="text-align:right;">${peso(item.product.price)}</td>
                    <td style="text-align:center;">
                        <span class="qty">
                            <button data-act="dec" data-id="${id}">−</button>
                            <strong>${item.qty}</strong>
                            <button data-act="inc" data-id="${id}">+</button>
                        </span>
                    </td>
                    <td style="text-align:right;"><strong>${peso(sub)}</strong></td>
                    <td style="text-align:right;">
                        <button class="btn btn-danger" data-act="rm" data-id="${id}">Remove</button>
                    </td>
                </tr>`
            );
        }
        tbody.innerHTML = rows.join("");
    }

    document.getElementById("cartBody").addEventListener("click", (e) => {
        const btn = e.target.closest("button[data-act]");
        if (!btn) return;
        const id = parseInt(btn.dataset.id, 10);
        const item = cart.get(id);
        if (!item) return;
        const act = btn.dataset.act;
        if (act === "rm") cart.delete(id);
        else if (act === "inc") item.qty += 1;
        else if (act === "dec") {
            item.qty -= 1;
            if (item.qty <= 0) cart.delete(id);
        }
        recalc();
    });

    const input = document.getElementById("searchInput");
    const result = document.getElementById("searchResult");

    async function doSearch() {
        const id = input.value.trim();
        if (!id) return;
        try {
            const r = await fetch(`${CTX}/api/search?id=${encodeURIComponent(id)}`);
            const data = await r.json();
            if (!data.success) {
                result.className = "search-result error";
                result.innerHTML = `<span><strong>Not found:</strong> Product ID ${escapeHtml(id)}</span>
                                    <span class="meta">${data.comparisons||0} comparisons</span>`;
                return;
            }
            const p = data.product;
            const existing = cart.get(p.id);
            if (existing) existing.qty += 1;
            else cart.set(p.id, { product: p, qty: 1 });

            const us = (data.timeNs / 1000).toFixed(1);
            result.className = "search-result found";
            result.innerHTML =
                `<span><strong>#${p.id}</strong> · ${escapeHtml(p.name)} · ${peso(p.price)}</span>
                 <span class="meta">${data.comparisons} comparisons · ${us} μs · n=${data.datasetSize.toLocaleString()}</span>`;
            input.value = "";
            input.focus();
            recalc();
            toast(`Added ${escapeHtml(p.name)} to cart`, "success");
        } catch (err) {
            toast("Search failed: " + err.message, "error");
        }
    }

    document.getElementById("searchBtn").addEventListener("click", doSearch);
    input.addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });

    document.getElementById("clearBtn").addEventListener("click", () => {
        if (cart.size === 0) return;
        cart.clear();
        recalc();
        toast("Cart cleared");
    });

    const modal = document.getElementById("paymentModal");
    const cashIn = document.getElementById("cashInput");
    const confirmBtn = document.getElementById("confirmBtn");
    let lastResult = null;
    let lastTotals = null;

    function openModal() {
        const t = recalc();
        if (t.count === 0) return;
        lastTotals = t;
        document.getElementById("modalTotal").textContent = peso(t.total);
        document.getElementById("modalSub").textContent   = peso(t.sub);
        document.getElementById("modalTax").textContent   = peso(t.tax);
        document.getElementById("changeAmount").textContent = peso(0);
        document.getElementById("modalGreedyUnits").textContent = "--";
        document.getElementById("modalDpUnits").textContent = "--";
        document.getElementById("breakdownList").innerHTML =
            '<div class="cart-empty" style="padding:30px 10px;"><div style="font-size:13px;">Enter cash tendered to compute change.</div></div>';
        document.getElementById("totalUnits").textContent = "0 units";
        document.getElementById("savedPill").textContent = "OPTIMAL MIX";
        document.getElementById("savedPill").style.background = "var(--surface-soft)";
        document.getElementById("savedPill").style.color = "var(--muted)";
        cashIn.value = "";
        confirmBtn.disabled = true;
        modal.classList.add("show");
        setTimeout(() => cashIn.focus(), 100);
    }
    function closeModal() { modal.classList.remove("show"); }

    document.getElementById("checkoutBtn").addEventListener("click", openModal);
    document.getElementById("closeModal").addEventListener("click", closeModal);
    document.getElementById("backBtn").addEventListener("click", closeModal);
    modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });

    let cashTimer;
    cashIn.addEventListener("input", () => {
        clearTimeout(cashTimer);
        cashTimer = setTimeout(computeChange, 200);
    });

    async function computeChange() {
        const t = lastTotals;
        if (!t) return;
        const cash = parseFloat(cashIn.value);
        const greedyDisplay = document.getElementById("modalGreedyUnits");
        const dpDisplay = document.getElementById("modalDpUnits");
        const pill = document.getElementById("savedPill");

        if (isNaN(cash) || cash <= 0) {
            document.getElementById("changeAmount").textContent = peso(0);
            greedyDisplay.textContent = "--";
            dpDisplay.textContent = "--";
            confirmBtn.disabled = true;
            return;
        }
        if (cash < t.total) {
            document.getElementById("changeAmount").textContent = peso(t.total - cash) + " short";
            document.getElementById("breakdownList").innerHTML =
                '<div class="cart-empty" style="padding:30px 10px;color:var(--danger);">' +
                '<div style="font-size:13px;">Cash tendered is less than the total due.</div></div>';
            document.getElementById("totalUnits").textContent = "—";
            greedyDisplay.textContent = "--";
            dpDisplay.textContent = "--";
            confirmBtn.disabled = true;
            return;
        }
        const totalCent = Math.round(t.total * 100);
        const cashCent  = Math.round(cash    * 100);
        
        try {
            const r = await fetch(`${CTX}/api/payment?total=${totalCent}&cash=${cashCent}`);
            const data = await r.json();
            lastResult = data;

            if (!data.success) {
                document.getElementById("breakdownList").innerHTML =
                    `<div class="cart-empty" style="padding:30px 10px;color:var(--danger);">
                        <div style="font-size:13px;">${escapeHtml(data.message)}</div></div>`;
                document.getElementById("totalUnits").textContent = "—";
                greedyDisplay.textContent = "Fail";
                dpDisplay.textContent = "N/A";
                confirmBtn.disabled = true;
                return;
            }

            const change = data.changeCentavos / 100;
            document.getElementById("changeAmount").textContent = peso(change);

            greedyDisplay.textContent = data.greedyUnits >= 0 ? data.greedyUnits + " units" : "Fail";
            dpDisplay.textContent = data.totalUnits + " units";

            if (data.unitsSaved > 0) {
                pill.textContent = data.unitsSaved + " UNITS SAVED";
                pill.style.background = "var(--accent-soft)";
                pill.style.color = "var(--accent-strong)";
            } else {
                pill.textContent = "OPTIMAL MIX";
                pill.style.background = "var(--surface-soft)";
                pill.style.color = "var(--muted)";
            }

            const list = document.getElementById("breakdownList");
            if (data.breakdown.length === 0) {
                list.innerHTML = '<div class="cart-empty" style="padding:30px 10px;"><div style="font-size:13px;">No change required.</div></div>';
            } else {
                list.innerHTML = data.breakdown.map(d => {
                    const isBill = d.isBill === true;
                    return `<div class="denom-row">
                                <div class="denom-icon">${isBill ? billIcon() : coinIcon()}</div>
                                <div class="denom-info">
                                    <div class="denom-name">${escapeHtml(d.label)}</div>
                                    <div class="denom-type">${isBill ? "Paper Currency" : "Metal Unit"}</div>
                                </div>
                                <div class="denom-count">x ${d.count}</div>
                            </div>`;
                }).join("");
            }
            document.getElementById("totalUnits").textContent = `${data.totalUnits} units`;
            confirmBtn.disabled = false;
        } catch (err) {
            toast("Payment calculation error", "error");
        }
    }

    function billIcon() {
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/></svg>';
    }
    function coinIcon() {
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="9" r="6"/><circle cx="15" cy="15" r="6"/></svg>';
    }

    async function finalizeTransaction() {
        if (!lastResult || !lastTotals) return null;
        const totalCent = Math.round(lastTotals.total * 100);
        const cashCent  = Math.round(parseFloat(cashIn.value) * 100);
        try {
            const r = await fetch(`${CTX}/api/finalize`, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `total=${totalCent}&cash=${cashCent}`
            });
            const data = await r.json();
            if (!r.ok || !data.success) {
                toast(data.error || "Finalize failed", "error");
                return null;
            }
            return data;
        } catch (err) {
            toast("Finalize failed: " + err.message, "error");
            return null;
        }
    }

    confirmBtn.addEventListener("click", async () => {
        if (!lastResult || !lastTotals) return;
        confirmBtn.disabled = true;
        const fin = await finalizeTransaction();
        if (!fin) {
            confirmBtn.disabled = false;
            return;
        }
        toast("Drawer updated · " + fin.totalUnits + " units dispensed", "success");
        showReceipt(lastTotals, lastResult);
    });
    document.getElementById("printPreviewBtn").addEventListener("click", () => {
        if (!lastResult || !lastTotals) {
            toast("Compute change first", "error");
            return;
        }
        showReceipt(lastTotals, lastResult);
    });

    function showReceipt(totals, res) {
        const overlay = document.getElementById("receiptOverlay");
        const r = document.getElementById("receipt");
        const items = [];
        for (const { product, qty } of cart.values()) {
            items.push(`<div class="line"><span>${qty}× ${escapeHtml(product.name)}</span><span>${peso(product.price*qty)}</span></div>`);
        }
        const breakdown = res.breakdown.map(d => `<div class="line"><span>${escapeHtml(d.label)}</span><span>x ${d.count}</span></div>`).join("");
        const txnId = "TXN-" + Date.now().toString().slice(-8);
        r.innerHTML = `
            <h3>DYNAMEX</h3>
            <div class="center">Optimized POS Platform<br/>${new Date().toLocaleString("en-PH")}<br/>${txnId}</div>
            <hr/>
            ${items.join("")}
            <hr/>
            <div class="line"><span>Subtotal</span><span>${peso(totals.sub)}</span></div>
            <div class="line"><span>VAT (12%)</span><span>${peso(totals.tax)}</span></div>
            <div class="line"><strong>TOTAL</strong><strong>${peso(totals.total)}</strong></div>
            <div class="line"><span>Cash Tendered</span><span>${peso(parseFloat(cashIn.value))}</span></div>
            <div class="line"><strong>Change</strong><strong>${peso(res.changeCentavos/100)}</strong></div>
            <hr/>
            <div class="center" style="margin-bottom:8px;font-weight:bold;">Optimal Change (${res.totalUnits} units)</div>
            ${breakdown}
            <hr/>
            <div class="center">Thank you for shopping!<br/>Powered by O(log n) + Bounded DP</div>
            <div class="actions">
                <button class="btn btn-secondary" id="printBtn" style="flex:1;">Print</button>
                <button class="btn btn-primary" id="newTxnBtn" style="flex:1;">New Transaction</button>
            </div>`;
        overlay.classList.add("show");

        document.getElementById("printBtn").onclick = () => window.print();
        document.getElementById("newTxnBtn").onclick = () => {
            overlay.classList.remove("show");
            modal.classList.remove("show");
            cart.clear();
            lastResult = null;
            lastTotals = null;
            recalc();
            input.focus();
            toast("Ready for next transaction", "success");
        };
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c =>
            ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
    }
    function toast(msg, type = "") {
        const el = document.getElementById("toast");
        el.textContent = msg;
        el.className = "toast show " + type;
        setTimeout(() => { el.className = "toast " + type; }, 2400);
    }

    recalc();
})();
