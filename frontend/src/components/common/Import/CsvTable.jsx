import React from "react";

const CsvTable = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <p className="mt-6 text-gray-500">
        No CSV data uploaded yet. Please can you upload a CSV file.
      </p>
    );
  }

  const headers = Object.keys(data[0]);

  return (
    <div className="mt-6">
      <h2 className="text-xl font-semibold mb-4">Portfolio Data</h2>

      <table className="w-full border">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} className="border p-2">
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {headers.map((header) => (
                <td key={header} className="border p-2">
                  {row[header]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CsvTable;
