# Daily Brief Generator

An automated daily briefing system that integrates with Google Calendar and Todoist to generate comprehensive daily reports. Runs automatically via GitHub Actions on a daily schedule.

## Features

- 📅 **Multi-Account Calendar Integration**: Supports both personal and work Google Calendar accounts
- ✅ **Todoist Task Management**: Fetches tasks, priorities, and project information
- 🤖 **Automated Scheduling**: Runs daily via GitHub Actions with Claude Code integration
- 📊 **Intelligent Analysis**: Provides insights on schedule conflicts, busy periods, and task priorities
- 📝 **Rich Reporting**: Generates markdown reports with emojis and structured formatting

## Setup

### 1. Local Development

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Copy the environment template:
```bash
cp .env.example .env
```

3. Set up Google Calendar OAuth (one-time setup):
```bash
node scripts/oauth-setup.js
```
This will guide you through setting up OAuth 2.0 authentication for both personal and work Google accounts.

4. Configure your API credentials in `.env`:
   - **Google Calendar**: Use the OAuth credentials from the setup script
   - **Todoist**: Get your API token from [Todoist Integrations](https://todoist.com/prefs/integrations)

### 2. GitHub Actions Setup

1. Go to your repository Settings > Secrets and Variables > Actions

2. Add the following repository secrets:
   - `ANTHROPIC_API_KEY`: Your Anthropic API key for Claude
   - `GOOGLE_OAUTH_CLIENT_ID`: Your Google OAuth client ID
   - `GOOGLE_OAUTH_CLIENT_SECRET`: Your Google OAuth client secret
   - `GOOGLE_PERSONAL_REFRESH_TOKEN`: Personal account refresh token (from oauth-setup.js)
   - `GOOGLE_WORK_REFRESH_TOKEN`: Work account refresh token (from oauth-setup.js)
   - `TODOIST_API_TOKEN`: Your Todoist API token

### 3. Google Calendar OAuth Setup

#### Creating OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click on it and press "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - If prompted, configure the OAuth consent screen first:
     - Choose "External" user type
     - Fill in required fields (App name, User support email, Developer contact)
     - Add your email to test users
   
5. Configure the OAuth Client ID:
   - Application type: "Web application"
   - Name: "Daily Brief Generator" (or any name you prefer)
   - Authorized redirect URIs: Add `http://localhost:3000/oauth/callback`
   - Click "Create"

6. **Download the credentials JSON file**:
   - After creating the OAuth client, click the download button (⬇️) next to your newly created OAuth 2.0 Client ID
   - Save this file to your computer (e.g., `~/Downloads/credentials.json`)
   - **Remember the full path to this file** - you'll need it for the setup script

#### Running the OAuth Setup

7. Run the OAuth setup script:
   ```bash
   node scripts/oauth-setup.js
   ```
   
8. When prompted for the "path to OAuth credentials JSON file", enter the full path to the file you downloaded in step 6:
   ```
   Enter path to OAuth credentials JSON file: /Users/yourusername/Downloads/credentials.json
   ```
   
9. Follow the remaining prompts to authorize both personal and work accounts

**Token Refresh**: OAuth tokens expire periodically (~6 months). When this happens, simply re-run the setup script to get new tokens.

## Usage

### Local Development
```bash
# Run the daily brief generator
npm run dev

# Or directly
node src/index.js
```

### Production (GitHub Actions)
The workflow runs automatically every day at 9:00 AM UTC. You can also trigger it manually:

1. Go to Actions tab in your repository
2. Select "Daily Brief Generation" workflow
3. Click "Run workflow"

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TODOIST_API_TOKEN` | Yes | Your Todoist API token |
| `GOOGLE_OAUTH_CLIENT_ID` | No* | Google OAuth client ID |
| `GOOGLE_OAUTH_CLIENT_SECRET` | No* | Google OAuth client secret |
| `GOOGLE_PERSONAL_REFRESH_TOKEN` | No* | Personal account refresh token |
| `GOOGLE_WORK_REFRESH_TOKEN` | No* | Work account refresh token |
| `PERSONAL_CALENDAR_ID` | No | Calendar ID (defaults to 'primary') |
| `WORK_CALENDAR_ID` | No | Calendar ID (defaults to 'primary') |

*Google OAuth configuration is required for calendar functionality. At least one refresh token (personal or work) should be provided.

### Customizing the Schedule

Edit `.github/workflows/daily-brief.yml` to change when the brief runs:

```yaml
on:
  schedule:
    - cron: "0 9 * * *"  # 9 AM UTC daily
```

## Output

The daily brief includes:

- **Today's Schedule**: All events from personal and work calendars
- **Schedule Analysis**: Conflicts, busy periods, meeting load
- **Task Overview**: Today's tasks, overdue items, priorities
- **Insights**: Intelligent recommendations based on your schedule and tasks
- **Day Overview**: Summary statistics and focus areas

Generated briefs are saved as markdown files and uploaded as GitHub Actions artifacts.

## Project Structure

```
daily-brief/
├── src/
│   ├── auth/              # OAuth authentication
│   ├── calendar/          # Google Calendar integration
│   ├── todoist/           # Todoist API client
│   ├── briefing/          # Brief generation and templates
│   ├── utils/             # Configuration and utilities
│   └── index.js           # Main application entry point
├── scripts/
│   └── oauth-setup.js     # OAuth configuration script
├── .github/workflows/     # GitHub Actions workflow
└── output/               # Generated brief files
```

## Troubleshooting

### Common Issues

1. **Authentication Errors**: Verify your API tokens and OAuth refresh tokens
2. **Calendar Access**: Ensure OAuth tokens have proper calendar read permissions
3. **Token Expiration**: If you get authentication errors, refresh tokens may have expired - re-run `node scripts/oauth-setup.js`
4. **Workflow Failures**: Check GitHub Actions logs for detailed error messages

### Testing Locally

1. Ensure all environment variables are set in `.env`
2. Run `npm run dev` to test the complete workflow
3. Check the `output/` directory for generated briefs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

ISC