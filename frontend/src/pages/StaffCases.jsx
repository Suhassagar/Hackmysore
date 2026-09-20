import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  Briefcase,
  AlertCircle,
  Clock,
  MapPin,
  Building2,
  Filter,
  Search,
  RefreshCw,
  ChevronRight,
  UserCheck,
  PauseCircle,
  CheckCircle2,
} from 'lucide-react';

export const StaffCases = () => {
  const { token, user } = useAuth();
  const [cases, setCases] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'needs_attention' | 'my_cases'
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCases = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.getStaffCases(token, {
          page: targetPage,
          limit: 12,
          view: activeTab,
          status: statusFilter || undefined,
          assignedTo: activeTab === 'my_cases' ? user?.id : undefined,
          search: searchQuery.trim() || undefined,
        });

        if (res.ok && res.data) {
          setCases(res.data.items || []);
          setTotal(res.data.total || 0);
          setPage(res.data.page || 1);
          setTotalPages(res.data.totalPages || 1);
        } else {
          setError(res.data?.message || 'Failed to load operational cases.');
        }
      } catch (err) {
        setError(err.message || 'Error fetching cases.');
      } finally {
        setLoading(false);
      }
    },
    [token, user?.id, activeTab, statusFilter, searchQuery]
  );

  useEffect(() => {
    fetchCases(1);
  }, [fetchCases]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchCases(1);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'UNASSIGNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
            <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
            Unassigned
          </span>
        );
      case 'ASSIGNED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800">
            <UserCheck className="w-3.5 h-3.5 text-blue-500" />
            Assigned
          </span>
        );
      case 'ACKNOWLEDGED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300 dark:border-indigo-800">
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            Acknowledged
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800">
            <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin-slow" />
            In Progress
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-900/40 dark:text-purple-300 dark:border-purple-800">
            <PauseCircle className="w-3.5 h-3.5 text-purple-500" />
            On Hold
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Resolved
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-300 dark:bg-gray-800 dark:text-gray-300">
            Closed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-gray-200 dark:border-gray-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Staff Case Operations
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Operational civic work lifecycle, assignment, follow-through, and resolution tracking.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchCases(page)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mt-6 border-b border-gray-200 dark:border-gray-800">
        <nav className="flex space-x-8 -mb-px">
          <button
            onClick={() => {
              setActiveTab('active');
              setStatusFilter('');
            }}
            className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'active'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            Active Cases
          </button>

          <button
            onClick={() => {
              setActiveTab('needs_attention');
              setStatusFilter('');
            }}
            className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'needs_attention'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <AlertCircle className="w-4 h-4 text-amber-500" />
            Needs Attention
          </button>

          <button
            onClick={() => {
              setActiveTab('my_cases');
              setStatusFilter('');
            }}
            className={`pb-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors ${
              activeTab === 'my_cases'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <UserCheck className="w-4 h-4 text-indigo-500" />
            My Cases
          </button>
        </nav>

        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
          Total: {total}
        </span>
      </div>

      {/* Filters & Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <form onSubmit={handleSearchSubmit} className="relative md:col-span-2">
          <input
            type="text"
            placeholder="Search by Case Number (CIV-2026-...) or issue keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full py-2.5 px-3 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none dark:text-white"
          >
            <option value="">All Statuses</option>
            <option value="UNASSIGNED">Unassigned</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mt-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Case Grid */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-400">
          <RefreshCw className="w-8 h-8 animate-spin mb-3 text-blue-500" />
          <p className="text-sm">Loading staff case queue...</p>
        </div>
      ) : cases.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-2xl mt-6">
          <Briefcase className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            No operational cases found
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter
              ? 'No cases matched the current search criteria or status filter.'
              : activeTab === 'needs_attention'
              ? 'No unassigned or paused cases require immediate attention.'
              : activeTab === 'my_cases'
              ? 'You do not have any cases assigned to you currently.'
              : 'There are no active operational cases in this department queue.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          {cases.map((c) => (
            <div
              key={c.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                {/* Top header: Case number & Status */}
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="font-mono text-xs font-bold text-gray-900 dark:text-white px-2.5 py-1 bg-gray-100 dark:bg-gray-700/60 rounded-md border border-gray-200 dark:border-gray-600">
                    {c.case_number}
                  </span>
                  {getStatusBadge(c.status)}
                </div>

                {/* Category & Description */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                      {c.category || 'CIVIC ISSUE'}
                    </span>
                    {c.priority && (
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                        Priority: {c.priority}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                    {c.report_description || 'No report description available.'}
                  </p>
                </div>

                {/* Authority, Department, Jurisdiction */}
                <div className="space-y-1.5 text-xs text-gray-600 dark:text-gray-300 mb-4 bg-gray-50 dark:bg-gray-750 p-3 rounded-lg">
                  <div className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="font-semibold text-gray-700 dark:text-gray-200">
                      {c.authority_code || c.authority_name || 'MCC'}
                    </span>
                    <span className="text-gray-400">/</span>
                    <span className="truncate">{c.department_name || c.department_code || 'General'}</span>
                  </div>

                  {c.jurisdiction_name && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                      <span>{c.jurisdiction_name}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-gray-500">
                    <UserCheck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span>
                      {c.assigned_to_name ? (
                        <>Assigned: <strong className="text-gray-700 dark:text-gray-200">{c.assigned_to_name}</strong></>
                      ) : (
                        <em className="text-amber-600 dark:text-amber-400">Awaiting staff assignment</em>
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom footer: Timestamps & Action button */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div className="text-[11px] text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(c.created_at).toLocaleDateString()}</span>
                </div>

                <Link
                  to={`/staff/cases/${c.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 group"
                >
                  Manage Case
                  <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-800 mt-8 pt-4">
          <button
            onClick={() => fetchCases(page - 1)}
            disabled={page <= 1}
            className="px-3.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => fetchCases(page + 1)}
            disabled={page >= totalPages}
            className="px-3.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default StaffCases;
