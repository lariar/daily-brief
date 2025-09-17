# Email Setup for Daily Brief

The GitHub Actions workflow has been configured to send your daily brief via email. To complete the setup, you need to add three GitHub secrets.

## Required GitHub Secrets

Go to your repository → Settings → Secrets and variables → Actions, then add these Repository secrets:

### 1. EMAIL_RECIPIENT
- **Name**: `EMAIL_RECIPIENT`
- **Value**: `your-email@gmail.com` (replace with your email address)

### 2. GMAIL_USERNAME
- **Name**: `GMAIL_USERNAME`
- **Value**: `your-gmail-account@gmail.com` (the Gmail account that will send the emails)

### 3. GMAIL_APP_PASSWORD
- **Name**: `GMAIL_APP_PASSWORD`
- **Value**: [Your Gmail App Password - see setup below]

## Gmail App Password Setup

Since you're using Gmail, you need to create an App Password (not your regular Gmail password):

1. **Enable 2-Step Verification** (if not already enabled):
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Under "How you sign in to Google", enable "2-Step Verification"

2. **Generate App Password**:
   - Go to [App Passwords](https://myaccount.google.com/apppasswords)
   - Select "Mail" as the app
   - Generate the password
   - Copy the 16-character password (it will look like: `abcd efgh ijkl mnop`)

3. **Add to GitHub Secrets**:
   - Use this 16-character password as the value for `GMAIL_APP_PASSWORD`

## What the Email Contains

Your daily brief email will include:
- **Subject**: "Daily Brief - [run number]"
- **From**: Daily Brief Bot
- **To**: The email address you specified in `EMAIL_RECIPIENT`
- **Body**: Success message with workflow details
- **Attachment**: The generated markdown brief file(s) from the `output/` directory

## Testing

You can test the email functionality by:
1. Adding the GitHub secrets
2. Going to Actions → Daily Brief Generation → Run workflow
3. Manually triggering the workflow

The email will only be sent if the brief generation is successful (`if: success()`).