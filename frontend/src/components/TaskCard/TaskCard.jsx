import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const taskStatusBorder = {
  unassigned:  'border-concrete-300',
  assigned:    'border-primary-400',
  in_progress: 'border-yellow-400',
  done:        'border-green-500',
};

function TaskCard({ order, compact = false, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: order._id,
    data: { order },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  };

  const handleClick = (e) => {
    if (!isDragging && onClick) {
      e.stopPropagation();
      onClick(order);
    }
  };

  const borderColor = taskStatusBorder[order.taskStatus] || 'border-concrete-300';
  const isNegative = (order.total || 0) < 0;
  const formattedTotal = order.total != null
    ? (isNegative ? `-$${Math.abs(order.total).toFixed(2)}` : `$${order.total.toFixed(2)}`)
    : '$0.00';

  /* ── Compact (dentro del calendario) ── */
  if (compact) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...listeners}
        {...attributes}
        onClick={handleClick}
        className={`bg-white rounded border-l-4 ${borderColor} px-2 py-1.5 shadow-steel hover:shadow-steel-md transition-all hover:-translate-y-px group`}
      >
        <div className="flex items-center justify-between gap-1">
          <span className="text-xs font-bold text-steel-800 truncate">
            {order.orderId}
          </span>
          <span className={`text-xs font-bold shrink-0 ${isNegative ? 'text-red-500' : 'text-green-700'}`}>
            {formattedTotal}
          </span>
        </div>
        {order.task && (
          <p className="text-xs text-steel-500 truncate mt-0.5 leading-tight">{order.task}</p>
        )}
        {order.jobAddress && (
          <p className="text-xs text-concrete-400 truncate leading-tight">{order.jobAddress}</p>
        )}
      </div>
    );
  }

  /* ── Full (sidebar de no asignados) ── */
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`bg-steel-800 rounded-lg border-l-4 ${borderColor} p-3 shadow-steel hover:shadow-steel-md transition-all hover:-translate-y-0.5 cursor-grab`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <span className="font-bold text-white text-xs tracking-wide">{order.orderId}</span>
        <span className="text-xs px-1.5 py-0.5 rounded bg-steel-700 text-steel-300 shrink-0">
          {order.status}
        </span>
      </div>

      {/* Task */}
      {order.task && (
        <p className="text-xs text-steel-300 mb-1.5 line-clamp-2 leading-tight">{order.task}</p>
      )}

      {/* Address */}
      {order.jobAddress && (
        <p className="text-xs text-concrete-400 truncate mb-2 leading-tight">
          📍 {order.jobAddress}
        </p>
      )}

      {/* Total */}
      <div className="flex items-center justify-between pt-1.5 border-t border-steel-700">
        <span className={`text-sm font-black ${isNegative ? 'text-red-400' : 'text-primary-400'}`}>
          {formattedTotal}
        </span>
        {order.products?.length > 0 && (
          <span className="text-xs text-steel-500">
            {order.products.length} línea{order.products.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export default TaskCard;
