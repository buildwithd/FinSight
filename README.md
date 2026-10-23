# FinSight

FinSight is a dependency-free personal financial decision simulator. The browser interface uses HTML, CSS, and vanilla JavaScript; the Java server is the sole authority for EMI, cash-flow, debt, savings projection, emergency-fund, and insight calculations.

## Run

Open a terminal in this `FINSIGHT` folder and run:

```powershell
javac --add-modules jdk.httpserver -encoding UTF-8 FinSightServer.java
java --add-modules jdk.httpserver FinSightServer
```

Open `http://localhost:8080`. `RUN_FINSIGHT.bat` performs the same compilation and start steps on Windows.

## Presentation flow

1. Select **Load demo data** on Overview.
2. View the financial health score and summary tiles.
3. Open **Decision Simulator** and run the supplied car-purchase scenario.
4. Compare Current, Proposed, and Alternative results, charts, and rule-based observations.
5. Save/open the simulation from **Saved Simulations**.

## Local privacy and assumptions

All user data is stored only in the browser's localStorage. The Java server binds to localhost and does not write financial data to disk. Positive unallocated surplus is added to savings each month; negative surplus is withdrawn; EMI is not double-counted as an expense; no inflation or asset appreciation is assumed.

## Troubleshooting

- **`javac` not found:** install a JDK 17+ and restart VS Code.
- **Port busy:** FinSight tries ports 8080 through 8090; use the URL printed in the terminal.
- **₹ garbled:** save all four source files as UTF-8 and run the supplied batch file, which sets UTF-8 console mode.
