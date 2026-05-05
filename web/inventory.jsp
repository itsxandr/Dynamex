<%@page contentType="text/html" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <title>Dynamex — Inventory &amp; Cash Drawer</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${pageContext.request.contextPath}/css/style.css" />
    <link rel="icon" href="${pageContext.request.contextPath}/images/logo.png" />
</head>
<body>

<header class="topbar">
    <div class="brand">
        <img src="${pageContext.request.contextPath}/images/logo.png" alt="Dynamex" />
        <div class="brand-text">
            <h1>Dynamex</h1>
            <small>Optimized POS Platform</small>
        </div>
    </div>
    <nav>
        <a href="${pageContext.request.contextPath}/">Transaction Hub</a>
        <a href="${pageContext.request.contextPath}/inventory.jsp" class="active">Inventory &amp; Drawer</a>
    </nav>
    <div class="clock" id="clock">--:--:--</div>
</header>

<main class="container">

    <div class="metrics-grid" id="metricsGrid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="metric-card">
            <div class="label">Dataset Size</div>
            <div class="value" id="mDatasetSize">&mdash;</div>
            <div class="delta">products loaded</div>
        </div>
        <div class="metric-card">
            <div class="label">Binary Search Time</div>
            <div class="value" id="mBinaryTime">&mdash;</div>
            <div class="delta" id="mBinaryComp">&mdash;</div>
        </div>
        <div class="metric-card">
            <div class="label">Linear Search Time</div>
            <div class="value" id="mLinearTime">&mdash;</div>
            <div class="delta" id="mSpeedup">&mdash;</div>
        </div>
        
        <div class="metric-card">
            <div class="label">Change Algorithm Comparison</div>
            <div style="display: flex; align-items: baseline; gap: 12px; margin-top: 5px;">
                <div class="value" id="mDpUnits" style="color: var(--primary);">--</div>
                <div style="font-size: 12px; color: var(--muted); font-weight: 600;">DP Units</div>
            </div>
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--surface-soft); display: flex; justify-content: space-between; align-items: center;">
                <div style="font-family: var(--font-mono); font-size: 11px; color: var(--muted);">
                    Greedy: <span id="mGreedyUnits" style="font-weight: 600;">--</span>
                </div>
                <div id="mEfficiencyGain" style="font-size: 10px; font-weight: 700; color: var(--accent-strong); text-transform: uppercase; letter-spacing: 0.05em;">
                    --
                </div>
            </div>
        </div>

        <div class="metric-card">
            <div class="label">Calculation Engine</div>
            <div class="value" style="margin: 10px 0;">
                <select id="algoSelect" class="algo-select">
                    <option value="dp">Bounded Dynamic Programming</option>
                    <option value="greedy">Bounded Greedy</option>
                </select>
            </div>
            <div class="delta">Logic for checkout</div>
        </div>
    </div>

    <section class="card" style="margin-bottom: 24px;">
        <div class="card-header">
            <div>
                <h2>Inventory Catalogue</h2>
                <div class="subtitle">Pre-sorted by Product ID — required for Binary Search.</div>
            </div>
            <button class="btn btn-secondary" id="refreshMetricsBtn">Run Algorithm Test</button>
        </div>
        <div class="card-body">
            <div class="inventory-toolbar">
                <input type="text" id="invSearch" placeholder="Filter by ID or name&hellip;" />
                <div class="pager">
                    <button id="firstBtn">&laquo;</button>
                    <button id="prevBtn">&lsaquo;</button>
                    <span class="page-info" id="pageInfo">Page 1 / 1</span>
                    <button id="nextBtn">&rsaquo;</button>
                    <button id="lastBtn">&raquo;</button>
                </div>
            </div>

            <table class="cart-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Name</th>
                        <th style="text-align:right;">Price</th>
                        <th style="text-align:right;">Stock</th>
                    </tr>
                </thead>
                <tbody id="invBody"></tbody>
            </table>
        </div>
    </section>

    <section class="card" style="margin-bottom: 24px;">
        <div class="card-header">
            <div>
                <h2>Cash Register Drawer</h2>
                <div class="subtitle">Track and adjust the exact quantity of each bill &amp; coin in the drawer. The Bounded DP only uses what is physically here.</div>
            </div>
            <span class="units-saved-pill">Bounded Supply</span>
        </div>
        <div class="card-body">
            <div class="reg-summary">
                <div class="stat">
                    <span class="k">Total Cash on Hand</span>
                    <span class="v" id="regTotalCash">&#8369;0.00</span>
                </div>
                <div class="stat">
                    <span class="k">Bills</span>
                    <span class="v" id="regBillCount">0</span>
                </div>
                <div class="stat">
                    <span class="k">Coins</span>
                    <span class="v" id="regCoinCount">0</span>
                </div>
                <div class="stat">
                    <span class="k">Distinct Denominations Active</span>
                    <span class="v" id="regActiveCount">0</span>
                </div>
            </div>
            <div class="register-grid" id="registerList"></div>
        </div>
    </section>

    <section class="card">
        <div class="card-header">
            <div>
                <h2>Denomination Availability</h2>
                <div class="subtitle">Toggle bills/coins on or off entirely (e.g. to simulate out-of-stock scenarios in the algorithm test).</div>
            </div>
            <span class="units-saved-pill">Resource Management</span>
        </div>
        <div class="card-body">
            <div class="denom-toggles" id="denomList"></div>
        </div>
    </section>

</main>

<div class="toast" id="toast"></div>

<script>
    window.CTX = "${pageContext.request.contextPath}";
</script>
<script src="${pageContext.request.contextPath}/js/inventory.js"></script>
</body>
</html>
