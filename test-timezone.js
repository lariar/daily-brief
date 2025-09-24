#!/usr/bin/env node

const TimezoneValidator = require('./src/test/timezone-validation');
const CalendarService = require('./src/calendar/calendar-service');
const TodoistService = require('./src/todoist/todoist-service');
const BriefGenerator = require('./src/briefing/brief-generator');
const WeeklyReviewService = require('./src/weekly/weekly-review-service');
const config = require('./src/utils/config');

async function testTimezoneValidation() {
  console.log('🧪 Testing Timezone Validation for Weekly Review System\n');

  // Test basic timezone conversions
  const basicTests = TimezoneValidator.validateETConversions();

  console.log('\n🔧 Testing with Real Calendar Data...\n');

  try {
    // Initialize services
    const calendarService = new CalendarService();
    const todoistService = new TodoistService(config.todoist.apiToken);
    const briefGenerator = new BriefGenerator();
    const weeklyReviewService = new WeeklyReviewService(
      calendarService,
      todoistService,
      briefGenerator
    );

    // Initialize calendar service
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

    await calendarService.initialize(personalOAuthConfig, workOAuthConfig);

    // Get upcoming schedule
    console.log('📅 Fetching 7-day schedule...');
    const schedule = await calendarService.getUpcomingSchedule(7);

    console.log(`Found ${schedule.combined.length} events total`);

    // Validate event timezones
    TimezoneValidator.validateEventTimezones(schedule.combined);

    // Test availability calculation with debugging
    console.log('\n🗓️  Testing Availability Calculation...\n');

    const availability = weeklyReviewService.calculateAvailability(schedule.combined);

    console.log('=== Calculated Availability ===');
    Object.entries(availability).forEach(([day, slots]) => {
      console.log(`${day}: ${slots.map(slot => `${slot.start}–${slot.end} (${Math.floor(slot.duration/60)}h${slot.duration%60 ? Math.floor(slot.duration%60)+'m' : ''})`).join(', ')}`);
    });

    console.log('\n✅ Timezone validation complete!');

    return {
      basicTests,
      eventCount: schedule.combined.length,
      availability
    };

  } catch (error) {
    console.error('❌ Error during timezone validation:', error.message);
    console.error(error.stack);
  }
}

if (require.main === module) {
  testTimezoneValidation().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { testTimezoneValidation };