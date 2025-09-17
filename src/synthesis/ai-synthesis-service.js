const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class AISynthesisService {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.anthropic.com';
    this.model = 'claude-3-5-sonnet-20241022';
  }

  async initialize() {
    if (!this.apiKey) {
      throw new Error('Anthropic API key is required for AI synthesis');
    }
    
    try {
      await this.loadPrompt();
      console.log('✅ AI synthesis service initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize AI synthesis service:', error.message);
      throw error;
    }
  }

  async loadPrompt() {
    try {
      const promptPath = path.join(__dirname, '..', '..', 'prompts', 'daily-brief-prompt.md');
      this.promptTemplate = await fs.readFile(promptPath, 'utf8');
      return this.promptTemplate;
    } catch (error) {
      console.error('Failed to load prompt template:', error.message);
      throw new Error(`Prompt template not found or unreadable: ${error.message}`);
    }
  }

  async synthesize(briefData) {
    if (!this.promptTemplate) {
      await this.loadPrompt();
    }

    const dataContext = JSON.stringify(briefData, null, 2);
    const fullPrompt = `${this.promptTemplate}\n\n## DATA TO SYNTHESIZE:\n\`\`\`json\n${dataContext}\n\`\`\``;

    try {
      const response = await this.callClaude(fullPrompt);
      
      if (!response || typeof response !== 'string') {
        throw new Error('Invalid response from Claude API');
      }

      if (!this.validateOutput(response)) {
        throw new Error('AI generated content failed validation');
      }

      console.log('✅ AI synthesis completed successfully');
      return response;
    } catch (error) {
      console.error('❌ AI synthesis failed:', error.message);
      throw error;
    }
  }

  async callClaude(prompt) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        model: this.model,
        max_tokens: 4000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01'
        }
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

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

  validateOutput(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }

    // Basic validation - ensure it looks like markdown
    const hasMarkdownHeaders = /^#+ /.test(content.trim());
    const hasReasonableLength = content.length > 100 && content.length < 10000;
    const hasNoBadContent = !content.includes('TEMPLATE-GENERATED');

    return hasMarkdownHeaders && hasReasonableLength && hasNoBadContent;
  }
}

module.exports = AISynthesisService;