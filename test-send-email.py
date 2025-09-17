#!/usr/bin/env python3

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
import sys
from pathlib import Path

def send_test_email():
    """Send a test HTML email using the generated daily brief"""
    
    # Find the latest HTML file
    output_dir = Path("output")
    html_files = list(output_dir.glob("daily-brief-*.html"))
    
    if not html_files:
        print("❌ No HTML files found. Run 'npm run dev' first.")
        return False
    
    latest_file = max(html_files, key=lambda f: f.stat().st_mtime)
    print(f"📧 Using HTML file: {latest_file}")
    
    # Read HTML content
    with open(latest_file, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    # Check for required environment variables
    required_vars = ['GMAIL_USERNAME', 'GMAIL_APP_PASSWORD', 'EMAIL_RECIPIENT']
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"❌ Missing environment variables: {', '.join(missing_vars)}")
        print("Set these in your .env file:")
        for var in missing_vars:
            print(f"  {var}=your_value_here")
        return False
    
    # Email configuration
    smtp_server = "smtp.gmail.com"
    port = 587
    sender_email = os.environ['GMAIL_USERNAME']
    password = os.environ['GMAIL_APP_PASSWORD']
    receiver_email = os.environ['EMAIL_RECIPIENT']
    subject = f"Daily Brief - Test Email"
    
    print(f"📤 Sending test email...")
    print(f"   From: {sender_email}")
    print(f"   To: {receiver_email}")
    print(f"   Subject: {subject}")
    
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = f"Daily Brief Bot <{sender_email}>"
        message["To"] = receiver_email
        
        # Create HTML part
        html_part = MIMEText(html_content, "html")
        message.attach(html_part)
        
        # Send email
        context = ssl.create_default_context()
        with smtplib.SMTP(smtp_server, port) as server:
            server.starttls(context=context)
            server.login(sender_email, password)
            server.sendmail(sender_email, receiver_email, message.as_string())
        
        print("✅ HTML email sent successfully!")
        print("🔍 Check your email client to verify HTML rendering")
        return True
        
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        return False

def load_env_file():
    """Manually load environment variables from .env file"""
    env_file = Path(".env")
    if not env_file.exists():
        print("No .env file found")
        return
    
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            # Skip comments and empty lines
            if line.startswith('#') or not line or '=' not in line:
                continue
            
            # Parse key=value pairs
            key, value = line.split('=', 1)
            key = key.strip()
            value = value.strip()
            
            # Remove quotes if present
            if value.startswith('"') and value.endswith('"'):
                value = value[1:-1]
            elif value.startswith("'") and value.endswith("'"):
                value = value[1:-1]
            
            # Skip empty values
            if not value:
                continue
                
            # Set environment variable
            os.environ[key] = value
            print(f"   Loaded: {key}={'*' * min(len(value), 8)}...")  # Mask sensitive values
    
    print("✅ Loaded environment variables from .env file")

if __name__ == "__main__":
    # Load environment variables from .env file
    load_env_file()
    
    success = send_test_email()
    sys.exit(0 if success else 1)