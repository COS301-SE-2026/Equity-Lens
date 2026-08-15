import { useState } from "react";
import * as ShowPdf from "pdfjs-dist";
import showOnUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { ArrowLeftRight, Wallet, CreditCard, TrendingUp, Landmark, Briefcase, TriangleAlert, Bot ,LoaderCircle } from "lucide-react"
import { PieChart, Pie, Cell,BarChart,XAxis, YAxis, Tooltip, Bar, LineChart, Line, Legend, ResponsiveContainer } from "recharts"
import api from "../../services/api"
import * as XLSX from "xlsx"

ShowPdf.GlobalWorkerOptions.workerSrc = showOnUrl;

const DownloadEXCEL = () =>{ window.open("/template/EquityLens_Portfolio_Excel_Template.xlsx") }

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
          quantity: item.Quantity
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
   * 
   * @param {string} starting 
   * @param {string} ending 
   * @returns 
   */
  const getTheTable = (starting,ending) => {
    const table = []
    let addingRows = false

    for(const row of allRowsTogther)
    {
      if(row.text.toLowerCase().includes(starting.toLowerCase()))
      {
        addingRows = true
        continue
      }

      if(addingRows && row.text.toLowerCase().includes(ending.toLowerCase()))
      {
        break
      }

      if(addingRows)
      {
        table.push({page:row.page, text: row.text})
      }
    }

    return table
  }

  const HoldingsTable = getTheTable("Instrument Exposure ","Detailed Transactions - Instrument Purchases and Sales")
  const PurchaseAndSalesTable = getTheTable("Detailed Transactions - Instrument Purchases and Sales","Detailed Transactions - Transaction Costs")
  const ContributionsTable = getTheTable("Detailed Transactions - Contributions and Withdrawals","Detailed Transactions - Dividends and Withholding Tax")
  const TaxTable = getTheTable("Detailed Transactions - Dividends and withholding Tax","Detailed Transactions - Interest")
  const ExpensesTable = getTheTable("Detailed Transactions - Expenses","Notes")

  const accountIndex = allRowsTogther.findIndex((row) => {return row.text.trim().startsWith("EE")})
  const statementIndex = allRowsTogther.find((row) => {return row.text.trim().includes(" to ")})
  const accountRow = allRowsTogther[accountIndex]
  const PortfolioRow = allRowsTogther[accountIndex + 1].text.trim()

  if(!statementIndex)
  {
    throw("error for the statementIndex")
  }

  const gettingthData = statementIndex.text.split("to")[1].trim()
  let date = new Date(gettingthData).toISOString().split("T")[0]


  const Portfolio = [{

      account_number: accountRow.text,
      portfolio_name: PortfolioRow,
      statement_date: date,

  }]


  let instrumentName = "";

  const Holdings = HoldingsTable.map((row) => {
    const splitParts = row.text.split(" ").filter((item => item !== ""))

    if(row.text.includes("Opening Balance") || row.text.includes("Instrument") || row.text.includes("Total") || row.text.includes("Page"))
    {
      return null
    }

   const firstNumberIndex = splitParts.findIndex((item) => { return item.includes(".") && !Number.isNaN(item);})

   if(firstNumberIndex === -1)
   {
    instrumentName = instrumentName + " " + row.text;
    return null;
   }

   instrumentName = instrumentName + " " + splitParts.slice(0,firstNumberIndex).join(" ");

   const values = splitParts.slice(firstNumberIndex);

   const getNumber = () => {
    let numbers = values.pop();
    const check = values.at(-1);

    if(values.length > 0 && check && !check.includes("."))
    {
      const checkSecond = values.pop();

      if(checkSecond)
      {
        numbers = checkSecond + numbers;
      }
    }

    return numbers;
   }

   getNumber()
   getNumber()
   getNumber()
   getNumber()
   const cost = getNumber()
   const quantity = getNumber()

   if(cost == undefined || quantity == undefined)
   {
      return null;
   }

    const holdings =  {
      instrument_name: instrumentName.trim(),
      quantity: quantity,
      total_cost: (cost),
    }

    instrumentName = "";

    return holdings;

  }).filter((item) => item != null)


   const PurchaseandSales = PurchaseAndSalesTable.map((row) => {

    const splitParts = row.text.split(" ").filter((item => item !== ""))

    if(!splitParts[0].includes("/"))
    {
      return null
    }
    const values = splitParts.slice(2)

    const getNumber = () => {
    let numbers = values.pop();

    const check = values.at(-1);

    if(values.length > 0 && check && !check.includes("."))
    {
      const CheckSecond = values.pop();

      if(CheckSecond)
      {
        numbers = CheckSecond + numbers;
      }
    }

    return numbers;
   }

   getNumber()
   getNumber()
   const quantity = getNumber()
   const price = getNumber()
   const instrumentname = values.join(" ")

    return {
      transaction_date: splitParts[0].replaceAll("/","-"),
      transaction_name: splitParts[1],
      instrument_name: instrumentname,
      price: price,
      quantity: quantity,
    }

  }).filter((item) => item != null)


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

  }).filter((item) => item != null)

  
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
  }).filter((item) => item != null)

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
  }).filter((item) => item != null)

  const results = {Portfolio,Holdings,PurchaseandSales,ContributionsandWithdrawals,DividendsandWithholdingTax,Expenses}

  return results;

}

const Portfolio = () => {
  /**
   * @type {[any, function]}
   */
  const [summary, setSummary] = useState(null);
  /**
   * @type {[any[], function]}
   */
  const [GetTheTopHoldingsImportPDF, setGetTheTopHoldingsImportPDF] = useState([]);
  /**
   * @type {[any[], function]}
   */
  const [summaGetTheTopAllocationImportPDFry, setGetTheTopAllocationImportPDF] = useState([]);
  const [GetTheLowest, setGetTheLowest] = useState({ name: "", value: 0 });
  /**
   * @type {[any[], function]}
   */
  const [GetTradingActivity, setGetTradingActivity] = useState([]);
  /**
   * @type {[any[], function]}
   */
  const [GetCashFlow, setGetCashFlow] = useState([]);
  /**
   * @type {[any[], function]}
   */
  const [GetDividendIncome, setGetDividendIncome] = useState([]);
  /**
   * @type {[boolean,function]}
   */
  const [LoadingPage, setLoadingPage] = useState(false);
  const [accountType,setAccountType] = useState("");
  const [showPortfolios,setShowPortfolios] = useState(false);

  const colours = ["#8B5CF6", "#3B82F6", "#22C55E", "#F59E0B"];

  /**
   * 
   * @param {any} data
   * @param {File} file
   */
  const SavePortfolio = async (data, file) => {

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
            statement_end_date: "2026-08-14",
            statement_start_date: "2026-01-01",
            account_type: accountType
          }
      );

      const savedPortfolio = uploadPortfolioRequest.data;

      let PortfolioValue = 0;

      for(const holding of data.Holdings)
      {
          PortfolioValue = PortfolioValue + parseFloat(holding.total_cost)
      }

      for (const eachItems of data.Holdings) {
        const totalCost = parseFloat(eachItems.total_cost);
        const quantity = parseFloat(eachItems.quantity || 0);

        const uploadHoldingsRequest = await api.post(
          "/import_pdf/save_holdings",
          {
              portfolio_id: savedPortfolio.portfolio_id,
              instrument_name: eachItems.instrument_name,
              quantity: eachItems.quantity,
              ticker: " ",
              sector: " ",
              total_cost: totalCost,
              cost_price: (totalCost / quantity),
              weight_percentage: ((totalCost / PortfolioValue) * 100),
            }
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
              value_zar: (price * quantity),
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

       const Expenses = await api.get(
        `/import_pdf_summary/expenses/${savedPortfolio.portfolio_id}`
      )

      const ExpensesImport = Expenses.data;



    }
    catch (theErrors)
    {
      console.error("SavePortfolio failed:", theErrors)

      if(file.name.toLowerCase().endsWith(".pdf"))
      {
       alert("Incorrect PDF Password or unsupported EasyQuities statement. Please use the Excel template")
      }
      else
      {
        alert("Invalid or unsupported Excel file. Please can you make sure to use the Excel template")
      }
    }


  }

    if (LoadingPage)
    {
      return(
        <div className="flex flex-col items-center justify-center mt-30">
        <LoaderCircle className="w-20 h-16 animate-spin text-orange-500" />     
        <h2 className="text-2xl text-white font-bold mt-4">Loading Portfolio</h2>
        <p className="text-gray-400">Please wait until we import your portfolio...</p>
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

            <div className="border border-gray-700 rounded-xl p-4">
              <div className="flex justify-between items-center">

                 <p className="text-white font-semibold">
                  EasyQuities TFSA
                </p>

                <span className="text-purple font-semibold">
                  TFSA
                </span>

              </div>
           
                <p className="text-sm text-gray-400">
                  Account: EE12ee
                </p>

                <button className="text-purple-400 mt-2 hover:text-purple-300 hover:underline cursor-pointer">
                  View Summary
                </button>

              
            </div>

                <button 
                onClick={() => setShowPortfolios(true)}
                className="block mx-auto text-orange-400 mt-4 hover:text-orange-300">
                  view more
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
              <label className="block text-sm text-gray-400 mb-2"> Account Type</label>

              <select
                value={accountType}
                onChange={(event) => setAccountType(event.target.value )}
                className="w-full bg-gray-800 border border-gray-700 text-white p-3 rounded-xl"
               
              >
                <option value=""> Select account type</option>
                <option value="Taxable">Taxable</option>
                <option value="TFSA">TFSA</option>
                <option value="RA">RA</option>
                <option value="Other">Other</option>
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
              if(file.name.toLowerCase().endsWith(".pdf"))
              {
                alert("Incorrect PDF Password or unsupported EasyEquities statement. Please use the Excel template")
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
                Don't have a supported PDF? Don't worry, You can enter your portfolio
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
         <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-lg">
          <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-white mb-2">
                  My Portfolios
                </h3>

              <button onClick={() => setShowPortfolios(false) } className="text-gray-400 hover:text-white">
                X
              </button>
          </div>

            <div className="border border-gray-700 rounded-xl p-4">
              <div className="flex justify-between items-center">

                 <p className="text-white font-semibold">
                  EasyQuities TFSA
                </p>

                <span className="text-purple font-semibold">
                  TFSA
                </span>

              </div>
           
                <p className="text-sm text-gray-400">
                  Account: EE12ee
                </p>

                <button className="text-purple-400 mt-2 hover:text-purple-300 hover:underline cursor-pointer">
                  View Summary
                </button>
            </div>

             <div className="border border-gray-700 rounded-xl p-4">
              <div className="flex justify-between items-center">

                 <p className="text-white font-semibold">
                  EasyQuities TFSA
                </p>

                <span className="text-purple font-semibold">
                  TFSA
                </span>

              </div>
           
                <p className="text-sm text-gray-400">
                  Account: EE12ee
                </p>

                <button className="text-purple-400 mt-2 hover:text-purple-300 hover:underline cursor-pointer">
                  View Summary
                </button>
            </div>


                <button 
                onClick={() => setShowPortfolios(true)}
                className="block mx-auto text-orange-400 mt-4 hover:text-orange-300">
                  view more
                </button>

              </div>

          </div>
      )

  

      }

      { summary && <div className="grid grid-cols-6 gap-8 mt-8">

        <div className="p-5 border border-gray-700 rounded-2xl">

          <div className="flex items-center gap-3 mb-2">

            <Wallet size={20} className="text-yellow-500" />
            <p className="text-gray-400">Portfolio Value</p>

          </div>

          <h2 className="text-2xl font-bold text-white">R {summary?.PortfolioValue || 0}</h2>


        </div>

        <div className="p-5 border border-gray-700 rounded-2xl">

          <div className="flex items-center gap-3 mb-2">

            <Briefcase size={20} className="text-blue-500" />
            <p className="text-gray-400">Holdings</p>

          </div>

          <h2 className="text-2xl font-bold text-white">{summary?.TotalHoldings || 0}</h2>

        </div>

        <div className="p-5 border border-gray-700 rounded-2xl">

          <div className="flex items-center gap-3 mb-2">
            <ArrowLeftRight size={20} className="text-green-500" />
            <p className="text-gray-400">Purchase & Sales</p>
          </div>

          <h2 className="text-2xl font-bold text-white">R {summary?.TotalPurchasesAndSales || 0}</h2>

        </div>


        <div className="p-5 border border-gray-700 rounded-2xl">

          <div className="flex items-center gap-3 mb-2">

            <Landmark size={20} className="text-purple-500" />
            <p className="text-gray-400">Contributions</p>

          </div>

          <h2 className="text-2xl font-bold text-white">R {summary?.TotalContributionsAndWithdrawals || 0}</h2>

        </div>

        <div className="p-5 border border-gray-700 rounded-2xl">

          <div className="flex items-center gap-3 mb-2">

            <TrendingUp size={20} className="text-green-500" />
            <p className="text-gray-400">Dividends</p>

          </div>

          <h2 className="text-2xl font-bold text-white">R {summary?.TotalDividendsAndWithholdingTax || 0}</h2>

        </div>

        <div className="p-5 border border-gray-700 rounded-2xl">

          <div className="flex items-center gap-3 mb-2">

            <CreditCard size={20} className="text-orange-500" />
            <p className="text-gray-400">Expenses</p>

          </div>

          <h2 className="text-2xl font-bold text-white">R {summary?.TotalTransactionExpenses || 0}</h2>

        </div>

      </div>

      }


      <div className="grid grid-cols-4 gap-8 mt-8">
         
      </div>


      <div className="grid grid-cols-2 gap-8">
        

      </div>


      { summaGetTheTopAllocationImportPDFry.length > 0 && GetTheTopHoldingsImportPDF.length > 0 && <div className="grid grid-cols-3 gap-8 mb-7">

        <div className="border border-gray-700 rounded-2xl p-4">
          <h2 className="text-xl font-bold text-white text-center mb-4">
            Trading Activity
          </h2>

          <div className="flex justify-center w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
          <BarChart data={GetTradingActivity}>
            <XAxis dataKey="name"/>
            <YAxis/>
            <Tooltip/>
            <Bar dataKey="value" fill="blue"/>
          </BarChart>
          </ResponsiveContainer>
          </div>
          
        </div>

        <div className="border border-gray-700 rounded-2xl p-4">
          <h2 className="text-xl font-bold text-white text-center mb-4">
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

         <div className="border border-gray-700 rounded-2xl p-4">
          <h2 className="text-xl font-bold text-white text-center mb-4">
            Dividend Income
          </h2>

        <div className="flex justify-center w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
          <LineChart data={GetDividendIncome}>
            <XAxis dataKey="name"/>
            <YAxis/>
            <Tooltip/>
            <Legend/>

            <Line dataKey="gross_dividend" stroke="blue" />
            <Line dataKey="withholding_tax" stroke="red" />
            <Line dataKey="net_dividend" stroke="green" />

          </LineChart>
          </ResponsiveContainer>
          </div>
        </div>

        </div>

      }


       { summaGetTheTopAllocationImportPDFry.length > 0 && GetTheTopHoldingsImportPDF.length > 0 && <div className="grid grid-cols-3 gap-8 ">

       

        <div className="border border-gray-700 rounded-2xl p-4">
          <h2 className="text-xl font-bold text-white text-center">
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

        <div className="col-span-2 border border-gray-700 rounded-2xl p-4">
          <h2 className="text-xl font-bold text-white text-center">
            Top Holdings
          </h2>

          {GetTheTopHoldingsImportPDF.map((item, index) =>
            <div key={index} className="mb-4">
              <div className="flex justify-between mb-1">
                <p className="text-gray-300">
                  {item.name}
                </p>

                <p className="text-gray-300">
                  R{item.value}
                </p>
              </div>


              <div className="w-full bg-gray-600 rounded-full h-3">
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
            <h2 className="text-xl font-bold text-red">
              Lowest Holding
            </h2>
          </div>


          <p className="text-gray-400 mb-5">
            Your smallest holdings by weight in the portfolio
          </p>

          <div className="flex justify-between border border-gray-700 rounded-xl p-4">

            <div>
              <p className="text-xl text-white font-bold">{GetTheLowest?.name ?? "No holdings"}</p>
            </div>

            <div>
              <p className="text-xl text-red-400 font-bold">{GetTheLowest?.value}</p>
            </div>

          </div>

        </div>

        <div className="p-6 border border-purple-500 rounded-2xl">

          <div className="flex items-center gap-2">
            <Bot size={24} className="text-purple-500"></Bot>
            <h2 className="text-xl font-bold">
              AI Portfolio Assistant
            </h2>
          </div>

          <p className="text-gray-400 mb-5">
            Ask questions about your portfolio and recivce AI-powered insights.
          </p>

          <button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-xl font-semibold">
            Go To Assistant
          </button>

        </div>

      </div>

       }

    </div>
       

  )



};

export default Portfolio;


