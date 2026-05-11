import React from "react";

export default function Login() {
  return (
    <div className="container">
      <h1>Login</h1>

      <label>Email</label>
      <input type="email" />

      <label>Password</label>
      <input type="password" />

      <button>Login</button>
    </div>
  );
}