const GoogleCalendarClient = require('./google-calendar');

class CalendarService {
  constructor() {
    this.personalCalendar = null;
    this.workCalendar = null;
  }

  async initialize(personalOAuthConfig, workOAuthConfig) {
    const results = { personal: false, work: false };

    if (personalOAuthConfig && personalOAuthConfig.refreshToken) {
      this.personalCalendar = new GoogleCalendarClient(personalOAuthConfig);
      results.personal = await this.personalCalendar.initialize();
    }

    if (workOAuthConfig && workOAuthConfig.refreshToken) {
      this.workCalendar = new GoogleCalendarClient(workOAuthConfig);
      results.work = await this.workCalendar.initialize();
    }

    return results;
  }

  async getTodaysSchedule() {
    const schedule = {
      personal: [],
      work: [],
      combined: []
    };

    try {
      if (this.personalCalendar) {
        schedule.personal = await this.personalCalendar.getTodaysEvents();
      }

      if (this.workCalendar) {
        schedule.work = await this.workCalendar.getTodaysEvents();
      }

      schedule.combined = this.combineAndSortEvents(
        schedule.personal,
        schedule.work
      );

      return schedule;
    } catch (error) {
      console.error('Error getting today\'s schedule:', error.message);
      return schedule;
    }
  }

  async getUpcomingSchedule(days = 7) {
    const schedule = {
      personal: [],
      work: [],
      combined: []
    };

    try {
      if (this.personalCalendar) {
        schedule.personal = await this.personalCalendar.getUpcomingEvents('primary', days);
      }

      if (this.workCalendar) {
        schedule.work = await this.workCalendar.getUpcomingEvents('primary', days);
      }

      schedule.combined = this.combineAndSortEvents(
        schedule.personal,
        schedule.work
      );

      return schedule;
    } catch (error) {
      console.error('Error getting upcoming schedule:', error.message);
      return schedule;
    }
  }

  combineAndSortEvents(personalEvents, workEvents) {
    const allEvents = [
      ...personalEvents.map(event => ({ ...event, source: 'personal' })),
      ...workEvents.map(event => ({ ...event, source: 'work' }))
    ];

    return allEvents.sort((a, b) => a.start.getTime() - b.start.getTime());
  }

  analyzeSchedule(events) {
    const analysis = {
      totalEvents: events.length,
      meetingHours: 0,
      freeTime: [],
      conflicts: [],
      busyPeriods: []
    };

    if (events.length === 0) {
      return analysis;
    }

    events.forEach(event => {
      if (!event.isAllDay) {
        const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
        analysis.meetingHours += duration;
      }
    });

    analysis.conflicts = this.findConflicts(events);
    analysis.busyPeriods = this.identifyBusyPeriods(events);

    return analysis;
  }

  findConflicts(events) {
    const conflicts = [];
    
    for (let i = 0; i < events.length - 1; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const event1 = events[i];
        const event2 = events[j];

        if (!event1.isAllDay && !event2.isAllDay) {
          if (this.eventsOverlap(event1, event2)) {
            conflicts.push({
              event1: event1.title,
              event2: event2.title,
              time: event1.start
            });
          }
        }
      }
    }

    return conflicts;
  }

  eventsOverlap(event1, event2) {
    return event1.start < event2.end && event2.start < event1.end;
  }

  identifyBusyPeriods(events) {
    const workingHours = events.filter(event => 
      !event.isAllDay && 
      event.start.getHours() >= 9 && 
      event.start.getHours() < 17
    );

    const busyPeriods = [];
    let currentPeriod = null;

    workingHours.forEach(event => {
      if (!currentPeriod) {
        currentPeriod = {
          start: event.start,
          end: event.end,
          events: [event.title]
        };
      } else {
        const timeBetween = event.start.getTime() - currentPeriod.end.getTime();
        const minutesBetween = timeBetween / (1000 * 60);

        if (minutesBetween <= 30) {
          currentPeriod.end = event.end;
          currentPeriod.events.push(event.title);
        } else {
          if (currentPeriod.events.length > 1) {
            busyPeriods.push(currentPeriod);
          }
          currentPeriod = {
            start: event.start,
            end: event.end,
            events: [event.title]
          };
        }
      }
    });

    if (currentPeriod && currentPeriod.events.length > 1) {
      busyPeriods.push(currentPeriod);
    }

    return busyPeriods;
  }
}

module.exports = CalendarService;