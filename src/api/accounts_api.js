// Pay101 Accounts Portal API Client
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

class AccountsAPI {
  getToken() {
    return localStorage.getItem('accountsToken') || '';
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('accountsToken', token);
    } else {
      localStorage.removeItem('accountsToken');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  async handleResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      throw new Error(`Server returned status ${response.status}: ${text.slice(0, 100)}`);
    }

    if (!response.ok) {
      if (response.status === 401 && !window.location.pathname.includes('/login')) {
        this.setToken(null);
        window.location.href = '/login';
      }
      throw new Error(data.message || 'API request failed');
    }

    return data;
  }

  // --- AUTHENTICATION ---
  async login(email, password) {
    const response = await fetch(`${API_BASE}/accounts/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const res = await this.handleResponse(response);
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async verifyToken() {
    const token = this.getToken();
    if (!token) return { success: false };
    try {
      const response = await fetch(`${API_BASE}/accounts/auth/verify`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      return await this.handleResponse(response);
    } catch {
      this.setToken(null);
      return { success: false };
    }
  }

  logout() {
    this.setToken(null);
    localStorage.removeItem('accountsUser');
    window.location.href = '/login';
  }

  // --- MERCHANTS LEDGER ---
  async getMerchantsList() {
    const response = await fetch(`${API_BASE}/accounts/merchants/list`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return await this.handleResponse(response);
  }

  async getMerchantCommercials(merchantId, serviceType = 'PAYIN') {
    const response = await fetch(
      `${API_BASE}/accounts/merchants/commercials?merchant_id=${encodeURIComponent(merchantId)}&service_type=${serviceType}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );
    return await this.handleResponse(response);
  }

  async getMerchantLedger(params = {}) {
    const qs = new URLSearchParams();
    if (params.merchant_id) qs.append('merchant_id', params.merchant_id);
    if (params.service_type) qs.append('service_type', params.service_type);
    if (params.from_date) qs.append('from_date', params.from_date);
    if (params.to_date) qs.append('to_date', params.to_date);

    const response = await fetch(`${API_BASE}/accounts/merchants/ledger?${qs.toString()}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return await this.handleResponse(response);
  }

  // --- ACQUIRER LEDGER ---
  async getAcquirerRates(serviceType = 'PAYIN') {
    const response = await fetch(`${API_BASE}/accounts/acquirer/rates?service_type=${serviceType}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return await this.handleResponse(response);
  }

  async saveAcquirerRates(payload) {
    const response = await fetch(`${API_BASE}/accounts/acquirer/rates`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    return await this.handleResponse(response);
  }

  async getAcquirerLedger(params = {}) {
    const qs = new URLSearchParams();
    if (params.service_type) qs.append('service_type', params.service_type);
    if (params.from_date) qs.append('from_date', params.from_date);
    if (params.to_date) qs.append('to_date', params.to_date);
    if (params.api_id) qs.append('api_id', params.api_id);

    const response = await fetch(`${API_BASE}/accounts/acquirer/ledger?${qs.toString()}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return await this.handleResponse(response);
  }

  // --- REPORTS AUDIT & DOWNLOAD HISTORY ---
  async getReportsHistory(params = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.append('page', params.page);
    if (params.limit) qs.append('limit', params.limit);
    if (params.report_type) qs.append('report_type', params.report_type);
    if (params.service_type) qs.append('service_type', params.service_type);
    if (params.search) qs.append('search', params.search);

    const response = await fetch(`${API_BASE}/accounts/reports/history?${qs.toString()}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });
    return await this.handleResponse(response);
  }

  async logReport(payload) {
    try {
      const response = await fetch(`${API_BASE}/accounts/reports/log`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      });
      return await this.handleResponse(response);
    } catch (err) {
      console.warn('Could not log report to history:', err);
      return { success: false };
    }
  }

  async deleteReport(id) {
    const response = await fetch(`${API_BASE}/accounts/reports/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return await this.handleResponse(response);
  }
}

const accountsAPI = new AccountsAPI();
export default accountsAPI;
