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

    // Load prompt templates
    try {
      const dailyPromptPath = path.join(__dirname, '..', '..', 'prompts', 'daily-brief.txt');
      const weeklyPromptPath = path.join(__dirname, '..', '..', 'prompts', 'weekly-review.txt');

      this.promptTemplate = await fs.readFile(dailyPromptPath, 'utf8');
      this.weeklyPromptTemplate = await fs.readFile(weeklyPromptPath, 'utf8');

      const thinkingStatus = this.enableThinking ?
        `thinking mode enabled (${this.thinkingTokens} tokens)` :
        'thinking mode disabled';
      console.log(`✅ Brief generator initialized with Claude API and prompt templates (${thinkingStatus})`);
    } catch (error) {
      throw new Error(`Failed to load prompt templates: ${error.message}`);
    }

    return true;
  }

  async callClaude(prompt, maxRetries = 10) {
    let lastError;
    const twoHoursInMs = 2 * 60 * 60 * 1000; // 2 hours in milliseconds

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.callClaudeRequest(prompt);
        return result;
      } catch (error) {
        lastError = error;

        // Check if error is 529 (overloaded) - needs special handling
        const is529Error = error.message.includes('529') ||
                          error.message.toLowerCase().includes('overloaded');

        // Check if error is retryable (rate limit or other retryable errors)
        const isRetryable = is529Error ||
                          error.message.toLowerCase().includes('rate limit') ||
                          error.message.includes('429');

        if (isRetryable && attempt < maxRetries) {
          let delay;

          if (is529Error) {
            // For 529 errors, use more aggressive exponential backoff
            // Start with 30 seconds, double each time, up to 30 minutes max per attempt
            const baseDelay = 30000 * Math.pow(2, attempt - 1); // 30s, 60s, 2m, 4m, 8m, 16m, 32m...
            const maxDelayPerAttempt = 30 * 60 * 1000; // Cap at 30 minutes per attempt
            const clampedDelay = Math.min(baseDelay, maxDelayPerAttempt);
            const jitter = Math.random() * 5000; // 0-5s random jitter
            delay = clampedDelay + jitter;

            const delayMinutes = Math.round(delay / 60000);
            const delaySeconds = Math.round((delay % 60000) / 1000);
            console.log(`⚠️ Claude API overloaded (529 error, attempt ${attempt}/${maxRetries}). Retrying in ${delayMinutes}m ${delaySeconds}s...`);
          } else {
            // For other retryable errors (429 etc), use standard backoff
            const baseDelay = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s, 8s, 16s...
            const jitter = Math.random() * 1000; // 0-1s random jitter
            delay = baseDelay + jitter;

            console.log(`⚠️ Claude API error (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(delay/1000)}s...`);
          }

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

  async generateWeeklyReview(data) {
    const reviewData = {
      weekStart: format(data.metadata.weekStart, 'EEEE, MMMM d, yyyy'),
      weekEnd: format(data.metadata.weekEnd, 'EEEE, MMMM d, yyyy'),
      generatedAt: format(data.metadata.generatedAt, 'h:mm a'),
      ...data
    };

    console.log('🤖 Generating weekly review with Claude API...');

    const fullPrompt = `${this.weeklyPromptTemplate}

**INPUT DATA:**
${JSON.stringify(reviewData, null, 2)}`;

    try {
      const reviewContent = await this.callClaude(fullPrompt);
      console.log('✅ Weekly review generated successfully with Claude API');

      // Validate the HTML content
      console.log('🔍 Validating HTML structure...');
      const validatedContent = this.validateHtmlContent(reviewContent);
      console.log('✅ HTML validation passed');

      return validatedContent;
    } catch (error) {
      // Log more specific error information for retry failures
      if (error.message.toLowerCase().includes('overloaded')) {
        console.error('❌ Weekly review generation failed: Claude API is overloaded after multiple retry attempts');
      } else {
        console.error('❌ Weekly review generation failed:', error.message);
      }
      throw new Error(`Failed to generate weekly review: ${error.message}`);
    }
  }

  async saveWeeklyReview(reviewContent, filename = null) {
    try {
      const defaultFilename = `weekly-review-${format(new Date(), 'yyyy-MM-dd')}.html`;
      const filepath = path.join(process.cwd(), 'output', filename || defaultFilename);

      await fs.mkdir(path.dirname(filepath), { recursive: true });
      await fs.writeFile(filepath, reviewContent, 'utf8');

      return filepath;
    } catch (error) {
      console.error('Failed to save weekly review:', error.message);
      throw error;
    }
  }

  async generateClaudeInsights(prompt) {
    console.log('🧠 Generating insights with Claude...');

    try {
      const insights = await this.callClaude(prompt);
      console.log('✅ Insights generated successfully');

      // Try to parse as structured insights, fallback to text
      try {
        return JSON.parse(insights);
      } catch {
        // If not JSON, return as text insights
        return {
          keyPriorities: insights.split('\n').filter(line =>
            line.toLowerCase().includes('priority') || line.toLowerCase().includes('important')
          ).slice(0, 5),
          risksAndConflicts: insights.split('\n').filter(line =>
            line.toLowerCase().includes('risk') || line.toLowerCase().includes('conflict')
          ).slice(0, 3),
          scheduleAdjustments: insights.split('\n').filter(line =>
            line.toLowerCase().includes('schedule') || line.toLowerCase().includes('time')
          ).slice(0, 3),
          taskProgressPlan: insights.split('\n').filter(line =>
            line.toLowerCase().includes('task') || line.toLowerCase().includes('complete')
          ).slice(0, 3)
        };
      }
    } catch (error) {
      console.error('❌ Error generating Claude insights:', error.message);
      throw error;
    }
  }

  hasAnthropicKey() {
    return Boolean(this.anthropicApiKey);
  }

  formatForEmail(briefContent) {
    // Claude will already format it well for email, just return as-is
    return briefContent;
  }
}

module.exports = BriefGenerator;