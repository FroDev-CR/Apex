import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { collaboratorsApi } from '../api';
import SalaryPanel from '../components/SalaryPanel/SalaryPanel';

/**
 * Get start and end of current month
 */
function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
}

/**
 * Format date for input[type="date"] using local timezone components.
 * Avoids the toISOString().slice() bug in evening hours where UTC rolls forward.
 */
function formatDateForInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

function SalaryPage() {
  const [collaborators, setCollaborators] = useState([]);
  const [selectedCollaborator, setSelectedCollaborator] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState(() => {
    const { start, end } = getCurrentMonthRange();
    return {
      start: formatDateForInput(start),
      end: formatDateForInput(end),
    };
  });

  const fetchCollaborators = async () => {
    setLoading(true);
    try {
      const data = await collaboratorsApi.list({ active: true });
      setCollaborators(data);
      if (data.length > 0 && !selectedCollaborator) {
        setSelectedCollaborator(data[0]);
      }
    } catch (error) {
      toast.error(`Failed to load team members: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCollaborators();
  }, []);

  const handleCollaboratorSelect = (collaboratorId) => {
    const collaborator = collaborators.find(c => c._id === collaboratorId);
    setSelectedCollaborator(collaborator || null);
  };

  const handleDateChange = (field, value) => {
    setDateRange(prev => ({ ...prev, [field]: value }));
  };

  const setThisMonth = () => {
    const { start, end } = getCurrentMonthRange();
    setDateRange({
      start: formatDateForInput(start),
      end: formatDateForInput(end),
    });
  };

  const setLastMonth = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    setDateRange({
      start: formatDateForInput(start),
      end: formatDateForInput(end),
    });
  };

  const setThisWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const start = new Date(now);
    start.setDate(now.getDate() - dayOfWeek + 1); // Monday
    const end = new Date(start);
    end.setDate(start.getDate() + 6); // Sunday
    setDateRange({
      start: formatDateForInput(start),
      end: formatDateForInput(end),
    });
  };

  return (
    <div>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Salary</h1>
          <p className="text-gray-500 mt-1">
            View salary calculations for team members
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Collaborator Select */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Team Member
            </label>
            <select
              value={selectedCollaborator?._id || ''}
              onChange={(e) => handleCollaboratorSelect(e.target.value)}
              disabled={loading}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-w-[200px]"
            >
              <option value="">Select a team member</option>
              {collaborators.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={dateRange.start}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={dateRange.end}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Quick Date Selectors */}
          <div className="flex gap-2">
            <button
              onClick={setThisWeek}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              This Week
            </button>
            <button
              onClick={setThisMonth}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              This Month
            </button>
            <button
              onClick={setLastMonth}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Last Month
            </button>
          </div>
        </div>
      </div>

      {/* Salary Panel */}
      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-sm">
          <div className="text-gray-500">Loading...</div>
        </div>
      ) : (
        <SalaryPanel
          collaborator={selectedCollaborator}
          startDate={new Date(dateRange.start)}
          endDate={new Date(dateRange.end)}
        />
      )}

      {/* Info Notice */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex">
          <svg className="w-5 h-5 text-blue-500 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="text-sm font-medium text-blue-800">Salary Formulas Not Configured</h4>
            <p className="text-sm text-blue-700 mt-1">
              Salary calculations are currently showing $0.00 because the formulas are not yet implemented.
              To configure salary rules, edit the <code className="bg-blue-100 px-1 rounded">backend/src/salary/salaryRules.js</code> file
              and implement your business logic for calculating payments.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SalaryPage;
