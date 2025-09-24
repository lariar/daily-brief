const { format, setHours, setMinutes } = require('date-fns');
const { toZonedTime, formatInTimeZone } = require('date-fns-tz');

class TimezoneValidator {
  static validateETConversions() {
    console.log('🧪 Testing Timezone Conversions for ET (America/New_York)\n');

    const timezone = 'America/New_York';
    const now = new Date();

    // Test 1: Basic timezone conversion
    console.log('=== Test 1: Basic Timezone Conversion ===');
    console.log(`Current system time: ${now.toISOString()}`);
    console.log(`Current system time local: ${now.toString()}`);

    const etTime = toZonedTime(now, timezone);
    console.log(`Converted to ET: ${etTime.toString()}`);
    console.log(`Formatted ET: ${formatInTimeZone(now, timezone, 'yyyy-MM-dd HH:mm:ss zzz')}`);

    // Test 2: Working hours in ET
    console.log('\n=== Test 2: Working Hours (9 AM - 6 PM ET) ===');

    // Create a date in ET for testing
    const testDate = new Date('2025-09-23T00:00:00Z'); // Monday
    const etDate = toZonedTime(testDate, timezone);

    const workStart = setMinutes(setHours(etDate, 9), 0);  // 9:00 AM ET
    const workEnd = setMinutes(setHours(etDate, 18), 0);   // 6:00 PM ET

    console.log(`Test date: ${format(etDate, 'yyyy-MM-dd EEEE')}`);
    console.log(`Work start (9 AM ET): ${workStart.toString()}`);
    console.log(`Work start formatted: ${formatInTimeZone(workStart, timezone, 'HH:mm')}`);
    console.log(`Work end (6 PM ET): ${workEnd.toString()}`);
    console.log(`Work end formatted: ${formatInTimeZone(workEnd, timezone, 'HH:mm')}`);

    // Test 3: Sample event times
    console.log('\n=== Test 3: Sample Event Conversion ===');

    // Simulate a meeting from 10:00 AM to 11:00 AM ET
    const meetingStart = setMinutes(setHours(etDate, 10), 0);
    const meetingEnd = setMinutes(setHours(etDate, 11), 0);

    console.log(`Meeting start (10 AM ET): ${meetingStart.toString()}`);
    console.log(`Meeting start formatted: ${formatInTimeZone(meetingStart, timezone, 'HH:mm')}`);
    console.log(`Meeting end (11 AM ET): ${meetingEnd.toString()}`);
    console.log(`Meeting end formatted: ${formatInTimeZone(meetingEnd, timezone, 'HH:mm')}`);

    // Test 4: Availability calculation simulation
    console.log('\n=== Test 4: Availability Calculation Simulation ===');

    // Simulate free time before meeting (9:00-10:00 AM)
    const freeStart = workStart;
    const freeEnd = meetingStart;

    console.log(`Free slot start: ${formatInTimeZone(freeStart, timezone, 'HH:mm')}`);
    console.log(`Free slot end: ${formatInTimeZone(freeEnd, timezone, 'HH:mm')}`);

    // Simulate free time after meeting (11:00 AM - 6:00 PM)
    const freeStart2 = meetingEnd;
    const freeEnd2 = workEnd;

    console.log(`Free slot 2 start: ${formatInTimeZone(freeStart2, timezone, 'HH:mm')}`);
    console.log(`Free slot 2 end: ${formatInTimeZone(freeEnd2, timezone, 'HH:mm')}`);

    // Test 5: Check what times we expect vs what might be happening
    console.log('\n=== Test 5: Expected vs Actual Format ===');
    console.log('Expected availability format: "Mon: 9:00–10:00 (1h), 11:00–18:00 (7h)"');
    console.log(`Actual free slot 1: ${formatInTimeZone(freeStart, timezone, 'HH:mm')}–${formatInTimeZone(freeEnd, timezone, 'HH:mm')}`);
    console.log(`Actual free slot 2: ${formatInTimeZone(freeStart2, timezone, 'HH:mm')}–${formatInTimeZone(freeEnd2, timezone, 'HH:mm')}`);

    return {
      timezone,
      workStart: formatInTimeZone(workStart, timezone, 'HH:mm'),
      workEnd: formatInTimeZone(workEnd, timezone, 'HH:mm'),
      sampleFreeSlot1: `${formatInTimeZone(freeStart, timezone, 'HH:mm')}–${formatInTimeZone(freeEnd, timezone, 'HH:mm')}`,
      sampleFreeSlot2: `${formatInTimeZone(freeStart2, timezone, 'HH:mm')}–${formatInTimeZone(freeEnd2, timezone, 'HH:mm')}`
    };
  }

  static validateEventTimezones(events) {
    console.log('\n🧪 Validating Event Timezones\n');

    if (!events || events.length === 0) {
      console.log('No events provided for timezone validation');
      return;
    }

    const timezone = 'America/New_York';

    console.log('=== Event Timezone Analysis ===');
    events.slice(0, 5).forEach((event, index) => {
      console.log(`Event ${index + 1}: ${event.title}`);
      console.log(`  Start: ${event.start.toString()}`);
      console.log(`  Start in ET: ${formatInTimeZone(event.start, timezone, 'yyyy-MM-dd HH:mm zzz')}`);
      console.log(`  End: ${event.end.toString()}`);
      console.log(`  End in ET: ${formatInTimeZone(event.end, timezone, 'yyyy-MM-dd HH:mm zzz')}`);
      console.log(`  Is All Day: ${event.isAllDay}`);
      console.log(`  Original TZ: ${event.originalTimezone || 'Unknown'}`);
      console.log('');
    });
  }
}

module.exports = TimezoneValidator;