/** @param {{ title: string, id?: string }} props */
const SectionHeading = ({ title, id }) => (
  <div id={id} className="scroll-mt-6">
    <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
      {title}
    </h2>
  </div>
);

export default SectionHeading;
