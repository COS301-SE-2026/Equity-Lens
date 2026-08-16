import {Link} from 'react-router-dom';
import {ROUTES} from '../../utils/constants'
import {useState} from 'react';
import { LayoutDashboard,Upload,ChartPie,Newspaper,Bot,ChevronDown,ChevronUp,FileSpreadsheet,Mail,CircleHelp} from "lucide-react";

const REDIRECTS = [
    {
        title: 'Getting Started',
        body: 'In here you will learn the basic of EquityLens and where to find everything.',
        to: ROUTES.DASHBOARD,
        icon: <LayoutDashboard size={12}/>
    },
    {
        title: 'Import data',
        body: 'You can upload your portfolio either using PDF or Excel.',
        to: ROUTES.PORTFOLIO,
        action: "Go to portfolio"
    },
    {
        title: 'Understand your Portfolio',
        body: 'You can view your holdings,allocation, and also portfolio analytics.',
        to: ROUTES.ANALYTICS,
        action: "Go to analytics page"
    },
    {
        title: 'News & Market',
        body: 'To stay updated with the news about your investment.',
        to: ROUTES.NEWS,
        action: "Go to news page"
    },
    {
        title: 'AI Assistant',
        body: 'Ask questions in plain english about your portfolio.',
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
    <div className = "mx-w-7xl mx-auto px-6 py-8 text-white">

        <div className="mb-10">
            <div className="flex items-center gap-3 mb-2">
                <CircleHelp className="text-purple-400" size={30}></CircleHelp>
                <h1 className="text-3xl font-bold">Help Center</h1>
            </div>
            <p className="text-gray-400">
                Find guides, answers and useful resources for EquityLens
            </p>
        </div>

        <h2 className="text-xl font-semibold mb-4">How can we help</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            

        </div>

        
    </div>
    )
}

export default Help;