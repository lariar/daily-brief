const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { format } = require('date-fns');

class BriefGenerator {
  constructor() {
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  }

  async initialize() {
    if (!this.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    
    // Load prompt template
    try {
      const promptPath = path.join(__dirname, '..', '..', 'prompts', 'daily-brief.txt');
      this.promptTemplate = await fs.readFile(promptPath, 'utf8');
      console.log('✅ Brief generator initialized with Claude API and prompt template');
    } catch (error) {
      throw new Error(`Failed to load prompt template: ${error.message}`);
    }
    
    return true;
  }

  async callClaude(prompt) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode !== 200) {
              reject(new Error(`Claude API error: ${response.error?.message || data}`));
              return;
            }
            if (response.content && response.content[0] && response.content[0].text) {
              resolve(response.content[0].text);
            } else {
              reject(new Error('Unexpected response format from Claude API'));
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse Claude API response: ${parseError.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Claude API request failed: ${error.message}`));
      });

      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('Claude API request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  async generateBrief(data) {
    const briefData = {
      date: format(new Date(), 'EEEE, MMMM d, yyyy'),
      timestamp: format(new Date(), 'h:mm a'),
      ...data
    };

    console.log('🤖 Generating brief with Claude API...');
    
    const fullPrompt = `${this.promptTemplate}

**INPUT DATA:**
${JSON.stringify(briefData, null, 2)}`;

    try {
      const briefContent = await this.callClaude(fullPrompt);
      console.log('✅ Brief generated successfully with Claude API');
      return briefContent;
    } catch (error) {
      console.error('❌ Claude API failed:', error.message);
      throw new Error(`Failed to generate brief: ${error.message}`);
    }
  }


  async saveBrief(briefContent, filename = null) {
    try {
      const defaultFilename = `daily-brief-${format(new Date(), 'yyyy-MM-dd')}.html`;
      const filepath = path.join(process.cwd(), 'output', filename || defaultFilename);
      
      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, briefContent, 'utf8');
      
      return filepath;
    } catch (error) {
      console.error('Failed to save brief:', error.message);
      throw error;
    }
  }

  formatForEmail(briefContent) {
    return briefContent
      .replace(/^# /gm, '')
      .replace(/^## /gm, '**')
      .replace(/^### /gm, '***')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>\n');
  }


  formatForEmail(briefContent) {
    // Claude will already format it well for email, just return as-is
    return briefContent;
  }
}

module.exports = BriefGenerator;