const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Perform an authenticated or public API request.
 */
export async function apiRequest(endpoint, options = {}) {
  const { token, ...customOptions } = options;

  const headers = {
    'Content-Type': 'application/json',
    ...(customOptions.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...customOptions,
    headers,
  });

  const contentType = response.headers.get('content-type');
  let data = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

export const api = {
  // Phase 0 Health Check
  getHealth: () => apiRequest('/health'),

  // Phase 1 Auth & Current User
  getCurrentUser: (token) => apiRequest('/users/me', { token }),

  syncRegister: (payload) =>
    apiRequest('/auth/register-sync', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  devLogin: (email) =>
    apiRequest('/auth/dev-login', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  // Phase 1 Role-Specific Access Tests
  testPublic: () => apiRequest('/auth/test/public'),
  testCitizen: (token) => apiRequest('/auth/test/citizen', { token }),
  testStaff: (token) => apiRequest('/auth/test/staff', { token }),
  testAdmin: (token) => apiRequest('/auth/test/admin', { token }),

  // Phase 2 Citizen Civic Reports
  createReport: (reportData, token) =>
    apiRequest('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
      token,
    }),

  getMyReports: (token) =>
    apiRequest('/reports/my', {
      method: 'GET',
      token,
    }),

  getReportById: (id, token) =>
    apiRequest(`/reports/${id}`, {
      method: 'GET',
      token,
    }),

  getReport: (id, token) =>
    apiRequest(`/reports/${id}`, {
      method: 'GET',
      token,
    }),

  // Phase 3 AI Issue Understanding
  getReportAnalysis: (id, token) =>
    apiRequest(`/reports/${id}/analysis`, {
      method: 'GET',
      token,
    }),

  triggerReportAnalysis: (id, token, forceReprocess = false) =>
    apiRequest(`/reports/${id}/analyze`, {
      method: 'POST',
      body: JSON.stringify({ forceReprocess }),
      token,
    }),

  // Phase 4 Geospatial + Dynamic Jurisdiction Engine
  getReportJurisdiction: (id, token) =>
    apiRequest(`/reports/${id}/jurisdiction`, {
      method: 'GET',
      token,
    }),

  resolveReportJurisdiction: (id, token) =>
    apiRequest(`/reports/${id}/jurisdiction/resolve`, {
      method: 'POST',
      token,
    }),

  resolveLocationJurisdiction: (latitude, longitude, timestamp) =>
    apiRequest('/jurisdictions/resolve', {
      method: 'POST',
      body: JSON.stringify({ latitude, longitude, timestamp }),
    }),

  // Phase 5 Dynamic Civic Responsibility Rule Engine
  getReportRouting: (id, token) =>
    apiRequest(`/reports/${id}/routing`, {
      method: 'GET',
      token,
    }),

  resolveReportRouting: (id, token) =>
    apiRequest(`/reports/${id}/routing/resolve`, {
      method: 'POST',
      token,
    }),

  previewRouting: (payload, token) =>
    apiRequest('/routing/resolve', {
      method: 'POST',
      body: JSON.stringify(payload),
      token,
    }),

  // Phase 6 Routing Confidence & Human Review System
  getReviewQueue: (token, { page = 1, limit = 20 } = {}) =>
    apiRequest(`/staff/routing-review?page=${page}&limit=${limit}`, {
      method: 'GET',
      token,
    }),

  submitRoutingReview: (id, payload, token) =>
    apiRequest(`/reports/${id}/routing-review`, {
      method: 'POST',
      body: JSON.stringify(payload),
      token,
    }),

  getReportRoutingReviews: (id, token) =>
    apiRequest(`/reports/${id}/routing-reviews`, {
      method: 'GET',
      token,
    }),

  getAuthorities: (token) =>
    apiRequest('/routing/authorities', {
      method: 'GET',
      token,
    }),

  getDepartments: (token, authorityId) =>
    apiRequest(`/routing/departments${authorityId ? `?authorityId=${authorityId}` : ''}`, {
      method: 'GET',
      token,
    }),

  // Phase 7 Staff Case Workflow + Follow-Through
  getReportCase: (id, token) =>
    apiRequest(`/reports/${id}/case`, {
      method: 'GET',
      token,
    }),

  getStaffCases: (token, { page = 1, limit = 20, view = 'active', status, authorityId, departmentId, assignedTo, search } = {}) => {
    const params = new URLSearchParams({ page, limit, view });
    if (status) params.append('status', status);
    if (authorityId) params.append('authorityId', authorityId);
    if (departmentId) params.append('departmentId', departmentId);
    if (assignedTo) params.append('assignedTo', assignedTo);
    if (search) params.append('search', search);
    return apiRequest(`/staff/cases?${params.toString()}`, {
      method: 'GET',
      token,
    });
  },

  getCaseById: (id, token) =>
    apiRequest(`/staff/cases/${id}`, {
      method: 'GET',
      token,
    }),

  updateCaseStatus: (id, payload, token) =>
    apiRequest(`/staff/cases/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      token,
    }),

  assignCase: (id, payload, token) =>
    apiRequest(`/staff/cases/${id}/assignment`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
      token,
    }),

  addCaseNote: (id, payload, token) =>
    apiRequest(`/staff/cases/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify(payload),
      token,
    }),

  getStaffUsers: (token) =>
    apiRequest('/staff/users', {
      method: 'GET',
      token,
    }),
};

