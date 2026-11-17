# ROCK ATLAS — Structured Quantitative Research Template

**Document Status:** Methodological Template (Empirical sections require verified Rock Data Plus datasets)

## 1. Title & Abstract
- **Working Title:** Integrated Multi-Factor Intelligence, Liquidity Risk, and Market Resilience in East African Capital Markets: Evidence from the Nairobi Securities Exchange
- **Abstract:** Summarize the central research question, dataset provenance, analytical methodology (Six Engines + KMRI), out-of-sample validation, and limitations.

## 2. Background & Context
- Institutional structure of the Nairobi Securities Exchange (NSE), trading concentration, foreign investor flows, and market data accessibility gaps.

## 3. Problem Statement
- Fragmentation of market price data, fundamental filings, liquidity metrics, and macroeconomic context hinders reproducible investment research.

## 4. Research Question & Hypotheses
- **Primary Question:** Can multiple financial indicators be integrated into a transparent analytical framework that identifies investment opportunities while accounting for risk, liquidity, market conditions, and uncertainty in African capital markets?
- **H1 (Liquidity & Drawdown Discipline):** Adjusting momentum scores for Amihud illiquidity and peak-to-trough drawdowns shifts ranking stability toward investable counters.
- **H2 (KMRI Stress Differentiation):** Higher historical resilience scores associate with lower drawdown severity during subsequent market stress regimes.
- **H3 (Out-of-Sample Predictive Modesty):** Statistical forecasting baselines net of realistic NSE statutory transaction costs (~180 bps round-trip) require strict out-of-sample discipline to avoid overfitting.

## 5. Research Objectives
1. Establish verifiable data ingestion and 10-point quality validation governance.
2. Engineer modular Market, Fundamental, Predictive, Risk, Opportunity, and Decision Intelligence engines.
3. Formulate and stress-test the Kenyan Market Resilience Index (KMRI).
4. Evaluate predictive baselines chronologically without look-ahead bias.

## 6. Literature & Related Work
- *[Requires Verified Academic Citations]* — Review frontier market liquidity premia, Amihud (2002) illiquidity, emerging market factor investing, and composite resilience indices.

## 7. Data Sources & Methodology
- Document dataset name, source (e.g., Rock Data Plus), acquisition date, historical range, frequency, currency (KES), licensing constraints, and classification (`VERIFIED DATA`, `SYNTHETIC DATA`, `ESTIMATED DATA`, `UNAVAILABLE DATA`).

## 8. Data Preparation & Governance
- Report row retention, duplicate removal, OHLC consistency, extreme outlier flags (`|z| > 4.5`), and missing fundamental coverage.

## 9. Market Analysis (Engine 01)
- Equal-weighted vs. turnover-weighted composite index, breadth (`% > SMA50`), sector concentration, and volume spike distribution.

## 10. Opportunity Identification Framework (Engine 05)
- Transparent 5-factor scoring weights (`20% Momentum / 25% Fundamentals / 20% Valuation / 20% Risk / 15% Liquidity`), uncertainty escalation, and thesis invalidation conditions.

## 11. Risk Modelling (Engine 04)
- Annualized volatility (`sqrt(252)`), peak-to-trough drawdown, recovery duration, 95% historical VaR, Amihud illiquidity, HHI concentration, and macro/banking/liquidity stress scenarios.

## 12. Kenyan Market Resilience Index (KMRI)
- Mathematical specification of Performance, Resilience, Stability, Liquidity, and Foreign Participation; automated stress-regime isolation; Spearman rank correlation ($\rho$) weight sensitivity.

## 13. Backtesting Methodology (Engine 03)
- Chronological train/test split, lag-safe features, round-trip transaction costs, equal-weight benchmark comparison, and 95% empirical residual intervals.

## 14. Results & Findings
- *[Separate clearly: Synthetic Software Demonstration Outputs vs. Verified Empirical NSE Findings]*.

## 15. Robustness & Sensitivity Analysis
- Report Spearman $\rho$ across alternative weighting schemes and strategy sensitivity to `0 / 100 / 180 / 250 bps` cost assumptions.

## 16–22. Discussion, Limitations, Ethics, Conclusion, Recommendations, References & Reproducibility Appendix
- Address survivorship bias (delisted/suspended counters), thin-trading distortion, non-advisory boundaries, and automated test suite commands (`npm test`).
