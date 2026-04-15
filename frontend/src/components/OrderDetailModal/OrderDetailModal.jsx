/**
 * Modal que muestra el detalle completo de una orden de Hyphen Supply Pro
 */
function OrderDetailModal({ order, onClose }) {
  if (!order) return null;

  const totalColor = order.total < 0 ? 'text-red-600' : 'text-green-700';
  const formattedTotal = order.total < 0
    ? `-$${Math.abs(order.total).toFixed(2)}`
    : `$${(order.total || 0).toFixed(2)}`;

  const taskStatusLabel = {
    unassigned: 'Unassigned',
    assigned:   'Assigned',
    in_progress: 'In Progress',
    done:       'Done',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{order.orderId}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{order.customer}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
              {order.status}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* Task */}
          {order.task && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Task</h3>
              <p className="text-gray-800">{order.task}</p>
            </div>
          )}

          {/* Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            {order.jobAddress && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Job Address</h3>
                <p className="text-gray-800 text-sm">📍 {order.jobAddress}</p>
              </div>
            )}
            {order.subdivision && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Subdivision / Phase</h3>
                <p className="text-gray-800 text-sm">{order.subdivision}</p>
              </div>
            )}
            {order.planElevation && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Plan / Elevation</h3>
                <p className="text-gray-800 text-sm">{order.planElevation}</p>
              </div>
            )}
            {order.lotBlock && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Lot / Block</h3>
                <p className="text-gray-800 text-sm">{order.lotBlock}</p>
              </div>
            )}
            {order.permitNumber && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Permit #</h3>
                <p className="text-gray-800 text-sm">{order.permitNumber}</p>
              </div>
            )}
            {order.supplierOrderNum && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Supplier Order #</h3>
                <p className="text-gray-800 text-sm">{order.supplierOrderNum}</p>
              </div>
            )}
            {order.orderType && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Order Type</h3>
                <p className="text-gray-800 text-sm">{order.orderType}</p>
              </div>
            )}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Task Status</h3>
              <p className="text-gray-800 text-sm">{taskStatusLabel[order.taskStatus] || order.taskStatus}</p>
            </div>
            {order.date && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Date</h3>
                <p className="text-gray-800 text-sm">
                  {new Date(order.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            )}
            {order.assignedTo && (
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Assigned To</h3>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: order.assignedTo.color }} />
                  <p className="text-gray-800 text-sm">{order.assignedTo.name}</p>
                </div>
              </div>
            )}
          </div>

          {/* Products Table */}
          {order.products?.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Line Items</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Description</th>
                      <th className="text-center px-3 py-2 text-gray-600 font-medium">Qty</th>
                      <th className="text-right px-3 py-2 text-gray-600 font-medium">Unit Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {order.products.map((product, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-800">
                          {product.name}
                          {product.sku && <span className="text-gray-400 ml-2 text-xs">{product.sku}</span>}
                        </td>
                        <td className="px-3 py-2 text-center text-gray-600">{product.qty}</td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {product.price < 0 ? `-$${Math.abs(product.price).toFixed(2)}` : `$${product.price.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex justify-end pt-2 border-t border-gray-200">
            <div className="text-right">
              <span className="text-sm text-gray-500 mr-3">Total</span>
              <span className={`text-2xl font-bold ${totalColor}`}>{formattedTotal}</span>
            </div>
          </div>

          {/* Link to original */}
          {order.rawUrl && (
            <div className="pt-1">
              <a
                href={order.rawUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                Ver en Supply Pro →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default OrderDetailModal;
