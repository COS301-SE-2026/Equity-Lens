import {useState} from "react";
import * as ShowPdf from "pdfjs-dist";
import showOnUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

ShowPdf.GlobalWorkerOptions.workerSrc = showOnUrl;

const Portfolio = () =>
{
   const[convert,setConvert] = useState("");
   const[values,setTheValues] = useState("");
   const[theErrors,setTheErrors] = useState("");


   const whenPressingTheFile = async (pdf) =>
   {
     const getTheFile = pdf.target.files[0];

     if (getTheFile == null)
     {
       return
     }

     setTheErrors("");
     setTheValues("");
     setConvert("");

     try
     {
       const convertPdf = await ShowPdf.getDocument({
        data : await getTheFile.arrayBuffer(),
        password : "Secret",

       }).promise;

       let gettingInfo = "";

       for(let i = 1; i <= convertPdf.numPages;i++)
       {
        const page = await convertPdf.getPage(i);
        const content = await page.getTextContent();

        let PageInfo = "";


        for(const items of content.items)
        {
          PageInfo = PageInfo + items.str + " ";
        }

        gettingInfo = gettingInfo + PageInfo;

       }

       setConvert(gettingInfo);


     }
     catch(theErrors)
     {
      setTheErrors("Failed to open your Pdf, Please try again");
     }
   }


   return (
     <div className="p-6">
          <h1>Portfolio Analysis</h1>
          <input
            type = "file"
            accept = "application/pdf"
            onChange = {whenPressingTheFile}
            
          />

          {theErrors && <p> {theErrors} </p>}

          {values && (
            <div className="mt-4"> 
             <h2>Portfolio Value</h2>
             <p>R {values}</p>
             </div>
          )}

          {convert && (<div>
            <h2>Extracted text</h2>

            <textarea 
              value={convert}
              readOnly
              rows={15}
              className="w-full border p-2"
            />
          </div>)}



     </div>
   )




};

export default Portfolio;


