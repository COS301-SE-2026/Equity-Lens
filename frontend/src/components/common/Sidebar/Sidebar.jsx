import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PieChart,
  BarChart2,
  Newspaper,
  Bot,
  Briefcase,
  X,
} from 'lucide-react';
import { ROUTES } from '../../../utils/constants';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, to: ROUTES.DASHBOARD },
  { label: 'Portfolio', icon: Briefcase, to: ROUTES.PORTFOLIO },
  { label: 'Analytics', icon: BarChart2, to: ROUTES.ANALYTICS },
  { label: 'News', icon: Newspaper, to: ROUTES.NEWS },
  { label: 'AI Assistant', icon: Bot, to: ROUTES.AI_CHAT, badge: 'NEW' },
];


export default Sidebar;
