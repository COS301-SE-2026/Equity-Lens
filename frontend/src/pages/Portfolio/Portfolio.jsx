import { useState,useEffect } from "react";
import * as ShowPdf from "pdfjs-dist";
import PDFworker from "pdfjs-dist/build/pdf.worker.mjs?worker";
import { ArrowLeftRight, Wallet, CreditCard, TrendingUp, Landmark, Briefcase, TriangleAlert, Bot ,LoaderCircle } from "lucide-react"
import { PieChart, Pie, Cell,BarChart,XAxis, YAxis, Tooltip, Bar, LineChart, Line, Legend, ResponsiveContainer } from "recharts"
import api from "../../services/api"
import * as XLSX from "xlsx"
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants"
ShowPdf.GlobalWorkerOptions.workerPort = new PDFworker();

const DownloadEXCEL = () =>{ window.open("/template/EquityLens_Portfolio_Excel_Template.xlsx") }
const cardStyle   = {background: 'var(--surface-card)', borderColor: 'var(--border-subtle)'};
const panelStyle  = {borderColor: 'var(--border-subtle)'};
const titleStyle  = {color: 'var(--text-primary)'};
const mutedStyle  = {color: 'var(--text-secondary)'};
const dimStyle    = {color: 'var(--text-dim)'};

const ACCOUNT_TYPES = [
  { value: "zar", label: "ZAR" },
  { value: "tfsa", label: "TFSA" },
  { value: "usd", label: "USD" },
];

/** @param {string | null | undefined} value */
const accountTypeLabel = (value) =>
  ACCOUNT_TYPES.find((t) => t.value === value)?.label ?? "Not set";

/** @param {{ statement_start_date?: string|null, statement_end_date?: string|null }} portfolio */
const statementPeriod = (portfolio) => {
  const { statement_start_date: start, statement_end_date: end } = portfolio;
  if (start && end) return `${start} - ${end}`;
  if (end) return `Statement date: ${end}`;
  return "No statement date";
};

const SECTION_HEADER = "detailed transactions - ";

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
  const splitParts = text.split(" ").filter((item) => item !== "");

  if (!splitParts[0].includes("/")) {
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
    transaction_date: splitParts[0].replaceAll("/", "-"),
    transaction_name: splitParts[1],
    instrument_name: values.join(" "),
    price: parseFloat(priceCents) / 100,
    quantity: parseFloat(quantity),
    value_zar: parseFloat(valueZar),
  };
};

/**
 * @param {string} text
 */
export const parseExposureRow = (text) => {
  const splitParts = text.split(" ").filter((item) => item !== "");

  const firstNumberIndex = splitParts.findIndex((item) => {
    return item.includes(".") && Number.isFinite(Number(item));
  });

  if (firstNumberIndex === -1) {
    return null;
  }

  const values = splitParts.slice(firstNumberIndex);
  const getNumber = () => {
    let numbers = values.pop();
    const check = values.at(-1);

    if (values.length > 0 && check && !check.includes(".")) {
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

  if (weight === undefined || costPrice === undefined ||
      cost === undefined || quantity === undefined) {
    return null;
  }

  const impliedPrice = parseFloat(cost) / parseFloat(quantity);

  if (!weight.includes("%") ||
      Math.abs(impliedPrice - parseFloat(costPrice)) > parseFloat(costPrice) / 100) {
    throw new Error(`Could not read the exposure columns for: ${text.trim()}`);
  }

  return {
    instrument_name: splitParts.slice(0, firstNumberIndex).join(" "),
    quantity: quantity,
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
    ticker: " ",
    sector: " ",
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
    const field = Array.isArray(first.loc) ? first.loc[first.loc.length - 1] : "field";
    return `${field}: ${first.msg}`;
  }
  if (typeof detail === "string") return detail;
  return error?.message ?? "Unknown error";
};

/**
 * @param {Date | any} value
 */
const toDateOnly = (value) => {
  if (!(value instanceof Date)) return value;
  return value.toISOString().split("T")[0];
};

/**
 * @param {File} file
 */
const ReadingExcelFile = async(file) => {

  if(!file)
  {
    return;
  }

  const read = XLSX.read(await file.arrayBuffer(), { cellDates: true });

  const Portfolio = XLSX.utils.sheet_to_json(read.Sheets["Portfolio"]).map((item) =>({
          account_number: String(item["Account Number"] ?? ""),
          portfolio_name: String(item["Portfolio Name"] ?? ""),
          statement_date: toDateOnly(item["Statement Date"]),
  }));
  const Holdings = XLSX.utils.sheet_to_json(read.Sheets["Holdings"]).map((item) =>({
         instrument_name: item["Instrument Name"],
          quantity: item["Quantity"],
          total_cost: item["Total Cost"],
  }));
  const PurchaseandSales = XLSX.utils.sheet_to_json(read.Sheets["Purchase and Sales"]).map((item) =>({
          transaction_date: toDateOnly(item["Transaction Date"]),
          transaction_name: item["Transaction Type"],
          instrument_name: item["Instrument Name"],
          price: item.Price,
          quantity: item.Quantity,
          value_zar: (Number(item.Price) * Number(item.Quantity)),
  }));
  const ContributionsandWithdrawals = XLSX.utils.sheet_to_json(read.Sheets["Contributions and Withdrawals"]).map((item) =>({
              transaction_date: toDateOnly(item["Transaction Date"]),
              statement_date: toDateOnly(item["Settlement Date"]),
              transaction_name: item["Transaction Type"],
              value: item.Value,
  }));
  const DividendsandWithholdingTax = XLSX.utils.sheet_to_json(read.Sheets["Dividends and Withholding Tax"]).map((item) =>({
              transaction_date: toDateOnly(item["Transaction Date"]),
              instrument_name: item["Instrument Name"],
              gross_dividend: item["Gross Dividend"],
              tax_rate: item["Tax Rate(%)"],
  }));
  const Expenses = XLSX.utils.sheet_to_json(read.Sheets["Expenses"]).map((item) =>({
              transaction_date: toDateOnly(item["Transaction Date"]),
              settlement_date: toDateOnly(item["Settlement Date"]),
              narrative: item["Narrative"],
              value: item["Value"],
  }));


  return {
    Portfolio,Holdings,PurchaseandSales,ContributionsandWithdrawals,DividendsandWithholdingTax,Expenses
  }

}

/**
 * @param {File} file
 * @param {string } password
 */
const ReadingPDFFile = async(file,password) =>
{
  if(!file)
  {
    return
  }

  const convertPdf = await ShowPdf.getDocument({
        data: await file.arrayBuffer(),
        password: password,
      }).promise;


  const allRows = [];

  for(let x = 1; x <= convertPdf.numPages;x++)
  {
   
      const toGetThePage = await convertPdf.getPage(x);
      const ToGetTheContent = await toGetThePage.getTextContent();

      for(const items of ToGetTheContent.items)
      {
        if("str" in items && "transform" in items)
        {

          allRows.push({text: items.str , x:items.transform[4], y:items.transform[5], page: x})
      
        }
      }
    

  }

  /**
   * @type {{ y: number, page: number, text: string, items: {text: string, x: number, y: number, page: number}[]}[]}
   */
  const allRowsTogther = []

  for(const items of allRows)
  {
    const ExistRow = allRowsTogther.find((row) => row.y === items.y && row.page === items.page)

    if(ExistRow)
    {
      ExistRow.items.push(items);
    }
    else
    {
      allRowsTogther.push({page: items.page,text: "", y: items.y, items: [items]})
    }

    
  }

  for(const row of allRowsTogther)
  {
     row.text = row.items.map((item) => item.text).join(" ")
  }

  /**
  * @param {string} starting
  */
  const getTheTable = (starting) => sectionRows(allRowsTogther, starting)

  const HoldingsTable = getTheTable("Instrument Exposure ")
  const PurchaseAndSalesTable = getTheTable("Detailed Transactions - Instrument Purchases and Sales")
  const ContributionsTable = getTheTable("Detailed Transactions - Contributions and Withdrawals")
  const TaxTable = getTheTable("Detailed Transactions - Dividends and withholding Tax")
  const ExpensesTable = getTheTable("Detailed Transactions - Expenses")

  const accountIndex = allRowsTogther.findIndex((row) => {return row.text.trim().startsWith("EE")})
  const statementIndex = allRowsTogther.find((row) => {return row.text.trim().includes(" to ")})
  const accountRow = allRowsTogther[accountIndex]
  const PortfolioRow = allRowsTogther[accountIndex + 1].text.trim()

  if(!statementIndex)
  {
    throw("error for the statementIndex")
  }

  const gettingthData = statementIndex.text.split("to")[1].trim()
  const date = new Date(gettingthData).toISOString().split("T")[0]


  const Portfolio = [{

      account_number: accountRow.text,
      portfolio_name: PortfolioRow,
      statement_date: date,

  }]


  let instrumentName = "";

  const Holdings = HoldingsTable.map((row) => {

    if(row.text.includes("Opening Balance") || row.text.includes("Instrument") || row.text.includes("Total") || row.text.includes("Page"))
    {
      return null
    }

   const parsed = parseExposureRow(row.text)

   if(parsed === null)
   {
    instrumentName = instrumentName + " " + row.text;
    return null;
   }

    const holdings =  {
      ...parsed,
      instrument_name: (instrumentName + " " + parsed.instrument_name).trim(),
    }

    instrumentName = "";

    return holdings;

  }).filter((item) => item !== null)


   const PurchaseandSales = PurchaseAndSalesTable
     .map((row) => parsePurchaseRow(row.text))
     .filter((item) => item !== null)


   const ContributionsandWithdrawals = ContributionsTable.map((row) => {
    const splitParts = row.text.split(" ").filter((item => item !== ""))

    if(!splitParts[0].includes("/"))
    {
      return null
    }

    const last = splitParts.at(-1) || "";
    const secondLast = splitParts.at(-2) || "";

    const chackThousands = !Number.isNaN(Number(secondLast))

    return {
      transaction_date: splitParts[0].replaceAll("/","-"),
      statement_date: splitParts[1].replaceAll("/","-"),
      transaction_name: splitParts.slice(2,chackThousands ? -2 : -1).join(" ").replaceAll("Capital",""),
      value: chackThousands ? secondLast + last : last
    }

  }).filter((item) => item !== null)

  
   const DividendsandWithholdingTax = TaxTable.map((row) => {
    const splitParts = row.text.split(" ").filter((item) => item !== "")

    if(!splitParts[0].includes("/"))
    {
      return null;
    }

    return {
      transaction_date: splitParts[0].replaceAll("/","-"),
      instrument_name: splitParts.slice(1,-4).join(" "),
      gross_dividend: splitParts[splitParts.length - 4],
      tax_rate: splitParts[splitParts.length - 1],
    }
  }).filter((item) => item !== null)

   const Expenses = ExpensesTable.map((row) => {
    const splitParts = row.text.split(" ").filter((item => item !== ""))

    if(!splitParts[0].includes("/"))
    {
      return null;
    }

    return {
      transaction_date: splitParts[0].replaceAll("/","-"),
      settlement_date: splitParts[1].replaceAll("/","-"),
      narrative:  splitParts.slice(2,-1).join(" "),
      value: splitParts[splitParts.length - 1],
    }
  }).filter((item) => item !== null)

  const results = {Portfolio,Holdings,PurchaseandSales,ContributionsandWithdrawals,DividendsandWithholdingTax,Expenses}

  return results;

}

const Portfolio = () => {
  
  const navigate = useNavigate();
  /**
   * @type {[any, function]}
   */
  const [summary, setSummary] = useState(null);
  /**
   * @type {[any[], function]}
   */
  const [GetTheTopHoldingsImportPDF, setGetTheTopHoldingsImportPDF] = useState(/** @type {any[]}*/[]);
  /**
   * @type {[any[], function]}
   */
  const [summaGetTheTopAllocationImportPDFry, setGetTheTopAllocationImportPDF] = useState(/** @type {any[]}*/[]);
  const [GetTheLowest, setGetTheLowest] = useState({ name: "", value: 0 });
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
  const [accountType,setAccountType] = useState("");
  const [showPortfolios,setShowPortfolios] = useState(false);
  const [portfolios, setPortfolios] = useState(/** @type {any[]}*/[]);

  useEffect( () => {
    const getInfo = async () => {
      const responses = await api.get("/portfolio/current");
      setPortfolios(responses.data);
    };

    getInfo();

  }, [])

  /**
   * 
   * @param {*} id 
   */
  const ViewSummary = async(id) => {

  try{
    setLoadingPage(true)


          const getSummaryRequest = await api.get(
        `/import_pdf_summary/summary/${id}`
      )

      const getSummary = getSummaryRequest.data;
      setSummary(getSummary);

      const SummaGetTheTopAllocationImportPDFRequest = await api.get(
        `/import_pdf_summary/top_holdings/${id}`,
      )

      const getSummaGetTheTopAllocationImportPDFry = SummaGetTheTopAllocationImportPDFRequest.data;
      setGetTheTopHoldingsImportPDF(getSummaGetTheTopAllocationImportPDFry);


      const getSummaryGetTheTopHoldingsImportPDFRequest = await api.get(
        `/import_pdf_summary/portfolio_allocation/${id}`
      )

      const getSummaryGetTheTopHoldingsImportPDF = getSummaryGetTheTopHoldingsImportPDFRequest.data;
      setGetTheTopAllocationImportPDF(getSummaryGetTheTopHoldingsImportPDF);

      const LowestHoldingsRequest = await api.get(
        `/import_pdf_summary/lowest_holdings/${id}`
      )

      const LowestHoldings = LowestHoldingsRequest.data;
      setGetTheLowest(LowestHoldings);

       const TradingActivity = await api.get(
        `/import_pdf_summary/trading_activity/${id}`
      )

      const TradingActivityImport = TradingActivity.data;
      setGetTradingActivity(TradingActivityImport);

       const CashFlow = await api.get(
        `/import_pdf_summary/cash_flow/${id}`
      )

      const CashFlowImport = CashFlow.data;
      setGetCashFlow(CashFlowImport);

       const Income = await api.get(
        `/import_pdf_summary/dividend_income/${id}`
      )

      const IncomeImport = Income.data;
      setGetDividendIncome(IncomeImport);
    
  }

  catch(error)
  {
    console.warn("failed to load portfolio summary:", error)
  }
  finally
  {
    setLoadingPage(false)
  }

  }

  const colours = ["#8B5CF6", "#3B82F6", "#22C55E", "#F59E0B"];

  /**
   * 
   * @param {any} data
   * @param {File} file
   */

  
  const SavePortfolio = async (data, file) => {
    let createdPortfolioId = null;

    try {

      const uploadInvestmentStatements = await api.post(
        "/import_pdf/",
        
          {
            file_name: file.name,
          }
        
      );

      const document = uploadInvestmentStatements.data;
      const portfolio = data.Portfolio[0];

      const uploadPortfolioRequest = await api.post(
        "/import_pdf/save_portfolios/",
        {
            document_id: document.document_id,
            account_number: portfolio.account_number,
            portfolio_name: portfolio.portfolio_name,
            currency: "ZAR",
            statement_end_date: portfolio.statement_date,
            account_type: accountType
          }
      );

      const savedPortfolio = uploadPortfolioRequest.data;
      createdPortfolioId = savedPortfolio.portfolio_id;

      for (const holding of buildHoldingsPayload(data.Holdings)) {
        const uploadHoldingsRequest = await api.post(
          "/import_pdf/save_holdings",
          { portfolio_id: savedPortfolio.portfolio_id, ...holding }
          )
      }

     


      for (const eachItems of data.PurchaseandSales) {

        const price = parseFloat(eachItems.price);
        const quantity = parseFloat(eachItems.quantity);


        const uploadHoldingsRequest = await api.post(
          "/import_pdf/save_instrument_purchases_and_sales/",
          {
              portfolio_id: savedPortfolio.portfolio_id,
              transaction_date: eachItems.transaction_date,
              transaction_name: eachItems.transaction_name,
              instrument_name: eachItems.instrument_name,
              ticker: " ",
              sector: " ",
              price: price,
              quantity: quantity,
              value_zar: parseFloat(eachItems.value_zar),
            }
          )

      }


      for (const eachItems of data.ContributionsandWithdrawals) {
        const value_zar = parseFloat(eachItems.value);

        const uploadHoldingsRequest = await api.post(
          "/import_pdf/save_contributions_and_withdrawals/",
          {
              portfolio_id: savedPortfolio.portfolio_id,
              transaction_date: eachItems.transaction_date,
              settlement_date: eachItems.statement_date,
              transaction_name: eachItems.transaction_name,
              value_zar: value_zar,
          } 
        );
      }

      for (const eachItems of data.DividendsandWithholdingTax) {
        const gross_dividend = parseFloat(eachItems.gross_dividend);
        const tax_rate = parseFloat(eachItems.tax_rate);
        const net_dividend = ((gross_dividend - (gross_dividend *  (tax_rate/100))));

        const uploadHoldingsRequest = await api.post(
          "/import_pdf/save_dividends_and_withholding_tax/",
          {
              portfolio_id: savedPortfolio.portfolio_id,
              transaction_date: eachItems.transaction_date,
              instrument_name: eachItems.instrument_name,
              ticker: " ",
              sector: " ",
              gross_dividend: gross_dividend,
              withholding_tax: (gross_dividend *  (tax_rate/100)),
              net_dividend: net_dividend,
              tax_rate: tax_rate,
            }
           )
          }
      

      for (const eachItems of data.Expenses) {
        const value_zar = parseFloat(eachItems.value);

        const uploadHoldingsRequest = await api.post(
          "/import_pdf/save_transaction_expenses/",
          {
              portfolio_id: savedPortfolio.portfolio_id,
              transaction_date: eachItems.transaction_date,
              settlement_date: eachItems.settlement_date,
              narrative_name: eachItems.narrative,
              value_zar: value_zar,
            }
        );
      }
    
      
      const getSummaryRequest = await api.get(
        `/import_pdf_summary/summary/${savedPortfolio.portfolio_id}`
      )

      const getSummary = getSummaryRequest.data;
      setSummary(getSummary);

      const SummaGetTheTopAllocationImportPDFRequest = await api.get(
        `/import_pdf_summary/top_holdings/${savedPortfolio.portfolio_id}`,
      )

      const getSummaGetTheTopAllocationImportPDFry = SummaGetTheTopAllocationImportPDFRequest.data;
      setGetTheTopHoldingsImportPDF(getSummaGetTheTopAllocationImportPDFry);


      const getSummaryGetTheTopHoldingsImportPDFRequest = await api.get(
        `/import_pdf_summary/portfolio_allocation/${savedPortfolio.portfolio_id}`
      )

      const getSummaryGetTheTopHoldingsImportPDF = getSummaryGetTheTopHoldingsImportPDFRequest.data;
      setGetTheTopAllocationImportPDF(getSummaryGetTheTopHoldingsImportPDF);

      const LowestHoldingsRequest = await api.get(
        `/import_pdf_summary/lowest_holdings/${savedPortfolio.portfolio_id}`
      )

      const LowestHoldings = LowestHoldingsRequest.data;
      setGetTheLowest(LowestHoldings);





       const TradingActivity = await api.get(
        `/import_pdf_summary/trading_activity/${savedPortfolio.portfolio_id}`
      )

      const TradingActivityImport = TradingActivity.data;
      setGetTradingActivity(TradingActivityImport);

       const CashFlow = await api.get(
        `/import_pdf_summary/cash_flow/${savedPortfolio.portfolio_id}`
      )

      const CashFlowImport = CashFlow.data;
      setGetCashFlow(CashFlowImport);

       const Income = await api.get(
        `/import_pdf_summary/dividend_income/${savedPortfolio.portfolio_id}`
      )

      const IncomeImport = Income.data;
      setGetDividendIncome(IncomeImport);

    }
    catch (theErrors)
    {

      if(createdPortfolioId)
      {
        try
        {
          await api.delete(`/import_pdf/portfolios/${createdPortfolioId}`)
        }
        catch(cleanupError)
        {
          console.warn("could not remove the half-imported portfolio:", cleanupError)
        }
      }

      alert(`Could not save your statement: ${describeApiError(theErrors)}. Nothing was imported - please try again.`)
    }


  }

    if (LoadingPage)
    {
      return(
        <div className="flex flex-col items-center justify-center mt-32">
        <LoaderCircle className="w-20 h-16 animate-spin text-orange-500" />     
        <h2 className="text-2xl font-bold mt-4" style = {{color: 'var(--text-primary)'}}>Loading Portfolio</h2>
        <p style = {{color: 'var(--text-secondary)'}}>Please wait until we import your portfolio...</p>
        </div>
      )
    }
  
  return (

    
    <div className="p-6">

      <div className="max-w-6xl mx-auto p-6 bg-gray-900 border border-gray-700 rounded-3xl">

        <div className="text-center mb-10">
            <h2 className="text-4xl font-bold text-white mb-3">
              Upload Portfolio
            </h2>

            <p className="text-gray-400 max-w-xl mx-auto">
              Import your easyEquities portfolio but using your statement
              or our Excel template
            </p>
          </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">

                <h3 className="text-lg font-semibold text-white mb-2">
                  My Portfolios
                </h3>



    {portfolios.slice(0,2).map(/** @param {any} portfolio*/(portfolio, index) => (

            <div key={index} className="border border-gray-700 rounded-xl p-4 mb-3">
              <div className="flex justify-between items-center">

                 <p className="text-white font-semibold">
                  {portfolio.portfolio_name}
                </p>

                <span className="text-purple-400 font-semibold">
                  {accountTypeLabel(portfolio.account_type)}
                </span>

              </div>

                <p className="text-sm text-gray-400">
                  Account: {portfolio.account_number}
                </p>
           
                <p className="text-sm text-gray-400">
                  {statementPeriod(portfolio)}
                </p>

                <button onClick={() => ViewSummary(portfolio.id)} className="text-purple-400 mt-2 hover:text-purple-300 hover:underline cursor-pointer">
                  View Summary
                </button>
            </div>

          ))}

                <button 
                onClick={() => setShowPortfolios(true)}
                className="block mx-auto text-orange-400 mt-4 hover:text-orange-300">
                  view all
                </button>

              </div>


        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Upload your statement
                </h3>

                <p className="text-sm text-gray-400">
                  Upload your EasyEquities PDF or Complete the Excel template
                </p>
            </div>

            <div className="mb-4">
            <label htmlFor="account-type-select" className="block text-sm text-gray-400 mb-2">Account Type</label>

            <select
              id="account-type-select"
              value={accountType}
              onChange={(event) => setAccountType(event.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-xl"
            >
                <option value=""> Select account type</option>
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <label className="block text-center cursor-pointer w-full bg-orange-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-orange-600 transition">

              choose the File

            <input
              type="file"
              accept=".pdf,.xlsx"
              className="hidden"
              onChange={async (event) => { 
                const file = event.target.files?.[0];

                if(!file)
                {
                  return;
                }

                if(!accountType)
                {
                  alert("Please select an account type first");
                  event.target.value = "";
                  return;
                }

                setLoadingPage(true)
                try
                {
                let data;

                if(file.name.toLowerCase().endsWith(".pdf"))
                {
                  const Passwords = prompt("Enter the PDF password") || "";
                  data = await ReadingPDFFile(file, Passwords);
                   
                }
                else if(file.name.toLowerCase().endsWith(".xlsx"))
                {
                  data = await ReadingExcelFile(file);
                }


                await SavePortfolio(data,file);
              }
            
            catch(theError)
            {
              if(theError instanceof Error && theError.name === "PasswordException")
              {
                alert("Incorrect PDF password. Please check the password and try again")
              }
              else if(file.name.toLowerCase().endsWith(".pdf"))
              {
                alert("Could not read this PDF - it may not be an EasyEquities statement. Please use the Excel template")
              }
              else if(file.name.toLowerCase().endsWith(".xlsx"))
              {
                alert("Invalid or unsupported Excel file. Please can you make sure to use the Excel template")
              }
              else
              {
                alert("Please make sure you either upload a pdf or Excel")
              }
            }
            finally
            {
              setLoadingPage(false)
            }

            }
          }
            />
          </label>

          <p className="text-sm text-gray-500 text-center mt-3">
            PDF or XLSX
          </p>
        </div>

          <div className="border border-gray-700 rounded-2xl p-6">
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">
                Excel Template
              </h3>

              <p className="text-sm text-gray-400">
                Don&apost have a supported PDF? Don&apost worry, You can enter your portfolio
                manually using our template
              </p>
            </div>

            <button onClick={DownloadEXCEL} className="w-full border border-orange-500 text-orange-400 hover:bg-orange-500 hover:text-white font-semibold py-3 rounded-xl transition">
              Download Template
            </button>
            <p className="text-sm text-gray-500 text-center mt-3">
              EquityLens Excel Template
            </p>
          </div>
        </div>

        </div>



      { showPortfolios && (

        <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
         <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-hidden">
          <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  My Portfolios
                </h3>

              <button onClick={() => setShowPortfolios(false) } className="text-gray-400 hover:text-white">
                X
              </button>
          </div>

<div>
  <div className="max-h-[65vh] overflow-y-auto pr-2">
        {portfolios.map(/** @param {any} portfolio*/(portfolio, index) => (

            <div key={index} className="border border-gray-700 rounded-xl p-4 mb-3">
              <div className="flex justify-between items-center">

                 <p className="text-white font-semibold">
                  {portfolio.portfolio_name}
                </p>

                <span className="text-purple-400 font-semibold">
                  {accountTypeLabel(portfolio.account_type)}
                </span>

              </div>

                <p className="text-sm text-gray-400">
                  Account: {portfolio.account_number}
                </p>
           
                <p className="text-sm text-gray-400">
                  {statementPeriod(portfolio)}
                </p>

                <button onClick={() => ViewSummary(portfolio.id)} className="text-purple-400 mt-2 hover:text-purple-300 hover:underline cursor-pointer">
                  View Summary
                </button>
            </div>

          ))}
          
        </div>
 </div>
              </div>

          </div>
      )

  

      }

      { summary && <div className="grid grid-cols-6 gap-8 mt-8">

        <div className="p-5 border rounded-2xl" style = {panelStyle}>

          <div className="flex items-center gap-3 mb-2">

            <Wallet size={20} className="text-yellow-500" />
            <p style = {mutedStyle}>Portfolio Value</p>

          </div>

          <h2 className="text-2xl font-bold" style = {titleStyle}>R {summary?.PortfolioValue || 0}</h2>


        </div>

        <div className="p-5 border rounded-2xl" style = {panelStyle}>

          <div className="flex items-center gap-3 mb-2">

            <Briefcase size={20} className="text-blue-500" />
            <p style = {mutedStyle}>Holdings</p>

          </div>

          <h2 className="text-2xl font-bold" style = {titleStyle}>{summary?.TotalHoldings || 0}</h2>

        </div>

           <div className="p-5 border rounded-2xl" style = {panelStyle}>

            <div className="flex items-center gap-3 mb-2">
              <ArrowLeftRight size={20} className="text-green-500" />
              <p style = {mutedStyle}>Purchase & Sales</p>
            </div>

            <h2 className="text-2xl font-bold" style = {titleStyle}>R {summary?.TotalPurchasesAndSales || 0}</h2>  

          </div>


          <div className="p-5 border rounded-2xl" style = {panelStyle}>

            <div className="flex items-center gap-3 mb-2">

            <Landmark size={20} className="text-purple-500" />
            <p style = {mutedStyle}>Contributions</p>

          </div>

          <h2 className="text-2xl font-bold" style = {titleStyle}>R {summary?.TotalContributionsAndWithdrawals || 0}</h2>

        </div>

        <div className="p-5 border rounded-2xl" style = {panelStyle}>

          <div className="flex items-center gap-3 mb-2">

            <TrendingUp size={20} className="text-green-500" />
            <p style = {mutedStyle}>Dividends</p>

          </div>

          <h2 className="text-2xl font-bold" style = {titleStyle}>R {summary?.TotalDividendsAndWithholdingTax || 0}</h2>

        </div>

        <div className="p-5 border rounded-2xl" style = {panelStyle}>

          <div className="flex items-center gap-3 mb-2">

            <CreditCard size={20} className="text-orange-500" />
            <p style = {mutedStyle}>Expenses</p>

          </div>

          <h2 className="text-2xl font-bold" style = {titleStyle}>R {summary?.TotalTransactionExpenses || 0}</h2>

        </div>
      </div>


      }


      <div className="grid grid-cols-4 gap-8 mt-8">
         
      </div>


      <div className="grid grid-cols-2 gap-8">
        

      </div>


      { summaGetTheTopAllocationImportPDFry.length > 0 && GetTheTopHoldingsImportPDF.length > 0 && <div className="grid grid-cols-3 gap-8 mb-7">
          
        <div className="min-w-0 border rounded-2xl p-4" style = {panelStyle}>
          <h2 className="text-xl font-bold text-center mb-4" style = {titleStyle}>
            Trading Activity
          </h2>

          <div className="flex justify-center w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={GetTradingActivity}>
            <XAxis dataKey="name"/>
            <YAxis/>
            <Tooltip/>
            <Bar dataKey="value" fill={colours[1]} />
          </BarChart>
          </ResponsiveContainer>
          </div>
          
        </div>

        <div className="min-w-0 border rounded-2xl p-4" style = {panelStyle}>
          <h2 className="text-xl font-bold text-center mb-4" style = {titleStyle}>
            Cash flow
          </h2>

          <div className="flex justify-center w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
           <PieChart>
              <Pie
                data={GetCashFlow}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}>

                {GetCashFlow.map((item, index) => (<Cell key={index} fill={colours[index % colours.length]} />))}
              </Pie>
              <Tooltip/>
              <Legend/>
            </PieChart>
            </ResponsiveContainer>
            </div>

        </div>

        <div className="min-w-0 border rounded-2xl p-4" style = {panelStyle}>
          <h2 className="text-xl font-bold text-center mb-4" style = {titleStyle}>
            Dividend Income
          </h2>

        <div className="flex justify-center w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
          <LineChart data={GetDividendIncome}>
            <XAxis dataKey="name"/>
            <YAxis/>
            <Tooltip/>
            <Legend/>

            <Line dataKey="gross_dividend"  stroke={colours[1]} />
            <Line dataKey="withholding_tax" stroke="#EF4444" />
            <Line dataKey="net_dividend"    stroke={colours[2]} />

          </LineChart>
          </ResponsiveContainer>
          </div>
        </div>

        </div>

      }


       { summaGetTheTopAllocationImportPDFry.length > 0 && GetTheTopHoldingsImportPDF.length > 0 && <div className="grid grid-cols-3 gap-8 ">

       

        <div className="min-w-0 border rounded-2xl p-4" style = {panelStyle}>
          <h2 className="text-xl font-bold text-center" style = {titleStyle}>
            Assert allocation
          </h2>

          <div className="flex justify-center w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={summaGetTheTopAllocationImportPDFry}
                dataKey="weight_percentage"
                innerRadius={50}
                outerRadius={80}>
                {summaGetTheTopAllocationImportPDFry.map((item, index) => (<Cell key={index} fill={colours[index % colours.length]} />))}
              </Pie>
              <Tooltip/>
              <Legend/>
            </PieChart>
            </ResponsiveContainer>
          </div>

          </div>

        <div className="col-span-2 min-w-0 border rounded-2xl p-4" style = {panelStyle}>
          <h2 className="text-xl font-bold text-center" style = {titleStyle}>
            Top Holdings
          </h2>

          {GetTheTopHoldingsImportPDF.map((item, index) =>
            <div key={index} className="mb-4">
              <div className="flex justify-between mb-1">
                  <p style={mutedStyle}>
                    {item.name}
                  </p>
                  <p style={mutedStyle}>
                    R{item.value}
                  </p>
              </div>


              <div className="w-full rounded-full h-3" style={{ background: 'var(--surface-inset)' }}>
                <div className="h-3 rounded-full"
                      style={{
                        width: `${(item.value / (GetTheTopHoldingsImportPDF[0].value || 1)) * 100}%`,
                        backgroundColor: colours[index % colours.length]
                    }}>
                </div>
              </div>
            </div>
          )}
        </div> 
    </div>

      }


       { summaGetTheTopAllocationImportPDFry.length > 0 && GetTheTopHoldingsImportPDF.length > 0 && <div className="grid grid-cols-2 gap-8 mt-8">

        <div className="p-6 border border-red-700 rounded-2xl">

          <div className="flex items-center gap-2">
            <TriangleAlert size={24} className="text-red-500"></TriangleAlert>
            <h2 className="text-xl font-bold" style = {{ color: 'var(--signal-negative)' }}>
              Lowest Holding
            </h2>
          </div>

          <p className="mb-5" style = {mutedStyle}>
            Your smallest holdings by weight in the portfolio
          </p>
            <div className="flex justify-between border rounded-xl p-4" style = {panelStyle}>

              <div>
                <p className="text-xl font-bold" style = {titleStyle}>{GetTheLowest?.name ?? "No holdings"}</p>    
              </div>

              <div>
                <p className="text-xl text-red-400 font-bold">{GetTheLowest?.value}</p>
              </div>

            </div>
        </div>

        <div className="p-6 border border-purple-500 rounded-2xl">

          <div className="flex items-center gap-2">
            <Bot size={24} className="text-purple-500"></Bot>
            <h2 className="text-xl font-bold" style = {titleStyle}>
              AI Portfolio Assistant
            </h2>
          </div>

          <p className="mb-5" style = {mutedStyle}>
            Ask questions about your portfolio and recivce AI-powered insights.
          </p>

          <button onClick={()=> navigate(ROUTES.AI_CHAT) }className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold">
            Go To Assistant
          </button>

        </div>

      </div>

       }

    </div>
       

  )



};

export default Portfolio;


