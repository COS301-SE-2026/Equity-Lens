import React, { useState } from "react";
import CsvUpload from "../../components/common/Import/CsvUpload";
import CsvTable from "../../components/common/Import/CsvTable";

const Portfolio = () => {
  const [csvData, setCsvData] = useState([]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">Portfolio</h1>
      <p className="text-sm text-[var(--text-secondary)] mb-6">
        Import and manage your investment holdings.
      </p>

      <CsvUpload onCsvValid={setCsvData} />
      <CsvTable data={csvData} />
    </div>
  );
};

export default Portfolio;