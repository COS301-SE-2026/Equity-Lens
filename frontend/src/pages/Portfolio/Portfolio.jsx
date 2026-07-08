import { useState } from "react";
import * as ShowPdf from "pdfjs-dist";
import showOnUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { ArrowLeftRight, Wallet, CreditCard, Percent, TrendingUp, Landmark, Receipt, Briefcase, TriangleAlert, Bot } from "lucide-react"
import { PieChart, Pie, Cell } from "recharts"
import api from "../../services/api"
import * as XLSX from "xlsx"

ShowPdf.GlobalWorkerOptions.workerSrc = showOnUrl;


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


const ReadingPDFFile = async(file) => {


  if(!file)
  {
    return;
  }

        const convertPdf = await ShowPdf.getDocument({
        data: await file.arrayBuffer(),
      }).promise;

      let gettingInfo = "";

      for (let i = 1; i <= convertPdf.numPages; i++) {
        const page = await convertPdf.getPage(i);
        const content = await page.getTextContent();

        let PageInfo = "";


        for (const items of content.items) 
        {
          PageInfo = PageInfo + items.str + " ";
        }

        gettingInfo = gettingInfo + PageInfo;

      }

      const words = gettingInfo.split(" ").filter((word) => word !== "");

      const findAllSections = (start, end) =>
      {
        const starting = words.indexOf(start);
        const ending = words.indexOf(end);

        return words.slice(starting + 1, ending);
      }


  const PortfolioLength = findAllSections("Portfolio","Holdings")
  const HoldingsLength = findAllSections("Holdings","Purchase_and_Sales")
  const PurchaseandSalesLength = findAllSections("Purchase_and_Sales","Contributions_and_Withdrawals")
  const ContributionsandWithdrawalsLength = findAllSections("Contributions_and_Withdrawals","Dividends_and_Withholding_Tax")
  const DividendsandWithholdingTaxLength = findAllSections("Dividends_and_Withholding_Tax","Expenses")
  const ExpensesLength = words.slice(words.indexOf("Expenses") + 1)

  const Portfolio = []
  const Holdings = []
  const PurchaseandSales = []
  const ContributionsandWithdrawals = []
  const DividendsandWithholdingTax = []
  const Expenses = []


  for (let x = 5; x < PortfolioLength.length; x = x + 4) 
  {
        Portfolio.push({
          account_number: PortfolioLength[x],
          portfolio_name: PortfolioLength[x + 1],
          statement_date: PortfolioLength[x + 2],
          portfolio_value: PortfolioLength[x + 3],
        })
  }


  for (let x = 3; x < HoldingsLength.length; x = x + 3) 
  {
        Holdings.push({
          instrument_name: HoldingsLength[x],
          quantity: HoldingsLength[x + 1],
          total_cost: HoldingsLength[x + 2],
        })
  }

   for (let x = 5; x < PurchaseandSalesLength.length; x = x + 5) 
  {
        PurchaseandSales.push({
          transaction_date: PurchaseandSalesLength[x],
          transaction_name: PurchaseandSalesLength[x + 1],
          instrument_name: PurchaseandSalesLength[x + 2],
          price: PurchaseandSalesLength[x + 3],
          quantity: PurchaseandSalesLength[x + 4],
        })
  }

   for (let x = 4; x < ContributionsandWithdrawalsLength.length; x = x + 4) 
  {
        ContributionsandWithdrawals.push({
          transaction_date: ContributionsandWithdrawalsLength[x],
          statement_date: ContributionsandWithdrawalsLength[x + 1],
          transaction_name: ContributionsandWithdrawalsLength[x + 2],
          value: ContributionsandWithdrawalsLength[x + 3],
        })
  }

   for (let x = 4; x < DividendsandWithholdingTaxLength.length; x = x + 4) 
  {
        DividendsandWithholdingTax.push({
          transaction_date: DividendsandWithholdingTaxLength[x],
          instrument_name: DividendsandWithholdingTaxLength[x + 1],
          gross_dividend: DividendsandWithholdingTaxLength[x + 2],
          tax_rate: DividendsandWithholdingTaxLength[x + 3],
        })
  }

  for (let x = 4; x < ExpensesLength.length; x = x + 4) 
  {
        Expenses.push({
          transaction_date: ExpensesLength[x],
          settlement_date: ExpensesLength[x + 1],
          narrative: ExpensesLength[x + 2],
          value: ExpensesLength[x + 3],
        })
  }

  return {
    Portfolio,Holdings,PurchaseandSales,ContributionsandWithdrawals,DividendsandWithholdingTax,Expenses
  }


}

const Portfolio = () => {
  const [summary, setSummary] = useState("");
  const [GetTheTopHoldingsImportPDF, setGetTheTopHoldingsImportPDF] = useState([]);
  const [summaGetTheTopAllocationImportPDFry, setGetTheTopAllocationImportPDF] = useState([]);
  const colours = ["#8B5CF6", "#3B82F6", "#22C55E", "#F59E0B"];

  const SavePortfolio = async (data, file) => {

    try {

      const uploadInvestmentStatements = await api.post(
        "/import_pdf/",
        
          {
            file_name: file.name,
            document_text: "testing",
            password: "",
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




    }
    catch (theErrors) 
    {
      
    }




  }

  return (

    <div className="p-2">

      <div className="p-6 border border-gray-700 rounded-3xl">

        <div className="grid grid-cols-2 gap-8">

          <div>
            <h2 className="text-2xl font-bold text-white">
              Upload Portfolio
            </h2>
            <p className="text-gray-400 mt-2 mb-3">
              Upload your a PDF or Excel file to import your portfolio
            </p>

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

      </div>

      <div className="grid grid-cols-4 gap-8 mt-8">

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

          <h2 className="text-2xl font-bold text-white">R{summary?.TotalHoldings || 0}</h2>

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

            <Receipt size={20} className="text-red-500" />
            <p className="text-gray-400">Transaction COst</p>

          </div>

          <h2 className="text-2xl font-bold text-white">R{summary?.TotalTransactionCosts || 0}</h2>

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

            <Percent size={20} className="text-cyan-500" />
            <p className="text-gray-400">Interest</p>

          </div>

          <h2 className="text-2xl font-bold text-white">R{summary?.TotalTransactionInterest || 0}</h2>

        </div>

        <div className="p-5 border border-gray-700 rounded-2xl">

          <div className="flex items-center gap-3 mb-2">

            <CreditCard size={20} className="text-orange-500" />
            <p className="text-gray-400">Expenses</p>

          </div>

          <h2 className="text-2xl font-bold text-white">R{summary?.TotalTransactionExpenses || 0}</h2>

        </div>

      </div>


      <div className="grid grid-cols-4 gap-8 mt-8">

      </div>


      <div className="grid grid-cols-2 gap-8">


      </div>


      <div className="grid grid-cols-4 gap-8 ">

        <div className="border border-gray-700 rounded-2xl p-4">
          <h2 className="text-xl font-bold text-white">
            Portfolio Value Over Time
          </h2>
        </div>

        <div className="border border-gray-700 rounded-2xl p-4 col-span-2">
          <h2 className="text-xl font-bold text-white">
            Assert allocation
          </h2>

          <div className="flex items-center gap-6">


            <PieChart width={250} height={250}>
              <Pie
                data={summaGetTheTopAllocationImportPDFry}
                dataKey="weight_percentage"
                innerRadius={50}
                outerRadius={80}>

                {summaGetTheTopAllocationImportPDFry.map((item, index) => (<Cell key={index} fill={colours[index % colours.length]} />))}
              </Pie>

            </PieChart>

            <div className="flex flex-col justify-center gap-3">
              {summaGetTheTopAllocationImportPDFry.map((item, index) => (
                <div key={index} className="flex justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: colours[index % colours.length] }}>

                    </div>
                    <p className="text-gray-400">
                      {item.name}
                    </p>
                  </div>

                  <p className="text-white font-bold">
                    {item.weight_percentage}
                  </p>

                </div>
              ))}
            </div>

          </div>

          <div>

          </div>

        </div>

        <div className="border border-gray-700 rounded-2xl p-4">
          <h2 className="text-xl font-bold text-white">
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


      <div className="grid grid-cols-2 gap-8 mt-8">

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
              <p className="text-gray-400 text-sm">Instrument</p>
              <p className="text-xl text-white font-bold">Satrix</p>
            </div>

            <div>
              <p className="text-gray-400 text-sm">weight</p>
              <p className="text-xl text-red-400 font-bold">0.0%</p>
            </div>

          </div>

        </div>

        <div className="p-6 border border-purple-500 rounded-2xl">

          <div className="flex items-center gap-2">
            <Bot size={24} className="text-purple-500"></Bot>
            <h2 className="text-xl font-bold text-red">
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



    </div>

  )



};

export default Portfolio;


