import React, { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { taskService, TaskType } from '../../services/taskService';
import { userService } from '../../services/userService';
import { Calendar, Clock, PlusCircle, X, AlignLeft, User as UserIcon } from 'lucide-react';

const COLUMNS = [
  { id: 'TODO', title: 'Cần làm', color: '#f1f5f9' },
  { id: 'IN_PROGRESS', title: 'Đang làm', color: '#fef9c3' },
  { id: 'REVIEW', title: 'Thảo luận', color: '#e0f2fe' },
  { id: 'DONE', title: 'Hoàn thành', color: '#dcfce7' },
];

const KanbanPage: React.FC = () => {
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  
  // --- STATE CHO MODAL ---
  const [selectedTask, setSelectedTask] = useState<TaskType | null>(null);

  // Form State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('MEDIUM');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [taskRes, userRes] = await Promise.all([
        taskService.getAll(),
        userService.getAllStaff()
      ]);
      setTasks(taskRes.data);
      setStaffList(userRes.data);
    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;

    try {
      const res = await taskService.create({
        title: newTaskTitle,
        description: newTaskDesc,
        status: 'TODO',
        priority: priority as any,
        dueDate: dueDate || undefined,
        assigneeId: assigneeId || undefined
      });
      
      const selectedUser = staffList.find(u => u.id === assigneeId);
      
      // --- FIX LỖI TYPE: Dùng undefined thay vì null ---
      const taskWithFullInfo: TaskType = {
        ...res.data,
        assignee: selectedUser ? { _id: selectedUser.id, name: selectedUser.name } : undefined
      };

      setTasks([taskWithFullInfo, ...tasks]);
      
      setNewTaskTitle('');
      setNewTaskDesc('');
      setAssigneeId('');
      setDueDate('');
    } catch (error) {
      alert('Lỗi tạo task');
    }
  };

  const handleDelete = async (id: string) => {
    if(window.confirm('Xóa task này?')) {
        try {
            await taskService.delete(id);
            setTasks(prev => prev.filter(t => t._id !== id));
            setSelectedTask(null); // Đóng modal nếu đang mở task đó
        } catch (e) { alert('Lỗi xóa task'); }
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    if (source.droppableId !== destination.droppableId) {
        const newStatus = destination.droppableId;
        
        setTasks(prev => prev.map(t => 
            t._id === draggableId ? { ...t, status: newStatus as any } : t
        ));

        // Cập nhật luôn trạng thái trong Modal nếu đang mở
        if (selectedTask && selectedTask._id === draggableId) {
            setSelectedTask(prev => prev ? { ...prev, status: newStatus as any } : null);
        }

        try {
            await taskService.updateStatus(draggableId, newStatus);
        } catch (error) {
            console.error("Lỗi update status");
            fetchData();
        }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  const isOverdue = (dateString?: string) => {
    if (!dateString) return false;
    return new Date(dateString) < new Date() && new Date(dateString).toDateString() !== new Date().toDateString();
  };

  return (
    <div className="p-6 h-full flex flex-col max-h-screen overflow-hidden relative">
      
      {/* --- MODAL CHI TIẾT (POPUP) --- */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setSelectedTask(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                {/* Header Modal */}
                <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50">
                    <div>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded border uppercase tracking-wider ${
                            selectedTask.priority === 'HIGH' ? 'bg-red-50 text-red-600 border-red-100' : 
                            selectedTask.priority === 'MEDIUM' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-green-50 text-green-600 border-green-100'
                        }`}>
                            {selectedTask.priority} Priority
                        </span>
                        <h2 className="text-xl font-bold text-slate-800 mt-2">{selectedTask.title}</h2>
                    </div>
                    <button onClick={() => setSelectedTask(null)} className="p-1 hover:bg-slate-200 rounded-full transition">
                        <X className="w-6 h-6 text-slate-500" />
                    </button>
                </div>

                {/* Body Modal */}
                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    <div className="flex flex-wrap gap-4">
                        <div className="flex-1 min-w-[120px] bg-slate-50 p-3 rounded-lg border border-slate-100">
                             <p className="text-xs text-slate-400 font-bold uppercase mb-1">Trạng thái</p>
                             <p className="font-semibold text-slate-700">{COLUMNS.find(c => c.id === selectedTask.status)?.title}</p>
                        </div>
                        <div className="flex-1 min-w-[120px] bg-slate-50 p-3 rounded-lg border border-slate-100">
                             <p className="text-xs text-slate-400 font-bold uppercase mb-1">Hạn chót</p>
                             <div className="flex items-center gap-2 font-semibold text-slate-700">
                                <Calendar className="w-4 h-4"/> 
                                {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString('vi-VN') : 'Không có'}
                             </div>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                            <UserIcon className="w-4 h-4 text-blue-600"/> Người thực hiện
                        </p>
                        <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl bg-white">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-600 text-lg">
                                {selectedTask.assignee?.name ? selectedTask.assignee.name.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div>
                                <p className="font-bold text-slate-800">{selectedTask.assignee?.name || 'Chưa giao'}</p>
                                <p className="text-xs text-slate-500">ID: {selectedTask.assignee?._id || 'N/A'}</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <p className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                            <AlignLeft className="w-4 h-4 text-blue-600"/> Mô tả chi tiết
                        </p>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                            {selectedTask.description || <span className="text-slate-400 italic">Không có mô tả nào...</span>}
                        </div>
                    </div>
                </div>

                {/* Footer Modal */}
                <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button 
                        onClick={() => handleDelete(selectedTask._id)} 
                        className="px-4 py-2 text-red-600 font-bold hover:bg-red-50 rounded-lg transition text-sm"
                    >
                        Xóa Task
                    </button>
                    <button 
                        onClick={() => setSelectedTask(null)} 
                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition text-sm"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* --- TITLE --- */}
      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-blue-600"/> Quản lý Công Việc & Tiến Độ
        </h1>
      </div>

      {/* --- FORM TẠO TASK MỚI (GIỮ NGUYÊN FORM CŨ) --- */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex-shrink-0">
        <h3 className="font-bold text-slate-700 mb-3 text-sm uppercase">Tạo việc mới</h3>
        <form onSubmit={handleCreateTask} className="flex flex-col gap-4">
            <div className="flex gap-3">
                <input 
                    type="text" 
                    placeholder="Tên công việc cần làm..." 
                    className="flex-1 p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} required
                />
                <select className="p-2 border border-slate-300 rounded-lg bg-slate-50 font-medium text-sm" value={priority} onChange={e => setPriority(e.target.value)}>
                    <option value="LOW">Thấp</option>
                    <option value="MEDIUM">Vừa</option>
                    <option value="HIGH">Cao</option>
                </select>
            </div>
            <textarea 
                placeholder="Mô tả chi tiết (nếu có)..." 
                className="p-2 border border-slate-300 rounded-lg text-sm h-16 resize-none focus:ring-2 focus:ring-blue-500 outline-none"
                value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)}
            />
            <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Giao cho ai?</label>
                    <select className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={assigneeId} onChange={e => setAssigneeId(e.target.value)}>
                        <option value="">-- Chưa chỉ định --</option>
                        {/* --- FIX LỖI: Sửa user.role thành u.role --- */}
                        {staffList.map(u => (
                            <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                        ))}
                    </select>
                </div>
                <div className="w-[160px]">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Hạn chót</label>
                    <input type="date" className="w-full p-2 border border-slate-300 rounded-lg text-sm" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                </div>
                <button type="submit" className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition shadow-md">
                    + Thêm Task
                </button>
            </div>
        </form>
      </div>

      {/* --- KANBAN BOARD --- */}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 flex-1 h-full">
          {COLUMNS.map(col => {
             const columnTasks = tasks.filter(t => t.status === col.id);

             return (
              <div key={col.id} className="flex-1 min-w-[300px] flex flex-col rounded-xl h-full" style={{ backgroundColor: col.color }}>
                <div className="p-3 border-b border-black/5 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 text-sm uppercase">{col.title}</h3>
                    <span className="bg-white px-2 py-0.5 rounded-full text-xs font-bold text-slate-500 shadow-sm">
                        {columnTasks.length}
                    </span>
                </div>

                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      {...provided.droppableProps}
                      ref={provided.innerRef}
                      className={`p-2 flex-1 overflow-y-auto transition-colors ${
                        snapshot.isDraggingOver ? 'bg-black/5' : ''
                      }`}
                      style={{ minHeight: '150px' }}
                    >
                      {columnTasks.map((task, index) => (
                        <Draggable key={task._id} draggableId={task._id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              // --- THÊM: Click để mở Modal ---
                              onClick={() => setSelectedTask(task)}
                              // -------------------------------
                              className={`bg-white p-3 mb-3 rounded-lg shadow-sm border border-slate-100 relative group cursor-pointer
                                ${snapshot.isDragging ? 'shadow-xl rotate-2 ring-2 ring-blue-400 z-50' : 'hover:shadow-md hover:-translate-y-1 transition-all'}
                              `}
                              style={{ ...provided.draggableProps.style }}
                            >
                                <div className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${
                                    task.priority === 'HIGH' ? 'bg-red-500' : 
                                    task.priority === 'MEDIUM' ? 'bg-blue-400' : 'bg-green-400'
                                }`}></div>

                                <div className="pl-3">
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{task.title}</h4>
                                        <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); // Chặn sự kiện để không mở modal khi bấm xóa
                                                handleDelete(task._id); 
                                            }}
                                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            title="Xóa task"
                                        >✕</button>
                                    </div>
                                    
                                    {task.description && <p className="text-xs text-slate-500 mt-1 truncate">{task.description}</p>}

                                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-50">
                                        <div className="flex items-center gap-1.5" title="Người thực hiện">
                                            <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                                                {task.assignee?.name ? task.assignee.name.charAt(0).toUpperCase() : '?'}
                                            </div>
                                            <span className="text-xs text-slate-500 font-medium truncate max-w-[80px]">
                                                {task.assignee?.name || 'Chưa giao'}
                                            </span>
                                        </div>

                                        {task.dueDate && (
                                            <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded ${
                                                isOverdue(task.dueDate) && task.status !== 'DONE' 
                                                ? 'bg-red-100 text-red-600' 
                                                : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                <Clock className="w-3 h-3" />
                                                {formatDate(task.dueDate)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
             );
          })}
        </div>
      </DragDropContext>
    </div>
  );
};

export default KanbanPage;