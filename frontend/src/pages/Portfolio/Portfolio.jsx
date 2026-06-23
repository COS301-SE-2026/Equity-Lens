import { useState } from "react";
import * as ShowPdf from "pdfjs-dist";
import showOnUrl from "pdfjs-dist/build/pdf.worker.mjs?url";
import { getToken } from "../../services/authService"
import { ArrowLeftRight, Wallet,CreditCard,Percent,TrendingUp,Landmark,Receipt,Briefcase,TriangleAlert,Bot } from "lucide-react"

ShowPdf.GlobalWorkerOptions.workerSrc = showOnUrl;


 const ToGetIDForInstrument = async (getName) =>
 {
    const getID = await fetch(
        `http://localhost:8000/import_pdf/get_instrument_type_id/${getName}`,
        {
          method: "GET",
          headers:
          {
            Authorization: `Bearer ${getToken()}`
          },
        }
      );

    const get = await getID.json();
    return get.id;
 }

 const ToGetIDForTransaction = async (getName) =>
 {
    const getID = await fetch(
        `http://localhost:8000/import_pdf/get_transaction_type_id/${getName}`,
        {
          method: "GET",
          headers:
          {
            Authorization: `Bearer ${getToken()}`
          },
        }
      );

    const get = await getID.json();
    return get.id;
 }

 const ToGetIDForNarrative = async (getName) =>
 {
    const getID = await fetch(
      `http://localhost:8000/import_pdf/get_narrative_type_id/${getName}`,
        {
          method: "GET",
          headers:
          {
            Authorization: `Bearer ${getToken()}`
          },
        }
      );

    const get = await getID.json();
    return get.id;
 }

const Portfolio = () => {
  const [convert, setConvert] = useState("");
  const [values, setTheValues] = useState("");
  const [theErrors, setTheErrors] = useState("");
  const [summary,setSummary] = useState("");


  const whenPressingTheFile = async (pdf) => {

    const getTheFile = pdf.target.files[0];

    if (getTheFile == null) 
    {
      return
    }

    setTheErrors("");
    setTheValues("");
    setConvert("");

    try {
      const convertPdf = await ShowPdf.getDocument({
        data: await getTheFile.arrayBuffer(),
        password: "0509145305082",

      }).promise;

      let gettingInfo = "";

      for (let i = 1; i <= convertPdf.numPages; i++) 
      {
        const page = await convertPdf.getPage(i);
        const content = await page.getTextContent();

        let PageInfo = "";


        for (const items of content.items) 
        {
          PageInfo = PageInfo + items.str + " ";
        }

        gettingInfo = gettingInfo + PageInfo;

      }

      setConvert(gettingInfo);

      const uploadInvestmentStatements = await fetch(
        "http://localhost:8000/import_pdf/",
        {
          method: "POST",
          headers:
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },

          body: JSON.stringify({
            file_name: getTheFile.name,
            document_text: "Something special",
            password: "0792571562",
          })
        }
      );

      const getUploadInvestmentStatements = await uploadInvestmentStatements.json();

      const SplitingInArray = gettingInfo.split(" ");
      const getAccountNumber = SplitingInArray.find( (word) => word.startsWith("EE") && word.includes("-"));
      const getAccountNumberIndex = SplitingInArray.findIndex( (word) => word.startsWith("EE") && word.includes("-"));
      const getPortfolioName = SplitingInArray[getAccountNumberIndex + 1];


      const uploadPortfolioRequest = await fetch(
        "http://localhost:8000/import_pdf/save_portfolios/",
        {
          method: "POST",
          headers:
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },

          body: JSON.stringify({
            document_id: getUploadInvestmentStatements.document_id,
            account_number: getAccountNumber,
            portfolio_name: getPortfolioName,
          })
        }
      );


      const getuploadPortfolioRequest = await uploadPortfolioRequest.json();

      const ReplacenstrumentName = gettingInfo.replaceAll("10X S&P 500 Exchange Traded Fund" , "10X_S&P_500_Exchange_Traded_Fund")
      .replaceAll("10X S&P South Africa Top50 Index Exchange Traded Fund" , "10X_S&P_South_Africa_Top50_Index_Exchange_Traded_Fund")
      .replaceAll("EasyETFs AI World Actively Managed ETF" , "EasyETFs_AI_World_Actively_Managed_ETF")
      .replaceAll("Satrix MSCI Emerging Markets ETF" , "Satrix_MSCI_Emerging_Markets_ETF")
      .replaceAll("Instrument Purchases and Sales","Instrument_Purchases_and_Sales")
      .replaceAll("Detailed Transactions - Transaction Costs","Detailed_Transactions_-_Transaction_Costs")
      .replaceAll("Detailed Transactions - Contributions and Withdrawals","Detailed_Transactions_-_Contributions_and_Withdrawals")
      .replaceAll("Capital withdrawal", "Capital_withdrawal")
      .replaceAll("Capital contribution", "Capital_contribution")
      .replaceAll("Detailed Transactions - Dividends and Withholding Tax [4]","Detailed_Transactions_-_Dividends_and_Withholding_Tax_[4]")
      .replaceAll("Cash investment interest received", "Cash_investment_interest_received")
      .replaceAll("Securities Interest","Securities_Interest")
      .replaceAll("Detailed Transactions - Interest", "Detailed_Transactions_-_Interest")
      .replaceAll("Trust Account", "Trust_Account")
      .replaceAll("Detailed Transactions - Expenses","Detailed_Transactions_-_Expenses")
      .replaceAll("VAT on Cash Management Fee","VAT_on_Cash_Management_Fee")
      .replaceAll("Cash Management Fee","Cash_Management_Fee")
      .replaceAll("Value Added Tax on costs (VAT) for Early Settlement Fee","Value_Added_Tax_on_costs_(VAT)_for_Early_Settlement_Fee")
      .replaceAll("Early settlement fee","Early_settlement_fee")
      .replaceAll("Early Settlement Fee","Early_Settlement_Fee")
      .replaceAll("Page 6", "Page_6")
      .replaceAll("Page 7","Page_7")

      const FixInstrumentName = ReplacenstrumentName.split(" ").filter((word) => word !== "");
      const FixNumberComma = [];

      for(let i = 0; i < FixInstrumentName.length;i++)
      {
         const FirstNumber = FixInstrumentName[i];
         const SecondNumber = FixInstrumentName[i + 1];

         if(FirstNumber != "Fee" && FirstNumber != "withdrawal" && FirstNumber != "Total" && FirstNumber.includes("_") != true && FirstNumber.includes(".") != true && SecondNumber != null && SecondNumber.includes("."))
         {
            FixNumberComma.push(FirstNumber + SecondNumber);
            i = i + 1;
         }
         else
         {
           FixNumberComma.push(FirstNumber);
         }

      }

      const startFrom = FixNumberComma.indexOf("Weight");
      const allTotal = [];

      for(let i = 0; i < FixNumberComma.length;i++)
      {
        if(FixNumberComma[i] === "Total")
        {
          allTotal.push(i);
        }
      }

      const getIt = allTotal[2];
      const StartingAndEnding = FixNumberComma.slice(startFrom + 1, getIt);
      const FinalArray = [];

      for(let i = 0; i < StartingAndEnding.length; i = i + 14)
      {
        FinalArray.push({
          instrument_name: StartingAndEnding[i],
          quantity: StartingAndEnding[i + 8],
          total_cost: StartingAndEnding[i + 9],
          cost_price: StartingAndEnding[i + 10],
          current_price: StartingAndEnding[i + 11],
          current_value: StartingAndEnding[i + 12],
          weight_percentage: StartingAndEnding[i + 13],
        })
      }

      for(const eachItems of FinalArray)
      { 
       const uploadHoldingsRequest = await fetch(
        "http://localhost:8000/import_pdf/save_holdings/",
        {
          method: "POST",
          headers:
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },

          body: JSON.stringify({
            portfolio_id: getuploadPortfolioRequest.portfolio_id,
            instrument_name: eachItems.instrument_name.replaceAll("_"," "),
            quantity: eachItems.quantity,
            total_cost: eachItems.total_cost,
            cost_price: eachItems.cost_price,
            current_price: eachItems.current_price,
            current_value: eachItems.current_value,
            weight_percentage: eachItems.weight_percentage.replace("%"," "),
          })
        }
       );
      }


      const StartingFullPurchaseAndInvestment = FixNumberComma.indexOf("Instrument_Purchases_and_Sales");
      const EndingFullPurchaseAndInvestment =  allTotal[3];
      const fullPurchaseAndInvestment = FixNumberComma.slice(StartingFullPurchaseAndInvestment,EndingFullPurchaseAndInvestment);
      const FinalArrayPurchaseAndInvestment = [];

      for(let i = 13; i < fullPurchaseAndInvestment.length; i = i + 7)
      {
        
        const transactionID = await ToGetIDForTransaction(fullPurchaseAndInvestment[i + 1].replaceAll("_"," "));
        const instrumentID = await ToGetIDForInstrument(fullPurchaseAndInvestment[i + 2].replaceAll("_"," "));


        FinalArrayPurchaseAndInvestment.push({
          transactions_date: fullPurchaseAndInvestment[i].replaceAll("/","-"),
          transaction_type_id: transactionID,
          instrument_type_id: instrumentID,
          price: fullPurchaseAndInvestment[i + 3],
          quantity: fullPurchaseAndInvestment[i + 4],
          transactions_cost: fullPurchaseAndInvestment[i + 5],
          value_zar: fullPurchaseAndInvestment[i + 6],
        })
        
      }

      for(const eachItems of FinalArrayPurchaseAndInvestment)
      { 
       const uploadHoldingsRequest = await fetch(
        "http://localhost:8000/import_pdf/save_instrument_purchases_and_sales/",
        {
          method: "POST",
          headers:
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },

          body: JSON.stringify({
            portfolio_id: getuploadPortfolioRequest.portfolio_id,
            transactions_date: eachItems.transactions_date,
            transaction_type_id: eachItems.transaction_type_id,
            instrument_type_id: eachItems.instrument_type_id,
            price: eachItems.price,
            quantity: eachItems.quantity,
            transactions_cost: eachItems.transactions_cost,
            value_zar: eachItems.value_zar,
          })
        }
       );

      

      }

      const StartingTransactionCosts = FixNumberComma.indexOf("Detailed_Transactions_-_Transaction_Costs");
      const EndingTransactionCosts =  allTotal[4];
      const fullTransactionCosts = FixNumberComma.slice(StartingTransactionCosts,EndingTransactionCosts);
      const FinalTransactionCosts = [];

      for(let i = 7; i < fullTransactionCosts.length; i = i + 3)
      {
        
        const instrumentID = await ToGetIDForInstrument(fullTransactionCosts[i].replaceAll("_"," "));


        FinalTransactionCosts.push({
          instrument_type_id: instrumentID,
          brokerage: fullTransactionCosts[i + 1],
          other_trading_costs: fullTransactionCosts[i + 2],
        })
        
      }

      for(const eachItems of FinalTransactionCosts)
      { 
       const uploadHoldingsRequest = await fetch(
        "http://localhost:8000/import_pdf/save_transaction_costs/",
        {
          method: "POST",
          headers:
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },

          body: JSON.stringify({
            portfolio_id: getuploadPortfolioRequest.portfolio_id,
            instrument_type_id: eachItems.instrument_type_id,
            brokerage: eachItems.brokerage,
            other_trading_costs: eachItems.other_trading_costs,
          })
        }
       );

      }

      const StartingContributionsAndWithdrawals = FixNumberComma.indexOf("Detailed_Transactions_-_Contributions_and_Withdrawals");
      const EndingContributionsAndWithdrawals =  FixNumberComma.indexOf("Page_6");
      const fullContributionsAndWithdrawals = FixNumberComma.slice(StartingContributionsAndWithdrawals,(EndingContributionsAndWithdrawals - 1));
      const FinalContributionsAndWithdrawals = [];

      for(let i = 8; i < fullContributionsAndWithdrawals.length; i = i + 4)
      {

        const transactionID = await ToGetIDForTransaction(fullContributionsAndWithdrawals[i + 2].replaceAll("_"," "));

        
        FinalContributionsAndWithdrawals.push({
          transaction_date: fullContributionsAndWithdrawals[i].replaceAll("/","-"),
          settlement_date: fullContributionsAndWithdrawals[i + 1].replaceAll("/","-"),
          transaction_type_id: transactionID,
          value_zar: fullContributionsAndWithdrawals[i + 3],
        })
        
      }

      for(const eachItems of FinalContributionsAndWithdrawals)
      { 
       const uploadHoldingsRequest = await fetch(
        "http://localhost:8000/import_pdf/save_contributions_and_withdrawals/",
        {
          method: "POST",
          headers:
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },

          body: JSON.stringify({
            portfolio_id: getuploadPortfolioRequest.portfolio_id,
            transaction_date: eachItems.transaction_date,
            settlement_date: eachItems.settlement_date,
            transaction_type_id: eachItems.transaction_type_id,
            value_zar: eachItems.value_zar,
          })
        }
       );
      }



      const StartingDividendsAndWithholdingTax = FixNumberComma.indexOf("Detailed_Transactions_-_Dividends_and_Withholding_Tax_[4]");
      const EndingDividendsAndWithholdingTax =   allTotal[5];
      const fullDividendsAndWithholdingTax = FixNumberComma.slice(StartingDividendsAndWithholdingTax,EndingDividendsAndWithholdingTax);
      const FinalDividendsAndWithholdingTax = [];


      for(let i = 11; i < fullDividendsAndWithholdingTax.length; i = i + 6)
      {

        const instrumentID = await ToGetIDForInstrument(fullDividendsAndWithholdingTax[i + 1].replaceAll("_"," "));

        
        FinalDividendsAndWithholdingTax.push({
          transaction_date: fullDividendsAndWithholdingTax[i].replaceAll("/","-"),
          instrument_type_id: instrumentID,
          gross_dividend: fullDividendsAndWithholdingTax[i + 2],
          withholding_tax: fullDividendsAndWithholdingTax[i + 3],
          net_dividend: fullDividendsAndWithholdingTax[i + 4],
          tax_rate: fullDividendsAndWithholdingTax[i + 5],
        })
        
      }

      for(const eachItems of FinalDividendsAndWithholdingTax)
      { 
       const uploadHoldingsRequest = await fetch(
        "http://localhost:8000/import_pdf/save_dividends_and_withholding_tax/",
        {
          method: "POST",
          headers:
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },

          body: JSON.stringify({
            portfolio_id: getuploadPortfolioRequest.portfolio_id,
            transaction_date: eachItems.transaction_date,
            instrument_type_id: eachItems.instrument_type_id,
            gross_dividend: eachItems.gross_dividend,
            withholding_tax: eachItems.withholding_tax,
            net_dividend: eachItems.net_dividend,
            tax_rate: eachItems.tax_rate,
          })
        }
       );
      }


      const StartingTransactionInterest = FixNumberComma.indexOf("Detailed_Transactions_-_Interest");
      const EndingTransactionInterest =   allTotal[6];
      const fullTransactionInterest = FixNumberComma.slice(StartingTransactionInterest,EndingTransactionInterest);
      const FinalTransactionInterest = [];


      for(let i = 9; i < fullTransactionInterest.length; i = i + 5)
      {
        
        const transactionID = await ToGetIDForTransaction(fullTransactionInterest[i + 2].replaceAll("_"," "));
        const instrumentID = await ToGetIDForInstrument(fullTransactionInterest[i + 3].replaceAll("_"," "));


        FinalTransactionInterest.push({
          transaction_date: fullTransactionInterest[i].replaceAll("/","-"),
          settlement_date: fullTransactionInterest[i + 1].replaceAll("/","-"),
          transaction_type_id: transactionID,
          instrument_type_id: instrumentID,
          value_zar: fullTransactionInterest[i + 4],
        })
        
      }

       for(const eachItems of FinalTransactionInterest)
      { 
       const uploadHoldingsRequest = await fetch(
        "http://localhost:8000/import_pdf/save_transaction_interest/",
        {
          method: "POST",
          headers:
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },

          body: JSON.stringify({
            portfolio_id: getuploadPortfolioRequest.portfolio_id,
            transaction_date: eachItems.transaction_date,
            settlement_date: eachItems.settlement_date,
            transaction_type_id: eachItems.transaction_type_id,
            instrument_type_id: eachItems.instrument_type_id,
            value_zar: eachItems.value_zar,
          })
        }
       );

      }


      const StartingTransactionExpenses = FixNumberComma.indexOf("Detailed_Transactions_-_Expenses");
      const EndingTransactionExpenses =   FixNumberComma.indexOf("Page_7");
      const fullTransactionExpenses = FixNumberComma.slice(StartingTransactionExpenses,(EndingTransactionExpenses - 1));
      const FinalTransactionExpenses = [];


      for(let i = 9; i < fullTransactionExpenses.length; i = i + 5)
      {
        
        const transactionID = await ToGetIDForTransaction(fullTransactionExpenses[i + 2].replaceAll("_"," "));
        const narrativeID = await ToGetIDForNarrative(fullTransactionExpenses[i + 3].replaceAll("_"," "));


        FinalTransactionExpenses.push({
          transaction_date: fullTransactionExpenses[i].replaceAll("/","-"),
          settlement_date: fullTransactionExpenses[i + 1].replaceAll("/","-"),
          transaction_type_id: transactionID,
          narrative_type_id: narrativeID,
          value_zar: fullTransactionExpenses[i + 4],
        })
        
      }

       for(const eachItems of FinalTransactionExpenses)
      { 
       const uploadHoldingsRequest = await fetch(
        "http://localhost:8000/import_pdf/save_transaction_expenses/",
        {
          method: "POST",
          headers:
          {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`
          },

          body: JSON.stringify({
            portfolio_id: getuploadPortfolioRequest.portfolio_id,
            transaction_date: eachItems.transaction_date,
            settlement_date: eachItems.settlement_date,
            transaction_type_id: eachItems.transaction_type_id,
            narrative_type_id: eachItems.narrative_type_id,
            value_zar: eachItems.value_zar,
          })
        }
       );
      }

        const getSummaryRequest = await fetch(
      `http://localhost:8000/import_pdf_summary/summary/${getuploadPortfolioRequest.portfolio_id}`,
      {
        method: "GET",
          headers:
          {
            Authorization: `Bearer ${getToken()}`
          },
      }
    )

    const getSummary = await getSummaryRequest.json();
     setSummary(getSummary);

      
    }
    catch (theErrors) {
      setTheErrors("Failed to open your Pdf, Please try again");
    }

  


  }


    return (
      
    <div className="p-2">
      {/* <h1 className="text-4xl font-bold text-white">Portfolio Analysis</h1>
      <p className="text-gray-400 mt-2">
        Upload and analyse your portfolio statement
      </p> */}

      <div className="mt-3 flex justify-center">
      <div className="w-full p-8 border border-gray-700 rounded-3xl text-center">

        <p className="text-2xl font-semibold text-white mb-2">
        Upload your portfolio statement
       </p>

       <p className="text-gray-400 mb-8">
        Select your portfolio statement
       </p>

        <input
          type="file"
          accept="application/pdf"
          onChange={whenPressingTheFile}
          className="text-white file:bg-yellow-500 file:text-black file:border-0 file:px-4 file:py-2 file:rounded-lg file:font-medium"
        />

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



      <div className="grid grid-cols-2 gap-8 mt-8">

        <div className="p-6 border border-red-700 rounded-2xl">

          <div className="flex items-center gap-2">
            <TriangleAlert size={24} className="text-red-500"></TriangleAlert>
          <h2 className="text-xl font-bold text-red">
            Lowest Holding
          </h2>
          </div>
          

          <p className= "text-gray-400 mb-5"> 
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

          <p className= "text-gray-400 mb-5"> 
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


