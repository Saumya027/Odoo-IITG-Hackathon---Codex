// ============================================================================
// ExpenseFlow - Complete Expense Management System
// app.js - Integrated Backend Logic
// ============================================================================

// ============================================================================
// DATA MODELS & STATE
// ============================================================================

const AppState = {
  currentUser: null,
  currentCompany: null,
  employees: [],
  expenses: [],
  approvalRules: [],
  companies: [],
  currencies: [],
  exchangeRates: {}
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const Utils = {
  generateId: (prefix = 'ID') => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  
  showLoader: () => {
    document.getElementById('globalLoader').classList.remove('hidden');
  },
  
  hideLoader: () => {
    document.getElementById('globalLoader').classList.add('hidden');
  },
  
  showToast: (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px; padding: 16px 24px;
      background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
      color: white; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000; animation: slideIn 0.3s ease;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  },
  
  formatCurrency: (amount, currency = 'USD') => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: currency 
    }).format(amount);
  },
  
  formatDate: (date) => {
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }
};

// ============================================================================
// API SERVICE
// ============================================================================

const APIService = {
  async fetchCountries() {
    try {
      const response = await fetch('https://restcountries.com/v3.1/all?fields=name,currencies');
      const data = await response.json();
      return data.map(country => ({
        name: country.name.common,
        currency: Object.keys(country.currencies || {})[0] || 'USD',
        currencyName: Object.values(country.currencies || {})[0]?.name || 'US Dollar'
      })).sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Error fetching countries:', error);
      return [];
    }
  },
  
  async fetchExchangeRates(baseCurrency = 'USD') {
    try {
      const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
      const data = await response.json();
      return data.rates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      return {};
    }
  },
  
  async convertCurrency(amount, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return amount;
    
    if (!AppState.exchangeRates[fromCurrency]) {
      AppState.exchangeRates[fromCurrency] = await this.fetchExchangeRates(fromCurrency);
    }
    
    const rate = AppState.exchangeRates[fromCurrency][toCurrency];
    return rate ? amount * rate : amount;
  },
  
  // OCR Simulation (Mock - in production, use real OCR API like Tesseract.js or cloud services)
  async performOCR(imageFile) {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulated OCR result
        resolve({
          amount: (Math.random() * 500 + 50).toFixed(2),
          date: new Date().toISOString().split('T')[0],
          category: ['Meals', 'Transport', 'Accommodation', 'Office Supplies'][Math.floor(Math.random() * 4)],
          description: 'Auto-extracted from receipt',
          merchant: 'Sample Restaurant'
        });
      }, 1500);
    });
  }
};

// ============================================================================
// STORAGE SERVICE (Using In-Memory Storage)
// ============================================================================

const StorageService = {
  save() {
    // In production, this would save to a real backend
    // For now, data persists only in memory during the session
    console.log('Data saved to memory', AppState);
  },
  
  load() {
    // In production, this would load from a real backend
    console.log('Data loaded from memory');
  }
};

// ============================================================================
// AUTHENTICATION SERVICE
// ============================================================================

const AuthService = {
  async signup(name, email, password, companyName, country) {
    Utils.showLoader();
    
    try {
      // Check if company already exists
      const existingCompany = AppState.companies.find(c => 
        c.name.toLowerCase() === companyName.toLowerCase()
      );
      
      if (existingCompany) {
        throw new Error('Company already exists');
      }
      
      // Get currency for selected country
      const countryData = AppState.currencies.find(c => c.name === country);
      const currency = countryData?.currency || 'USD';
      
      // Create new company
      const company = {
        id: Utils.generateId('COMP'),
        name: companyName,
        country: country,
        baseCurrency: currency,
        createdAt: new Date().toISOString()
      };
      
      // Create admin user
      const admin = {
        id: Utils.generateId('USR'),
        companyId: company.id,
        name: name,
        email: email,
        password: password, // In production, hash this!
        role: 'admin',
        managerId: null,
        createdAt: new Date().toISOString()
      };
      
      AppState.companies.push(company);
      AppState.employees.push(admin);
      AppState.currentCompany = company;
      AppState.currentUser = admin;
      
      StorageService.save();
      Utils.hideLoader();
      Utils.showToast('Account created successfully!', 'success');
      
      return { user: admin, company };
    } catch (error) {
      Utils.hideLoader();
      Utils.showToast(error.message, 'error');
      throw error;
    }
  },
  
  async signin(email, password, isAdmin = true) {
    Utils.showLoader();
    
    try {
      const user = AppState.employees.find(e => 
        e.email === email && e.password === password
      );
      
      if (!user) {
        throw new Error('Invalid credentials');
      }
      
      if (isAdmin && user.role !== 'admin') {
        throw new Error('Not authorized as admin');
      }
      
      const company = AppState.companies.find(c => c.id === user.companyId);
      
      if (!company) {
        throw new Error('Company not found');
      }
      
      AppState.currentUser = user;
      AppState.currentCompany = company;
      
      // Fetch exchange rates for company's base currency
      AppState.exchangeRates[company.baseCurrency] = await APIService.fetchExchangeRates(company.baseCurrency);
      
      Utils.hideLoader();
      Utils.showToast('Signed in successfully!', 'success');
      
      return { user, company };
    } catch (error) {
      Utils.hideLoader();
      Utils.showToast(error.message, 'error');
      throw error;
    }
  },
  
  async signinEmployee(companyName, employeeId, password) {
    Utils.showLoader();
    
    try {
      const company = AppState.companies.find(c => 
        c.name.toLowerCase() === companyName.toLowerCase()
      );
      
      if (!company) {
        throw new Error('Company not found');
      }
      
      const user = AppState.employees.find(e => 
        e.companyId === company.id && 
        e.employeeId === employeeId && 
        e.password === password
      );
      
      if (!user) {
        throw new Error('Invalid credentials');
      }
      
      AppState.currentUser = user;
      AppState.currentCompany = company;
      
      AppState.exchangeRates[company.baseCurrency] = await APIService.fetchExchangeRates(company.baseCurrency);
      
      Utils.hideLoader();
      Utils.showToast('Signed in successfully!', 'success');
      
      return { user, company };
    } catch (error) {
      Utils.hideLoader();
      Utils.showToast(error.message, 'error');
      throw error;
    }
  },
  
  logout() {
    AppState.currentUser = null;
    AppState.currentCompany = null;
    Utils.showToast('Logged out successfully', 'success');
  }
};

// ============================================================================
// EMPLOYEE MANAGEMENT SERVICE
// ============================================================================

const EmployeeService = {
  createEmployee(data) {
    if (AppState.currentUser?.role !== 'admin') {
      throw new Error('Only admins can create employees');
    }
    
    const employee = {
      id: Utils.generateId('USR'),
      employeeId: data.employeeId,
      companyId: AppState.currentCompany.id,
      name: data.name,
      email: data.email,
      password: data.password,
      role: data.role || 'employee',
      managerId: data.managerId || null,
      isManagerApprover: data.isManagerApprover || false,
      createdAt: new Date().toISOString()
    };
    
    AppState.employees.push(employee);
    StorageService.save();
    Utils.showToast('Employee created successfully', 'success');
    
    return employee;
  },
  
  updateEmployee(employeeId, updates) {
    if (AppState.currentUser?.role !== 'admin') {
      throw new Error('Only admins can update employees');
    }
    
    const employee = AppState.employees.find(e => e.id === employeeId);
    if (!employee) {
      throw new Error('Employee not found');
    }
    
    Object.assign(employee, updates);
    StorageService.save();
    Utils.showToast('Employee updated successfully', 'success');
    
    return employee;
  },
  
  deleteEmployee(employeeId) {
    if (AppState.currentUser?.role !== 'admin') {
      throw new Error('Only admins can delete employees');
    }
    
    const index = AppState.employees.findIndex(e => e.id === employeeId);
    if (index === -1) {
      throw new Error('Employee not found');
    }
    
    AppState.employees.splice(index, 1);
    StorageService.save();
    Utils.showToast('Employee deleted successfully', 'success');
  },
  
  getCompanyEmployees() {
    return AppState.employees.filter(e => e.companyId === AppState.currentCompany?.id);
  },
  
  getManagers() {
    return this.getCompanyEmployees().filter(e => e.role === 'manager' || e.role === 'admin');
  }
};

// ============================================================================
// EXPENSE SERVICE
// ============================================================================

const ExpenseService = {
  async submitExpense(data) {
    try {
      const expense = {
        id: Utils.generateId('EXP'),
        companyId: AppState.currentCompany.id,
        employeeId: AppState.currentUser.id,
        employeeName: AppState.currentUser.name,
        amount: parseFloat(data.amount),
        currency: data.currency,
        amountInBaseCurrency: 0,
        category: data.category,
        description: data.description,
        date: data.date,
        merchant: data.merchant || '',
        receiptUrl: data.receiptUrl || null,
        status: 'pending',
        approvals: [],
        currentApproverIndex: 0,
        comments: [],
        createdAt: new Date().toISOString()
      };
      
      // Convert to base currency
      expense.amountInBaseCurrency = await APIService.convertCurrency(
        expense.amount,
        expense.currency,
        AppState.currentCompany.baseCurrency
      );
      
      // Determine approval flow
      const approvalFlow = this.determineApprovalFlow(expense);
      expense.approvalFlow = approvalFlow;
      
      AppState.expenses.push(expense);
      StorageService.save();
      Utils.showToast('Expense submitted successfully', 'success');
      
      return expense;
    } catch (error) {
      Utils.showToast('Error submitting expense: ' + error.message, 'error');
      throw error;
    }
  },
  
  determineApprovalFlow(expense) {
    const employee = AppState.employees.find(e => e.id === expense.employeeId);
    const flow = [];
    
    // Check if employee has a manager and isManagerApprover is true
    if (employee.managerId && employee.isManagerApprover) {
      const manager = AppState.employees.find(e => e.id === employee.managerId);
      if (manager) {
        flow.push({
          approverId: manager.id,
          approverName: manager.name,
          approverRole: manager.role,
          status: 'pending',
          sequence: 1
        });
      }
    }
    
    // Add approval rules configured by admin
    const applicableRules = AppState.approvalRules
      .filter(rule => rule.companyId === AppState.currentCompany.id)
      .sort((a, b) => a.sequence - b.sequence);
    
    applicableRules.forEach((rule, index) => {
      flow.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        approvers: rule.approvers.map(a => ({
          approverId: a.approverId,
          approverName: a.approverName
        })),
        condition: rule.condition,
        status: 'pending',
        sequence: flow.length + 1,
        approvalCount: 0,
        requiredApprovals: rule.condition?.percentage ? 
          Math.ceil(rule.approvers.length * rule.condition.percentage / 100) : 
          rule.approvers.length
      });
    });
    
    return flow;
  },
  
  async approveExpense(expenseId, comment = '') {
    const expense = AppState.expenses.find(e => e.id === expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }
    
    const currentStep = expense.approvalFlow[expense.currentApproverIndex];
    if (!currentStep) {
      throw new Error('No pending approval step');
    }
    
    // Record approval
    const approval = {
      approverId: AppState.currentUser.id,
      approverName: AppState.currentUser.name,
      action: 'approved',
      comment: comment,
      timestamp: new Date().toISOString()
    };
    
    expense.approvals.push(approval);
    
    // Handle different rule types
    if (currentStep.ruleType) {
      currentStep.approvalCount++;
      
      // Check if condition is met
      const conditionMet = this.checkApprovalCondition(currentStep, approval);
      
      if (conditionMet) {
        currentStep.status = 'approved';
        expense.currentApproverIndex++;
      }
    } else {
      // Simple single approver
      currentStep.status = 'approved';
      expense.currentApproverIndex++;
    }
    
    // Check if all approvals are complete
    if (expense.currentApproverIndex >= expense.approvalFlow.length) {
      expense.status = 'approved';
    }
    
    if (comment) {
      expense.comments.push({
        userId: AppState.currentUser.id,
        userName: AppState.currentUser.name,
        comment: comment,
        timestamp: new Date().toISOString()
      });
    }
    
    StorageService.save();
    Utils.showToast('Expense approved', 'success');
    
    return expense;
  },
  
  checkApprovalCondition(step, approval) {
    const condition = step.condition;
    
    if (!condition) return step.approvalCount >= step.approvers.length;
    
    // Specific approver rule
    if (condition.specificApproverId && approval.approverId === condition.specificApproverId) {
      return true;
    }
    
    // Percentage rule
    if (condition.percentage) {
      const percentageApproved = (step.approvalCount / step.approvers.length) * 100;
      if (percentageApproved >= condition.percentage) {
        return true;
      }
    }
    
    // Hybrid rule (OR logic)
    if (condition.hybrid) {
      if (condition.specificApproverId && approval.approverId === condition.specificApproverId) {
        return true;
      }
      if (condition.percentage) {
        const percentageApproved = (step.approvalCount / step.approvers.length) * 100;
        if (percentageApproved >= condition.percentage) {
          return true;
        }
      }
    }
    
    return false;
  },
  
  rejectExpense(expenseId, comment = '') {
    const expense = AppState.expenses.find(e => e.id === expenseId);
    if (!expense) {
      throw new Error('Expense not found');
    }
    
    expense.status = 'rejected';
    expense.approvals.push({
      approverId: AppState.currentUser.id,
      approverName: AppState.currentUser.name,
      action: 'rejected',
      comment: comment,
      timestamp: new Date().toISOString()
    });
    
    if (comment) {
      expense.comments.push({
        userId: AppState.currentUser.id,
        userName: AppState.currentUser.name,
        comment: comment,
        timestamp: new Date().toISOString()
      });
    }
    
    StorageService.save();
    Utils.showToast('Expense rejected', 'success');
    
    return expense;
  },
  
  getMyExpenses() {
    return AppState.expenses.filter(e => e.employeeId === AppState.currentUser.id);
  },
  
  getPendingApprovals() {
    const userId = AppState.currentUser.id;
    
    return AppState.expenses.filter(expense => {
      if (expense.status !== 'pending') return false;
      
      const currentStep = expense.approvalFlow[expense.currentApproverIndex];
      if (!currentStep) return false;
      
      // Check if current user is in the current approval step
      if (currentStep.approverId === userId) return true;
      
      if (currentStep.approvers) {
        return currentStep.approvers.some(a => a.approverId === userId);
      }
      
      return false;
    });
  },
  
  getAllExpenses() {
    if (AppState.currentUser?.role !== 'admin') {
      throw new Error('Only admins can view all expenses');
    }
    return AppState.expenses.filter(e => e.companyId === AppState.currentCompany.id);
  }
};

// ============================================================================
// APPROVAL RULES SERVICE
// ============================================================================

const ApprovalRuleService = {
  createRule(data) {
    if (AppState.currentUser?.role !== 'admin') {
      throw new Error('Only admins can create approval rules');
    }
    
    const rule = {
      id: Utils.generateId('RULE'),
      companyId: AppState.currentCompany.id,
      name: data.name,
      type: data.type, // 'sequential', 'percentage', 'specific', 'hybrid'
      sequence: data.sequence || 1,
      approvers: data.approvers || [],
      condition: data.condition || null,
      createdAt: new Date().toISOString()
    };
    
    AppState.approvalRules.push(rule);
    StorageService.save();
    Utils.showToast('Approval rule created', 'success');
    
    return rule;
  },
  
  updateRule(ruleId, updates) {
    if (AppState.currentUser?.role !== 'admin') {
      throw new Error('Only admins can update approval rules');
    }
    
    const rule = AppState.approvalRules.find(r => r.id === ruleId);
    if (!rule) {
      throw new Error('Rule not found');
    }
    
    Object.assign(rule, updates);
    StorageService.save();
    Utils.showToast('Approval rule updated', 'success');
    
    return rule;
  },
  
  deleteRule(ruleId) {
    if (AppState.currentUser?.role !== 'admin') {
      throw new Error('Only admins can delete approval rules');
    }
    
    const index = AppState.approvalRules.findIndex(r => r.id === ruleId);
    if (index === -1) {
      throw new Error('Rule not found');
    }
    
    AppState.approvalRules.splice(index, 1);
    StorageService.save();
    Utils.showToast('Approval rule deleted', 'success');
  },
  
  getCompanyRules() {
    return AppState.approvalRules.filter(r => r.companyId === AppState.currentCompany?.id);
  }
};

// ============================================================================
// UI RENDERING
// ============================================================================

const UI = {
  renderDashboard() {
    const appRoot = document.getElementById('appRoot');
    const role = AppState.currentUser.role;
    
    let content = `
      <div class="dashboard">
        <aside class="sidebar">
          <div class="sidebar-header">
            <h2>ExpenseFlow</h2>
            <p class="muted-sm">${AppState.currentCompany.name}</p>
          </div>
          <nav class="sidebar-nav">
            <a href="#" class="nav-item active" data-view="overview">
              <span>📊</span> Overview
            </a>
    `;
    
    if (role === 'employee' || role === 'manager' || role === 'admin') {
      content += `
            <a href="#" class="nav-item" data-view="my-expenses">
              <span>💰</span> My Expenses
            </a>
            <a href="#" class="nav-item" data-view="submit-expense">
              <span>➕</span> Submit Expense
            </a>
      `;
    }
    
    if (role === 'manager' || role === 'admin') {
      content += `
            <a href="#" class="nav-item" data-view="approvals">
              <span>✅</span> Approvals
              <span class="badge">${ExpenseService.getPendingApprovals().length}</span>
            </a>
      `;
    }
    
    if (role === 'admin') {
      content += `
            <a href="#" class="nav-item" data-view="all-expenses">
              <span>📋</span> All Expenses
            </a>
            <a href="#" class="nav-item" data-view="employees">
              <span>👥</span> Employees
            </a>
            <a href="#" class="nav-item" data-view="approval-rules">
              <span>⚙️</span> Approval Rules
            </a>
      `;
    }
    
    content += `
          </nav>
          <div class="sidebar-footer">
            <div class="user-info">
              <strong>${AppState.currentUser.name}</strong>
              <span class="muted-sm">${AppState.currentUser.role}</span>
            </div>
            <button class="btn ghost btn-sm" id="btnLogout">Logout</button>
          </div>
        </aside>
        <main class="main-content">
          <div id="viewContent"></div>
        </main>
      </div>
    `;
    
    appRoot.innerHTML = content;
    
    // Add event listeners
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const view = item.dataset.view;
        this.renderView(view);
      });
    });
    
    document.getElementById('btnLogout').addEventListener('click', () => {
      AuthService.logout();
      this.showLanding();
    });
    
    // Render initial view
    this.renderView('overview');
  },
  
  renderView(viewName) {
    const viewContent = document.getElementById('viewContent');
    
    switch(viewName) {
      case 'overview':
        this.renderOverview(viewContent);
        break;
      case 'my-expenses':
        this.renderMyExpenses(viewContent);
        break;
      case 'submit-expense':
        this.renderSubmitExpense(viewContent);
        break;
      case 'approvals':
        this.renderApprovals(viewContent);
        break;
      case 'all-expenses':
        this.renderAllExpenses(viewContent);
        break;
      case 'employees':
        this.renderEmployees(viewContent);
        break;
      case 'approval-rules':
        this.renderApprovalRules(viewContent);
        break;
    }
  },
  
  renderOverview(container) {
    const expenses = AppState.currentUser.role === 'admin' ? 
      ExpenseService.getAllExpenses() : 
      ExpenseService.getMyExpenses();
    
    const pending = expenses.filter(e => e.status === 'pending').length;
    const approved = expenses.filter(e => e.status === 'approved').length;
    const rejected = expenses.filter(e => e.status === 'rejected').length;
    
    const totalAmount = expenses
      .filter(e => e.status === 'approved')
      .reduce((sum, e) => sum + e.amountInBaseCurrency, 0);
    
    container.innerHTML = `
      <div class="view-header">
        <h1>Dashboard Overview</h1>
        <p class="muted">Welcome back, ${AppState.currentUser.name}</p>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${pending}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${approved}</div>
          <div class="stat-label">Approved</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${rejected}</div>
          <div class="stat-label">Rejected</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${Utils.formatCurrency(totalAmount, AppState.currentCompany.baseCurrency)}</div>
          <div class="stat-label">Total Approved</div>
        </div>
      </div>
      
      <div class="content-card">
        <h3>Recent Expenses</h3>
        ${this.renderExpenseTable(expenses.slice(0, 5))}
      </div>
    `;
  },
  
  renderMyExpenses(container) {
    const expenses = ExpenseService.getMyExpenses();
    
    container.innerHTML = `
      <div class="view-header">
        <h1>My Expenses</h1>
        <button class="btn primary" onclick="UI.renderView('submit-expense')">
          + New Expense
        </button>
      </div>
      
      <div class="content-card">
        ${this.renderExpenseTable(expenses)}
      </div>
    `;
  },
  
  renderSubmitExpense(container) {
    const currencies = [...new Set(AppState.currencies.map(c => c.currency))].sort();
    
    container.innerHTML = `
      <div class="view-header">
        <h1>Submit New Expense</h1>
      </div>
      
      <div class="content-card" style="max-width: 600px;">
        <form id="expenseForm">
          <div class="form-group">
            <label>Amount *</label>
            <input type="number" id="expAmount" step="0.01" required>
          </div>
          
          <div class="form-group">
            <label>Currency *</label>
            <select id="expCurrency" required>
              <option value="${AppState.currentCompany.baseCurrency}">${AppState.currentCompany.baseCurrency} (Company Currency)</option>
              ${currencies.filter(c => c !== AppState.currentCompany.baseCurrency).map(c => 
                `<option value="${c}">${c}</option>`
              ).join('')}
            </select>
          </div>
          
          <div class="form-group">
            <label>Category *</label>
            <select id="expCategory" required>
              <option value="Meals">Meals</option>
              <option value="Transport">Transport</option>
              <option value="Accommodation">Accommodation</option>
              <option value="Office Supplies">Office Supplies</option>
              <option value="Entertainment">Entertainment</option>
              <option value="Other">Other</option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Date *</label>
            <input type="date" id="expDate" required value="${new Date().toISOString().split('T')[0]}">
          </div>
          
          <div class="form-group">
            <label>Merchant</label>
            <input type="text" id="expMerchant" placeholder="Restaurant, Hotel, etc.">
          </div>
          
          <div class="form-group">
            <label>Description *</label>
            <textarea id="expDescription" rows="3" required></textarea>
          </div>
          
          <div class="form-group">
            <label>Receipt (OCR Scan)</label>
            <input type="file" id="expReceipt" accept="image/*">
            <p class="muted-sm">Upload receipt to auto-fill fields using OCR</p>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="btn ghost" onclick="UI.renderView('my-expenses')">Cancel</button>
            <button type="submit" class="btn primary">Submit Expense</button>
          </div>
        </form>
      </div>
    `;
    
    // Handle OCR file upload
    document.getElementById('expReceipt').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        Utils.showLoader();
        try {
          const ocrData = await APIService.performOCR(file);
          document.getElementById('expAmount').value = ocrData.amount;
          document.getElementById('expDate').value = ocrData.date;
          document.getElementById('expCategory').value = ocrData.category;
          document.getElementById('expDescription').value = ocrData.description;
          document.getElementById('expMerchant').value = ocrData.merchant;
          Utils.showToast('Receipt scanned successfully!', 'success');
        } catch (error) {
          Utils.showToast('OCR failed: ' + error.message, 'error');
        } finally {
          Utils.hideLoader();
        }
      }
    });
    
    // Handle form submission
    document.getElementById('expenseForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const data = {
        amount: document.getElementById('expAmount').value,
        currency: document.getElementById('expCurrency').value,
        category: document.getElementById('expCategory').value,
        date: document.getElementById('expDate').value,
        merchant: document.getElementById('expMerchant').value,
        description: document.getElementById('expDescription').value
      };
      
      try {
        await ExpenseService.submitExpense(data);
        this.renderView('my-expenses');
      } catch (error) {
        console.error('Error submitting expense:', error);
      }
    });
  },
  
  renderApprovals(container) {
    const pendingApprovals = ExpenseService.getPendingApprovals();
    
    container.innerHTML = `
      <div class="view-header">
        <h1>Pending Approvals</h1>
        <span class="badge" style="font-size: 1.2rem;">${pendingApprovals.length}</span>
      </div>
      
      <div class="content-card">
        ${pendingApprovals.length === 0 ? 
          '<p class="muted center" style="padding: 40px;">No pending approvals</p>' :
          pendingApprovals.map(expense => this.renderExpenseCard(expense, true)).join('')
        }
      </div>
    `;
  },
  
  renderAllExpenses(container) {
    const expenses = ExpenseService.getAllExpenses();
    
    container.innerHTML = `
      <div class="view-header">
        <h1>All Expenses</h1>
        <div>
          <select id="filterStatus" style="padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb;">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>
      
      <div class="content-card" id="allExpensesContent">
        ${this.renderExpenseTable(expenses)}
      </div>
    `;
    
    document.getElementById('filterStatus').addEventListener('change', (e) => {
      const status = e.target.value;
      const filtered = status === 'all' ? 
        expenses : 
        expenses.filter(exp => exp.status === status);
      document.getElementById('allExpensesContent').innerHTML = this.renderExpenseTable(filtered);
    });
  },
  
  renderEmployees(container) {
    const employees = EmployeeService.getCompanyEmployees();
    
    container.innerHTML = `
      <div class="view-header">
        <h1>Employees</h1>
        <button class="btn primary" id="btnAddEmployee">+ Add Employee</button>
      </div>
      
      <div class="content-card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Manager</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(emp => {
              const manager = emp.managerId ? 
                AppState.employees.find(e => e.id === emp.managerId) : 
                null;
              return `
                <tr>
                  <td>${emp.employeeId || 'N/A'}</td>
                  <td>${emp.name}</td>
                  <td>${emp.email}</td>
                  <td><span class="badge">${emp.role}</span></td>
                  <td>${manager ? manager.name : '-'}</td>
                  <td>
                    <button class="btn btn-sm ghost" onclick="UI.editEmployee('${emp.id}')">Edit</button>
                    ${emp.role !== 'admin' ? 
                      `<button class="btn btn-sm ghost" onclick="UI.deleteEmployee('${emp.id}')">Delete</button>` : 
                      ''
                    }
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    document.getElementById('btnAddEmployee').addEventListener('click', () => {
      this.showEmployeeModal();
    });
  },
  
  renderApprovalRules(container) {
    const rules = ApprovalRuleService.getCompanyRules();
    
    container.innerHTML = `
      <div class="view-header">
        <h1>Approval Rules</h1>
        <button class="btn primary" id="btnAddRule">+ Add Rule</button>
      </div>
      
      <div class="content-card">
        ${rules.length === 0 ? 
          '<p class="muted center" style="padding: 40px;">No approval rules configured</p>' :
          rules.map(rule => `
            <div class="rule-card" style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                  <h3>${rule.name}</h3>
                  <p class="muted-sm">Sequence: ${rule.sequence} | Type: ${rule.type}</p>
                  <div style="margin-top: 12px;">
                    <strong>Approvers:</strong>
                    ${rule.approvers.map(a => `<span class="badge" style="margin: 4px;">${a.approverName}</span>`).join('')}
                  </div>
                  ${rule.condition ? `
                    <p class="muted-sm" style="margin-top: 8px;">
                      <strong>Condition:</strong> 
                      ${rule.condition.percentage ? `${rule.condition.percentage}% approval required` : ''}
                      ${rule.condition.specificApproverId ? `Specific approver: ${rule.approvers.find(a => a.approverId === rule.condition.specificApproverId)?.approverName}` : ''}
                    </p>
                  ` : ''}
                </div>
                <div>
                  <button class="btn btn-sm ghost" onclick="UI.editRule('${rule.id}')">Edit</button>
                  <button class="btn btn-sm ghost" onclick="UI.deleteRule('${rule.id}')">Delete</button>
                </div>
              </div>
            </div>
          `).join('')
        }
      </div>
    `;
    
    document.getElementById('btnAddRule').addEventListener('click', () => {
      this.showRuleModal();
    });
  },
  
  renderExpenseTable(expenses) {
    if (expenses.length === 0) {
      return '<p class="muted center" style="padding: 40px;">No expenses found</p>';
    }
    
    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Employee</th>
            <th>Category</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map(exp => `
            <tr>
              <td>${Utils.formatDate(exp.date)}</td>
              <td>${exp.employeeName}</td>
              <td>${exp.category}</td>
              <td>
                ${Utils.formatCurrency(exp.amount, exp.currency)}
                ${exp.currency !== AppState.currentCompany.baseCurrency ? 
                  `<br><span class="muted-sm">(${Utils.formatCurrency(exp.amountInBaseCurrency, AppState.currentCompany.baseCurrency)})</span>` : 
                  ''
                }
              </td>
              <td><span class="badge badge-${exp.status}">${exp.status}</span></td>
              <td>
                <button class="btn btn-sm ghost" onclick="UI.viewExpense('${exp.id}')">View</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },
  
  renderExpenseCard(expense, showActions = false) {
    return `
      <div class="expense-card" style="padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 16px;">
        <div style="display: flex; justify-content: space-between;">
          <div style="flex: 1;">
            <div style="display: flex; gap: 12px; align-items: start;">
              <div style="flex: 1;">
                <h3>${expense.category} - ${Utils.formatCurrency(expense.amountInBaseCurrency, AppState.currentCompany.baseCurrency)}</h3>
                <p class="muted-sm">${expense.employeeName} • ${Utils.formatDate(expense.date)}</p>
                <p style="margin-top: 8px;">${expense.description}</p>
                ${expense.merchant ? `<p class="muted-sm">Merchant: ${expense.merchant}</p>` : ''}
              </div>
              <span class="badge badge-${expense.status}">${expense.status}</span>
            </div>
            
            <div style="margin-top: 16px;">
              <strong>Approval Flow:</strong>
              <div style="margin-top: 8px;">
                ${expense.approvalFlow.map((step, idx) => `
                  <div style="padding: 8px; background: ${idx === expense.currentApproverIndex ? '#fef3c7' : step.status === 'approved' ? '#d1fae5' : '#f3f4f6'}; border-radius: 4px; margin-bottom: 8px;">
                    <strong>Step ${step.sequence}:</strong> 
                    ${step.approverName || step.ruleName}
                    ${step.status === 'approved' ? ' ✓' : step.status === 'rejected' ? ' ✗' : ' (Pending)'}
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
        
        ${showActions ? `
          <div style="margin-top: 16px; display: flex; gap: 12px;">
            <button class="btn primary" onclick="UI.approveExpense('${expense.id}')">Approve</button>
            <button class="btn ghost" onclick="UI.rejectExpense('${expense.id}')">Reject</button>
            <button class="btn ghost" onclick="UI.viewExpense('${expense.id}')">View Details</button>
          </div>
        ` : ''}
      </div>
    `;
  },
  
  viewExpense(expenseId) {
    const expense = AppState.expenses.find(e => e.id === expenseId);
    if (!expense) return;
    
    const modal = document.getElementById('genericModal');
    const content = document.getElementById('genericModalContent');
    
    content.innerHTML = this.renderExpenseCard(expense, false);
    
    document.getElementById('genericModalTitle').textContent = 'Expense Details';
    document.getElementById('genericModalMessage').textContent = '';
    document.getElementById('genericModalCancel').style.display = 'none';
    document.getElementById('genericModalConfirm').textContent = 'Close';
    
    modal.classList.add('show');
  },
  
  approveExpense(expenseId) {
    const comment = prompt('Add a comment (optional):');
    if (comment === null) return; // User cancelled
    
    try {
      ExpenseService.approveExpense(expenseId, comment);
      this.renderView('approvals');
    } catch (error) {
      Utils.showToast(error.message, 'error');
    }
  },
  
  rejectExpense(expenseId) {
    const comment = prompt('Reason for rejection (required):');
    if (!comment) {
      Utils.showToast('Rejection reason is required', 'error');
      return;
    }
    
    try {
      ExpenseService.rejectExpense(expenseId, comment);
      this.renderView('approvals');
    } catch (error) {
      Utils.showToast(error.message, 'error');
    }
  },
  
  showEmployeeModal(employeeId = null) {
    const employee = employeeId ? AppState.employees.find(e => e.id === employeeId) : null;
    const managers = EmployeeService.getManagers();
    
    const modal = document.getElementById('genericModal');
    const content = document.getElementById('genericModalContent');
    
    content.innerHTML = `
      <form id="employeeForm">
        <div class="form-group">
          <label>Employee ID *</label>
          <input type="text" id="empId" value="${employee?.employeeId || ''}" required>
        </div>
        
        <div class="form-group">
          <label>Full Name *</label>
          <input type="text" id="empName" value="${employee?.name || ''}" required>
        </div>
        
        <div class="form-group">
          <label>Email *</label>
          <input type="email" id="empEmail" value="${employee?.email || ''}" required>
        </div>
        
        <div class="form-group">
          <label>Password ${employee ? '(leave blank to keep current)' : '*'}</label>
          <input type="password" id="empPassword" ${employee ? '' : 'required'}>
        </div>
        
        <div class="form-group">
          <label>Role *</label>
          <select id="empRole" required>
            <option value="employee" ${employee?.role === 'employee' ? 'selected' : ''}>Employee</option>
            <option value="manager" ${employee?.role === 'manager' ? 'selected' : ''}>Manager</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Manager</label>
          <select id="empManager">
            <option value="">None</option>
            ${managers.filter(m => m.id !== employeeId).map(m => 
              `<option value="${m.id}" ${employee?.managerId === m.id ? 'selected' : ''}>${m.name}</option>`
            ).join('')}
          </select>
        </div>
        
        <div class="form-group">
          <label>
            <input type="checkbox" id="empIsManagerApprover" ${employee?.isManagerApprover ? 'checked' : ''}>
            Manager must approve expenses
          </label>
        </div>
      </form>
    `;
    
    document.getElementById('genericModalTitle').textContent = employee ? 'Edit Employee' : 'Add Employee';
    document.getElementById('genericModalMessage').textContent = '';
    document.getElementById('genericModalCancel').style.display = 'inline-block';
    document.getElementById('genericModalConfirm').textContent = 'Save';
    
    modal.classList.add('show');
    
    document.getElementById('genericModalConfirm').onclick = () => {
      const data = {
        employeeId: document.getElementById('empId').value,
        name: document.getElementById('empName').value,
        email: document.getElementById('empEmail').value,
        password: document.getElementById('empPassword').value,
        role: document.getElementById('empRole').value,
        managerId: document.getElementById('empManager').value || null,
        isManagerApprover: document.getElementById('empIsManagerApprover').checked
      };
      
      try {
        if (employee) {
          EmployeeService.updateEmployee(employeeId, data);
        } else {
          EmployeeService.createEmployee(data);
        }
        modal.classList.remove('show');
        this.renderView('employees');
      } catch (error) {
        Utils.showToast(error.message, 'error');
      }
    };
  },
  
  editEmployee(employeeId) {
    this.showEmployeeModal(employeeId);
  },
  
  deleteEmployee(employeeId) {
    if (confirm('Are you sure you want to delete this employee?')) {
      try {
        EmployeeService.deleteEmployee(employeeId);
        this.renderView('employees');
      } catch (error) {
        Utils.showToast(error.message, 'error');
      }
    }
  },
  
  showRuleModal(ruleId = null) {
    const rule = ruleId ? AppState.approvalRules.find(r => r.id === ruleId) : null;
    const employees = EmployeeService.getCompanyEmployees();
    
    const modal = document.getElementById('genericModal');
    const content = document.getElementById('genericModalContent');
    
    content.innerHTML = `
      <form id="ruleForm">
        <div class="form-group">
          <label>Rule Name *</label>
          <input type="text" id="ruleName" value="${rule?.name || ''}" required>
        </div>
        
        <div class="form-group">
          <label>Sequence *</label>
          <input type="number" id="ruleSequence" value="${rule?.sequence || 1}" required>
        </div>
        
        <div class="form-group">
          <label>Rule Type *</label>
          <select id="ruleType" required>
            <option value="sequential" ${rule?.type === 'sequential' ? 'selected' : ''}>Sequential (All must approve)</option>
            <option value="percentage" ${rule?.type === 'percentage' ? 'selected' : ''}>Percentage Based</option>
            <option value="specific" ${rule?.type === 'specific' ? 'selected' : ''}>Specific Approver</option>
            <option value="hybrid" ${rule?.type === 'hybrid' ? 'selected' : ''}>Hybrid (Percentage OR Specific)</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>Approvers *</label>
          <select id="ruleApprovers" multiple style="height: 120px;">
            ${employees.filter(e => e.role === 'manager' || e.role === 'admin').map(e => 
              `<option value="${e.id}" ${rule?.approvers?.some(a => a.approverId === e.id) ? 'selected' : ''}>${e.name}</option>`
            ).join('')}
          </select>
          <p class="muted-sm">Hold Ctrl/Cmd to select multiple</p>
        </div>
        
        <div id="percentageCondition" class="form-group" style="display: none;">
          <label>Approval Percentage *</label>
          <input type="number" id="rulePercentage" min="1" max="100" value="${rule?.condition?.percentage || 60}">
        </div>
        
        <div id="specificCondition" class="form-group" style="display: none;">
          <label>Specific Approver *</label>
          <select id="ruleSpecificApprover">
            <option value="">Select approver</option>
            ${employees.filter(e => e.role === 'manager' || e.role === 'admin').map(e => 
              `<option value="${e.id}" ${rule?.condition?.specificApproverId === e.id ? 'selected' : ''}>${e.name}</option>`
            ).join('')}
          </select>
        </div>
      </form>
    `;
    
    document.getElementById('genericModalTitle').textContent = rule ? 'Edit Approval Rule' : 'Add Approval Rule';
    document.getElementById('genericModalMessage').textContent = '';
    document.getElementById('genericModalCancel').style.display = 'inline-block';
    document.getElementById('genericModalConfirm').textContent = 'Save';
    
    modal.classList.add('show');
    
    // Show/hide conditional fields based on type
    const ruleTypeSelect = document.getElementById('ruleType');
    const updateConditionFields = () => {
      const type = ruleTypeSelect.value;
      document.getElementById('percentageCondition').style.display = 
        (type === 'percentage' || type === 'hybrid') ? 'block' : 'none';
      document.getElementById('specificCondition').style.display = 
        (type === 'specific' || type === 'hybrid') ? 'block' : 'none';
    };
    ruleTypeSelect.addEventListener('change', updateConditionFields);
    updateConditionFields();
    
    document.getElementById('genericModalConfirm').onclick = () => {
      const selectedApprovers = Array.from(document.getElementById('ruleApprovers').selectedOptions);
      const type = document.getElementById('ruleType').value;
      
      const data = {
        name: document.getElementById('ruleName').value,
        sequence: parseInt(document.getElementById('ruleSequence').value),
        type: type,
        approvers: selectedApprovers.map(opt => ({
          approverId: opt.value,
          approverName: opt.text
        })),
        condition: null
      };
      
      // Set condition based on type
      if (type === 'percentage') {
        data.condition = {
          percentage: parseInt(document.getElementById('rulePercentage').value)
        };
      } else if (type === 'specific') {
        data.condition = {
          specificApproverId: document.getElementById('ruleSpecificApprover').value
        };
      } else if (type === 'hybrid') {
        data.condition = {
          hybrid: true,
          percentage: parseInt(document.getElementById('rulePercentage').value),
          specificApproverId: document.getElementById('ruleSpecificApprover').value
        };
      }
      
      try {
        if (rule) {
          ApprovalRuleService.updateRule(ruleId, data);
        } else {
          ApprovalRuleService.createRule(data);
        }
        modal.classList.remove('show');
        this.renderView('approval-rules');
      } catch (error) {
        Utils.showToast(error.message, 'error');
      }
    };
  },
  
  editRule(ruleId) {
    this.showRuleModal(ruleId);
  },
  
  deleteRule(ruleId) {
    if (confirm('Are you sure you want to delete this approval rule?')) {
      try {
        ApprovalRuleService.deleteRule(ruleId);
        this.renderView('approval-rules');
      } catch (error) {
        Utils.showToast(error.message, 'error');
      }
    }
  },
  
  showLanding() {
    document.getElementById('landingPage').classList.remove('hidden');
    document.getElementById('appRoot').classList.add('hidden');
    document.getElementById('appRoot').innerHTML = '';
  },
  
  showApp() {
    document.getElementById('landingPage').classList.add('hidden');
    document.getElementById('appRoot').classList.remove('hidden');
    this.renderDashboard();
  }
};

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initializeApp() {
  // Load currencies
  Utils.showLoader();
  AppState.currencies = await APIService.fetchCountries();
  Utils.hideLoader();
  
  // Populate country dropdown
  const signupCountry = document.getElementById('signupCountry');
  if (signupCountry) {
    signupCountry.innerHTML = AppState.currencies.map(c => 
      `<option value="${c.name}">${c.name} (${c.currency})</option>`
    ).join('');
  }
  
  // Setup event listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Landing page buttons
  document.getElementById('btnSignIn').addEventListener('click', () => {
    document.getElementById('authModal').classList.add('show');
    document.getElementById('signinView').classList.remove('hidden');
    document.getElementById('signupView').classList.add('hidden');
  });
  
  document.getElementById('btnGetStarted').addEventListener('click', () => {
    document.getElementById('authModal').classList.add('show');
    document.getElementById('signupView').classList.remove('hidden');
    document.getElementById('signinView').classList.add('hidden');
  });
  
  document.getElementById('btnGetStarted2').addEventListener('click', () => {
    document.getElementById('authModal').classList.add('show');
    document.getElementById('signupView').classList.remove('hidden');
    document.getElementById('signinView').classList.add('hidden');
  });
  
  // Auth modal close
  document.getElementById('authClose').addEventListener('click', () => {
    document.getElementById('authModal').classList.remove('show');
  });
  
  // Toggle between signin and signup
  document.getElementById('showSignIn').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signinView').classList.remove('hidden');
    document.getElementById('signupView').classList.add('hidden');
  });
  
  document.getElementById('showSignUp').addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('signupView').classList.remove('hidden');
    document.getElementById('signinView').classList.add('hidden');
  });
  
  // Signin tabs
  document.getElementById('adminTabBtn').addEventListener('click', () => {
    document.getElementById('adminTabBtn').classList.add('active');
    document.getElementById('employeeTabBtn').classList.remove('active');
    document.getElementById('adminSigninView').classList.remove('hidden');
    document.getElementById('employeeSigninView').classList.add('hidden');
  });
  
  document.getElementById('employeeTabBtn').addEventListener('click', () => {
    document.getElementById('employeeTabBtn').classList.add('active');
    document.getElementById('adminTabBtn').classList.remove('active');
    document.getElementById('employeeSigninView').classList.remove('hidden');
    document.getElementById('adminSigninView').classList.add('hidden');
  });
  
  // Signup
  document.getElementById('doSignup').addEventListener('click', async () => {
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const companyName = document.getElementById('signupCompanyName').value;
    const country = document.getElementById('signupCountry').value;
    
    if (!name || !email || !password || !companyName || !country) {
      Utils.showToast('Please fill all fields', 'error');
      return;
    }
    
    try {
      await AuthService.signup(name, email, password, companyName, country);
      document.getElementById('authModal').classList.remove('show');
      UI.showApp();
    } catch (error) {
      console.error('Signup error:', error);
    }
  });
  
  // Signin
  document.getElementById('doSignin').addEventListener('click', async () => {
    const isAdmin = document.getElementById('adminTabBtn').classList.contains('active');
    
    try {
      if (isAdmin) {
        const email = document.getElementById('signinEmail').value;
        const password = document.getElementById('signinPassword').value;
        
        if (!email || !password) {
          Utils.showToast('Please fill all fields', 'error');
          return;
        }
        
        await AuthService.signin(email, password, true);
      } else {
        const companyName = document.getElementById('signinCompanyName').value;
        const empId = document.getElementById('signinEmpId').value;
        const password = document.getElementById('signinEmpPassword').value;
        
        if (!companyName || !empId || !password) {
          Utils.showToast('Please fill all fields', 'error');
          return;
        }
        
        await AuthService.signinEmployee(companyName, empId, password);
      }
      
      document.getElementById('authModal').classList.remove('show');
      UI.showApp();
    } catch (error) {
      console.error('Signin error:', error);
    }
  });
  
  // Generic modal
  document.getElementById('genericModalClose').addEventListener('click', () => {
    document.getElementById('genericModal').classList.remove('show');
  });
  
  document.getElementById('genericModalCancel').addEventListener('click', () => {
    document.getElementById('genericModal').classList.remove('show');
  });
  
  // Close modals on overlay click
  document.querySelectorAll('.overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('show');
      }
    });
  });
}

// Start the app
document.addEventListener('DOMContentLoaded', initializeApp);