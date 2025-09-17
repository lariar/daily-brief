const { 
  format, 
  startOfDay, 
  endOfDay, 
  addDays, 
  isToday, 
  isTomorrow, 
  isYesterday,
  differenceInHours,
  differenceInMinutes
} = require('date-fns');
const { toZonedTime, formatInTimeZone } = require('date-fns-tz');

class DateUtils {
  static formatTime(date, timezone = null) {
    if (!date) return '';
    
    if (timezone) {
      return formatInTimeZone(new Date(date), timezone, 'h:mm a');
    }
    
    return format(new Date(date), 'h:mm a');
  }

  static formatDate(date) {
    if (!date) return '';
    return format(new Date(date), 'MMM d, yyyy');
  }

  static formatDateTime(date) {
    if (!date) return '';
    return format(new Date(date), 'MMM d, yyyy h:mm a');
  }

  static formatRelativeDate(date) {
    if (!date) return '';
    
    const dateObj = new Date(date);
    
    if (isToday(dateObj)) {
      return 'Today';
    } else if (isTomorrow(dateObj)) {
      return 'Tomorrow';
    } else if (isYesterday(dateObj)) {
      return 'Yesterday';
    } else {
      return this.formatDate(dateObj);
    }
  }

  static getTodayRange() {
    const today = new Date();
    return {
      start: startOfDay(today),
      end: endOfDay(today)
    };
  }

  static getDateRange(days) {
    const today = new Date();
    return {
      start: startOfDay(today),
      end: endOfDay(addDays(today, days))
    };
  }

  static isInRange(date, startDate, endDate) {
    const checkDate = new Date(date);
    return checkDate >= startDate && checkDate <= endDate;
  }

  static getDurationBetween(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const hours = differenceInHours(end, start);
    const minutes = differenceInMinutes(end, start) % 60;
    
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    } else {
      return `${minutes}m`;
    }
  }

  static isWorkingHours(date) {
    const hour = new Date(date).getHours();
    return hour >= 9 && hour < 17;
  }

  static isWeekend(date) {
    const day = new Date(date).getDay();
    return day === 0 || day === 6;
  }

  static getWeekDayName(date) {
    return format(new Date(date), 'EEEE');
  }

  static getTimeUntil(date) {
    const now = new Date();
    const target = new Date(date);
    
    if (target <= now) {
      return 'Past';
    }
    
    const diffHours = differenceInHours(target, now);
    const diffMinutes = differenceInMinutes(target, now) % 60;
    
    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      return `${days} day${days > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes}m`;
    }
  }

  static groupEventsByDate(events) {
    const grouped = new Map();
    
    events.forEach(event => {
      const dateKey = format(new Date(event.start), 'yyyy-MM-dd');
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey).push(event);
    });
    
    return Object.fromEntries(grouped);
  }

  static sortEventsByTime(events) {
    return events.sort((a, b) => new Date(a.start) - new Date(b.start));
  }

  static findOverlappingEvents(events) {
    const overlaps = [];
    
    for (let i = 0; i < events.length - 1; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (this.eventsOverlap(events[i], events[j])) {
          overlaps.push({
            event1: events[i],
            event2: events[j]
          });
        }
      }
    }
    
    return overlaps;
  }

  static eventsOverlap(event1, event2) {
    const start1 = new Date(event1.start);
    const end1 = new Date(event1.end);
    const start2 = new Date(event2.start);
    const end2 = new Date(event2.end);
    
    return start1 < end2 && start2 < end1;
  }

  static calculateFreeTime(events, startHour = 9, endHour = 17) {
    const sortedEvents = this.sortEventsByTime(events);
    const freeSlots = [];
    const workStart = startHour;
    const workEnd = endHour;
    
    let currentTime = workStart;
    
    sortedEvents.forEach(event => {
      const eventStart = new Date(event.start).getHours() + new Date(event.start).getMinutes() / 60;
      const eventEnd = new Date(event.end).getHours() + new Date(event.end).getMinutes() / 60;
      
      if (eventStart > currentTime) {
        freeSlots.push({
          start: currentTime,
          end: eventStart,
          duration: eventStart - currentTime
        });
      }
      
      currentTime = Math.max(currentTime, eventEnd);
    });
    
    if (currentTime < workEnd) {
      freeSlots.push({
        start: currentTime,
        end: workEnd,
        duration: workEnd - currentTime
      });
    }
    
    return freeSlots;
  }
}

module.exports = DateUtils;