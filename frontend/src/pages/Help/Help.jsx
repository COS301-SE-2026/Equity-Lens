import {Link} from 'react-router-dom';
import {ROUTES} from '../../utils/constants'
import { div } from 'framer-motion/client';

const REDIRECTS = [
    {
        title: 'Check on dashboard',
        body: 'Take a look at your dashboard.',
        to: ROUTES.DASHBOARD,
        action: "Go to dashboard"
    },
    {
        title: 'Import your portfolio',
        body: 'Upload a PDF of CSV file.',
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

const CARD = 'terminal-card flex flex-col p-4';

const Help = () => (
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
    </div>
)

export default Help;