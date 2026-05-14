import { useState } from "react";


export default function SimplePage() {
    
    const [message, setMessage] = useState("");

  return (
    <div>
      <h1>Example Page</h1>

      <button onClick={() => setMessage("Welcome User")}>
        Example Button
      </button>

      <p>{message}</p>
      
    </div>
  );
}