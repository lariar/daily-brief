# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Daily Brief Generator that integrates with Google Calendar and Todoist to create automated daily briefings. The application runs via GitHub Actions on a daily schedule and generates comprehensive markdown reports with calendar events, tasks, and intelligent analysis.

## Common Development Commands

```bash
# Install dependencies
npm install

# Run the daily brief generator
npm run dev
# or
node src/index.js

# Run tests
npm test

# Set up OAuth authentication (one-time setup)
node scripts/oauth-setup.js
```

## Architecture

The application follows a service-oriented architecture with clear separation of concerns:

### Core Services
- **CalendarService** (`src/calendar/`): Handles Google Calendar integration for both personal and work accounts
- **TodoistService** (`src/todoist/`): Manages Todoist API integration and task analysis
- **BriefGenerator** (`src/briefing/`): Creates the final daily brief content and handles file output

### Key Components
- **Main Application** (`src/index.js`): Orchestrates all services and handles the application lifecycle
- **OAuth Authentication** (`src/auth/`): Manages Google OAuth 2.0 flow with refresh tokens
- **Configuration** (`src/utils/config.js`): Centralized configuration management with environment variables
- **Date Utilities** (`src/utils/date-utils.js`): Date handling and timezone management

### Data Flow
1. Application initializes all services (Calendar, Todoist, Brief Generator)
2. Gathers schedule data from Google Calendar accounts (personal + work)
3. Gathers task data from Todoist with analysis and insights
4. Generates comprehensive brief using Handlebars templates
5. Saves output to `output/` directory as markdown files

## Authentication Setup

The application uses OAuth 2.0 for Google Calendar and API tokens for Todoist:

1. **Google Calendar OAuth**: Run `node scripts/oauth-setup.js` to configure both personal and work account access
2. **Todoist API**: Get token from [Todoist Integrations](https://todoist.com/prefs/integrations)

Required environment variables are documented in `.env.example`.

## Claude Thinking Mode

This application supports Claude's thinking mode for enhanced reasoning and analysis. When enabled, Claude will use extended thinking to provide more thoughtful insights in your daily briefs.

### Configuration

Set these environment variables in your `.env` file:

```bash
# Enable thinking mode (true/false)
CLAUDE_THINKING_MODE=true

# Thinking token budget (1000-32000, default: 8000)
CLAUDE_THINKING_TOKENS=8000
```

### Cost Considerations

- **Thinking mode disabled**: Standard Claude 3.5 Sonnet pricing ($3/$15 per million input/output tokens)
- **Thinking mode enabled**: Same pricing, but thinking tokens are included in the output token count
- **Recommended budget**: 8000 tokens provides good balance between cost and reasoning depth

## GitHub Actions Integration

The project runs automatically via GitHub Actions (`daily-brief.yml`) at 9:00 AM UTC daily. The workflow:
- Uses the `anthropics/claude-code-action@v1` to execute the daily brief generation
- Requires repository secrets for API credentials
- Uploads generated briefs as workflow artifacts
- Creates issues on workflow failures for monitoring

## Key Files

- `src/index.js`: Main application entry point and orchestration
- `src/utils/config.js`: Environment configuration management
- `scripts/oauth-setup.js`: OAuth 2.0 setup utility for Google Calendar
- `.github/workflows/daily-brief.yml`: Automated workflow configuration
- `output/`: Directory where generated daily briefs are saved

## Dependencies

- **@doist/todoist-api-typescript**: Official Todoist API client
- **googleapis**: Google Calendar API integration
- **handlebars**: Template engine for brief generation
- **date-fns**: Date manipulation and formatting
- **dotenv**: Environment variable management

## Testing and Verification

After making changes, ensure the application works by:
1. Running `npm run dev` to test the complete workflow locally
2. Checking the `output/` directory for generated briefs
3. Verifying API connections and authentication work correctly