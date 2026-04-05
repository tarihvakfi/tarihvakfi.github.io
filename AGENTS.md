# AGENTS.md

## Project
This repository hosts a fully free volunteer tracking system for a foundation website deployed on GitHub Pages.

Primary domain:
- https://tarihvakfi.github.io

## Product goal
Build a production-ready, fully static frontend on GitHub Pages, backed by:
- Firebase Authentication (Google sign-in only)
- Cloud Firestore
- Google Apps Script + Google Sheets for email summaries and lightweight automation

## Hard constraints
- Keep the system free to operate for now
- Do NOT use paid-only architecture
- Do NOT use Firebase Cloud Functions
- Do NOT use Firebase Storage
- Do NOT use any private backend server or VPS
- Do NOT introduce Node/Express backend for production runtime
- Frontend must run as static files on GitHub Pages
- Prefer vanilla HTML/CSS/JavaScript unless there is a strong reason otherwise
- Keep dependencies minimal
- Keep setup simple enough for a non-expert maintainer

## Auth and roles
Authentication:
- Google sign-in only

User states:
- pending
- approved
- blocked

Roles:
- volunteer
- coordinator
- admin

## Required app areas
- /auth/   -> sign in / application / waiting approval page
- /app/    -> volunteer dashboard
- /admin/  -> coordinator/admin dashboard

## Data model
Use Firestore collections:
- users
- tasks
- reports
- announcements
- activityLogs

## Security
- Enforce authorization with Firestore security rules
- Never rely on hidden buttons alone
- Volunteers can only read/write their own allowed records
- Coordinators can manage users/tasks/reports only for their department
- Admins can manage everything
- Pending users must not access volunteer/admin data

## Email automation
Use Google Apps Script + Google Sheets for:
- new application notification
- approval email
- task assignment email
- weekly summary email
- inactivity reminder email

## Code quality
- Keep files small and readable
- Add clear comments only where necessary
- Avoid dead code
- Avoid unnecessary abstractions
- Prefer maintainable folder structure
- Add defensive error handling and user-facing messages

## Deliverables
Always keep these files updated:
- README.md
- docs/SETUP.md
- docs/FIRESTORE_SCHEMA.md
- docs/SECURITY_RULES.md
- docs/APPS_SCRIPT_SETUP.md
- docs/DEPLOYMENT.md

## Workflow
When implementing:
1. Inspect repository structure first
2. Propose or create a clean folder structure
3. Implement incrementally
4. Validate links and paths for GitHub Pages
5. Add placeholder config instructions where secrets are needed
6. Add deployment instructions
7. Summarize what remains for manual console setup

## Manual setup assumptions
Assume the maintainer will manually:
- create the Firebase project
- enable Google provider
- add authorized domains
- paste Firebase config
- deploy Apps Script
- create triggers
- connect Google Sheets

## Important
Do not hardcode secrets.
Use clear placeholders for environment-specific values.
Prefer solutions that can be understood and maintained by a small nonprofit team.
