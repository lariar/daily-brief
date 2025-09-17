const TodoistClient = require('./todoist-client');

class TodoistService {
  constructor(apiToken) {
    this.client = new TodoistClient(apiToken);
    this.projects = [];
    this.labels = [];
  }

  async initialize() {
    try {
      this.projects = await this.client.getProjects();
      this.labels = await this.client.getLabels();
      return true;
    } catch (error) {
      console.error('Failed to initialize Todoist service:', error.message);
      return false;
    }
  }

  async getDailyTaskSummary() {
    try {
      const [todaysTasks, overdueTasks, highPriorityTasks] = await Promise.all([
        this.client.getTodaysTasks(),
        this.client.getOverdueTasks(),
        this.client.getHighPriorityTasks()
      ]);

      const summary = {
        today: {
          tasks: todaysTasks,
          analysis: this.client.analyzeTasks(todaysTasks),
          byProject: this.client.groupTasksByProject(todaysTasks, this.projects)
        },
        overdue: {
          tasks: overdueTasks,
          analysis: this.client.analyzeTasks(overdueTasks),
          byProject: this.client.groupTasksByProject(overdueTasks, this.projects)
        },
        highPriority: {
          tasks: highPriorityTasks,
          analysis: this.client.analyzeTasks(highPriorityTasks),
          byProject: this.client.groupTasksByProject(highPriorityTasks, this.projects)
        }
      };

      return summary;
    } catch (error) {
      console.error('Error getting daily task summary:', error.message);
      return {
        today: {
          tasks: [],
          analysis: { total: 0, byPriority: { urgent: 0, veryHigh: 0, high: 0, normal: 0 }, overdue: 0, dueToday: 0, dueTomorrow: 0, withDueDates: 0, projects: [], labels: [] },
          byProject: {}
        },
        overdue: {
          tasks: [],
          analysis: { total: 0, byPriority: { urgent: 0, veryHigh: 0, high: 0, normal: 0 }, overdue: 0, dueToday: 0, dueTomorrow: 0, withDueDates: 0, projects: [], labels: [] },
          byProject: {}
        },
        highPriority: {
          tasks: [],
          analysis: { total: 0, byPriority: { urgent: 0, veryHigh: 0, high: 0, normal: 0 }, overdue: 0, dueToday: 0, dueTomorrow: 0, withDueDates: 0, projects: [], labels: [] },
          byProject: {}
        }
      };
    }
  }

  async getWeeklyTaskSummary() {
    try {
      const upcomingTasks = await this.client.getUpcomingTasks(7);
      
      const summary = {
        upcoming: {
          tasks: upcomingTasks,
          analysis: this.client.analyzeTasks(upcomingTasks),
          byProject: this.client.groupTasksByProject(upcomingTasks, this.projects)
        },
        tasksByDay: this.groupTasksByDay(upcomingTasks)
      };

      return summary;
    } catch (error) {
      console.error('Error getting weekly task summary:', error.message);
      return {
        upcoming: {
          tasks: [],
          analysis: { total: 0, byPriority: { urgent: 0, veryHigh: 0, high: 0, normal: 0 }, overdue: 0, dueToday: 0, dueTomorrow: 0, withDueDates: 0, projects: [], labels: [] },
          byProject: {}
        },
        tasksByDay: {}
      };
    }
  }

  groupTasksByDay(tasks) {
    const grouped = new Map();
    const today = new Date();

    for (let i = 0; i < 7; i++) {
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

  generateTaskInsights(summary) {
    const insights = [];

    if (summary.overdue.tasks.length > 0) {
      insights.push({
        type: 'warning',
        message: `You have ${summary.overdue.tasks.length} overdue task(s) that need attention.`,
        priority: 'high'
      });
    }

    if (summary.today.analysis.byPriority.urgent > 0) {
      insights.push({
        type: 'urgent',
        message: `${summary.today.analysis.byPriority.urgent} urgent task(s) scheduled for today.`,
        priority: 'urgent'
      });
    }

    if (summary.today.tasks.length === 0) {
      insights.push({
        type: 'info',
        message: 'No tasks scheduled for today. Consider planning your day.',
        priority: 'low'
      });
    } else if (summary.today.tasks.length > 10) {
      insights.push({
        type: 'warning',
        message: `You have ${summary.today.tasks.length} tasks today. Consider prioritizing.`,
        priority: 'medium'
      });
    }

    const busyProjects = Object.entries(summary.today.byProject)
      .filter(([_, tasks]) => tasks.length > 3)
      .map(([project, tasks]) => ({ project, count: tasks.length }));

    if (busyProjects.length > 0) {
      insights.push({
        type: 'info',
        message: `Busy projects today: ${busyProjects.map(p => `${p.project} (${p.count})`).join(', ')}`,
        priority: 'medium'
      });
    }

    return insights;
  }

  getProjectName(projectId) {
    const project = this.projects.find(p => p.id === projectId);
    return project ? project.name : 'Unknown Project';
  }

  getLabelName(labelId) {
    const label = this.labels.find(l => l.id === labelId);
    return label ? label.name : 'Unknown Label';
  }

  formatTaskForDisplay(task) {
    return {
      title: task.content,
      description: task.description,
      priority: task.priority,
      project: this.getProjectName(task.projectId),
      labels: task.labels.map(labelId => this.getLabelName(labelId)),
      due: task.due ? {
        date: task.due.date,
        time: task.due.datetime,
        string: task.due.string
      } : null,
      url: task.url
    };
  }
}

module.exports = TodoistService;