#!/usr/bin/env node

const CalendarService = require('./calendar/calendar-service');
const TodoistService = require('./todoist/todoist-service');
const BriefGenerator = require('./briefing/brief-generator');
const WeeklyReviewService = require('./weekly/weekly-review-service');
const config = require('./utils/config');

class DailyBriefApp {
  constructor() {
    this.calendarService = new CalendarService();
    this.todoistService = new TodoistService(config.todoist.apiToken);
    this.briefGenerator = new BriefGenerator();
    this.weeklyReviewService = new WeeklyReviewService(
      this.calendarService,
      this.todoistService,
      this.briefGenerator
    );
  }

  async initialize() {
    console.log('🚀 Initializing Daily Brief application...');

    try {
      const personalOAuthConfig = config.hasPersonalCalendar() ? {
        clientId: config.google.oauth.clientId,
        clientSecret: config.google.oauth.clientSecret,
        refreshToken: config.google.personal.refreshToken
      } : null;

      const workOAuthConfig = config.hasWorkCalendar() ? {
        clientId: config.google.oauth.clientId,
        clientSecret: config.google.oauth.clientSecret,
        refreshToken: config.google.work.refreshToken
      } : null;

      const calendarResults = await this.calendarService.initialize(
        personalOAuthConfig,
        workOAuthConfig
      );

      console.log('📅 Calendar initialization:', {
        personal: calendarResults.personal ? '✅' : '❌',
        work: calendarResults.work ? '✅' : '❌'
      });

      const todoistResult = await this.todoistService.initialize();
      console.log('✅ Todoist initialization:', todoistResult ? '✅' : '❌');

      try {
        const briefResult = await this.briefGenerator.initialize();
        console.log('📝 Brief generator initialization: ✅');
      } catch (briefError) {
        console.log('📝 Brief generator initialization: ❌');
        throw new Error(`Brief generator initialization failed: ${briefError.message}`);
      }

      if (!todoistResult) {
        throw new Error('Failed to initialize Todoist service');
      }

      return true;
    } catch (error) {
      console.error('❌ Initialization failed:', error.message);
      return false;
    }
  }

  async generateDailyBrief() {
    console.log('📊 Gathering data for daily brief...');

    // Track integration failures
    const integrationErrors = {
      calendar: null,
      todoist: null
    };

    try {
      const [schedule, tasks] = await Promise.all([
        this.gatherScheduleData().catch(error => {
          integrationErrors.calendar = error.message;
          console.error('📅 Calendar integration failed:', error.message);
          return {
            personal: [],
            work: [],
            combined: [],
            analysis: {
              totalEvents: 0,
              meetingHours: 0,
              conflicts: [],
              busyPeriods: []
            }
          };
        }),
        this.gatherTaskData().catch(error => {
          integrationErrors.todoist = error.message;
          console.error('✅ Todoist integration failed:', error.message);
          return {
            today: {
              tasks: [],
              analysis: { total: 0, byPriority: { urgent: 0, veryHigh: 0, high: 0, normal: 0 } },
              byProject: {}
            },
            overdue: {
              tasks: [],
              analysis: { total: 0, byPriority: { urgent: 0, veryHigh: 0, high: 0, normal: 0 } },
              byProject: {}
            },
            highPriority: {
              tasks: [],
              analysis: { total: 0, byPriority: { urgent: 0, veryHigh: 0, high: 0, normal: 0 } },
              byProject: {}
            },
            insights: []
          };
        })
      ]);

      console.log('🔍 Analyzing data...');
      const briefData = {
        schedule,
        tasks,
        integrationErrors // Include error information in brief data
      };

      console.log('📝 Generating brief...');
      const briefContent = await this.briefGenerator.generateBrief(briefData);

      console.log('💾 Saving brief...');
      const filepath = await this.briefGenerator.saveBrief(briefContent);

      console.log('✅ Daily brief generated successfully!');
      console.log(`📄 Saved to: ${filepath}`);

      this.printSummary(briefData);

      return {
        success: true,
        filepath,
        content: briefContent,
        data: briefData,
        integrationErrors
      };
    } catch (error) {
      console.error('❌ Failed to generate daily brief:', error.message);
      return {
        success: false,
        error: error.message,
        integrationErrors
      };
    }
  }

  async gatherScheduleData() {
    try {
      const todaysSchedule = await this.calendarService.getTodaysSchedule();
      const analysis = this.calendarService.analyzeSchedule(todaysSchedule.combined);

      return {
        ...todaysSchedule,
        analysis
      };
    } catch (error) {
      console.error('📅 Error gathering schedule data:', error.message);
      // Propagate the error so it can be caught by the main handler
      throw new Error(`Calendar integration failed: ${error.message}`);
    }
  }


  async gatherTaskData() {
    try {
      const [dailySummary, insights] = await Promise.all([
        this.todoistService.getDailyTaskSummary(),
        this.generateTaskInsights()
      ]);

      return {
        ...dailySummary,
        insights
      };
    } catch (error) {
      console.error('✅ Error gathering task data:', error.message);
      // Propagate the error so it can be caught by the main handler
      throw new Error(`Todoist integration failed: ${error.message}`);
    }
  }

  async generateTaskInsights() {
    try {
      const summary = await this.todoistService.getDailyTaskSummary();
      return this.todoistService.generateTaskInsights(summary);
    } catch (error) {
      console.error('💡 Error generating task insights:', error.message);
      return [];
    }
  }

  printSummary(data) {
    console.log('\n📋 Brief Summary:');
    
    if (data.schedule) {
      console.log(`📅 Events today: ${data.schedule.combined.length}`);
      if (data.schedule.analysis.meetingHours > 0) {
        console.log(`⏰ Meeting hours: ${data.schedule.analysis.meetingHours.toFixed(1)}h`);
      }
      if (data.schedule.analysis.conflicts.length > 0) {
        console.log(`⚠️  Schedule conflicts: ${data.schedule.analysis.conflicts.length}`);
      }
    }

    if (data.tasks) {
      console.log(`✅ Tasks today: ${data.tasks.today?.analysis.total || 0}`);
      console.log(`🚨 Overdue tasks: ${data.tasks.overdue?.analysis.total || 0}`);
      console.log(`🔥 High priority: ${(data.tasks.today?.analysis.byPriority.high || 0) + (data.tasks.today?.analysis.byPriority.urgent || 0)}`);
    }

    console.log('');
  }

  async generateWeeklyReview() {
    console.log('📊 Generating weekly review...');

    try {
      const result = await this.weeklyReviewService.generateWeeklyReview();

      if (result.success) {
        console.log('✅ Weekly review generated successfully!');
        console.log(`📄 Saved to: ${result.filepath}`);
        return result;
      } else {
        console.log('💥 Weekly review generation failed!');
        return result;
      }
    } catch (error) {
      console.error('❌ Failed to generate weekly review:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async run() {
    // Check for mode argument
    const args = process.argv.slice(2);
    const modeArg = args.find(arg => arg.startsWith('--mode='));
    const mode = modeArg ? modeArg.split('=')[1] : 'daily';

    if (mode === 'weekly') {
      console.log('📅 Weekly Review Generator');
      console.log('==========================\n');

      const initialized = await this.initialize();
      if (!initialized) {
        process.exit(1);
      }

      const result = await this.generateWeeklyReview();

      if (result.success) {
        console.log('🎉 Weekly review completed successfully!');
        process.exit(0);
      } else {
        console.log('💥 Weekly review generation failed!');
        process.exit(1);
      }
    } else {
      console.log('🌅 Daily Brief Generator');
      console.log('========================\n');

      const initialized = await this.initialize();
      if (!initialized) {
        process.exit(1);
      }

      const result = await this.generateDailyBrief();

      if (result.success) {
        console.log('🎉 Daily brief completed successfully!');
        process.exit(0);
      } else {
        console.log('💥 Daily brief generation failed!');
        process.exit(1);
      }
    }
  }
}

if (require.main === module) {
  const app = new DailyBriefApp();
  app.run().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = DailyBriefApp;