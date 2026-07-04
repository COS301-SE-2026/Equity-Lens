import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, TrendingUp, TrendingDown, Github,
  Upload, Layers, Newspaper, Sparkles, Menu, X, Bot,
  Check, Shield, Lock, EyeOff, Trash2, FileCheck, Command, FileInput, Percent, Radio } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { PieChart, Pie, Cell, ResponsiveContainer, LineChart, Line, YAxis, Tooltip, BarChart, Bar, XAxis, } from 'recharts';
import { ROUTES } from '../../utils/constants';

const YELLOW = '#FACC15';

const PRESETS = {
  vooqqq: {
    label: '60% VOO + 40% QQQ',
    exposure: [
      { name: 'AAPL', value: 12.4 },
      { name: 'MSFT', value: 11.9 },
      { name: 'NVDA', value: 10.2 },
      { name: 'GOOGL', value: 6.1 },
      { name: 'AMZN', value: 5.8 },
      { name: 'META', value: 4.7 },
      { name: 'Other', value: 48.9 },
    ],
    concentration: 51.1,
    top: 'top 6 holdings',
  },
  balanced: {
    label: '70% VOO + 30% VXUS',
    exposure: [
      { name: 'AAPL', value: 4.9 },
      { name: 'MSFT', value: 4.6 },
      { name: 'NVDA', value: 4.0 },
      { name: 'TSMC', value: 2.3 },
      { name: 'GOOGL', value: 2.1 },
      { name: 'NESN', value: 1.4 },
      { name: 'Other', value: 80.7 },
    ],
    concentration: 19.3,
    top: 'top 6 holdings',
  },
  ai: {
    label: '50% SMH + 30% QQQ + 20% ARKK',
    exposure: [
      { name: 'NVDA', value: 22.1 },
      { name: 'TSMC', value: 11.8 },
      { name: 'AVGO', value: 9.4 },
      { name: 'AMD', value: 6.2 },
      { name: 'MSFT', value: 5.1 },
      { name: 'TSLA', value: 4.9 },
      { name: 'Other', value: 40.5 },
    ],
    concentration: 59.5,
    top: 'top 6 holdings',
  },
};

const PIE_COLORS = ['#FACC15', '#F59E0B', '#FDBA74', '#FCD34D', '#EAB308', '#CA8A04', '#52525b'];

const NVDA_OVERLAP = [
  { etf: 'VOO', pct: 6.2, hint: 'VOO gives NVDA 6.2% weighting inside the S&P 500 basket.' },
  { etf: 'QQQ', pct: 8.9, hint: 'QQQ leans tech-heavy and gives NVDA 8.9%.' },
  { etf: 'SMH', pct: 21.4, hint: 'SMH is a semis fund. NVDA sits at 21.4% of it.' },
];

const NVDA_FLATTENED = 12.4;

const HERO_PERF = Array.from({ length: 30 }, (_, i) => ({
  d: i,
  v: 100 + i * 0.42 + Math.sin(i / 3) * 2.1,
}));

const FEATURES = [
  {
    icon: Command,
    title: 'Natural language risk interrogation',
    body: 'Ask plain-English questions directly against your look-through ledger. Uncover macro vulnerabilities, isolate benchmark anomalies, and simulate allocation shifts instantly.',
    isSpotlight: true,
  },
  {
    icon: FileInput,
    title: 'Broker statement import',
    body: 'Upload your portfolio. Positions, quantities, and cost basis parsed in seconds.',
  },
  {
    icon: Layers,
    title: 'Look-through exposure',
    body: 'Every ETF is flattened into its underlying holdings so you see real concentration, not fund labels.',
  },
  {
    icon: Percent,
    title: 'Portfolio Health',
    body: 'Weighted Sharpe, Beta, CAPM, Altman Z, P/E, ROE, and dividend yield across your entire book.',
  },
  {
    icon: Radio,
    title: 'News correlation',
    body: 'When a holding moves more than expected, we pull the news story that caused it.',
  },
];

const TRUST_ITEMS = [
  { icon: EyeOff,    text: 'Read-only portfolio analysis' },
  { icon: Lock,      text: 'No trading permissions required' },
  { icon: Shield,    text: 'Encrypted statement uploads' },
  { icon: Trash2,    text: 'Statements deleted after processing' },
];

const COMPARISON = [
  { legacy: 'Shows funds',           lens: 'Shows underlying companies' },
  { legacy: 'Portfolio value',        lens: 'Portfolio health' },
  { legacy: 'Generic market news',    lens: 'News linked to your holdings' },
  { legacy: 'Manual interpretation',  lens: 'Actionable portfolio insights' },
  { legacy: 'Basic allocation',       lens: 'Look-through exposure' },
];