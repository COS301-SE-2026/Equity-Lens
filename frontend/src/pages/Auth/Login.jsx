
export default function Login() {
  return (

    <div className="vh-100 bg-body text-body">

      <nav className="bg-body">
        <span>
          EquityLens
        </span>

        <label>
          test 1
        </label>
        

        <button>
          Sign Up
        </button>


      </nav>


      <div className="row h-100">

        {/* Left Side of the login page */}
        <div className="col-md d-flex flex-column justify-content-center p-5">

          <h1 className="display-1 fw-bold mb-4">
            Welcome to equity lense
          </h1>

          <p className="text-muted fs-5 mb-4">
            Access your dashboard and continue managing your
            investments with ease.
          </p>

          <div className="d-flex flex-row gap-3 mt-4">

  <button className="btn btn-primary px-4 py-2 rounded-4">
    Learn More
  </button>

  <button className="btn btn-outline-secondary px-4 py-2 rounded-4">
    Contact Us
  </button>

</div>
        </div>

        {/* Right Side of the login page */}
        <div className="col-md d-flex justify-content-center align-items-center">

          <div
            className="p-4 rounded-5 shadow"
            style={{ width: "100%", maxWidth: "360px" }}
          >

            <div className="text-center mb-4 ">
              <h2 className="fw-bold">
                Login
              </h2>

              <p className="text-muted">
                Sign in to continue
              </p>
            </div>

            {/* Email section the login page */}
            <div className="mb-3">
              <label>
                Email
              </label>

              <input
                type="email"
                className="form-control"
                placeholder="Enter email"
              />
            </div>

            <div className="mb-3">
              <label>
                Password
              </label>

              <input
                type="password"
                className="form-control"
                placeholder="Enter password"
              />
            </div>
          
            <button className="btn btn-primary w-100 p-2 rounded-4 shadow-s">
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>

    
  );
}