const { format, addDays, startOfWeek, endOfWeek, isWeekend, setHours, setMinutes } = require('date-fns');
const { toZonedTime, formatInTimeZone } = require('date-fns-tz');

class WeeklyReviewService {
  constructor(calendarService, todoistService, briefGenerator) {
    this.calendarService = calendarService;
    this.todoistService = todoistService;
    this.briefGenerator = briefGenerator;
    this.timezone = 'America/New_York';
  }

  async generateWeeklyReview() {
    console.log('📊 Gathering data for weekly review...');

    try {
      const [weeklySchedule, weeklyTasks] = await Promise.all([
        this.gatherWeeklyScheduleData(),
        this.gatherWeeklyTaskData()
      ]);

      console.log('🧠 Generating insights with Claude...');
      const insights = await this.generateWeeklyInsights({
        schedule: weeklySchedule,
        tasks: weeklyTasks
      });

      console.log('📅 Calculating availability blocks...');
      const availability = this.calculateAvailability(weeklySchedule.combined);

      const reviewData = {
        schedule: weeklySchedule,
        tasks: weeklyTasks,
        insights,
        availability,
        metadata: {
          generatedAt: new Date(),
          weekStart: startOfWeek(new Date(), { weekStartsOn: 1 }), // Monday
          weekEnd: endOfWeek(new Date(), { weekStartsOn: 1 }) // Sunday
        }
      };

      console.log('📝 Generating weekly review...');
      const reviewContent = await this.briefGenerator.generateWeeklyReview(reviewData);

      console.log('💾 Saving weekly review...');
      const filepath = await this.briefGenerator.saveWeeklyReview(reviewContent);

      console.log('✅ Weekly review generated successfully!');
      console.log(`📄 Saved to: ${filepath}`);

      this.printWeeklySummary(reviewData);

      return {
        success: true,
        filepath,
        content: reviewContent,
        data: reviewData
      };
    } catch (error) {
      console.error('❌ Failed to generate weekly review:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async gatherWeeklyScheduleData() {
    try {
      const weeklySchedule = await this.calendarService.getUpcomingSchedule(7);
      const analysis = this.analyzeWeeklySchedule(weeklySchedule.combined);

      return {
        ...weeklySchedule,
        analysis
      };
    } catch (error) {
      console.error('📅 Error gathering weekly schedule data:', error.message);
      return {
        personal: [],
        work: [],
        combined: [],
        analysis: {
          totalEvents: 0,
          meetingHours: 0,
          conflicts: [],
          busyPeriods: [],
          travelEvents: [],
          familyEvents: [],
          overCapacityDays: []
        }
      };
    }
  }

  async gatherWeeklyTaskData() {
    try {
      // Get tasks for next 14 days as specified
      const upcomingTasks = await this.todoistService.client.getUpcomingTasks(14);
      const overdueTasks = await this.todoistService.client.getOverdueTasks();

      const weeklyTasks = {
        upcoming: {
          tasks: upcomingTasks,
          analysis: this.todoistService.client.analyzeTasks(upcomingTasks),
          byProject: this.todoistService.client.groupTasksByProject(upcomingTasks, this.todoistService.projects)
        },
        overdue: {
          tasks: overdueTasks,
          analysis: this.todoistService.client.analyzeTasks(overdueTasks),
          byProject: this.todoistService.client.groupTasksByProject(overdueTasks, this.todoistService.projects)
        },
        byDay: this.groupTasksByDay(upcomingTasks, 14)
      };

      return weeklyTasks;
    } catch (error) {
      console.error('✅ Error gathering weekly task data:', error.message);
      return {
        upcoming: {
          tasks: [],
          analysis: { total: 0, byPriority: { urgent: 0, veryHigh: 0, high: 0, normal: 0 } },
          byProject: {}
        },
        overdue: {
          tasks: [],
          analysis: { total: 0, byPriority: { urgent: 0, veryHigh: 0, high: 0, normal: 0 } },
          byProject: {}
        },
        byDay: {}
      };
    }
  }

  groupTasksByDay(tasks, days) {
    const grouped = new Map();
    const today = new Date();

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      grouped.set(dateStr, []);
    }

    tasks.forEach(task => {
      if (task.due && task.due.date) {
        const dueDate = task.due.date;
        if (grouped.has(dueDate)) {
          grouped.get(dueDate).push(task);
        }
      }
    });

    return Object.fromEntries(grouped);
  }

  analyzeWeeklySchedule(events) {
    const analysis = {
      totalEvents: events.length,
      meetingHours: 0,
      conflicts: [],
      busyPeriods: [],
      travelEvents: [],
      familyEvents: [],
      overCapacityDays: []
    };

    if (events.length === 0) {
      return analysis;
    }

    // Calculate total meeting hours
    events.forEach(event => {
      if (!event.isAllDay) {
        const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
        analysis.meetingHours += duration;
      }
    });

    // Find conflicts
    analysis.conflicts = this.calendarService.findConflicts(events);

    // Identify travel events (keywords in title/description)
    analysis.travelEvents = events.filter(event =>
      this.containsTravelKeywords(event.title) ||
      this.containsTravelKeywords(event.description || '')
    );

    // Identify family events
    analysis.familyEvents = events.filter(event =>
      this.containsFamilyKeywords(event.title) ||
      this.containsFamilyKeywords(event.description || '')
    );

    // Identify over-capacity days (more than 8 hours of meetings)
    analysis.overCapacityDays = this.findOverCapacityDays(events);

    // Identify busy periods
    analysis.busyPeriods = this.calendarService.identifyBusyPeriods(events);

    return analysis;
  }

  containsTravelKeywords(text) {
    if (!text) return false;
    const travelKeywords = ['flight', 'airport', 'travel', 'trip', 'drive to', 'driving', 'commute'];
    return travelKeywords.some(keyword => text.toLowerCase().includes(keyword));
  }

  containsFamilyKeywords(text) {
    if (!text) return false;
    const familyKeywords = ['family', 'kids', 'child', 'daughter', 'son', 'spouse', 'wife', 'husband', 'personal'];
    return familyKeywords.some(keyword => text.toLowerCase().includes(keyword));
  }

  findOverCapacityDays(events) {
    const dayGroups = {};

    events.forEach(event => {
      if (!event.isAllDay) {
        const dayKey = format(event.start, 'yyyy-MM-dd');
        if (!dayGroups[dayKey]) {
          dayGroups[dayKey] = [];
        }
        dayGroups[dayKey].push(event);
      }
    });

    const overCapacityDays = [];
    Object.entries(dayGroups).forEach(([date, dayEvents]) => {
      const totalHours = dayEvents.reduce((sum, event) => {
        const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
        return sum + duration;
      }, 0);

      if (totalHours > 8) {
        overCapacityDays.push({
          date,
          totalHours: Math.round(totalHours * 10) / 10,
          eventCount: dayEvents.length,
          events: dayEvents.map(e => e.title)
        });
      }
    });

    return overCapacityDays;
  }

  calculateAvailability(events) {
    const availability = {};
    const workingHours = { start: 9, end: 18 }; // 9 AM to 6 PM ET

    // Debug: Log timezone information
    const debugMode = process.env.NODE_ENV !== 'production';
    if (debugMode) {
      console.log(`🕒 Calculating availability for timezone: ${this.timezone}`);
      console.log(`🕒 Working hours: ${workingHours.start}:00 - ${workingHours.end}:00 ET`);
    }

    // Calculate for next 7 days, weekdays only
    for (let i = 0; i < 7; i++) {
      const date = addDays(new Date(), i);
      const dateInET = toZonedTime(date, this.timezone);

      // Skip weekends
      if (isWeekend(dateInET)) {
        continue;
      }

      const dayKey = format(dateInET, 'EEE'); // Mon, Tue, etc.
      const dateStr = format(dateInET, 'yyyy-MM-dd');

      // Get events for this day
      const dayEvents = events.filter(event => {
        const eventDate = format(event.start, 'yyyy-MM-dd');
        return eventDate === dateStr && !event.isAllDay;
      });

      // Calculate free slots
      const freeSlots = this.calculateDayAvailability(dayEvents, dateInET, workingHours);

      if (freeSlots.length > 0) {
        availability[dayKey] = freeSlots;
      }
    }

    return availability;
  }

  calculateDayAvailability(dayEvents, date, workingHours) {
    // Create working day boundaries in ET
    const dayStart = setMinutes(setHours(date, workingHours.start), 0);
    const dayEnd = setMinutes(setHours(date, workingHours.end), 0);

    // Sort events by start time
    const sortedEvents = dayEvents
      .filter(event => event.start >= dayStart && event.start < dayEnd)
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    const freeSlots = [];
    let currentTime = dayStart;

    for (const event of sortedEvents) {
      // If there's a gap before this event
      if (event.start > currentTime) {
        const gapMinutes = (event.start.getTime() - currentTime.getTime()) / (1000 * 60);

        // Only include gaps of 30+ minutes
        if (gapMinutes >= 30) {
          freeSlots.push({
            start: formatInTimeZone(currentTime, this.timezone, 'HH:mm'),
            end: formatInTimeZone(event.start, this.timezone, 'HH:mm'),
            duration: Math.floor(gapMinutes)
          });
        }
      }

      // Move current time to end of this event
      currentTime = new Date(Math.max(currentTime.getTime(), event.end.getTime()));
    }

    // Check for time after last event until end of day
    if (currentTime < dayEnd) {
      const remainingMinutes = (dayEnd.getTime() - currentTime.getTime()) / (1000 * 60);

      if (remainingMinutes >= 30) {
        freeSlots.push({
          start: formatInTimeZone(currentTime, this.timezone, 'HH:mm'),
          end: formatInTimeZone(dayEnd, this.timezone, 'HH:mm'),
          duration: Math.floor(remainingMinutes)
        });
      }
    }

    return freeSlots;
  }

  async generateWeeklyInsights(data) {
    if (!this.briefGenerator.hasAnthropicKey()) {
      console.log('⚠️  No Anthropic API key found. Skipping AI insights generation.');
      return this.generateBasicInsights(data);
    }

    try {
      const prompt = this.buildWeeklyInsightsPrompt(data);
      const insights = await this.briefGenerator.generateClaudeInsights(prompt);
      return insights;
    } catch (error) {
      console.error('❌ Error generating Claude insights:', error.message);
      return this.generateBasicInsights(data);
    }
  }

  buildWeeklyInsightsPrompt(data) {
    const { schedule, tasks } = data;

    return `You are conducting a weekly review analysis. Analyze the following data and provide insights in the specified format.

CALENDAR DATA (Next 7 Days):
- Total Events: ${schedule.analysis.totalEvents}
- Total Meeting Hours: ${schedule.analysis.meetingHours.toFixed(1)}
- Conflicts: ${schedule.analysis.conflicts.length}
- Travel Events: ${schedule.analysis.travelEvents.length}
- Family Events: ${schedule.analysis.familyEvents.length}
- Over-capacity Days: ${schedule.analysis.overCapacityDays.length}

TASK DATA (Next 14 Days):
- Upcoming Tasks: ${tasks.upcoming.analysis.total}
- Overdue Tasks: ${tasks.overdue.analysis.total}
- High Priority Tasks: ${tasks.upcoming.analysis.byPriority.high + tasks.upcoming.analysis.byPriority.urgent}

DETAILED EVENTS:
${schedule.combined.slice(0, 20).map(event =>
  `- ${format(event.start, 'EEE MMM dd HH:mm')}: ${event.title} (${event.source})`
).join('\n')}

DETAILED TASKS:
${tasks.upcoming.tasks.slice(0, 15).map(task =>
  `- ${task.content} (Priority: ${task.priority}, Due: ${task.due?.date || 'No due date'})`
).join('\n')}

Please provide a weekly review analysis with the following sections:

1. KEY PRIORITIES: Identify the 3-5 most important items for the week based on urgency, impact, and deadlines.

2. RISKS AND CONFLICTS: Highlight potential issues like:
   - Schedule conflicts or over-capacity days
   - Competing priorities or deadlines
   - Travel disruptions
   - Overdue tasks creating pressure

3. SUGGESTED SCHEDULE ADJUSTMENTS: Recommend specific changes to optimize the week:
   - Meetings to reschedule or consolidate
   - Buffer time needed for high-priority work
   - Time blocks to protect for deep work

4. TASK PROGRESS PLAN: Suggest a strategy for task completion:
   - Which overdue tasks to tackle first
   - How to break down large projects
   - When to focus on different types of work

Format your response as structured insights that can be easily consumed in an email format.`;
  }

  generateBasicInsights(data) {
    const insights = {
      keyPriorities: [],
      risksAndConflicts: [],
      scheduleAdjustments: [],
      taskProgressPlan: []
    };

    const { schedule, tasks } = data;

    // Key Priorities
    if (tasks.overdue.analysis.total > 0) {
      insights.keyPriorities.push(`Address ${tasks.overdue.analysis.total} overdue tasks`);
    }

    if (tasks.upcoming.analysis.byPriority.urgent > 0) {
      insights.keyPriorities.push(`Complete ${tasks.upcoming.analysis.byPriority.urgent} urgent tasks`);
    }

    // Risks and Conflicts
    if (schedule.analysis.conflicts.length > 0) {
      insights.risksAndConflicts.push(`${schedule.analysis.conflicts.length} schedule conflicts detected`);
    }

    if (schedule.analysis.overCapacityDays.length > 0) {
      insights.risksAndConflicts.push(`${schedule.analysis.overCapacityDays.length} over-capacity days (>8 hours of meetings)`);
    }

    // Schedule Adjustments
    if (schedule.analysis.meetingHours > 30) {
      insights.scheduleAdjustments.push('Consider consolidating meetings to create focus time blocks');
    }

    // Task Progress Plan
    if (tasks.overdue.analysis.total > 3) {
      insights.taskProgressPlan.push('Prioritize completing overdue tasks before taking on new work');
    }

    return insights;
  }

  printWeeklySummary(data) {
    console.log('\n📋 Weekly Review Summary:');

    if (data.schedule) {
      console.log(`📅 Events this week: ${data.schedule.combined.length}`);
      console.log(`⏰ Total meeting hours: ${data.schedule.analysis.meetingHours.toFixed(1)}h`);
      if (data.schedule.analysis.conflicts.length > 0) {
        console.log(`⚠️  Schedule conflicts: ${data.schedule.analysis.conflicts.length}`);
      }
      if (data.schedule.analysis.overCapacityDays.length > 0) {
        console.log(`🔥 Over-capacity days: ${data.schedule.analysis.overCapacityDays.length}`);
      }
    }

    if (data.tasks) {
      console.log(`✅ Upcoming tasks: ${data.tasks.upcoming.analysis.total}`);
      console.log(`🚨 Overdue tasks: ${data.tasks.overdue.analysis.total}`);
      console.log(`🔥 High priority: ${data.tasks.upcoming.analysis.byPriority.high + data.tasks.upcoming.analysis.byPriority.urgent}`);
    }

    if (data.availability) {
      const totalSlots = Object.values(data.availability).flat().length;
      console.log(`🗓️  Available time slots: ${totalSlots}`);
    }

    console.log('');
  }
}

module.exports = WeeklyReviewService;