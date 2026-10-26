import {
  ArrowLeftRight,
  Wallet,
  CreditCard,
  TrendingUp,
  Landmark,
  Briefcase,
  TriangleAlert,
  LoaderCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Legend,
  ResponsiveContainer,
} from 'recharts';

import Button from '../../components/common/Button/Button';
import Money from '../../components/common/Money/Money';
import { GlassPanel, PanelHead } from '../../components/dashboard/shared/GlassPanel';
import MoneyAxisTick from '../../components/dashboard/shared/MoneyAxisTick';
import api from '../../services/api';

import {
  dividendBars,
  rand,
  shortDate,
  shortSnapshotId,
  splitCashFlow,
  splitTrading,
} from './portfolioFigures';

/** @type {Promise<any> | null} */
let pdfPromise = null;
const loadPdfjs = () => {
  if (!pdfPromise) pdfPromise = import('./pdfLoader').then((m) => m.default);
  return pdfPromise;
};

const loadXlsx = () => import('xlsx');

const DownloadEXCEL = () => {
  window.open('/template/EquityLens_Portfolio_Excel_Template.xlsx');
};
const titleStyle = { color: 'var(--text-primary)' };
const mutedStyle = { color: 'var(--text-secondary)' };
const dimStyle = { color: 'var(--text-dim)' };
const badgeStyle = { background: 'var(--accent-subtle)', color: 'var(--accent-primary)' };

const SERIES_COLOURS = [
  'var(--accent-primary)',
  'var(--signal-info)',
  'var(--signal-positive)',
  'var(--signal-warning)',
  'var(--accent-light)',
  'var(--text-secondary)',
  'var(--text-dim)',
];
const axisTick = { fill: 'var(--chart-axis-text)', fontSize: 11 };
const axisLine = { stroke: 'var(--chart-grid)' };
const legendStyle = { fontSize: 12 };

/** @param {string} value */
const legendText = (value) => <span style={mutedStyle}>{value}</span>;

/** @param {{ active?: boolean, payload?: any[], label?: string, percent?: boolean }} props */
const ChartTooltip = ({ active, payload, label, percent = false }) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 font-mono text-[12px]"
      style={{ background: 'var(--chart-tooltip-bg)', border: '1px solid var(--border-mid)' }}
    >
      {label && (
        <div className="mb-1 text-[11px] tracking-widest" style={{ color: 'var(--text-ghost)' }}>
          {label}
        </div>
      )}
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-3 py-0.5">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: p.payload?.fill ?? p.color }} />
            <span style={mutedStyle}>{p.name}</span>
          </span>
          {percent ? (
            <span className="ml-auto font-semibold" style={titleStyle}>
              {Number(p.value).toFixed(2)}%
            </span>
          ) : (
            <Money className="ml-auto font-semibold" style={titleStyle}>
              {rand(p.value)}
            </Money>
          )}
        </div>
      ))}
    </div>
  );
};

/** @param {{ icon: any, colour: string, label: string, children: any, note?: any }} props */
const FigureCard = ({ icon: Icon, colour, label, children, note }) => (
  <GlassPanel className="flex flex-col gap-2 p-4">
    <div
      className="flex items-center gap-2 font-mono text-[11px] tracking-widest"
      style={{ color: 'var(--text-ghost)' }}
    >
      <Icon size={14} style={{ color: colour }} />
      {label}
    </div>
    <div className="whitespace-nowrap font-mono text-base font-semibold md:text-lg xl:text-xl" style={titleStyle}>
      {children}
    </div>
    {note && (
      <div className="text-[12px] leading-5" style={mutedStyle}>
        {note}
      </div>
    )}
  </GlassPanel>
);

const ACCOUNT_TYPES = [
  { value: 'zar', label: 'ZAR' },
  { value: 'tfsa', label: 'TFSA' },
  { value: 'usd', label: 'USD' },
];

/** @param {string | null | undefined} value */
const accountTypeLabel = (value) =>
  ACCOUNT_TYPES.find((t) => t.value === value)?.label ?? 'Not set';

/** @param {{ statement_start_date?: string|null, statement_end_date?: string|null }} portfolio */
const statementPeriod = (portfolio) => {
  const { statement_start_date: start, statement_end_date: end } = portfolio;
  if (start && end) return `${start} - ${end}`;
  if (end) return `Statement date: ${end}`;
  return 'No statement date';
};

const SECTION_HEADER = 'detailed transactions - ';

/**
 * @param {{ page: number, text: string }[]} allRows
 * @param {string} starting
 */
export const sectionRows = (allRows, starting) => {
  const table = [];
  let addingRows = false;

  for (const row of allRows) {
    if (row.text.toLowerCase().includes(starting.toLowerCase())) {
      addingRows = true;
      continue;
    }

    if (addingRows && row.text.toLowerCase().includes(SECTION_HEADER)) {
      break;
    }

    if (addingRows) {
      table.push({ page: row.page, text: row.text });
    }
  }

  return table;
};

/**
 * @param {string} text
 */
export const parsePurchaseRow = (text) => {
  const splitParts = text.split(' ').filter((item) => item !== '');

  if (!splitParts[0].includes('/')) {
    return null;
  }
  const values = splitParts.slice(2);

  const getNumber = () => {
    let numbers = values.pop();
    const check = values.at(-1);

    if (values.length > 0 && check && /^\d+$/.test(check)) {
      const checkSecond = values.pop();
      if (checkSecond) {
        numbers = checkSecond + numbers;
      }
    }

    return numbers;
  };

  const valueZar = getNumber();
  getNumber();
  const quantity = getNumber();
  const priceCents = getNumber();

  if (valueZar === undefined || quantity === undefined || priceCents === undefined) {
    return null;
  }

  return {
    transaction_date: splitParts[0].replaceAll('/', '-'),
    transaction_name: splitParts[1],
    instrument_name: values.join(' '),
    price: parseFloat(priceCents) / 100,
    quantity: parseFloat(quantity),
    value_zar: parseFloat(valueZar),
  };
};

/**
 * @param {string} text
 */
export const parseExposureRow = (text) => {
  const splitParts = text.split(' ').filter((item) => item !== '');

  const firstNumberIndex = splitParts.findIndex((item) => {
    return item.includes('.') && Number.isFinite(Number(item));
  });

  if (firstNumberIndex === -1) {
    return null;
  }

  const values = splitParts.slice(firstNumberIndex);
  const getNumber = () => {
    let numbers = values.pop();
    const check = values.at(-1);

    if (values.length > 0 && check && !check.includes('.')) {
      const checkSecond = values.pop();

      if (checkSecond) {
        numbers = checkSecond + numbers;
      }
    }

    return numbers;
  };

  const weight = getNumber();
  const statementValue = getNumber();
  const statementPrice = getNumber();
  const costPrice = getNumber();
  const cost = getNumber();
  const quantity = getNumber();

  if (
    weight === undefined ||
    costPrice === undefined ||
    cost === undefined ||
    quantity === undefined
  ) {
    return null;
  }

  const impliedPrice = parseFloat(cost) / parseFloat(quantity);

  if (
    !weight.includes('%') ||
    Math.abs(impliedPrice - parseFloat(costPrice)) > parseFloat(costPrice) / 100
  ) {
    throw new Error(`Could not read the exposure columns for: ${text.trim()}`);
  }

  return {
    instrument_name: splitParts.slice(0, firstNumberIndex).join(' '),
    quantity,
    total_cost: cost,
    statement_price: statementPrice,
    statement_value: statementValue,
  };
};

/** @param {string|number|null|undefined} value */
const toNumberOrNull = (value) => {
  const parsed = parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * @param {{
 *   instrument_name: string,
 *   quantity: string|number,
 *   total_cost: string|number,
 *   statement_price?: string|number|null,
 *   statement_value?: string|number|null,
 * }[]} rows
 */
export const buildHoldingsPayload = (rows) => {
  const held = rows
    .map((row) => ({
      instrument_name: row.instrument_name,
      quantity: parseFloat(String(row.quantity)),
      total_cost: parseFloat(String(row.total_cost)),
      statement_price: toNumberOrNull(row.statement_price),
      statement_value: toNumberOrNull(row.statement_value),
    }))
    .filter((row) => row.quantity > 0);

  const portfolioValue = held.reduce((total, row) => total + row.total_cost, 0);

  return held.map((row) => ({
    instrument_name: row.instrument_name,
    quantity: row.quantity,
    ticker: ' ',
    sector: ' ',
    total_cost: row.total_cost,
    cost_price: row.total_cost / row.quantity,
    weight_percentage: (row.total_cost / portfolioValue) * 100,
    statement_price: row.statement_price,
    statement_value: row.statement_value,
  }));
};

/**
 * @param {any} error
 */
const describeApiError = (error) => {
  const detail = error?.response?.data?.detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0];
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : 'field';
    return `${field}: ${first.msg}`;
  }
  if (typeof detail === 'string') return detail;
  return error?.message ?? 'Unknown error';
};

/**
 * @param {Date | any} value
 */
export const toDateOnly = (value) => {
  if (!(value instanceof Date)) return value;
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
};

/**
 * @param {File} file
 */
const ReadingExcelFile = async (file) => {
  if (!file) {
    return;
  }
  const XLSX = await loadXlsx();

  const read = XLSX.read(await file.arrayBuffer(), { cellDates: true });

  const Portfolio = XLSX.utils.sheet_to_json(read.Sheets['Portfolio']).map((item) => ({
    account_number: String(item['Account Number'] ?? ''),
    portfolio_name: String(item['Portfolio Name'] ?? ''),
    statement_date: toDateOnly(item['Statement Date']),
  }));
  const Holdings = XLSX.utils.sheet_to_json(read.Sheets['Holdings']).map((item) => ({
    instrument_name: item['Instrument Name'],
    quantity: item['Quantity'],
    total_cost: item['Total Cost'],
  }));
  const PurchaseandSales = XLSX.utils
    .sheet_to_json(read.Sheets['Purchase and Sales'])
    .map((item) => ({
      transaction_date: toDateOnly(item['Transaction Date']),
      transaction_name: item['Transaction Type'],
      instrument_name: item['Instrument Name'],
      price: item.Price,
      quantity: item.Quantity,
      value_zar: Number(item.Price) * Number(item.Quantity),
    }));
  const ContributionsandWithdrawals = XLSX.utils
    .sheet_to_json(read.Sheets['Contributions and Withdrawals'])
    .map((item) => ({
      transaction_date: toDateOnly(item['Transaction Date']),
      statement_date: toDateOnly(item['Settlement Date']),
      transaction_name: item['Transaction Type'],
      value: item.Value,
    }));
  const DividendsandWithholdingTax = XLSX.utils
    .sheet_to_json(read.Sheets['Dividends and Withholding Tax'])
    .map((item) => ({
      transaction_date: toDateOnly(item['Transaction Date']),
      instrument_name: item['Instrument Name'],
      gross_dividend: item['Gross Dividend'],
      tax_rate: item['Tax Rate(%)'],
    }));
  const Expenses = XLSX.utils.sheet_to_json(read.Sheets['Expenses']).map((item) => ({
    transaction_date: toDateOnly(item['Transaction Date']),
    settlement_date: toDateOnly(item['Settlement Date']),
    narrative: item['Narrative'],
    value: item['Value'],
  }));

  return {
    Portfolio,
    Holdings,
    PurchaseandSales,
    ContributionsandWithdrawals,
    DividendsandWithholdingTax,
    Expenses,
  };
};

/**
 * @param {File} file
 * @param {string } password
 */
const ReadingPDFFile = async (file, password) => {
  if (!file) {
    return;
  }
  const ShowPdf = await loadPdfjs();

  const convertPdf = await ShowPdf.getDocument({
    data: await file.arrayBuffer(),
    password,
  }).promise;

  const allRows = [];

  for (let x = 1; x <= convertPdf.numPages; x++) {
    const toGetThePage = await convertPdf.getPage(x);
    const ToGetTheContent = await toGetThePage.getTextContent();

    for (const items of ToGetTheContent.items) {
      if ('str' in items && 'transform' in items) {
        allRows.push({ text: items.str, x: items.transform[4], y: items.transform[5], page: x });
      }
    }
  }

  /**
   * @type {{ y: number, page: number, text: string, items: {text: string, x: number, y: number, page: number}[]}[]}
   */
  const allRowsTogther = [];

  for (const items of allRows) {
    const ExistRow = allRowsTogther.find((row) => row.y === items.y && row.page === items.page);

    if (ExistRow) {
      ExistRow.items.push(items);
    } else {
      allRowsTogther.push({ page: items.page, text: '', y: items.y, items: [items] });
    }
  }

  for (const row of allRowsTogther) {
    row.text = row.items.map((item) => item.text).join(' ');
  }

  /**
   * @param {string} starting
   */
  const getTheTable = (starting) => sectionRows(allRowsTogther, starting);

  const HoldingsTable = getTheTable('Instrument Exposure ');
  const PurchaseAndSalesTable = getTheTable(
    'Detailed Transactions - Instrument Purchases and Sales',
  );
  const ContributionsTable = getTheTable('Detailed Transactions - Contributions and Withdrawals');
  const TaxTable = getTheTable('Detailed Transactions - Dividends and withholding Tax');
  const ExpensesTable = getTheTable('Detailed Transactions - Expenses');

  const accountIndex = allRowsTogther.findIndex((row) => {
    return row.text.trim().startsWith('EE');
  });
  const statementIndex = allRowsTogther.find((row) => {
    return row.text.trim().includes(' to ');
  });
  const accountRow = allRowsTogther[accountIndex];
  const PortfolioRow = allRowsTogther[accountIndex + 1].text.trim();

  if (!statementIndex) {
    throw 'error for the statementIndex';
  }

  const gettingthData = statementIndex.text.split('to')[1].trim();
  const date = toDateOnly(new Date(gettingthData));

  const Portfolio = [
    {
      account_number: accountRow.text,
      portfolio_name: PortfolioRow,
      statement_date: date,
    },
  ];

  let instrumentName = '';

  const Holdings = HoldingsTable.map((row) => {
    if (
      row.text.includes('Opening Balance') ||
      row.text.includes('Instrument') ||
      row.text.includes('Total') ||
      row.text.includes('Page')
    ) {
      return null;
    }

    const parsed = parseExposureRow(row.text);

    if (parsed === null) {
      instrumentName = instrumentName + ' ' + row.text;
      return null;
    }

    const holdings = {
      ...parsed,
      instrument_name: (instrumentName + ' ' + parsed.instrument_name).trim(),
    };

    instrumentName = '';

    return holdings;
  }).filter((item) => item !== null);

  const PurchaseandSales = PurchaseAndSalesTable.map((row) => parsePurchaseRow(row.text)).filter(
    (item) => item !== null,
  );

  const ContributionsandWithdrawals = ContributionsTable.map((row) => {
    const splitParts = row.text.split(' ').filter((item) => item !== '');

    if (!splitParts[0].includes('/')) {
      return null;
    }

    const last = splitParts.at(-1) || '';
    const secondLast = splitParts.at(-2) || '';

    const chackThousands = !Number.isNaN(Number(secondLast));

    return {
      transaction_date: splitParts[0].replaceAll('/', '-'),
      statement_date: splitParts[1].replaceAll('/', '-'),
      transaction_name: splitParts
        .slice(2, chackThousands ? -2 : -1)
        .join(' ')
        .replaceAll('Capital', ''),
      value: chackThousands ? secondLast + last : last,
    };
  }).filter((item) => item !== null);

  const DividendsandWithholdingTax = TaxTable.map((row) => {
    const splitParts = row.text.split(' ').filter((item) => item !== '');

    if (!splitParts[0].includes('/')) {
      return null;
    }

    return {
      transaction_date: splitParts[0].replaceAll('/', '-'),
      instrument_name: splitParts.slice(1, -4).join(' '),
      gross_dividend: splitParts[splitParts.length - 4],
      tax_rate: splitParts[splitParts.length - 1],
    };
  }).filter((item) => item !== null);

  const Expenses = ExpensesTable.map((row) => {
    const splitParts = row.text.split(' ').filter((item) => item !== '');

    if (!splitParts[0].includes('/')) {
      return null;
    }

    return {
      transaction_date: splitParts[0].replaceAll('/', '-'),
      settlement_date: splitParts[1].replaceAll('/', '-'),
      narrative: splitParts.slice(2, -1).join(' '),
      value: splitParts[splitParts.length - 1],
    };
  }).filter((item) => item !== null);

  const results = {
    Portfolio,
    Holdings,
    PurchaseandSales,
    ContributionsandWithdrawals,
    DividendsandWithholdingTax,
    Expenses,
  };

  return results;
};

const Portfolio = () => {
  /**
   * @type {[any, function]}
   */
  const [summary, setSummary] = useState(/** @type {any} */ (null));
  /**
   * @type {[any[], function]}
   */
  const [GetTheTopHoldingsImportPDF, setGetTheTopHoldingsImportPDF] = useState(
    /** @type {any[]}*/[],
  );
  /**
   * @type {[any[], function]}
   */
  const [summaGetTheTopAllocationImportPDFry, setGetTheTopAllocationImportPDF] = useState(
    /** @type {any[]}*/[],
  );
  const [GetTheLowest, setGetTheLowest] = useState(/** @type {any} */ ({ name: '', value: 0 }));
  /**
   * @type {[any[], function]}
   */
  const [GetTradingActivity, setGetTradingActivity] = useState(/** @type {any[]}*/[]);
  /**
   * @type {[any[], function]}
   */
  const [GetCashFlow, setGetCashFlow] = useState(/** @type {any[]}*/[]);
  /**
   * @type {[any[], function]}
   */
  const [GetDividendIncome, setGetDividendIncome] = useState(/** @type {any[]}*/[]);
  /**
   * @type {[boolean,function]}
   */
  const [LoadingPage, setLoadingPage] = useState(false);
  const [accountType, setAccountType] = useState('');
  const [showPortfolios, setShowPortfolios] = useState(false);
  const [portfolios, setPortfolios] = useState(/** @type {any[]}*/[]);
  const [snapshot, setSnapshot] = useState(/** @type {any} */ (null));
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pdfPassword, setPdfPassword] = useState('');
  /** @type {[File | null, Function]} */
  const [pendingPdfFile, setPendingPdfFile] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  
  /** @param {string} message */
  const showError = (message) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  };

  useEffect(() => {
    const getInfo = async () => {
      const responses = await api.get('/portfolio/current');

      setPortfolios(responses.data);


    };

    getInfo();
  }, []);

  /**
   *
   * @param {*} id
   */
  const ViewSummary = async (id) => {
    try {
      setLoadingPage(true);

      setSelectedPortfolioId(id);

      const response = await api.get(`/portfolio_snapshot/${id}`);

      const portfolioSnapshot = response.data;
      const data = portfolioSnapshot.snapshot;

      setSnapshot(portfolioSnapshot);

      setSummary(data.summary);

      setGetTheTopHoldingsImportPDF(data.holdings?.top || []);

      setGetTheTopAllocationImportPDF(data.holdings?.allocation || []);

      setGetTheLowest(data.holdings?.lowest || { name: '', value: 0 });

      setGetTradingActivity(data.activity?.trading || []);

      setGetCashFlow(data.activity?.cash_flow || []);

      setGetDividendIncome(data.activity?.dividend_income || []);
    } catch (error) {
      showError('Could not load portfolio summary');
    } finally {
      setLoadingPage(false);
    }
  };

  const downloadSnapshot = async () => {
    if (!selectedPortfolioId) {
      showError('Please select a portfolio first');
      return;
    }

    try {
      const response = await api.get(`/portfolio_snapshot/${selectedPortfolioId}/download`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: 'application/pdf',
      });

      const url = window.URL.createObjectURL(blob);

      const link = document.createElement('a');

      link.href = url;
      link.download = `equity-lens-${selectedPortfolioId}.pdf`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(url);
    } catch (error) {
      showError('Could not download the portfolio Summary. Please try again later');
    }
  };


  /**
   *
   * @param {any} data
   * @param {File} file
   */

  const SavePortfolio = async (data, file) => {
    let createdPortfolioId = null;

    try {
      const uploadInvestmentStatements = await api.post(
        '/import_pdf/',

        {
          file_name: file.name,
        },
      );

      const document = uploadInvestmentStatements.data;
      const portfolio = data.Portfolio[0];

      const uploadPortfolioRequest = await api.post('/import_pdf/save_portfolios/', {
        document_id: document.document_id,
        account_number: portfolio.account_number,
        portfolio_name: portfolio.portfolio_name,
        currency: 'ZAR',
        statement_end_date: portfolio.statement_date,
        account_type: accountType,
      });

      const savedPortfolio = uploadPortfolioRequest.data;
      createdPortfolioId = savedPortfolio.portfolio_id;

      for (const holding of buildHoldingsPayload(data.Holdings)) {
        const uploadHoldingsRequest = await api.post('/import_pdf/save_holdings', {
          portfolio_id: savedPortfolio.portfolio_id,
          ...holding,
        });
      }

      for (const eachItems of data.PurchaseandSales) {
        const price = parseFloat(eachItems.price);
        const quantity = parseFloat(eachItems.quantity);

        const uploadHoldingsRequest = await api.post(
          '/import_pdf/save_instrument_purchases_and_sales/',
          {
            portfolio_id: savedPortfolio.portfolio_id,
            transaction_date: eachItems.transaction_date,
            transaction_name: eachItems.transaction_name,
            instrument_name: eachItems.instrument_name,
            ticker: ' ',
            sector: ' ',
            price,
            quantity,
            value_zar: parseFloat(eachItems.value_zar),
          },
        );
      }

      for (const eachItems of data.ContributionsandWithdrawals) {
        const value_zar = parseFloat(eachItems.value);

        const uploadHoldingsRequest = await api.post(
          '/import_pdf/save_contributions_and_withdrawals/',
          {
            portfolio_id: savedPortfolio.portfolio_id,
            transaction_date: eachItems.transaction_date,
            settlement_date: eachItems.statement_date,
            transaction_name: eachItems.transaction_name,
            value_zar,
          },
        );
      }

      for (const eachItems of data.DividendsandWithholdingTax) {
        const gross_dividend = parseFloat(eachItems.gross_dividend);
        const tax_rate = parseFloat(eachItems.tax_rate);
        const net_dividend = gross_dividend - gross_dividend * (tax_rate / 100);

        const uploadHoldingsRequest = await api.post(
          '/import_pdf/save_dividends_and_withholding_tax/',
          {
            portfolio_id: savedPortfolio.portfolio_id,
            transaction_date: eachItems.transaction_date,
            instrument_name: eachItems.instrument_name,
            ticker: ' ',
            sector: ' ',
            gross_dividend,
            withholding_tax: gross_dividend * (tax_rate / 100),
            net_dividend,
            tax_rate,
          },
        );
      }

      for (const eachItems of data.Expenses) {
        const value_zar = parseFloat(eachItems.value);

        const uploadHoldingsRequest = await api.post('/import_pdf/save_transaction_expenses/', {
          portfolio_id: savedPortfolio.portfolio_id,
          transaction_date: eachItems.transaction_date,
          settlement_date: eachItems.settlement_date,
          narrative_name: eachItems.narrative,
          value_zar,
        });
      }

      const getSummaryRequest = await api.get(
        `/import_pdf_summary/summary/${savedPortfolio.portfolio_id}`,
      );

      const getSummary = getSummaryRequest.data;
      setSummary(getSummary);

      const SummaGetTheTopAllocationImportPDFRequest = await api.get(
        `/import_pdf_summary/top_holdings/${savedPortfolio.portfolio_id}`,
      );

      const getSummaGetTheTopAllocationImportPDFry = SummaGetTheTopAllocationImportPDFRequest.data;
      setGetTheTopHoldingsImportPDF(getSummaGetTheTopAllocationImportPDFry);

      const getSummaryGetTheTopHoldingsImportPDFRequest = await api.get(
        `/import_pdf_summary/portfolio_allocation/${savedPortfolio.portfolio_id}`,
      );

      const getSummaryGetTheTopHoldingsImportPDF = getSummaryGetTheTopHoldingsImportPDFRequest.data;
      setGetTheTopAllocationImportPDF(getSummaryGetTheTopHoldingsImportPDF);

      const LowestHoldingsRequest = await api.get(
        `/import_pdf_summary/lowest_holdings/${savedPortfolio.portfolio_id}`,
      );

      const LowestHoldings = LowestHoldingsRequest.data;
      setGetTheLowest(LowestHoldings);

      const TradingActivity = await api.get(
        `/import_pdf_summary/trading_activity/${savedPortfolio.portfolio_id}`,
      );

      const TradingActivityImport = TradingActivity.data;
      setGetTradingActivity(TradingActivityImport);

      const CashFlow = await api.get(
        `/import_pdf_summary/cash_flow/${savedPortfolio.portfolio_id}`,
      );

      const CashFlowImport = CashFlow.data;
      setGetCashFlow(CashFlowImport);

      const Income = await api.get(
        `/import_pdf_summary/dividend_income/${savedPortfolio.portfolio_id}`,
      );

      const IncomeImport = Income.data;
      setGetDividendIncome(IncomeImport);

      setSelectedPortfolioId(savedPortfolio.portfolio_id);


      const snapshotResponse = await api.get(`/portfolio_snapshot/${savedPortfolio.portfolio_id}`);

      setSnapshot(snapshotResponse.data);
      const portfoliosResponse = await api.get('/portfolio/current');
      setPortfolios(portfoliosResponse.data);
    } catch (theErrors) {
      if (createdPortfolioId) {
        try {
          await api.delete(`/import_pdf/portfolios/${createdPortfolioId}`);
        } catch (cleanupError) {
          console.warn('could not remove the half-imported portfolio:', cleanupError);
        }
      }

      showError(
        `Could not save your statement: ${describeApiError(theErrors)}. Nothing was imported - please try again.`,
      );
    }
  };

  const trades = splitTrading(GetTradingActivity);
  const cashFlow = splitCashFlow(GetCashFlow);
  const rankedOn = summary?.ValueBasis === 'cost' ? 'by cost' : 'by value at statement date';

  if (LoadingPage) {
    return (
      <div className="flex flex-col items-center justify-center mt-32">
        <LoaderCircle
          className="w-20 h-16 animate-spin"
          style={{ color: 'var(--accent-primary)' }}
        />
        <h2 className="text-2xl font-bold mt-4" style={{ color: 'var(--text-page)' }}>
          Loading Portfolio
        </h2>
        <p style={{ color: 'var(--text-page-secondary)' }}>
          Please wait until we import your portfolio...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl md:p-2">
      <div className="mb-6 text-center">
        <h2 className="mb-2 text-3xl font-bold md:text-4xl" style={{ color: 'var(--text-page)' }}>
          Upload <span style={{ color: 'var(--accent-primary)' }}>Portfolio</span>
        </h2>

        <p
          className="mx-auto max-w-2xl text-sm md:text-base"
          style={{ color: 'var(--text-page-secondary)' }}
        >
          Import your EasyEquities portfolio using your statement or our Excel template
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <GlassPanel className="flex flex-col">
          <PanelHead label="My Portfolios" />

          <div className="flex flex-1 flex-col p-5">
            <p className="mb-4 text-sm" style={mutedStyle}>
              Select one of your existing portfolios
            </p>

            <div className="flex-1">
              {portfolios.slice(0, 2).map(
                /** @param {any} portfolio*/ (portfolio, index) => (
                  <div
                    key={index}
                    className="mb-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-4 transition hover:border-[var(--border-mid)]"
                  >
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <p className="min-w-0 truncate font-semibold" style={titleStyle}>
                        {portfolio.portfolio_name}
                      </p>

                      <span className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold" style={badgeStyle}>
                        {accountTypeLabel(portfolio.account_type)}
                      </span>
                    </div>

                    <p className="text-sm" style={mutedStyle}>
                      Account: <Money>{portfolio.account_number}</Money>
                    </p>

                    <p className="text-sm" style={mutedStyle}>
                      {statementPeriod(portfolio)}
                    </p>

                    <button
                      type="button"
                      onClick={() => ViewSummary(portfolio.id)}
                      className="mt-3 text-sm font-medium text-[var(--accent-primary)] transition hover:underline"
                    >
                      View Summary
                    </button>
                  </div>
                ),
              )}
            </div>

            <button
              type="button"
              onClick={() => setShowPortfolios(true)}
              className="mt-3 text-sm font-medium text-[var(--accent-primary)] transition hover:text-[var(--accent-hover)]"
            >
              View all portfolios
            </button>
          </div>
        </GlassPanel>

        <GlassPanel className="flex flex-col">
          <PanelHead label="Upload your statement" />

          <div className="flex flex-1 flex-col p-5">
            <p className="mb-5 text-sm" style={mutedStyle}>
              Upload your EasyEquities PDF or complete the Excel template
            </p>

            <div className="mb-5">
              <label
                htmlFor="account-type-select"
                className="mb-2 block text-sm font-medium text-[var(--text-secondary)]"
              >
                Account Type
              </label>

              <select
                id="account-type-select"
                value={accountType}
                onChange={(event) => setAccountType(event.target.value)}
                className="w-full rounded-xl border border-[var(--border-mid)] bg-[var(--surface-inset)] p-3 text-[var(--text-primary)] outline-none transition focus:border-[var(--accent-primary)]"
              >
                <option value="">Select account type</option>

                {ACCOUNT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <label className="pressable mt-auto block w-full cursor-pointer rounded-lg bg-[var(--accent-primary)] px-6 py-3 text-center font-semibold text-[var(--text-on-accent)] transition hover:bg-[var(--accent-hover)]">
              Choose File

              <input
                type="file"
                accept=".pdf,.xlsx"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];

                  if (!file) {
                    return;
                  }

                  if (!accountType) {
                    showError('Please select an account type first');
                    event.target.value = '';
                    return;
                  }

                  setLoadingPage(true);

                  try {
                    let data;

                    if (file.name.toLowerCase().endsWith('.pdf')) {
                      setPendingPdfFile(file);
                      setPdfPassword('');
                      setShowPasswordModal(true);
                      setLoadingPage(false);
                      return;

                    } else if (file.name.toLowerCase().endsWith('.xlsx')) {
                      data = await ReadingExcelFile(file);
                    }

                    await SavePortfolio(data, file);
                  } catch (theError) {
                    if (theError instanceof Error && theError.name === 'PasswordException') {
                      showError('Incorrect PDF password. Please check the password and try again.');
                      setPdfPassword('');
                      return;
                    }
                    else if (file.name.toLowerCase().endsWith('.pdf')) {
                      showError(
                        'Could not read this PDF - it may not be an EasyEquities statement. Please use the Excel template',
                      );
                    } else if (file.name.toLowerCase().endsWith('.xlsx')) {
                      showError(
                        'Invalid or unsupported Excel file. Please make sure to use the Excel template',
                      );
                    } else {
                      showError('Please make sure you either upload a PDF or Excel file');
                    }
                  } finally {
                    setLoadingPage(false);
                  }
                }}
              />
            </label>

            <p className="mt-3 text-center text-sm" style={dimStyle}>
              PDF or XLSX
            </p>
          </div>
        </GlassPanel>

        <GlassPanel className="flex flex-col sm:col-span-2 lg:col-span-1">
          <PanelHead label="Excel Template" />

          <div className="flex flex-1 flex-col p-5">
            <p className="mb-5 text-sm" style={mutedStyle}>
              Don&apos;t have a supported PDF? Use our template instead.
            </p>

            <div className="mt-auto">
              <Button variant="secondary" size="lg" fullWidth onClick={DownloadEXCEL}>
                Download Template
              </Button>

              <p className="mt-3 text-center text-sm" style={dimStyle}>
                EquityLens Excel Template
              </p>
            </div>
          </div>
        </GlassPanel>
      </div>

      {showPortfolios && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] px-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-5">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)]">My Portfolios</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Select a portfolio to view its summary
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowPortfolios(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-mid)] text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
              >
                ×
              </button>
            </div>

            <div className="max-h-[65vh] overflow-y-auto p-6">
              <div className="space-y-4">
                {portfolios.map(
                  /** @param {any} portfolio */ (portfolio) => (
                    <div
                      key={portfolio.id}
                      className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-raised)] p-5 transition hover:border-[var(--border-mid)]"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                            {portfolio.portfolio_name}
                          </p>

                          <p className="mt-2 text-sm text-[var(--text-secondary)]">
                            Account: <Money>{portfolio.account_number}</Money>
                          </p>

                          <p className="mt-1 text-sm text-[var(--text-secondary)]">
                            {statementPeriod(portfolio)}
                          </p>
                        </div>

                        <span
                          className="shrink-0 rounded-lg px-3 py-1 text-xs font-semibold"
                          style={badgeStyle}
                        >
                          {accountTypeLabel(portfolio.account_type)}
                        </span>
                      </div>

                      <div className="mt-4 border-t border-[var(--border-subtle)] pt-4">
                        <Button
                          size="sm"
                          onClick={() => {
                            setShowPortfolios(false);
                            ViewSummary(portfolio.id);
                          }}
                        >
                          View Summary
                        </Button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <FigureCard
            icon={Wallet}
            colour="var(--accent-primary)"
            label="Value at statement date"
            note={
              <>
                <div>as at {shortDate(summary.StatementDate) ?? '—'}</div>
                {summary.ValueBasis === 'cost' ? (
                  <div>The statement had no closing values, so this is what you paid (cost)</div>
                ) : (
                  <div>
                    Cost basis <Money>{rand(summary.PortfolioValue)}</Money>
                    {summary.ValueBasis === 'mixed' && ' · some holdings at cost'}
                  </div>
                )}
              </>
            }
          >
            <Money>{rand(summary.StatementValue)}</Money>
          </FigureCard>

          <FigureCard icon={Briefcase} colour="var(--signal-info)" label="Holdings">
            {summary.TotalHoldings ?? '—'}
          </FigureCard>

          <FigureCard
            icon={ArrowLeftRight}
            colour="var(--text-secondary)"
            label="Traded (buys + sells)"
            note={
              <>
                Bought <Money>{rand(trades.bought)}</Money> · Sold <Money>{rand(trades.sold)}</Money>
              </>
            }
          >
            <Money>{rand(summary.TotalPurchasesAndSales)}</Money>
          </FigureCard>

          <FigureCard
            icon={Landmark}
            colour="var(--signal-info)"
            label="Net contributions"
            note={
              <>
                In <Money>{rand(cashFlow.moneyIn)}</Money> · Out <Money>{rand(cashFlow.moneyOut)}</Money>
              </>
            }
          >
            <Money>{rand(summary.TotalContributionsAndWithdrawals)}</Money>
          </FigureCard>

          <FigureCard icon={TrendingUp} colour="var(--signal-positive)" label="Dividends (after tax)">
            <Money>{rand(summary.TotalDividendsAndWithholdingTax)}</Money>
          </FigureCard>

          <FigureCard icon={CreditCard} colour="var(--signal-warning)" label="Expenses">
            <Money>{rand(summary.TotalTransactionExpenses)}</Money>
          </FigureCard>
        </div>
      )}

      {snapshot && (
        <GlassPanel className="mt-6">
          <PanelHead
            label="Portfolio Summary"
            hint={`Snapshot ${shortSnapshotId(snapshot.snapshot_id) ?? '—'} · generated ${
              shortDate(snapshot.created_at) ?? '—'
            }`}
          />

          <div className="p-5">
            <Button size="lg" fullWidth onClick={downloadSnapshot}>
              Download Portfolio Summary
            </Button>
          </div>
        </GlassPanel>
      )}

      {summaGetTheTopAllocationImportPDFry.length > 0 &&
        GetTheTopHoldingsImportPDF.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <GlassPanel className="min-w-0">
              <PanelHead label="Trading Activity" />

              <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={GetTradingActivity}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={axisLine} />
                    <YAxis tick={<MoneyAxisTick />} tickLine={false} axisLine={false} width={56} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
                    <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                      {GetTradingActivity.map((row, index) => (
                        <Cell
                          key={index}
                          fill={row.side === 'sell' ? 'var(--text-secondary)' : 'var(--accent-primary)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>

            <GlassPanel className="min-w-0">
              <PanelHead label="Cash Flow" />

              <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={GetCashFlow}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={false} />
                    <YAxis tick={<MoneyAxisTick />} tickLine={false} axisLine={false} width={56} />
                    <ReferenceLine y={0} stroke="var(--chart-axis-text)" />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
                    <Bar dataKey="value" name="Amount" radius={[4, 4, 0, 0]}>
                      {GetCashFlow.map((row, index) => (
                        <Cell
                          key={index}
                          fill={row.value < 0 ? 'var(--signal-negative)' : 'var(--signal-positive)'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>

            <GlassPanel className="min-w-0 sm:col-span-2 lg:col-span-1">
              <PanelHead label="Dividend Income" />

              <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dividendBars(GetDividendIncome)}>
                    <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                    <XAxis dataKey="name" tick={axisTick} tickLine={false} axisLine={axisLine} />
                    <YAxis tick={<MoneyAxisTick />} tickLine={false} axisLine={false} width={56} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-hover)' }} />
                    <Legend wrapperStyle={legendStyle} formatter={legendText} />
                    <Bar dataKey="net" name="Net dividend" stackId="dividend" fill="var(--accent-primary)" />
                    <Bar
                      dataKey="tax"
                      name="Withholding tax"
                      stackId="dividend"
                      fill="var(--text-dim)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>
          </div>
        )}

      {summaGetTheTopAllocationImportPDFry.length > 0 &&
        GetTheTopHoldingsImportPDF.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <GlassPanel className="min-w-0">
              <PanelHead label="Allocation by holding" />

              <div className="h-80 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={summaGetTheTopAllocationImportPDFry}
                      dataKey="weight_percentage"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={80}
                      stroke="var(--surface-card)"
                    >
                      {summaGetTheTopAllocationImportPDFry.map((item, index) => (
                        <Cell key={index} fill={SERIES_COLOURS[index % SERIES_COLOURS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip percent />} />
                    <Legend wrapperStyle={legendStyle} formatter={legendText} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </GlassPanel>

            <GlassPanel className="min-w-0 lg:col-span-2">
              <PanelHead label="Top Holdings" hint={rankedOn} />

              <div className="space-y-4 p-5">
                {GetTheTopHoldingsImportPDF.map((item, index) => (
                  <div key={index}>
                    <div className="mb-1 flex justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate" style={mutedStyle}>
                        {item.name}
                      </span>
                      <Money className="shrink-0 font-mono" style={titleStyle}>
                        {rand(item.value)}
                      </Money>
                    </div>

                    <div className="h-2 w-full rounded-full" style={{ background: 'var(--surface-inset)' }}>
                      <div
                        className="h-2 rounded-full"
                        style={{
                          width: `${(item.value / (GetTheTopHoldingsImportPDF[0].value || 1)) * 100}%`,
                          backgroundColor: SERIES_COLOURS[index % SERIES_COLOURS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>
        )}

      {summaGetTheTopAllocationImportPDFry.length > 0 &&
        GetTheTopHoldingsImportPDF.length > 0 && (
          <GlassPanel className="mt-5">
            <PanelHead label="Smallest Holding" hint={rankedOn} />

            <div className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div className="flex min-w-0 items-center gap-2">
                <TriangleAlert size={18} style={{ color: 'var(--signal-warning)' }} />
                <p className="truncate text-lg font-semibold" style={titleStyle}>
                  {GetTheLowest?.name ?? 'No holdings'}
                </p>
              </div>

              <div className="text-right">
                <Money className="font-mono text-lg font-semibold" style={titleStyle}>
                  {rand(GetTheLowest?.value)}
                </Money>
                {typeof GetTheLowest?.weight_percentage === 'number' && (
                  <p className="text-sm" style={mutedStyle}>
                    {GetTheLowest.weight_percentage.toFixed(2)}% of the portfolio
                  </p>
                )}
              </div>
            </div>
          </GlassPanel>
        )}

      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim)] px-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 shadow-2xl">

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                PDF <span className="text-[var(--accent-primary)]">Password</span>
              </h2>

              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Enter the password for your EasyEquities statement.
              </p>
            </div>

            <label
              htmlFor="pdf-password"
              className="mb-2 block text-sm font-medium text-[var(--text-secondary)]"
            >
              Password
            </label>

            <input
              id="pdf-password"
              type="password"
              value={pdfPassword}
              onChange={(event) => {
                setPdfPassword(event.target.value);
              }}
              placeholder="Enter PDF password"
              className="w-full rounded-xl border border-[var(--border-mid)] bg-[var(--surface-inset)] px-4 py-3 text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-disabled)] focus:border-[var(--accent-primary)]"
            />


            <div className="mt-6 flex gap-3">
              <Button
                variant="ghost"
                size="lg"
                className="flex-1"
                onClick={() => {
                  setShowPasswordModal(false);
                  setPendingPdfFile(null);
                  setPdfPassword('');
                }}
              >
                Cancel
              </Button>

              <Button
                size="lg"
                className="flex-1"
                onClick={async () => {
                  if (!pendingPdfFile) return;

                  try {
                    setShowPasswordModal(false);
                    setLoadingPage(true);

                    const data = await ReadingPDFFile(
                      pendingPdfFile,
                      pdfPassword,
                    );

                    await SavePortfolio(data, pendingPdfFile);
                  } catch (theError) {
                    if (
                      theError instanceof Error &&
                      theError.name === 'PasswordException'
                    ) {
                      showError(
                        'Incorrect PDF password. Please check the password and try again',
                      );
                    } else {
                      showError(
                        'Could not read this PDF. Please make sure it is a valid EasyEquities statement.',
                      );
                    }
                  } finally {
                    setLoadingPage(false);
                    setPendingPdfFile(null);
                    setPdfPassword('');
                  }
                }}
              >
                Continue
              </Button>
            </div>
          </div>
        </div>
      )}
      {showErrorModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--scrim)] px-4">
          <div className="w-full max-w-md rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-elevated)] p-6 shadow-2xl">

            <div className="mb-6">
              <h2 className="text-2xl font-bold text-[var(--text-primary)]">
                Something <span className="text-[var(--accent-primary)]">went wrong</span>
              </h2>

              <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                {errorMessage}
              </p>
            </div>

            <Button
              size="lg"
              fullWidth
              onClick={() => {
                setShowErrorModal(false);
                setErrorMessage('');
              }}
            >
              OK
            </Button>

          </div>
        </div>
      )}

    </div>

  );
};

export default Portfolio;
