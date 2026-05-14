const Portfolio = () => (
  <div className="max-w-7xl mx-auto px-4 py-8">
    <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Portfolio</h1>
    <p className="text-lg text-[var(--text-secondary)]">
      Import and manage your investment holdings across various assets.
    </p>
    <div className="mt-8 p-12 border-2 border-dashed border-[var(--border-primary)] rounded-xl flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center mb-4">
        <span className="text-2xl">💼</span>
      </div>
      <p className="text-[var(--text-secondary)] font-medium">
        Portfolio Management features are scheduled for Sprint 2.
      </p>
    </div>
  </div>
);

export default Portfolio;