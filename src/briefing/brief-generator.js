const https = require('https');
const fs = require('fs').promises;
const path = require('path');
const { format } = require('date-fns');

class BriefGenerator {
  constructor() {
    this.anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim();
    this.enableThinking = process.env.CLAUDE_THINKING_MODE === 'true' || false;
    this.thinkingTokens = parseInt(process.env.CLAUDE_THINKING_TOKENS) || 8000;
  }

  async initialize() {
    if (!this.anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    
    // Initialize HTML validation
    try {
      console.log('✅ HTML validation schema initialized');
    } catch (error) {
      throw new Error(`Failed to initialize validation: ${error.message}`);
    }
    
    // Load prompt template
    try {
      const promptPath = path.join(__dirname, '..', '..', 'prompts', 'daily-brief.txt');
      this.promptTemplate = await fs.readFile(promptPath, 'utf8');
      
      const thinkingStatus = this.enableThinking ? 
        `thinking mode enabled (${this.thinkingTokens} tokens)` : 
        'thinking mode disabled';
      console.log(`✅ Brief generator initialized with Claude API and prompt template (${thinkingStatus})`);
    } catch (error) {
      throw new Error(`Failed to load prompt template: ${error.message}`);
    }
    
    return true;
  }

  async callClaude(prompt, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.callClaudeRequest(prompt);
        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retryable (overloaded or rate limit)
        const isRetryable = error.message.toLowerCase().includes('overloaded') ||
                          error.message.toLowerCase().includes('rate limit') ||
                          error.message.includes('429') ||
                          error.message.includes('529');

        if (isRetryable && attempt < maxRetries) {
          // Calculate exponential backoff with jitter
          const baseDelay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          const jitter = Math.random() * 1000; // 0-1s random jitter
          const delay = baseDelay + jitter;

          console.log(`⚠️ Claude API overloaded (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(delay/1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // Non-retryable error or max retries reached
          break;
        }
      }
    }

    // If we got here, all retries failed
    throw lastError;
  }

  async callClaudeRequest(prompt) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        model: this.enableThinking ? 'claude-sonnet-4-20250514' : 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }],
        ...(this.enableThinking && {
          thinking: {
            type: 'enabled',
            budget_tokens: this.thinkingTokens
          }
        })
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
          'anthropic-version': '2023-06-01',
          ...(this.enableThinking && {
            'anthropic-beta': 'interleaved-thinking-2025-05-14'
          })
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode !== 200) {
              const errorMessage = response.error?.message || response.error?.type || data;
              reject(new Error(`Claude API error (${res.statusCode}): ${errorMessage}`));
              return;
            }
            // Log thinking mode usage
            if (this.enableThinking) {
              const thinkingContent = response.content.find(item => item.type === 'thinking');
              if (thinkingContent) {
                console.log('🧠 Extended thinking used successfully');
              }
            }
            if (response.content && response.content.length > 0) {
              // In thinking mode, find the text content (not thinking content)
              const textContent = response.content.find(item => item.type === 'text');
              if (textContent && textContent.text) {
                resolve(textContent.text);
              } else if (response.content[0] && response.content[0].text) {
                // Fallback for non-thinking mode
                resolve(response.content[0].text);
              } else {
                reject(new Error('Unexpected response format from Claude API'));
              }
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

      const timeout = this.enableThinking ? 120000 : 30000; // 2 minutes for thinking mode, 30s otherwise
      req.setTimeout(timeout, () => {
        req.destroy();
        reject(new Error('Claude API request timeout'));
      });

      req.write(postData);
      req.end();
    });
  }

  validateHtmlContent(content) {
    const trimmedContent = content.trim();
    
    // Check if content starts with DOCTYPE
    if (!trimmedContent.startsWith('<!DOCTYPE html')) {
      throw new Error('HTML content must start with <!DOCTYPE html>');
    }
    
    // Check if content ends with </html>
    if (!trimmedContent.endsWith('</html>')) {
      throw new Error('HTML content must end with </html>');
    }
    
    // Check for required HTML structure
    const requiredTags = ['<head>', '</head>', '<body>', '</body>'];
    for (const tag of requiredTags) {
      if (!content.includes(tag)) {
        throw new Error(`HTML must include ${tag} tag`);
      }
    }
    
    // Additional basic HTML validation
    if (!content.includes('<html')) {
      throw new Error('HTML must include <html> tag');
    }
    
    console.log('✅ HTML structure validation passed');
    return content;
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

      // Validate the HTML content
      console.log('🔍 Validating HTML structure...');
      const validatedContent = this.validateHtmlContent(briefContent);
      console.log('✅ HTML validation passed');

      return validatedContent;
    } catch (error) {
      // Log more specific error information for retry failures
      if (error.message.toLowerCase().includes('overloaded')) {
        console.error('❌ Brief generation failed: Claude API is overloaded after multiple retry attempts');
      } else {
        console.error('❌ Brief generation failed:', error.message);
      }
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
    // Claude will already format it well for email, just return as-is
    return briefContent;
  }
}

module.exports = BriefGenerator;