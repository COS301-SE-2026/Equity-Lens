# EquityLens

<p align="center">
  <img src="https://img.shields.io/badge/Status-Active-success" alt="Status" />
  <img src="https://img.shields.io/badge/Platform-Web%20App-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/Stack-FastAPI%20%2B%20React-9cf" alt="Stack" />
</p>

EquityLens is a web-based investment intelligence platform that helps retail investors make smarter, safer financial decisions. It brings portfolio imports, institutional-grade analysis, AI-powered guidance, and market/news context into one streamlined experience.

Live app: [equitylens.co.za](https://equitylens.co.za/)

[![Build](https://github.com/COS301-SE-2026/Equity-Lens/actions/workflows/ci.yml/badge.svg)](https://github.com/COS301-SE-2026/Equity-Lens/actions)
[![codecov](https://codecov.io/gh/COS301-SE-2026/Equity-Lens/graph/badge.svg?token=K5WIIJ0VXC)](https://codecov.io/gh/COS301-SE-2026/Equity-Lens)
![Requirements](https://img.shields.io/badge/requirements-up%20to%20date-brightgreen)
[![GitHub Issues](https://img.shields.io/github/issues/COS301-SE-2026/Equity-Lens)](https://github.com/COS301-SE-2026/Equity-Lens/issues)
[![Uptime](https://img.shields.io/uptimerobot/status/m803628024-a58c2adb71aaf80c9f7ccc71?label=uptime)](https://stats.uptimerobot.com/NXrIxg9iOy)
[![Uptime Ratio](https://img.shields.io/uptimerobot/ratio/m803628024-a58c2adb71aaf80c9f7ccc71?label=30-day%20uptime)](https://stats.uptimerobot.com/NXrIxg9iOy)

---

## Overview

EquityLens gives users the ability to:

- Import and manage their own investment portfolio
- Run institutional-grade financial analysis on holdings
- Track how stock movements relate to relevant news events
- Explore insights from an AI-assisted investment companion
- Make more informed, structured investment decisions

---

## Key Features

- Portfolio upload from CSV or Excel statements
- Financial analysis and portfolio-level insights
- News-linked market event tracking
- AI-powered chat assistant for investment questions
- Secure AWS Cognito authentication and MFA support
- Dockerized local development workflow

---

## Demo Videos

- [Demo 1 Video](https://drive.google.com/file/d/1zTsXVxXO-8XaZbjOjm34sZqkUZCKs1rV/view?usp=sharing)
- [Demo 2 Video](./Documentation/Demo_2/Demo_2_video/2026-07-30%2023-18-48.mp4)
- [Demo 3 Video](https://drive.google.com/file/d/1x89mauJbrfO37-Z5hops6Qw0v2t45XQB/view?usp=sharing)
- [Demo 4 Video](https://drive.google.com/file/d/1qxCTyB_wQ9fCqNMUHkxCQtzdevk20bmj/view?usp=sharing)

---

## Documentation

| Document | Link |
|---|---|
| Software Requirement Specification (SRS) | [View SRS](./Documentation/Demo_4/SRS.pdf) |
| Software Architecture Specification (SAS) | [View SAS](./Documentation/Demo_4/SAS.pdf) |
| Coding Standards | [View](./Documentation/Demo_4/Coding_Standards.pdf) |
| Testing Policy | [View](./Documentation/Demo_4/Testing_Policy.pdf) |
| User Manual | [View](./Documentation/Demo_4/User_Manual.pdf) |
| Brand Style Guide | Live at `/brand` in the running app ([source](./frontend/src/pages/BrandStyleGuide/BrandStyleGuide.jsx)) |
| GitHub Project Board | [View Board](https://github.com/orgs/COS301-SE-2026/projects/45) |
| Design Document (Demo 1) | [View Design Doc](./Documentation/Demo_1/DESIGN_DOCUMENT.pdf) |
| Wireframes (Demo 1) | [View Wireframes](./Documentation/Demo_1/Wireframes.pdf) |
| API Service Contract | [View API Contract](https://api.equitylens.co.za/docs) |
| OpenAPI Specification | [View OpenAPI](./docs/api/openapi.json) |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 7, TailwindCSS, Recharts, AWS Amplify Cognito, Framer Motion, React Hook Form |
| Backend | FastAPI (Python 3.11), SQLAlchemy, Alembic, pandas, numpy |
| Auth | AWS Cognito with email verification and TOTP MFA |
| Database | PostgreSQL 16 in production, server-side market-data cache |
| AI | AWS Bedrock with Claude models |
| Market Data | yfinance, Alpha Vantage |
| News | NewsData |
| File Handling | pdfjs-dist, SheetJS/xlsx |
| CI/CD | GitHub Actions, Docker, Terraform, Amazon ECR, EC2 deployment |

---

## Project Workflow

### Branching Strategy

```text
main
└──dev
    └── feature/*, fix/*, docs/*, test/*, refactor/*, chore/*
```

Rules:

- `main` is always demo-ready and deployable
- `dev` is the primary integration branch
- All work must be merged through pull requests
- PRs into `dev` require at least two approvals and a passing CI pipeline
- Branches should be deleted after merge

### Branch Naming Convention

```text
[type]/[description]/[INITIALS]
```

Examples:

```text
feature/portfolio-csv-import/JH
feature/dashboard-sector-chart/AVS
fix/jwt-token-expiry/AS
docs/srs-functional-requirements/JH
refactor/market-data-caching/AVS
chore/update-dependencies/JKH
```

### Branch Types

| Type | Purpose |
|---|---|
| `feature` | New functionality |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `refactor` | Code restructure without behaviour change |
| `chore` | Dependencies and tooling updates |

### Team Initials

| Member | Initials |
|---|---|
| Abdulrahman Sabah | AS |
| Joshua Heath | JH |
| Jonty Honey | JKH |
| Antony van Straten | AVS |

### PR Naming Convention

```text
[INITIALS] : short description of what this PR does
```

Examples:

```text
JH : feat: add portfolio CSV import endpoint
AS : fix: resolve JWT token expiry bug
AVS : docs: update SRS functional requirements
JKH : chore: update dependencies
```

PR rules:

- Include a reference to the related GitHub issue using `Closes #[issue number]`
- Require at least two team approvals
- Ensure CI passes before merging
- Delete the branch after merge

---

## Getting Started

### Prerequisites

- Docker Desktop
- Node.js 22+
- Python 3.11+

### Environment Setup

Copy the example environment files before starting the project:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

> By default, the backend serves cached/local data only. Live market data fetches are gated behind `ALLOW_LIVE_MARKET_FALLBACK=true` in `backend/.env`. Add this flag if you need live prices during local development. `ALPHA_VANTAGE_API_KEY` is optional and only affects non-JSE ticker history.

### Run the Project

The full stack runs with Docker Compose:

```bash
# Start all services
docker-compose up

# Rebuild after pulling changes
docker-compose down
docker-compose up --build

# Wipe the database and rebuild
docker-compose down -v
docker-compose up --build
```

Once running:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

> Docker Desktop must be running before executing the commands above.

---

## Testing

### Frontend

```bash
cd frontend
npm run test
```

### Frontend Coverage

```bash
cd frontend
npm run coverage
```

### Backend

```bash
cd backend
python -m pytest
```

### Backend Coverage

```bash
cd backend
python -m pytest --cov=app --cov-report=xml
```

### End-to-End Testing

```bash
cd frontend
npx playwright install
npm run test:e2e
```

---

## Team

### Abdulrahman Sabah
**Student Number:** u24566170

Final-year Computer Science student at the University of Pretoria with a strong foundation in software engineering and cybersecurity. Holds certifications from IBM, Cisco, Microsoft Azure, and Amazon.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?logo=linkedin)](https://www.linkedin.com/in/abdulrahman-sabah-a240aa39b)
[![GitHub](https://img.shields.io/badge/GitHub-black?logo=github)](https://github.com/Abdulrahman-Sabah)

### Joshua Heath
**Student Number:** u23541475

Third-year Computer Science student at the University of Pretoria with full-stack development experience across academic and personal projects.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?logo=linkedin)](https://www.linkedin.com/in/joshua-heath-a910b5367)
[![GitHub](https://img.shields.io/badge/GitHub-black?logo=github)](https://github.com/Josh-Heath123)

### Antony van Straten
**Student Number:** u24590739

BSc Computer Science student in their third year at the University of Pretoria, deeply passionate about Machine Learning, Artificial Intelligence and building in general. Gained full-stack experience through personal and academic projects.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?logo=linkedin)](https://www.linkedin.com/in/antony-van-straten/)
[![GitHub](https://img.shields.io/badge/GitHub-black?logo=github)](https://github.com/antonyvs05)

### Jonty Honey
**Student Number:** u23536862

Third-year BSc Computer Science student at the University of Pretoria with a passion for data science, full-stack development and game development.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?logo=linkedin)](https://www.linkedin.com/in/jonty-honey/)
[![GitHub](https://img.shields.io/badge/GitHub-black?logo=github)](https://github.com/jonty282)
