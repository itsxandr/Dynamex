# Dynamex — Optimized Transaction & Inventory Management System

A Java web application that demonstrates two algorithms working together in a Point-of-Sale workflow:

1. **Binary Search** — `O(log n)` inventory lookup over 10,000 products.
2. **Dynamic Programming Coin-Change** — `O(n × m)` optimal change-maker that handles "out-of-stock" denominations where a greedy approach fails.

Built with **Java 8 + Java EE 8 (`javax.servlet`) + JSP** as a Maven project so it opens directly in **Apache NetBeans** with **JDK 1.8**.

---

## Project Layout

```text
Dynamex/
├── pom.xml                            
└── src/main/
    ├── java/com/dynamex/
    │   ├── model/
    │   │   ├── Product.java
    │   │   ├── CartItem.java
    │   │   └── Denomination.java
    │   ├── service/
    │   │   ├── InventoryManager.java  <- Binary Search Algorithm
    │   │   ├── TransactionEngine.java <- DP Coin-Change Algorithm
    │   │   ├── CSVLoader.java
    │   │   └── AppState.java
    │   └── servlet/
    │       ├── SearchServlet.java     <- /api/search
    │       ├── PaymentServlet.java    <- /api/payment
    │       ├── InventoryServlet.java  <- /api/inventory
    │       ├── DenominationServlet.java <- /api/denominations
    │       ├── MetricsServlet.java    <- /api/metrics
    │       └── AppContextListener.java <- @WebListener (loads CSV on startup)
    ├── resources/products.csv         <- 10,000 pre-sorted products
    └── webapp/
        ├── index.jsp                  <- Search & Transaction Hub
        ├── inventory.jsp              <- Inventory & Resource Management Dashboard
        ├── css/style.css
        ├── js/app.js
        ├── js/inventory.js
        ├── images/logo.png
        └── WEB-INF/web.xml
```

---

## Running in NetBeans

### Prerequisites

- **Java JDK 1.8** (also works on JDK 11 — source/target is set to 1.8)
- **Apache NetBeans 12+** with the _Java EE / Web_ and _Maven_ plugin packs enabled
- A servlet container that supports `javax.servlet` (Servlet 4.0):
  - **Apache Tomcat 9.x** (recommended)
  - **Eclipse GlassFish** or **Payara**

> The project uses `javax.servlet` (Java EE 8 / Servlet 4.0), so it needs
> **Tomcat 9.x** — _not_ Tomcat 10+, because Tomcat 10 switched to `jakarta.servlet`.

### Steps

1. **Open NetBeans → File → Open Project** and pick the `Dynamex` folder.
   NetBeans will recognize the `pom.xml` and import it as a Maven Web Application.
2. Right-click the project → **Properties → Run → Server** and pick your installed Tomcat 9.
3. Right-click the project → **Run** (or press **F6**).
4. NetBeans launches the server, deploys the WAR, and opens
   `http://localhost:8080/Dynamex/` in your browser.

### Running from the command line — _no Tomcat install required_

The project bundles an embedded **Jetty 9.4** so you can run it standalone:

```bash
mvn jetty:run
# App is then available at http://localhost:5000/dynamex/
```

Or build a WAR for manual deployment:

```bash
mvn package
# Drop target/Dynamex.war into <tomcat-9>/webapps/ and start Tomcat.
```

---

## Application Flow

1. **System Initialization** — `AppContextListener` reads `products.csv` from the classpath into an `ArrayList<Product>`, sorts it by ID, and stores the `InventoryManager` in the application state.
2. **Product Search** — User types a Product ID on the Hub (`index.jsp`); the front-end calls `GET /api/search?id=…` which runs `InventoryManager.binarySearch()` and returns the product + algorithm metrics (comparisons, time in nanoseconds).
3. **Cart & Checkout** — The Hub maintains the cart, calculates subtotal + 12% VAT, and opens the **Payment & Optimization** modal.
4. **Change Optimization** — The cash field calls `GET /api/payment?total=…&cash=…` which runs `TransactionEngine.minCoins()` against only the denominations currently flagged as **available**.
5. **Reset** — _Confirm & Print Receipt_ shows a printable receipt; _New Transaction_ clears the cart for the next customer.

The **Inventory & Resource Management Dashboard** (`inventory.jsp`) exposes:

- The full sorted inventory in a paginated table (proves binary search works on large data).
- A **Denomination Manager** that toggles bills/coins as Out-of-Stock — the DP engine immediately uses the new constraint.
- **System Metrics** comparing Binary vs Linear search times, and DP vs Greedy unit counts.

---

## Algorithms

### Binary Search — `InventoryManager.java`

```java
public Product binarySearch(int targetID) {
    int low = 0, high = products.size() - 1;
    while (low <= high) {
        int mid = low + (high - low) / 2;
        Product p = products.get(mid);
        if (p.getId() == targetID)       return p;
        else if (p.getId() < targetID)   low  = mid + 1;
        else                             high = mid - 1;
    }
    return null;
}
```

- **Time:** `O(log n)` — at most ⌈log₂ 10,000⌉ = 14 comparisons.
- **Space:** `O(1)`.

### DP Coin-Change — `TransactionEngine.java`

Bottom-up table where `dp[i]` is the minimum number of units to make amount `i`,
and `usedCoin[i]` records which denomination produced that minimum so the
breakdown can be reconstructed.

- **Time:** `O(n × m)` — `n` = change amount in centavos, `m` = available denominations.
- **Space:** `O(n)`.
- All money is computed in **centavos (integer)** to avoid floating-point error.

### Greedy comparison

`TransactionEngine.greedyCount()` is the naive baseline. It is shown side-by-side on the dashboard and proves that greedy can fail (return `-1`) when a key denomination is removed, while DP still finds the optimal answer.

---

## API Endpoints

| Method | Path                            | Description                                               |
| -----: | ------------------------------- | --------------------------------------------------------- | ------ |
|    GET | `/api/search?id=`               | Binary search lookup                                      |
|    GET | `/api/payment?total=&cash=`     | DP change-maker (values in centavos)                      |
|    GET | `/api/inventory?page=&size=&q=` | Paginated, sorted inventory                               |
|    GET | `/api/denominations`            | List denominations + availability                         |
|   POST | `/api/denominations`            | Toggle availability — body `denom=…&available=true        | false` |
|    GET | `/api/metrics`                  | Live algorithm benchmark (Binary vs Linear, DP vs Greedy) |

---

## Testing the "Scarcity" Case

1. Start the app and add a few items so the change ends in `0.50` (e.g. `567.50`).
2. Open the **Inventory Dashboard** and toggle **₱50 Bill** → _Out of Stock_.
3. Go back to the Hub, complete the transaction.
4. The breakdown will avoid the ₱50 bill but still return the **mathematically minimum** number of units (e.g. 5×₱100 + 1×₱20 + 1×₱20 + 1×₱5 + 1×₱2 + 1×₱0.50 — the DP picks whichever combination is fewest given the constraint).
5. Refresh metrics — the Greedy column will show a higher unit count, or `-1` if greedy can't make change at all.

---

## Group

| Name                           | Role      | Responsibility                                   |
| ------------------------------ | --------- | ------------------------------------------------ |
| **Delph Xander O. Mogro**      | Leader    | Project coordination, Application Logic & Coding |
| **Gabrielle L. Pagkaliwangan** | Developer | Core Logic Implementation & Coding               |
| **Samara Bianca M. Miyamoto**  | Analyst   | Testing, Documentation & Coding                  |

Course: **CS2615 — Design and Analysis of Algorithms**

```

```
