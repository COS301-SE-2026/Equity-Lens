import * as ShowPdf from 'pdfjs-dist';
import PDFworker from 'pdfjs-dist/build/pdf.worker.mjs?worker';

ShowPdf.GlobalWorkerOptions.workerPort = new PDFworker();

export default ShowPdf;
