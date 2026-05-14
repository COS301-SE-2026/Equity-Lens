
export default function Footer() {
  return (
    <footer className="bg-dark text-white py-3 mt-5">
      <div className="container d-flex flex-row justify-content-between align-items-center">

        <div>
          <h5 className="fw-bold mb-1">EquityLens</h5>

          <p className="mb-0">
            Smart investment insights for everyone.
          </p>
        </div>

        <div className="d-flex flex-row gap-3">
          <a href="#" className="text-white text-decoration-none">
            Home
          </a>

          <a href="#" className="text-white text-decoration-none">
            About
          </a>

          <a href="#" className="text-white text-decoration-none">
            Contact
          </a>
        </div>

      </div>

      <div className="text-center mt-4">
        2026 EquityLens. All rights reserved.
      </div>
    </footer>
  );
}