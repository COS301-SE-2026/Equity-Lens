import {useState} from 'react';
import {Link} from 'react-router-dom';

import {ROUTES} from '../../utils/constants'

const REDIRECTS = [
    {
        title: 'Check on dashboard',
        body: 'Take a look at your dashboard.',
        to: ROUTES.DASHBOARD,
        action: "Go to dashboard"
    },
    {
        title: 'Import your portfolio',
        body: 'Upload a PDF or Excel file.',
        to: ROUTES.PORTFOLIO,
        action: "Go to portfolio"
    },
    {
        title: 'Look at the analytics',
        body: 'Explained formulas.',
        to: ROUTES.ANALYTICS,
        action: "Go to analytics page"
    },
    {
        title: 'Check on news about your stocks',
        body: 'Keep up to date with market news.',
        to: ROUTES.NEWS,
        action: "Go to news page"
    },
    {
        title: 'Ask AI Assistant questions',
        body: 'Ask questions in plain english.',
        to: ROUTES.NEWS,
        action: "Go to AI Assistant"
    },
];

const QNA = [
    {
        q: "Which file formats can I upload?",
        a: "Excel by following the template and PDF"
    },
    {
        q: "Can the AI Assistant see my portfolio?",
        a: "Yes, it uses your uploaded portfolio and replies are based off of those."
    },
    {
        q: "Is this financial advice?",
        a: "No. EquityLens is there to help you gain futher insight into your portfolio."
    }
];

const LINKS = [
    {
        label: 'Portfolio Template',
        body: 'Download the Excel format we import cleanly',
        href: '/template/EquityLens_Portfolio_Excel_Template.xlsx',
        download: true
    }, 
    {
        label: 'Contact support',
        body: 'Email us for any queries or questions',
        href: 'mailto:thebigfivetb5@gmail.com',
    }
];

const CARD = 'terminal-card flex flex-col p-4';

const Help = () => {
    /**
     * @type {[number | null, function]}
     */
    const [open, closed] = useState(null);

    return (
    <div className = "mx-auto w-full wax-w-4x1">
        <h1 className = "text-3xl font-semibold text-center">Help</h1>

        <div className = "mt-6 grid gap-3 sm:grid-cols-2">
            {REDIRECTS.map(({title, body, to, action}) => (
                <div key = {title} className = {CARD}>
                    <h2 className = "text-sm font-medium">{title}</h2>
                    <p className = "mt-1.5 flex-1 text-xs text-text-secondary">{body}</p>
                    <Link to = {to} className = "mt-3 self-start text-xs font-medium text-[var(--signal-gold)]">{action}</Link>
                </div>
            ))}
        </div>

        <h2 className = "mt-10 text-x1 font-semiBold">FAQs</h2>

        <div className = "mt-4 flex flex-col gap-2">
            {QNA.map(({q,a}, i) => (
                <div key = {q} className = "terminal-card">
                    <button type = "button" onClick = {() => closed(open === i ? null : i)} aria-expanded = {open === i} 
                            className = "flex w-full items-center justify-between p-4 text-left text-sm font-medium">
                        {q}
                        <span className = "text-text-secondary">{open === i ? '-' : '+'}</span>
                    </button>
                    {open === i && (<p className = "px-4 pb-4 text-sm font-medium text-text-secondary">{a}</p>)}
                </div>
            ))}
        </div>

        <h2 className = "mt-10 text-x1 font-semiBold">Resources (Click box to get output)</h2>

        <div className = "mt-4 grid gap-3 sm:grid-cols-3">
            {LINKS.map(({label, body, href, download}) => (
                <a key ={label} href = {href} download = {download} className = {CARD}>
                    <h3 className = "text-sm font-medium">{label}</h3>
                    <p className = "mt-1.5 text-xs text-text-secondary">{body}</p>
                </a>
            ))}
        </div>
    </div>
    )
}

export default Help;