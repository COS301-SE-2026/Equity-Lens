import React, { useState } from "react";

const CsvUpload = ({ onCsvValid }) => {
  const [error, setError] = useState("");

  const requiredFields = [
    "Asset",
    "Symbol",
    "Quantity",
    "Buy Price"
  ];

  const cleanValue = (value) => {
    return value.replaceAll('"', "").replace("\r", "").trim();
  };

  const handleFileChange = (event) => {
    const toGetFile = event.target.files[0];

    if (toGetFile == null) {
      setError("Please select a CSV file.");
      return;
    }

    if (toGetFile.name.endsWith(".csv") == false) {
      setError("Sorry, Please make sure that it's a csv file.");
      return;
    }

    const reader = new FileReader();

    reader.onload = (e) => {
      const makeAllText = e.target.result;

      const allLineInCSV = makeAllText
        .split("\n")
        .filter(line => line.trim() !== "");

      const headers = allLineInCSV[0]
        .split(";")
        .map(h => cleanValue(h));

      const missingFields = requiredFields.filter(
        field => !headers.includes(field)
      );

      if (missingFields.length > 0) {
        setError("Missing required fields: " + missingFields.join(", "));
        return;
      }

      const rows = allLineInCSV.slice(1).map(line => {
        const values = line
          .split(";")
          .map(v => cleanValue(v));

        const row = {};

        headers.forEach((header, index) => {
          row[header] = values[index];
        });

        return row;
      });

      setError("");
      onCsvValid(rows);
    };

    reader.readAsText(toGetFile);
  };

  return (
    <div className="p-6 border rounded-lg">
      <h2 className="text-xl font-semibold mb-4">Import CSV</h2>

      <input
        type="file"
        accept=".csv"
        onChange={handleFileChange}
      />

      {error && (
        <p className="mt-4 text-red-600 font-medium">
          {error}
        </p>
      )}
    </div>
  );
};

export default CsvUpload;
