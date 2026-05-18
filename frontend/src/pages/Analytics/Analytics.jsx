import { useState, useEffect } from 'react';
import useIndicators from '../../hooks/useIndicators';

const INDICATORS = {
  capm: {
    label: 'CAPM',
    tooltip: 'Expected return based on how much this stock moves relative to the broader market. Higher beta = higher expected return demanded.',
    signal:   (v) => v > 14 ? 'positive' : 'neutral',
    describe: (v) => `${v}% expected annual return for this risk level`,
  },
  pe_ratio: {
    label: 'P/E Ratio',
    tooltip: 'Price paid per rand of earnings. Below 15 is cheap; above 30 may be expensive unless strong growth is expected.',
    signal:   (v) => v < 15 ? 'positive' : v > 30 ? 'negative' : 'neutral',
    describe: (v) => v < 15 ? 'Below market average' : v > 30 ? 'Premium valuation' : 'In line with market',
  },
  altman_z: {
    label: 'Altman Z',
    tooltip: 'Bankruptcy risk score. Above 2.99 is safe; below 1.81 signals distress; in between is the grey zone.',
    signal:   (v) => v > 2.99 ? 'positive' : v < 1.81 ? 'negative' : 'neutral',
    describe: (v) => v > 2.99 ? 'Safe zone' : v < 1.81 ? 'Distress zone' : 'Grey zone — monitor',
  },
  sharpe: {
    label: 'Sharpe Ratio',
    tooltip: "Return earned per unit of risk. Above 1.0 is good; negative means the risk isn't being rewarded.",
    signal:   (v) => v >= 1 ? 'positive' : v < 0 ? 'negative' : 'neutral',
    describe: (v) => v >= 1 ? 'Good risk-adjusted return' : v < 0 ? 'Below risk-free rate' : 'Modest return for risk',
  },
  beta: {
    label: 'Beta',
    tooltip: 'Measures how much this stock moves relative to the market. Above 1 means more volatile than the market.',
    signal:   (v) => v < 1 ? 'positive' : v > 1.5 ? 'negative' : 'neutral',
    describe: (v) => v < 1 ? 'Less volatile than market' : v > 1.5 ? 'Highly volatile' : 'Moves with the market',
  },
  sortino: {
    label: 'Sortino Ratio',
    tooltip: 'Like the Sharpe ratio but only penalises downward volatility. Above 1 is good.',
    signal:   (v) => v >= 1 ? 'positive' : v < 0 ? 'negative' : 'neutral',
    describe: (v) => v >= 1 ? 'Good downside-adjusted return' : v < 0 ? 'Poor downside performance' : 'Moderate',
  },
  rsi: {
    label: 'RSI',
    tooltip: 'Measures price momentum on a 0–100 scale. Above 70 is overbought; below 30 is oversold.',
    signal:   (v) => v < 30 ? 'positive' : v > 70 ? 'negative' : 'neutral',
    describe: (v) => v > 70 ? 'Overbought — possible pullback' : v < 30 ? 'Oversold — possible bounce' : 'Neutral momentum',
  },
};
