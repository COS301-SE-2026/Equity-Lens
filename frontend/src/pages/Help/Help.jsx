import { Link } from 'react-router-dom';
import { ROUTES } from '../../utils/constants'
import { useState } from 'react';
import { LayoutDashboard, Upload, ChartPie, Newspaper, Bot, ChevronDown, ChevronUp, FileSpreadsheet, Mail, CircleHelp } from "lucide-react";

const REDIRECTS = [
    {
        title: 'Getting Started',
        body: 'In here you will learn the basic of EquityLens and where to find everything.',
        to: ROUTES.DASHBOARD,
        icon: <LayoutDashboard size={22} />
    },
    {
        title: 'Import data',
        body: 'You can upload your portfolio either using PDF or Excel.',
        to: ROUTES.PORTFOLIO,
        icon: <Upload size={22} />
    },
    {
        title: 'Understand your Portfolio',
        body: 'You can view your holdings,allocation, and also portfolio analytics.',
        to: ROUTES.ANALYTICS,
        icon: <ChartPie size={22} />
    },
    {
        title: 'News & Market',
        body: 'To stay updated with the news about your investment.',
        to: ROUTES.NEWS,
        icon: <Newspaper size={22} />
    },
    {
        title: 'AI Assistant',
        body: 'Ask questions in plain english about your portfolio.',
        to: ROUTES.NEWS,
        icon: <Bot size={22} />
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
    },
    {
        q: "Is this financial advice?",
        a: "No. EquityLens is there to help you gain futher insight into your portfolio."
    },
    {
        q: "Is this financial advice?",
        a: "No. EquityLens is there to help you gain futher insight into your portfolio."
    },
    {
        q: "Is this financial advice?",
        a: "No. EquityLens is there to help you gain futher insight into your portfolio."
    },
    {
        q: "Is this financial advice?",
        a: "No. EquityLens is there to help you gain futher insight into your portfolio."
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
        icon: <FileSpreadsheet size={22} />
    },
    {
        label: 'Contact support',
        body: 'Email us for any queries or questions',
        href: 'mailto:thebigfivetb5@gmail.com',
        icon: <Mail size={22} />
    }
];

const CARD = 'terminal-card flex flex-col p-4';

const Help = () => {
    /**
     * @type {[number | null, function]}
     */
    const [open, setOpen] = useState(null);

    return (
        <div className="max-w-7xl mx-auto px-6 py-8 text-white">

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

                {REDIRECTS.map(({ title, body, to, icon }) => (
                    <Link key={title} to={to} className="border border-gray-700 bg-gray-900 rounded-2xl p-5 hover:border-purple-500 hover:bg-gray-800 transition">
                        <div className="w-11 h-11 rounded-xl bg-purple-500 text-purple-400 flex items-center justify-center mb-4">{icon}</div>
                        <h3 className="font-semibold mb-2">{title}</h3>
                        <h3 className="text-sm text-gray-400">{body}</h3>
                    </Link>
                ))}

            </div>

            <div className="mt-6 border border-gray-700 rounded-2xl p-5 bg-">
                <p className="text-purple-400 font-semibold">
                    Quick Tip
                </p>

                <p className="text-sm text-gray-400 mt-1">
                    Hover over charts and graphs to view more information about your portfolio data.
                </p>
            </div>

            <div className="mt-12">

                <h2 className="text-xl font-semibold mb-2">
                    Frequently Asked Questions
                </h2>

                <p className="text-sm text-gray-400 mb-5">
                    Quick answers to common questions.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                    {QNA.map(({ q, a }, index) => (
                        <div
                            key={q}
                            className=" border border-gray-700 bg-gray-900 rounded-xl overflow-hidden
              "
                        >

                            <button
                                type="button"
                                onClick={() =>
                                    setOpen(open === index ? null : index)
                                }
                                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-800"
                            >
                                <span className="text-sm font-medium">
                                    {q}
                                </span>

                                {open === index ? (
                                    <ChevronUp size={18} className="text-purple-400"
                                    />
                                ) : (
                                    <ChevronDown size={18} className="text-purple-400"
                                    />
                                )}

                            </button>

                            {open === index && (
                                <p className="px-4 pb-4 text-sm text-gray-400">
                                    {a}
                                </p>
                            )}

                        </div>
                    ))}

                </div>

                <div className="mt-12">

                    <h2 className="text-xl font-semibold mb-4">
                        Resources
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {LINKS.map(({ label, body, href, download, icon }) => (
                            <a
                                key={label}
                                href={href}
                                download={download}
                                className="border border-gray-700 bg-gray-900 rounded-2xl p-5 hover:border-purple-500 transition"
                            >

                                <div className="flex items-center gap-3 mb-2">

                                    <div className="w-10 h-10 rounded-lg bg-purple-500 text-purple-400 flex items-center justify-center">
                                        {icon}
                                    </div>

                                    <h3 className="font-semibold">
                                        {label}
                                    </h3>

                                </div>

                                <p className="text-sm text-gray-400">
                                    {body}
                                </p>

                            </a>
                        ))}

                    </div>

                </div>

            </div>
        </div>
    )
}

export default Help;