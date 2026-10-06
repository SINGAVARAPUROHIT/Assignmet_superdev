export default function TaskTable({ tasks, loading, error, isFiltered }) {
  if (loading) {
    return <div className="state-message">Loading tasks...</div>;
  }

  if (error) {
    return (
      <div className="state-message error">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (!tasks || tasks.length === 0) {
    return (
      <div className="state-message">
        {isFiltered ? 'No tasks found matching your filter criteria.' : 'No tasks found.'}
      </div>
    );
  }

  const formatDate = (isoString) => {
    if (!isoString) return '\u2014';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <table className="task-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>Title & Description</th>
          <th>Status</th>
          <th>Priority</th>
          <th>Assignee</th>
          <th>Created</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((task) => (
          <tr key={task.id}>
            <td className="task-id">#{task.id}</td>
            <td>
              <div className="task-title">{task.title}</div>
              {task.description && <div className="task-desc">{task.description}</div>}
            </td>
            <td>
              <span className={`status-badge ${task.status ? task.status.toLowerCase() : ''}`}>
                {task.status ? task.status.replace('_', ' ') : '\u2014'}
              </span>
            </td>
            <td>
              <span className={`priority-tag ${task.priority ? task.priority.toLowerCase() : 'medium'}`}>
                {task.priority || 'MEDIUM'}
              </span>
            </td>
            <td>{task.assignee || '\u2014'}</td>
            <td className="task-date">{formatDate(task.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
