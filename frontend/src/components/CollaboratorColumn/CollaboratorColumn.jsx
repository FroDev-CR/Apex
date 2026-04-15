import { useDroppable } from '@dnd-kit/core';
import TaskCard from '../TaskCard/TaskCard';

function CollaboratorColumn({ collaborator, date, orders = [], onOrderClick }) {
  const droppableId = `${collaborator._id}-${date.toISOString().split('T')[0]}`;

  const { isOver, setNodeRef } = useDroppable({
    id: droppableId,
    data: { collaboratorId: collaborator._id, date: date.toISOString() },
  });

  return (
    <div
      ref={setNodeRef}
      className={`h-full min-h-[80px] rounded transition-all ${
        isOver
          ? 'bg-primary-50 ring-2 ring-primary-400 ring-inset'
          : 'bg-transparent hover:bg-concrete-100'
      }`}
    >
      <div className="space-y-1.5 p-0.5">
        {orders.map(order => (
          <TaskCard key={order._id} order={order} compact onClick={onOrderClick} />
        ))}
      </div>

      {orders.length === 0 && (
        <div className={`flex items-center justify-center h-full min-h-[70px] text-xs font-semibold uppercase tracking-widest transition-colors ${
          isOver ? 'text-primary-500' : 'text-concrete-300'
        }`}>
          {isOver ? '⬇ Soltar' : '+'}
        </div>
      )}
    </div>
  );
}

export default CollaboratorColumn;
