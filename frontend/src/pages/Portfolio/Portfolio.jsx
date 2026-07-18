import { useState } from "react";
import * as ShowPdf from "pdfjs-dist";
import showOnUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { ArrowLeftRight, Wallet, CreditCard, Percent, TrendingUp, Landmark, Receipt, Briefcase, TriangleAlert, Bot, Download } from "lucide-react"
import { PieChart, Pie, Cell,BarChart,XAxis, YAxis, Tooltip, Bar, LineChart, Line, Legend, ResponsiveContainer } from "recharts"
import api from "../../services/api"
import * as XLSX from "xlsx"

ShowPdf.GlobalWorkerOptions.workerSrc = showOnUrl;


const DownloadPDF = () => { window.open("/template/EquityLens PDF Import Template.pdf")}
const DownloadEXCEL = () =>{ window.open("/template/EquityLens Portfolio Excel Template.xlsx") }


const ReadingExcelFile = async(file) => {

  if(!file)
  {
    return;
  }

  const read = XLSX.read(await file.arrayBuffer());

  const Portfolio = XLSX.utils.sheet_to_json(read.Sheets["Portfolio"]).map((item) =>({
          account_number: item.Account_Number,
          portfolio_name: item.Portfolio_Name,
          statement_date: item.Statement_Date,
          portfolio_value: item.Portfolio_Value,
  }));
  const Holdings = XLSX.utils.sheet_to_json(read.Sheets["Holdings"]).map((item) =>({
         instrument_name: item.Instrument_Name,
          quantity: item.Quantity,
          total_cost: item.Total_Cost,
  }));
  const PurchaseandSales = XLSX.utils.sheet_to_json(read.Sheets["Purchase and Sales"]).map((item) =>({
          transaction_date: item.Transaction_Date,
          transaction_name: item.Transaction_Type,
          instrument_name: item.Instrument_Name,
          price: item.Price,
          quantity: item.Quantity
  }));
  const ContributionsandWithdrawals = XLSX.utils.sheet_to_json(read.Sheets["Contributions and Withdrawals"]).map((item) =>({
              transaction_date: item.Transaction_Date,
              statement_date: item.Settlement_Date,
              transaction_name: item.Transaction_Type,
              value: item.Value,
  }));
  const DividendsandWithholdingTax = XLSX.utils.sheet_to_json(read.Sheets["Dividends and Withholding Tax"]).map((item) =>({
              transaction_date: item.Transaction_Date,
              instrument_name: item.Instrument_Name,
              gross_dividend: item.Gross_Dividend,
              tax_rate: item["Tax_Rate(%)"],
  }));
  const Expenses = XLSX.utils.sheet_to_json(read.Sheets["Expenses"]).map((item) =>({
              transaction_date: item.Transaction_Date,
              settlement_date: item.Settlement_Date,
              narrative: item.Narrative,
              value: item.Value,
  }));


  return {
    Portfolio,Holdings,PurchaseandSales,ContributionsandWithdrawals,DividendsandWithholdingTax,Expenses
  }

}

const ReadingPDFFile = async(file) =>
{
  if(!file)
  {
    return
  }

  const convertPdf = await ShowPdf.getDocument({
        data: await file.arrayBuffer(),
        password: "test",
      }).promise;


  const allRows = [];

  for(let x = 1; x <= convertPdf.numPages;x++)
  {
      const toGetThePage = await convertPdf.getPage(x);
      const ToGetTheContent = await toGetThePage.getTextContent();


      console.log("all", ToGetTheContent)

      for(const items of ToGetTheContent.items)
      {

        allRows.push({text: items.str, x:items.transform[4], y:items.transform[5], page: x})
      }


  }

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
      allRowsTogther.push({page: items.page, y: items.y, items: [items]})
    }

    
  }

  console.log("allRowsTogther:", allRowsTogther )

  for(const row of allRowsTogther)
  {
     row.text = row.items.map((item) => item.text).join(" ")
  }

  console.log("allRowsTogther text :", allRowsTogther )

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

  const HoldingsTable = getTheTable("Holdings","Detailed Transactions - Instrument Purchases and Sales")
  const PurchaseAndSalesTable = getTheTable("Detailed Transactions - Instrument Purchases and Sales","Detailed Transactions - Transaction Costs")
  const ContributionsTable = getTheTable("Detailed Transactions - Contributions and Withdrawals","Detailed Transactions - Dividends and Withholding Tax")
  const TaxTable = getTheTable("Detailed Transactions - Dividends and withholding Tax","Detailed Transactions - Interest")
  const ExpensesTable = getTheTable("Detailed Transactions - Expenses","Notes")

  const results = {HoldingsTable,PurchaseAndSalesTable,TaxTable,ContributionsTable,ExpensesTable}

  console.log("Check all the data.", JSON.stringify(results,null,2))

  return results;

}

const Portfolio = () => {
  const [summary, setSummary] = useState("");
  const [GetTheTopHoldingsImportPDF, setGetTheTopHoldingsImportPDF] = useState([]);
  const [summaGetTheTopAllocationImportPDFry, setGetTheTopAllocationImportPDF] = useState([]);
  const [GetTheLowest, setGetTheLowest] = useState([]);
  const [GetTradingActivity, setGetTradingActivity] = useState([]);
  const [GetCashFlow, setGetCashFlow] = useState([]);
  const [GetDividendIncome, setGetDividendIncome] = useState([]);
  const [GetExpenses, setGetExpenses] = useState([]);

  const colours = ["#8B5CF6", "#3B82F6", "#22C55E", "#F59E0B"];

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
          }
      );

      const savedPortfolio = uploadPortfolioRequest.data;

      const PortfolioValue = parseFloat(data.Portfolio[0].portfolio_value.replace("R","").replace(",",""));

      for (const eachItems of data.Holdings) {
        const totalCost = parseFloat(eachItems.total_cost.replace("R","").replace(",",""));
        const quantity = parseFloat(eachItems.quantity);

        const uploadHoldingsRequest = await api.post(
          "/import_pdf/save_holdings/",
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

        const price = parseFloat(eachItems.price.replace("R","").replace(",",""));
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
        const value_zar = parseFloat(eachItems.value.replace("R","").replace(",",""));

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
        const gross_dividend = parseFloat(eachItems.gross_dividend.replace("R","").replace(",",""));
        const tax_rate = parseFloat(eachItems.tax_rate.replace("%",""));
        const net_dividend = parseFloat((gross_dividend - (gross_dividend *  (tax_rate/100))));

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
        const value_zar = parseFloat(eachItems.value.replace("R","").replace(",",""));

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
      setGetExpenses(ExpensesImport);



    }
    catch (theErrors) 
    {
      
    }




  }

  return (

    <div className="p-2">

      <div className="p-6 border border-gray-700 rounded-3xl">

        <div className="flex flex-col items-center">

            <h2 className="text-2xl font-bold text-white text-center">
              Upload Portfolio
            </h2>
            <p className="text-gray-400 mt-2 mb-3 text-center">
              Upload your a PDF or Excel file to import your portfolio
            </p>

            <div className="flex gap-4 mt-6">

            <button onClick={DownloadPDF} className="bg-red-600 text-white px-5 py-2 rounded-lg">
                Download PDF Template
            </button>

            <button onClick={DownloadEXCEL} className="bg-green-600 text-white px-5 py-2 rounded-lg">
              Download Excel Template
            </button>

             </div>

            <input
              type="file"
              accept=".pdf,.xlsx"
              className="mt-6 text-gray-600"
              onChange={async (event) => { 
                const file = event.target.files[0];

                if(!file)
                {
                  return;
                }


                try
                {
                let data;

                if(file.name.toLowerCase().endsWith(".pdf"))
                {
                   data = await ReadingPDFFile(file);
                }
                else if(file.name.toLowerCase().endsWith(".xlsx"))
                {
                  data = await ReadingExcelFile(file);
                }
                else
                {
                  alert("Please select a PDF or Excel file");
                  return;
                }


                await SavePortfolio(data,file);
              }
            
            catch(theError)
            {
              alert("Not working...")
            }

            }
          }
            />

        </div>

      </div>

      { summary && <div className="grid grid-cols-6 gap-8 mt-8">

        <div className="p-5 border border-gray-700 rounded-2xl">

          <div className="flex items-center gap-3 mb-2">

            <Wallet size={20} className="text-yellow-500" />
            <p className="text-gray-400">Portfolio Value</p>

          </div>

          <h2 className="text-2xl font-bold text-white">R{summary?.PortfolioValue || 0}</h2>


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

          <h2 className="text-2xl font-bold text-white">R{summary?.TotalPurchasesAndSales || 0}</h2>

        </div>


        <div className="p-5 border border-gray-700 rounded-2xl">

          <div className="flex items-center gap-3 mb-2">

            <Landmark size={20} className="text-purple-500" />
            <p className="text-gray-400">Contributions</p>

          </div>

          <h2 className="text-2xl font-bold text-white">R{summary?.TotalContributionsAndWithdrawals || 0}</h2>

        </div>

        <div className="p-5 border border-gray-700 rounded-2xl">

          <div className="flex items-center gap-3 mb-2">

            <TrendingUp size={20} className="text-green-500" />
            <p className="text-gray-400">Dividends</p>

          </div>

          <h2 className="text-2xl font-bold text-white">R{summary?.TotalDividendsAndWithholdingTax || 0}</h2>

        </div>

        <div className="p-5 border border-gray-700 rounded-2xl">

          <div className="flex items-center gap-3 mb-2">

            <CreditCard size={20} className="text-orange-500" />
            <p className="text-gray-400">Expenses</p>

          </div>

          <h2 className="text-2xl font-bold text-white">R{summary?.TotalTransactionExpenses || 0}</h2>

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



         <div className="border border-gray-700 rounded-2xl p-4">
          <h2 className="text-xl font-bold text-white text-center">
            Expense breakdown
          </h2>
          <div className="flex justify-center w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={GetExpenses} layout="vertical">
            <XAxis type = "number"/>
            <YAxis type="category" dataKey="name"/>
            <Tooltip/>
            <Bar dataKey="value" fill="orange"/>
          </BarChart>
          </ResponsiveContainer>
          </div>
        </div>

      

        <div className="border border-gray-700 rounded-2xl p-4">
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
              <p className="text-xl text-white font-bold">{GetTheLowest.name}</p>
            </div>

            <div>
              <p className="text-xl text-red-400 font-bold">{GetTheLowest.value}</p>
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


