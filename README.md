# The Big Five (TB5) | EquityLens

EquityLens is a web-based platform aimed at bridging the gap between retail investors 
and investment analytics by providing the user with the ability to import their own portfolio, 
run institutional-grade financial analysis, track how stock movements relate to news events, 
and engage with a trained AI-powered assistant to make smarter and safer investment decisions.

---

## Demo Videos

- [Demo 1 Video](https://drive.google.com/file/d/1zTsXVxXO-8XaZbjOjm34sZqkUZCKs1rV/view?usp=sharing)

---


## Documentation

| | Link |
|---|---|
| Design Document | [View Design Doc](./Documentation/Demo_1/DESIGN_DOCUMENT.pdf) |
| Software Requirement Specification (SRS) | [View SRS](./Documentation/Demo_1/Software_Requirement_Specification.pdf) |
| Wireframes | [View Wireframes](./Documentation/Demo_1/Wireframes.pdf) |
| GitHub Project Board | [View Board](https://github.com/orgs/COS301-SE-2026/projects/45) |

---

## Project Status

[![Build](https://github.com/COS301-SE-2026/Equity-Lens/actions/workflows/ci.yml/badge.svg)](https://github.com/COS301-SE-2026/Equity-Lens/actions)
[![codecov](https://codecov.io/gh/COS301-SE-2026/Equity-Lens/graph/badge.svg?token=K5WIIJ0VXC)](https://codecov.io/gh/COS301-SE-2026/Equity-Lens)
![Requirements](https://img.shields.io/badge/requirements-up%20to%20date-brightgreen)
[![GitHub Issues](https://img.shields.io/github/issues/COS301-SE-2026/Equity-Lens)](https://github.com/COS301-SE-2026/Equity-Lens/issues)


## The Team

### Abdulrahman Sabah
**Student Number:** u24566170

Final-year Computer Science student at the University of Pretoria with a strong foundation in software engineering and cybersecurity. Holds certifications from IBM, Cisco, Microsoft Azure, and Amazon.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?logo=linkedin)](https://www.linkedin.com/in/abdulrahman-sabah-a240aa39b)
[![GitHub](https://img.shields.io/badge/GitHub-black?logo=github)](https://github.com/Abdulrahman-Sabah)

---

### Joshua Heath
**Student Number:** u23541475

Third-year Computer Science student at the University of Pretoria with full-stack development experience across academic and personal projects.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?logo=linkedin)](https://www.linkedin.com/in/joshua-heath-a910b5367)
[![GitHub](https://img.shields.io/badge/GitHub-black?logo=github)](https://github.com/Josh-Heath123)

---

### Antony van Straten
**Student Number:** u24590739

BSc Computer Science student in their third year at the University of Pretoria, deeply passionate about Machine Learning, Artificial Intelligence and building in general. Gained full-stack experience through personal and academic projects.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?logo=linkedin)](https://www.linkedin.com/in/antony-van-straten/)
[![GitHub](https://img.shields.io/badge/GitHub-black?logo=github)](https://github.com/antonyvs05)

---

### Jonty Honey
**Student Number:** u23536862

Third-year BSc Computer Science student at the University of Pretoria with a passion for data science, full-stack development and game development.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-blue?logo=linkedin)](https://www.linkedin.com/in/jonty-honey/)
[![GitHub](https://img.shields.io/badge/GitHub-black?logo=github)](https://github.com/jonty282)

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React + Vite, TailwindCSS, Recharts |
| Backend | FastAPI, AWS Lambda, API Gateway |
| Auth | AWS Cognito |
| Database | AWS RDS PostgreSQL, AWS S3 |
| AI | AWS Bedrock |
| Market Data | yfinance (primary), Alpha Vantage (fallback) |
| News | newsapi |
| File Handling | pdfPlumber |
| CI/CD | GitHub Actions, AWS SAM |

---

## Branching Strategy

### Branch Hierarchy

```
main
└── dev
    └── feature/*, fix/*, docs/*, test/*, refactor/*, chore/*
```

### Rules

- `main` - always deployable and demo-ready. Only merged into from `dev` before each demo.
- `dev` - primary integration branch. All feature branches merge here first.
- Never commit directly to `main` or `dev` - always via a Pull Request.
- All PRs into `dev` require at least two approved reviews and a passing CI pipeline before merging.
- Delete the branch after merging.

### Branch Naming Convention

```
[type]/[description]/[INITIALS]
```

**Examples:**
```
feature/portfolio-csv-import/JH
feature/dashboard-sector-chart/AVS
fix/jwt-token-expiry/AS
docs/srs-functional-requirements/JH
refactor/market-data-caching/AVS
chore/update-dependencies/JKH
```

### Branch Types

| Type | Purpose |
|------|---------|
| `feature` | New functionality |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `refactor` | Code restructure without behaviour change |
| `chore` | Dependencies, config, tooling updates |

### Team Initials

| Member | Initials |
|--------|----------|
| Abdulrahman Sabah | AS |
| Joshua Heath | JH |
| Jonty Honey | JKH |
| Antony van Straten | AVS |

---

## PR Naming Convention

```
[INITIALS] : short description of what this PR does
```

**Examples:**
```
JH : feat: add portfolio CSV import endpoint
AS : fix: resolve JWT token expiry bug
AVS : docs: update SRS functional requirements
JKH : chore: update dependencies
```

### PR Rules

- PRs must reference the related GitHub Issue using `Closes #[issue number]` in the description
- At least two team members must review and approve before merging
- CI pipeline must pass before any merge is allowed
- Delete the branch after merging

---

## Getting Started

### Prerequisites

- Docker Desktop (required)
- Node.js 20+ (for running frontend tests locally)
- Python 3.11+ (for running backend tests locally)

### Running the Project

The entire stack (frontend, backend, database) runs via Docker Compose.

```bash
# Start all services
docker-compose up

# Rebuild after pulling changes
docker-compose down
docker-compose up --build

# Wipes the database
docker-compose down -v
docker-compose up --build
```

Once running:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |

> Docker Desktop must be running before executing any of the above commands.

---

## Testing

### Frontend unit and integration test

```bash
cd frontend
npm run test
```

### Frontend Coverage

```bash
cd frontend
npm run coverage
```

### Backend unit and integration test

```bash
cd backend
python -m pytest
```

### Backend Coverage

```bash
cd backend
python -m pytest --cov=app --cov-report=xml
```

### e2e testing 

```bash
cd frontend
npx playwright install
npm run test:e2e
```
