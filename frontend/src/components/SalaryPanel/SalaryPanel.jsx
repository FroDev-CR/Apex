import { useState, useEffect } from 'react';
import { collaboratorsApi } from '../../api';
import toast from 'react-hot-toast';

/**
 * Format currency
 * @param {number} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format date for display
 * @param {string|Date} date
 * @returns {string}
 */
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * SalaryPanel component - Displays salary calculation for a collaborator
 * @param {Object} props
 * @param {Object} props.collaborator - Selected collaborator
 * @param {Date} props.startDate - Period start date
 * @param {Date} props.endDate - Period end date
 */
function SalaryPanel({ collaborator, startDate, endDate }) {
  const [salaryData, setSalaryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!collaborator || !startDate || !endDate) {
      setSalaryData(null);
      return;
    }

    const fetchSalary = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await collaboratorsApi.getSalary(
          collaborator._id,
          startDate.toISOString(),
          endDate.toISOString()
        );
        setSalaryData(data);
      } catch (err) {
        setError(err.message);
        toast.error(`Failed to load salary data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchSalary();
  }, [collaborator, startDate, endDate]);

  if (!collaborator) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <p className="text-gray-500 text-center">
          Select a collaborator to view salary details
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-center h-32">
          <div className="text-gray-500">Loading salary data...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-red-500 text-center">{error}</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold mr-3"
              style={{ backgroundColor: collaborator.color }}
            >
              {collaborator.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{collaborator.name}</h3>
              <p className="text-sm text-gray-500">{collaborator.email}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Hourly Rate</div>
            <div className="text-lg font-semibold text-gray-900">
              {formatCurrency(collaborator.hourlyRate || 0)}/hr
            </div>
          </div>
        </div>
      </div>

      {/* Period Summary */}
      {salaryData && (
        <>
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-sm text-gray-500">Period</div>
                <div className="font-medium text-gray-900">
                  {formatDate(salaryData.period.start)} - {formatDate(salaryData.period.end)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Orders Completed</div>
                <div className="font-medium text-gray-900">
                  {salaryData.ordersCompleted}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Total Salary</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(salaryData.salary?.total || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="p-6">
            <h4 className="font-semibold text-gray-900 mb-4">Order Breakdown</h4>

            {salaryData.orders?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-sm text-gray-500 border-b border-gray-200">
                      <th className="pb-3 font-medium">Order ID</th>
                      <th className="pb-3 font-medium">Customer</th>
                      <th className="pb-3 font-medium">Order Total</th>
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Payment</th>
                      <th className="pb-3 font-medium">Formula</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salaryData.orders.map((order, index) => {
                      const breakdown = salaryData.salary?.breakdown?.find(
                        b => b.orderId === order.orderId
                      );

                      return (
                        <tr
                          key={order._id}
                          className="border-b border-gray-100 last:border-b-0"
                        >
                          <td className="py-3 font-medium text-gray-900">
                            #{order.orderId}
                          </td>
                          <td className="py-3 text-gray-600">{order.customer}</td>
                          <td className="py-3 text-gray-600">
                            {formatCurrency(order.total)}
                          </td>
                          <td className="py-3 text-gray-600">
                            {formatDate(order.assignedDate)}
                          </td>
                          <td className="py-3 font-medium text-green-600">
                            {formatCurrency(breakdown?.amount || 0)}
                          </td>
                          <td className="py-3">
                            <span className="text-xs px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                              {breakdown?.formula || 'N/A'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                No completed orders in this period
              </p>
            )}
          </div>

          {/* Note about pending formulas */}
          {salaryData.salary?.total === 0 && salaryData.ordersCompleted > 0 && (
            <div className="px-6 pb-6">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Salary formulas are not yet configured.
                  Please update <code className="bg-yellow-100 px-1 rounded">salaryRules.js</code>{' '}
                  with your business rules.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default SalaryPanel;
