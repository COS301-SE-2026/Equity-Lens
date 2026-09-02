import { Link } from 'react-router-dom';
import { useState } from 'react';
import {
    LayoutDashboard, Upload, PieChart, Newspaper, Bot,
    ChevronDown, ChevronUp, FileSpreadsheet, Mail, CircleHelp,
} from 'lucide-react';
import { ROUTES } from '../../utils/constants';

const REDIRECTS = [
    {
        title: 'Getting Started',
        body: 'Learn the basics of EquityLens and where to find everything.',
        to: ROUTES.DASHBOARD,
        icon: <LayoutDashboard size={22} />,
    },
    {
        title: 'Import data',
        body: 'Upload your portfolio as a PDF statement or the Excel template.',
        to: ROUTES.PORTFOLIO,
        icon: <Upload size={22} />,
    },
    {
        title: 'Understand your portfolio',
        body: 'View your holdings, allocation and portfolio analytics.',
        to: ROUTES.ANALYTICS,
        icon: <PieChart size={22} />,
    },
    {
        title: 'News & market',
        body: 'Stay updated with news about your investments.',
        to: ROUTES.NEWS,
        icon: <Newspaper size={22} />,
    },
    {
        title: 'AI Assistant',
        body: 'Ask questions in plain English about your portfolio.',
        to: ROUTES.AI_CHAT,
        icon: <Bot size={22} />,
    },
];

const QNA = [
    {
        q: 'Which file formats can I upload?',
        a: 'Excel, using the template below, or a PDF statement from your broker.',
    },
    {
        q: 'Can the AI Assistant see my portfolio?',
        a: 'Yes. Its answers are based on the portfolio you uploaded.',
    },
    {
        q: 'Is this financial advice?',
        a: 'No. EquityLens is here to help you gain further insight into your portfolio.',
    },
];

const LINKS = [
    {
        label: 'Portfolio template',
        body: 'Download the Excel format we import cleanly.',
        href: '/template/EquityLens_Portfolio_Excel_Template.xlsx',
        download: true,
        icon: <FileSpreadsheet size={22} />,
    },
    {
        label: 'Contact support',
        body: 'Email us with any queries or questions.',
        href: 'mailto:thebigfivetb5@gmail.com',
        icon: <Mail size={22} />,
    },
];

const CARD = 'glass-surface rounded-xl p-5';
const LINK_CARD = `${CARD} block transition hover:bg-[var(--surface-hover)]`;
const ICON_BADGE = 'flex h-11 w-11 items-center justify-center rounded-xl';

const Help = () => {
    const [openIndex, setOpenIndex] = useState(/** @type {number | null} */ (null));

    // accent-tinted badge, same treatment the holdings table uses for a selected row
    const badgeStyle = { background: 'var(--accent-subtle)', color: 'var(--accent-primary)' };

    return (
        <div className="mx-auto w-full max-w-6xl px-6 py-8" style={{ color: 'var(--text-page)' }}>
            <div className="mb-10">
                <div className="mb-2 flex items-center gap-3">
                    <CircleHelp size={30} style={{ color: 'var(--accent-primary)' }} />
                    <h1 className="text-3xl font-semibold">Help Centre</h1>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-page-secondary)' }}>
                    Find guides, answers and useful resources for EquityLens.
                </p>
            </div>

            <h2 className="mb-4 text-xl font-semibold">How can we help</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {REDIRECTS.map(({ title, body, to, icon }) => (
                    <Link key={title} to={to} className={LINK_CARD}>
                        <div className={`${ICON_BADGE} mb-4`} style={badgeStyle}>{icon}</div>
                        <h3 className="mb-1 text-sm font-medium">{title}</h3>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{body}</p>
                    </Link>
                ))}
            </div>

            <div className={`${CARD} mt-6`}>
                <p className="text-sm font-medium" style={{ color: 'var(--accent-primary)' }}>Quick tip</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Hover over charts and graphs to see more detail about your portfolio data.
                </p>
            </div>

            <h2 className="mb-2 mt-12 text-xl font-semibold">Frequently asked questions</h2>
            <p className="mb-5 text-sm" style={{ color: 'var(--text-page-secondary)' }}>
                Quick answers to common questions.
            </p>

            <div className="flex flex-col gap-2">
                {QNA.map(({ q, a }, index) => (
                    <div key={q} className="glass-surface overflow-hidden rounded-xl">
                        <button
                            type="button"
                            onClick={() => setOpenIndex(openIndex === index ? null : index)}
                            aria-expanded={openIndex === index}
                            className="flex w-full items-center justify-between p-4 text-left text-sm font-medium">
                            {q}
                            {openIndex === index
                                ? <ChevronUp size={18} style={{ color: 'var(--accent-primary)' }} />
                                : <ChevronDown size={18} style={{ color: 'var(--accent-primary)' }} />}
                        </button>
                        {openIndex === index && (
                            <p className="px-4 pb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>{a}</p>
                        )}
                    </div>
                ))}
            </div>

            <h2 className="mb-4 mt-12 text-xl font-semibold">Resources</h2>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {LINKS.map(({ label, body, href, download, icon }) => (
                    <a key={label} href={href} download={download} className={LINK_CARD}>
                        <div className="mb-2 flex items-center gap-3">
                            <div className={ICON_BADGE} style={badgeStyle}>{icon}</div>
                            <h3 className="text-sm font-medium">{label}</h3>
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{body}</p>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default Help;