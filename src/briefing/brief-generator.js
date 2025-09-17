const Handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { format } = require('date-fns');
const AISynthesisService = require('../synthesis/ai-synthesis-service');
const config = require('../utils/config');

class BriefGenerator {
  constructor() {
    this.template = null;
    this.aiSynthesis = null;
    this.setupHelpers();
  }

  async initialize() {
    try {
      // Initialize AI synthesis service if API key is available
      const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicApiKey) {
        try {
          this.aiSynthesis = new AISynthesisService(anthropicApiKey);
          await this.aiSynthesis.initialize();
          console.log('✅ AI synthesis enabled');
        } catch (aiError) {
          console.warn('⚠️ AI synthesis initialization failed, falling back to template:', aiError.message);
          this.aiSynthesis = null;
        }
      } else {
        console.log('ℹ️ No Anthropic API key found, using template mode');
      }

      // Always initialize template as fallback
      const templatePath = path.join(__dirname, 'templates', 'daily-brief.hbs');
      
      // Check if template file exists before attempting to read
      try {
        await fs.access(templatePath);
      } catch (accessError) {
        throw new Error(`Template file not found at ${templatePath}. Please ensure the template file exists.`);
      }

      const templateContent = await fs.readFile(templatePath, 'utf8');
      
      if (!templateContent || templateContent.trim().length === 0) {
        throw new Error(`Template file is empty at ${templatePath}`);
      }

      try {
        this.template = Handlebars.compile(templateContent);
      } catch (compileError) {
        throw new Error(`Failed to compile template: ${compileError.message}`);
      }

      console.log('✅ Brief template loaded successfully');
      return true;
    } catch (error) {
      const errorMessage = `Failed to initialize brief generator: ${error.message}`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }
  }

  setupHelpers() {
    Handlebars.registerHelper('formatTime', (date) => {
      if (!date) return '';
      return format(new Date(date), 'h:mm a');
    });

    Handlebars.registerHelper('formatDate', (date) => {
      if (!date) return '';
      return format(new Date(date), 'MMM d, yyyy');
    });

    Handlebars.registerHelper('join', (array, separator) => {
      if (!Array.isArray(array)) return '';
      return array.join(separator || ', ');
    });

    Handlebars.registerHelper('add', (a, b) => {
      return (a || 0) + (b || 0);
    });

    Handlebars.registerHelper('round', (number, decimals) => {
      if (typeof number !== 'number') return 0;
      return Math.round(number * Math.pow(10, decimals || 0)) / Math.pow(10, decimals || 0);
    });

    Handlebars.registerHelper('getPriorityEmoji', (priority) => {
      const emojis = {
        'Urgent': '🔴',
        'Very High': '🟠',
        'High': '🟡',
        'Normal': '⚪'
      };
      return emojis[priority] || '⚪';
    });

    Handlebars.registerHelper('getInsightEmoji', (type) => {
      const emojis = {
        'warning': '⚠️',
        'urgent': '🚨',
        'info': 'ℹ️',
        'success': '✅'
      };
      return emojis[type] || 'ℹ️';
    });

    Handlebars.registerHelper('getTopProjects', (projectTasks) => {
      if (!projectTasks) return 'General tasks';
      
      const projects = Object.entries(projectTasks)
        .sort(([,a], [,b]) => b.length - a.length)
        .slice(0, 3)
        .map(([name, tasks]) => `${name} (${tasks.length})`)
        .join(', ');
      
      return projects || 'General tasks';
    });
  }

  async generateBrief(data) {
    // Prepare enhanced data with metadata
    const briefData = {
      date: format(new Date(), 'EEEE, MMMM d, yyyy'),
      timestamp: format(new Date(), 'h:mm a'),
      ...data,
      insights: this.generateInsights(data)
    };

    // Try AI synthesis first if available
    if (this.aiSynthesis) {
      try {
        console.log('🤖 Attempting AI synthesis...');
        const aiContent = await this.aiSynthesis.synthesize(briefData);
        
        if (this.validateAIOutput(aiContent)) {
          console.log('✅ AI synthesis successful');
          return aiContent;
        } else {
          console.warn('⚠️ AI output failed validation, falling back to template');
        }
      } catch (aiError) {
        console.error('❌ AI synthesis failed:', aiError.message);
        console.log('🔄 Falling back to template generation');
      }
    }

    // Fallback to template with warning
    if (!this.template) {
      throw new Error('Template not initialized');
    }

    const templateContent = this.template(briefData);
    return this.addFallbackWarning(templateContent);
  }

  generateInsights(data) {
    const insights = [];

    if (data.schedule && data.schedule.analysis) {
      const { analysis, combined } = data.schedule;

      if (analysis.conflicts && analysis.conflicts.length > 0) {
        insights.push({
          type: 'warning',
          message: `You have ${analysis.conflicts.length} scheduling conflict(s) today. Consider rescheduling.`
        });
      }

      if (analysis.meetingHours > 6) {
        insights.push({
          type: 'warning',
          message: `Heavy meeting day with ${Math.round(analysis.meetingHours * 10) / 10} hours scheduled. Block time for focus work.`
        });
      } else if (analysis.meetingHours < 2 && combined.length > 0) {
        insights.push({
          type: 'info',
          message: 'Light meeting day - good opportunity for deep work and task completion.'
        });
      }

      if (analysis.busyPeriods && analysis.busyPeriods.length > 0) {
        insights.push({
          type: 'info',
          message: `${analysis.busyPeriods.length} busy period(s) identified. Plan breaks between meetings.`
        });
      }
    }

    if (data.tasks) {
      if (data.tasks.overdue && data.tasks.overdue.tasks.length > 0) {
        insights.push({
          type: 'urgent',
          message: `${data.tasks.overdue.tasks.length} overdue task(s) need immediate attention.`
        });
      }

      if (data.tasks.today && data.tasks.today.analysis) {
        const todayAnalysis = data.tasks.today.analysis;
        
        if (todayAnalysis.byPriority.urgent > 0) {
          insights.push({
            type: 'urgent',
            message: `${todayAnalysis.byPriority.urgent} urgent task(s) scheduled for today.`
          });
        }

        if (todayAnalysis.total === 0) {
          insights.push({
            type: 'info',
            message: 'No tasks scheduled for today. Consider planning your priorities.'
          });
        } else if (todayAnalysis.total > 10) {
          insights.push({
            type: 'warning',
            message: `${todayAnalysis.total} tasks today is quite ambitious. Focus on high-priority items.`
          });
        }
      }
    }

    const scheduleLoad = data.schedule ? data.schedule.analysis.meetingHours || 0 : 0;
    const taskLoad = data.tasks && data.tasks.today ? data.tasks.today.analysis.total : 0;

    if (scheduleLoad > 4 && taskLoad > 8) {
      insights.push({
        type: 'warning',
        message: 'Very busy day ahead! Consider delegating or rescheduling non-essential items.'
      });
    } else if (scheduleLoad < 2 && taskLoad < 5) {
      insights.push({
        type: 'success',
        message: 'Manageable day ahead - great opportunity to make significant progress!'
      });
    }

    if (new Date().getDay() === 1) {
      insights.push({
        type: 'info',
        message: 'Start of a new week! Review your weekly goals and priorities.'
      });
    }

    if (new Date().getDay() === 5) {
      insights.push({
        type: 'info',
        message: 'End of the week approaching. Consider planning weekend priorities.'
      });
    }

    return insights;
  }

  async saveBrief(briefContent, filename = null) {
    try {
      const defaultFilename = `daily-brief-${format(new Date(), 'yyyy-MM-dd')}.md`;
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

  validateAIOutput(content) {
    if (!content || typeof content !== 'string') {
      return false;
    }

    // Check for basic markdown structure
    const hasMarkdownHeaders = /^#+ /.test(content.trim());
    const hasReasonableLength = content.length > 200 && content.length < 8000;
    const notEmpty = content.trim().length > 0;
    const noFallbackWarning = !content.includes('TEMPLATE-GENERATED');

    return hasMarkdownHeaders && hasReasonableLength && notEmpty && noFallbackWarning;
  }

  addFallbackWarning(templateContent) {
    const warningBanner = `⚠️ **TEMPLATE-GENERATED BRIEF** - AI synthesis unavailable\n\n`;
    return warningBanner + templateContent;
  }

  formatForSlack(briefContent) {
    return briefContent
      .replace(/^# (.*)/gm, '*$1*')
      .replace(/^## (.*)/gm, '*$1*')
      .replace(/^### (.*)/gm, '_$1_')
      .replace(/\*\*(.*?)\*\*/g, '*$1*')
      .replace(/`(.*?)`/g, '`$1`')
      .substring(0, 3000);
  }
}

module.exports = BriefGenerator;