import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

const taskStatusDot = {
  unassigned:  'bg-concrete-400',
  assigned:    'bg-primary-400',
  in_progress: 'bg-yellow-400',
  done:        'bg-green-500',
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

  const dotColor = taskStatusDot[order.taskStatus] || 'bg-concrete-400';
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
        className="bg-white rounded px-2 py-1.5 shadow-steel hover:shadow-steel-md transition-all hover:-translate-y-px group"
      >
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
            <span className="text-xs font-bold text-steel-800 truncate">
              {order.orderId}
            </span>
          </div>
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
      className="bg-steel-800 rounded-lg p-3 shadow-steel hover:shadow-steel-md transition-all hover:-translate-y-0.5 cursor-grab"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-px ${dotColor}`} />
          <span className="font-bold text-white text-xs tracking-wide">{order.orderId}</span>
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded bg-steel-700 text-steel-300 shrink-0 ml-auto">
          {order.status}
        </span>
      </div>

      {/* Task */}
      {order.task && (
        <p className="text-xs text-steel-300 mb-1.5 line-clamp-2 leading-tight">{order.task}</p>
      )}

      {/* Address */}
      {order.jobAddress && (
        <p className="text-xs text-concrete-400 truncate mb-2 leading-tight flex items-center gap-1">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          {order.jobAddress}
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
