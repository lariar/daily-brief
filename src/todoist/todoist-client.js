const { TodoistApi } = require('@doist/todoist-api-typescript');

class TodoistClient {
  constructor(apiToken) {
    this.api = new TodoistApi(apiToken);
  }

  async getTasks(filter = null) {
    try {
      const response = await this.api.getTasks({ filter });
      if (!response) {
        console.warn('Todoist API returned null/undefined for tasks');
        return [];
      }
      
      // Extract the results array from the API response
      const tasks = response.results || response;
      return this.formatTasks(tasks);
    } catch (error) {
      console.error('Error fetching tasks:', error.message);
      return [];
    }
  }

  async getRelevantTasks() {
    // Get tasks that are:
    // - Due today or in the next 5 days
    // - Overdue from the last 7 days
    // - Exclude tasks without due dates or older than 7 days overdue
    
    const filters = [];
    const today = new Date();
    
    // Add filters for today through next 5 days
    for (let i = 0; i <= 5; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      filters.push(`due:${dateStr}`);
    }
    
    // Add filters for overdue tasks from last 7 days
    for (let i = 1; i <= 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      filters.push(`due:${dateStr}`);
    }
    
    const allTasks = await this.getTasks(filters.join(' | '));
    
    // Additional client-side filtering to ensure we only get tasks with due dates
    return this.filterTasksByDateCriteria(allTasks);
  }

  filterTasksByDateCriteria(tasks) {
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const fiveDaysFromNow = new Date(today);
    fiveDaysFromNow.setDate(today.getDate() + 5);
    
    return tasks.filter(task => {
      // Skip tasks without due dates
      if (!task.due || !task.due.date) {
        return false;
      }
      
      const dueDate = new Date(task.due.date);
      
      // Include if due date is between 7 days ago and 5 days from now
      return dueDate >= sevenDaysAgo && dueDate <= fiveDaysFromNow;
    });
  }

  async getTodaysTasks() {
    const relevantTasks = await this.getRelevantTasks();
    const today = new Date().toISOString().split('T')[0];
    
    return relevantTasks.filter(task => {
      return task.due && task.due.date === today;
    });
  }

  async getOverdueTasks() {
    const relevantTasks = await this.getRelevantTasks();
    const today = new Date().toISOString().split('T')[0];
    
    return relevantTasks.filter(task => {
      return task.due && task.due.date < today;
    });
  }

  async getUpcomingTasks(days = 5) {
    const relevantTasks = await this.getRelevantTasks();
    const today = new Date().toISOString().split('T')[0];
    
    return relevantTasks.filter(task => {
      return task.due && task.due.date > today;
    });
  }

  async getHighPriorityTasks() {
    const relevantTasks = await this.getRelevantTasks();
    
    return relevantTasks.filter(task => {
      return task.priority === 'High' || task.priority === 'Very High' || task.priority === 'Urgent';
    });
  }

  async getProjects() {
    try {
      const response = await this.api.getProjects();
      const projects = response.results || response;
      if (!Array.isArray(projects)) {
        console.warn('getProjects received non-array:', typeof projects, projects);
        return [];
      }
      return projects.map(project => ({
        id: project.id,
        name: project.name,
        color: project.color,
        isArchived: project.isArchived,
        isFavorite: project.isFavorite,
        url: project.url
      }));
    } catch (error) {
      console.error('Error fetching projects:', error.message);
      return [];
    }
  }

  async getLabels() {
    try {
      const response = await this.api.getLabels();
      const labels = response.results || response;
      if (!Array.isArray(labels)) {
        console.warn('getLabels received non-array:', typeof labels, labels);
        return [];
      }
      return labels.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        order: label.order,
        isFavorite: label.isFavorite
      }));
    } catch (error) {
      console.error('Error fetching labels:', error.message);
      return [];
    }
  }

  formatTasks(tasks) {
    if (!Array.isArray(tasks)) {
      console.warn('formatTasks received non-array:', typeof tasks, tasks);
      return [];
    }
    return tasks.map(task => ({
      id: task.id,
      content: task.content,
      description: task.description || '',
      projectId: task.projectId,
      sectionId: task.sectionId,
      parentId: task.parentId,
      order: task.order,
      priority: this.getPriorityLevel(task.priority),
      labels: task.labels || [],
      due: task.due ? {
        date: task.due.date,
        datetime: task.due.datetime,
        string: task.due.string,
        timezone: task.due.timezone,
        isRecurring: task.due.isRecurring
      } : null,
      url: task.url,
      commentCount: task.commentCount,
      isCompleted: task.isCompleted,
      createdAt: new Date(task.createdAt),
      creatorId: task.creatorId,
      assigneeId: task.assigneeId
    }));
  }

  getPriorityLevel(priority) {
    const levels = {
      1: 'Normal',
      2: 'High',
      3: 'Very High',
      4: 'Urgent'
    };
    return levels[priority] || 'Normal';
  }

  analyzeTasks(tasks) {
    const analysis = {
      total: tasks.length,
      byPriority: {
        urgent: 0,
        veryHigh: 0,
        high: 0,
        normal: 0
      },
      overdue: 0,
      dueToday: 0,
      dueTomorrow: 0,
      withDueDates: 0,
      projects: new Set(),
      labels: new Set()
    };

    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    tasks.forEach(task => {
      switch (task.priority) {
        case 'Urgent':
          analysis.byPriority.urgent++;
          break;
        case 'Very High':
          analysis.byPriority.veryHigh++;
          break;
        case 'High':
          analysis.byPriority.high++;
          break;
        default:
          analysis.byPriority.normal++;
      }

      if (task.due) {
        analysis.withDueDates++;
        const dueDate = task.due.date;
        
        if (dueDate < today) {
          analysis.overdue++;
        } else if (dueDate === today) {
          analysis.dueToday++;
        } else if (dueDate === tomorrow) {
          analysis.dueTomorrow++;
        }
      }

      if (task.projectId) {
        analysis.projects.add(task.projectId);
      }

      task.labels.forEach(label => analysis.labels.add(label));
    });

    analysis.projects = Array.from(analysis.projects);
    analysis.labels = Array.from(analysis.labels);

    return analysis;
  }

  groupTasksByProject(tasks, projects) {
    const projectMap = new Map(projects.map(p => [p.id, p.name]));
    const grouped = new Map();

    tasks.forEach(task => {
      const projectName = projectMap.get(task.projectId) || 'Inbox';
      if (!grouped.has(projectName)) {
        grouped.set(projectName, []);
      }
      grouped.get(projectName).push(task);
    });

    return Object.fromEntries(grouped);
  }
}

module.exports = TodoistClient;