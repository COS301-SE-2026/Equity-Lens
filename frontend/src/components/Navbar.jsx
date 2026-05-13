
export default function Navbar() {
  return (
    <nav className="navbar navbar-expand-lg bg-white shadow-sm py-3">

      <div className="container">

        <a className="navbar-brand fw-bold fs-3 text-primary" href="#">
          EquityLens
        </a>

        <div className="d-flex flex-row gap-4 align-items-center">

          <a
            href="#"
            className="text-dark text-decoration-none"
          >
            Home
          </a>

          <a
            href="#"
            className="text-dark text-decoration-none"
          >
            tests
          </a>

          <a
            href="#"
            className="text-dark text-decoration-none"
          >
            tests
          </a>

          <button className="btn btn-primary rounded-4 px-4">
            Sign Up
          </button>

        </div>
      </div>
    </nav>
  );
}