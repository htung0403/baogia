import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { pipelineApi } from '@/api/client';
import { X, Plus, Edit2, Trash2, GripVertical } from 'lucide-react';
import type { PipelineColumn, PipelineStage } from '@/types';
import { useToast } from '@/components/ui/toast';

const COLORS = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
  { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
  { value: 'teal', label: 'Teal', class: 'bg-teal-500' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'yellow', label: 'Yellow', class: 'bg-yellow-400' },
  { value: 'slate', label: 'Slate', class: 'bg-slate-500' },
  { value: 'emerald', label: 'Emerald', class: 'bg-emerald-500' },
];

export default function PipelineSettingsModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [confirmDelete, setConfirmDelete] = useState<{
    kind: 'column' | 'stage';
    id: string;
    name: string;
  } | null>(null);
  const [messageDialog, setMessageDialog] = useState<string | null>(null);
  const [draggingColumnId, setDraggingColumnId] = useState<string | null>(null);
  const [draggingStage, setDraggingStage] = useState<{ stageId: string; columnId: string } | null>(null);

  const { data: boardRes, isLoading } = useQuery({
    queryKey: ['pipeline-board'],
    queryFn: () => pipelineApi.getBoard(),
  });
  
  const columns: PipelineColumn[] = boardRes?.data?.data?.columns ?? [];

  const deleteColumnMut = useMutation({
    mutationFn: (id: string) => pipelineApi.deleteColumn(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['pipeline-board'] });
      const previousBoard = queryClient.getQueryData(['pipeline-board']);

      queryClient.setQueryData(['pipeline-board'], (old: any) => {
        const oldColumns = old?.data?.data?.columns;
        if (!Array.isArray(oldColumns)) return old;
        return {
          ...old,
          data: {
            ...old.data,
            data: {
              ...old.data.data,
              columns: oldColumns.filter((col: PipelineColumn) => col.id !== id),
            },
          },
        };
      });

      return { previousBoard };
    },
    onError: (err: any, _id, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(['pipeline-board'], context.previousBoard);
      }
      setMessageDialog(err?.response?.data?.message || 'Lỗi khi xóa cột');
      toast.error('Không thể xóa cột', err?.response?.data?.message || 'Vui lòng thử lại');
    },
    onSuccess: () => toast.success('Đã xóa cột'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['pipeline-board'] }),
  });

  const deleteStageMut = useMutation({
    mutationFn: (id: string) => pipelineApi.deleteStage(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: ['pipeline-board'] });
      const previousBoard = queryClient.getQueryData(['pipeline-board']);

      queryClient.setQueryData(['pipeline-board'], (old: any) => {
        const oldColumns = old?.data?.data?.columns;
        if (!Array.isArray(oldColumns)) return old;
        return {
          ...old,
          data: {
            ...old.data,
            data: {
              ...old.data.data,
              columns: oldColumns.map((col: PipelineColumn) => ({
                ...col,
                stages: (col.stages || []).filter((stage: PipelineStage) => stage.id !== id),
              })),
            },
          },
        };
      });

      return { previousBoard };
    },
    onError: (err: any, _id, context) => {
      if (context?.previousBoard) {
        queryClient.setQueryData(['pipeline-board'], context.previousBoard);
      }
      setMessageDialog(err?.response?.data?.message || 'Lỗi khi xóa stage');
      toast.error('Không thể xóa stage', err?.response?.data?.message || 'Vui lòng thử lại');
    },
    onSuccess: () => toast.success('Đã xóa stage'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['pipeline-board'] }),
  });

  const [editingColumn, setEditingColumn] = useState<Partial<PipelineColumn> | null>(null);
  const [editingStage, setEditingStage] = useState<Partial<PipelineStage> | null>(null);

  const reorderColumnsMut = useMutation({
    mutationFn: (orderedColumns: PipelineColumn[]) =>
      Promise.all(
        orderedColumns.map((col, index) =>
          pipelineApi.updateColumn(col.id, { sort_order: index + 1 })
        )
      ),
    onError: (err: any) => {
      setMessageDialog(err?.response?.data?.message || 'Lỗi khi cập nhật thứ tự cột');
      toast.error('Không thể cập nhật thứ tự cột', err?.response?.data?.message || 'Vui lòng thử lại');
    },
    onSuccess: () => toast.success('Đã cập nhật thứ tự cột'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['pipeline-board'] }),
  });

  const reorderStagesMut = useMutation({
    mutationFn: ({ stages }: { stages: PipelineStage[] }) =>
      Promise.all(
        stages.map((stage, index) =>
          pipelineApi.updateStage(stage.id, { sort_order: index + 1 })
        )
      ),
    onError: (err: any) => {
      setMessageDialog(err?.response?.data?.message || 'Lỗi khi cập nhật thứ tự stage');
      toast.error('Không thể cập nhật thứ tự stage', err?.response?.data?.message || 'Vui lòng thử lại');
    },
    onSuccess: () => toast.success('Đã cập nhật thứ tự stage'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['pipeline-board'] }),
  });

  const handleDeleteColumn = (id: string, name: string) => {
    setConfirmDelete({ kind: 'column', id, name });
  };

  const handleDeleteStage = (id: string, name: string) => {
    setConfirmDelete({ kind: 'stage', id, name });
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.kind === 'column') {
      deleteColumnMut.mutate(confirmDelete.id);
    } else {
      deleteStageMut.mutate(confirmDelete.id);
    }
    setConfirmDelete(null);
  };

  const reorderById = <T extends { id: string }>(items: T[], sourceId: string, targetId: string): T[] => {
    const sourceIndex = items.findIndex((item) => item.id === sourceId);
    const targetIndex = items.findIndex((item) => item.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items;

    const next = [...items];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    return next;
  };

  const handleColumnDrop = (targetColumnId: string) => {
    if (!draggingColumnId || draggingColumnId === targetColumnId) return;

    const previousBoard = queryClient.getQueryData(['pipeline-board']);
    let reorderedColumns: PipelineColumn[] = [];

    queryClient.setQueryData(['pipeline-board'], (old: any) => {
      const oldColumns = old?.data?.data?.columns;
      if (!Array.isArray(oldColumns)) return old;

      reorderedColumns = reorderById(oldColumns, draggingColumnId, targetColumnId).map(
        (col: PipelineColumn, index) => ({ ...col, sort_order: index + 1 })
      );

      return {
        ...old,
        data: {
          ...old.data,
          data: {
            ...old.data.data,
            columns: reorderedColumns,
          },
        },
      };
    });

    if (reorderedColumns.length > 0) {
      reorderColumnsMut.mutate(reorderedColumns, {
        onError: () => {
          if (previousBoard) queryClient.setQueryData(['pipeline-board'], previousBoard);
        },
      });
    }

    setDraggingColumnId(null);
  };

  const handleStageDrop = (columnId: string, targetStageId: string) => {
    if (!draggingStage) return;
    if (draggingStage.columnId !== columnId || draggingStage.stageId === targetStageId) return;

    const previousBoard = queryClient.getQueryData(['pipeline-board']);
    let reorderedStages: PipelineStage[] = [];

    queryClient.setQueryData(['pipeline-board'], (old: any) => {
      const oldColumns = old?.data?.data?.columns;
      if (!Array.isArray(oldColumns)) return old;

      const nextColumns = oldColumns.map((col: PipelineColumn) => {
        if (col.id !== columnId) return col;

        reorderedStages = reorderById(col.stages || [], draggingStage.stageId, targetStageId).map(
          (stage: PipelineStage, index) => ({ ...stage, sort_order: index + 1 })
        );
        return { ...col, stages: reorderedStages };
      });

      return {
        ...old,
        data: {
          ...old.data,
          data: {
            ...old.data.data,
            columns: nextColumns,
          },
        },
      };
    });

    if (reorderedStages.length > 0) {
      reorderStagesMut.mutate(
        { stages: reorderedStages },
        {
          onError: () => {
            if (previousBoard) queryClient.setQueryData(['pipeline-board'], previousBoard);
          },
        }
      );
    }

    setDraggingStage(null);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 shrink-0">
          <h2 className="text-[16px] font-bold text-slate-800">Cấu hình Pipeline</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {isLoading ? (
            <div className="text-center py-10 text-slate-400">Đang tải...</div>
          ) : (
            <div className="space-y-6">
              {/* Header actions */}
              <div className="flex justify-end">
                <button
                  onClick={() => setEditingColumn({ name: '', color: 'blue', sort_order: columns.length + 1 })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 text-[13px] font-bold rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Thêm cột mới
                </button>
              </div>

              {/* Columns List */}
              {columns.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-xl text-slate-500">
                  Chưa có cột nào. Hãy thêm cột đầu tiên.
                </div>
              ) : (
                <div className="space-y-4">
                  {columns.map(col => (
                    <div
                      key={col.id}
                      draggable
                      onDragStart={() => setDraggingColumnId(col.id)}
                      onDragEnd={() => setDraggingColumnId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleColumnDrop(col.id)}
                      className={`border border-slate-200 rounded-xl overflow-hidden bg-slate-50 transition-all ${draggingColumnId === col.id ? 'opacity-60' : ''}`}
                    >
                      {/* Column Header */}
                      <div className="bg-white px-4 py-3 flex items-center justify-between border-b border-slate-200">
                        <div className="flex items-center gap-3">
                          <GripVertical className="w-4 h-4 text-slate-300" />
                          <div className={`w-3 h-3 rounded-full ${COLORS.find(c => c.value === col.color)?.class || 'bg-slate-400'}`} />
                          <h3 className="font-bold text-slate-800 text-[14px]">{col.name}</h3>
                          <span className="text-[12px] text-slate-400">Thứ tự: {col.sort_order}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingColumn(col)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Sửa cột"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteColumn(col.id, col.name)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa cột"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Stages List */}
                      <div className="p-4 space-y-2">
                        {col.stages.map(stage => (
                          <div
                            key={stage.id}
                            draggable
                            onDragStart={() => setDraggingStage({ stageId: stage.id, columnId: col.id })}
                            onDragEnd={() => setDraggingStage(null)}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={() => handleStageDrop(col.id, stage.id)}
                            className={`flex items-center justify-between bg-white border border-slate-200 p-3 rounded-lg shadow-sm hover:border-indigo-300 transition-colors ${draggingStage?.stageId === stage.id ? 'opacity-60' : ''}`}
                          >
                            <div className="flex items-center gap-3">
                              <GripVertical className="w-4 h-4 text-slate-300" />
                              <div className={`w-2.5 h-2.5 rounded-full ${COLORS.find(c => c.value === stage.color)?.class || 'bg-slate-400'}`} />
                              <div>
                                <p className="text-[13px] font-bold text-slate-700">{stage.name}</p>
                                {stage.description && <p className="text-[11px] text-slate-500 mt-0.5">{stage.description}</p>}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                Thứ tự: {stage.sort_order}
                              </span>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => setEditingStage(stage)}
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                  title="Sửa stage"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteStage(stage.id, stage.name)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Xóa stage"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}

                        <button
                          onClick={() => setEditingStage({ column_id: col.id, name: '', color: col.color, sort_order: col.stages.length + 1 })}
                          className="w-full mt-2 flex items-center justify-center gap-1.5 py-2 border border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 rounded-lg text-[13px] font-medium transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                          Thêm stage
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {editingColumn && (
        <ColumnFormModal
          column={editingColumn}
          onSuccessMessage={(msg) => toast.success(msg)}
          onErrorMessage={(msg) => setMessageDialog(msg)}
          onClose={() => setEditingColumn(null)}
        />
      )}

      {editingStage && (
        <StageFormModal
          stage={editingStage}
          onSuccessMessage={(msg) => toast.success(msg)}
          onErrorMessage={(msg) => setMessageDialog(msg)}
          onClose={() => setEditingStage(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteDialog
          title={confirmDelete.kind === 'column' ? 'Xóa cột' : 'Xóa stage'}
          message={`Bạn có chắc muốn xóa ${confirmDelete.kind === 'column' ? 'cột' : 'stage'} "${confirmDelete.name}"?`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={handleConfirmDelete}
          isLoading={deleteColumnMut.isPending || deleteStageMut.isPending}
        />
      )}

      {messageDialog && (
        <MessageDialog
          title="Thông báo"
          message={messageDialog}
          onClose={() => setMessageDialog(null)}
        />
      )}
    </div>,
    document.body
  );
}

function ConfirmDeleteDialog({
  title,
  message,
  onCancel,
  onConfirm,
  isLoading,
}: {
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] text-slate-600">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-[13px] font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 text-[13px] font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Đang xóa...' : 'Xóa'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function MessageDialog({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-[15px] font-bold text-slate-800">{title}</h3>
        </div>
        <div className="px-5 py-4">
          <p className="text-[13px] text-slate-600">{message}</p>
        </div>
        <div className="flex justify-end border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ColumnFormModal({
  column,
  onClose,
  onSuccessMessage,
  onErrorMessage,
}: {
  column: Partial<PipelineColumn>;
  onClose: () => void;
  onSuccessMessage: (message: string) => void;
  onErrorMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: column.name || '',
    color: column.color || 'blue',
    sort_order: column.sort_order || 1,
  });

  const saveMut = useMutation({
    mutationFn: (data: any) => column.id ? pipelineApi.updateColumn(column.id, data) : pipelineApi.createColumn(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
      onSuccessMessage(column.id ? 'Cập nhật cột thành công' : 'Tạo cột thành công');
      onClose();
    },
    onError: (err: any) => onErrorMessage(err?.response?.data?.message || 'Lỗi khi lưu cột'),
  });

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
      <div className="bg-white border rounded-xl shadow-lg w-full max-w-sm mx-4 p-5">
        <h3 className="text-[15px] font-bold text-slate-800 mb-4">{column.id ? 'Sửa cột' : 'Thêm cột mới'}</h3>
        
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(formData); }} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Tên cột *</label>
            <input
              required
              autoFocus
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Màu sắc *</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c.value })}
                  className={`w-6 h-6 rounded-full ${c.class} border-2 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-all ${formData.color === c.value ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              Hủy
            </button>
            <button type="submit" disabled={saveMut.isPending} className="px-4 py-2 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saveMut.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function StageFormModal({
  stage,
  onClose,
  onSuccessMessage,
  onErrorMessage,
}: {
  stage: Partial<PipelineStage>;
  onClose: () => void;
  onSuccessMessage: (message: string) => void;
  onErrorMessage: (message: string) => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    column_id: stage.column_id || '',
    name: stage.name || '',
    description: stage.description || '',
    color: stage.color || 'blue',
    sort_order: stage.sort_order || 1,
  });

  const saveMut = useMutation({
    mutationFn: (data: any) => stage.id ? pipelineApi.updateStage(stage.id, data) : pipelineApi.createStage(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-board'] });
      onSuccessMessage(stage.id ? 'Cập nhật stage thành công' : 'Tạo stage thành công');
      onClose();
    },
    onError: (err: any) => onErrorMessage(err?.response?.data?.message || 'Lỗi khi lưu stage'),
  });

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20">
      <div className="bg-white border rounded-xl shadow-lg w-full max-w-sm mx-4 p-5">
        <h3 className="text-[15px] font-bold text-slate-800 mb-4">{stage.id ? 'Sửa stage' : 'Thêm stage mới'}</h3>
        
        <form onSubmit={(e) => { e.preventDefault(); saveMut.mutate(formData); }} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Tên stage *</label>
            <input
              required
              autoFocus
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full h-9 px-3 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Mô tả ngắn</label>
            <textarea
              rows={2}
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 text-[13px] border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[12px] font-medium text-slate-700">Màu sắc *</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: c.value })}
                  className={`w-6 h-6 rounded-full ${c.class} border-2 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-500 transition-all ${formData.color === c.value ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 mt-6">
            <button type="button" onClick={onClose} className="px-4 py-2 text-[13px] font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              Hủy
            </button>
            <button type="submit" disabled={saveMut.isPending} className="px-4 py-2 text-[13px] font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50">
              {saveMut.isPending ? 'Đang lưu...' : 'Lưu'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
