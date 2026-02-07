import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import statementService, { Statement } from '../../services/statementService';
import tagService, { Tag } from '../../services/TagService';
import { 
  Plus, Trash2, Calendar, Landmark, Lock, Calculator,
  PieChart, Tag as TagIcon, Settings, Edit2, Save, X, Filter, ArrowRight,
  TrendingUp, TrendingDown, Wallet, BarChart3, Search, RotateCcw, Check
} from 'lucide-react';

// --- CONSTANTS ---
const TAG_COLORS = [
  { bg: 'bg-red-100', text: 'text-red-700', ring: 'ring-red-500', val: 'red' },
  { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'ring-blue-500', val: 'blue' },
  { bg: 'bg-green-100', text: 'text-green-700', ring: 'ring-green-500', val: 'green' },
  { bg: 'bg-yellow-100', text: 'text-yellow-700', ring: 'ring-yellow-500', val: 'yellow' },
  { bg: 'bg-purple-100', text: 'text-purple-700', ring: 'ring-purple-500', val: 'purple' },
  { bg: 'bg-gray-100', text: 'text-gray-700', ring: 'ring-gray-500', val: 'gray' },
  { bg: 'bg-orange-100', text: 'text-orange-700', ring: 'ring-orange-500', val: 'orange' },
  { bg: 'bg-teal-100', text: 'text-teal-700', ring: 'ring-teal-500', val: 'teal' },
];

const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);

// --- 1. REUSABLE FORM COMPONENT ---
interface TransactionFormProps {
  formData: any;
  onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onSubmit: (e: FormEvent) => void;
  tags: Tag[];
  toggleTag: (id: string) => void;
  isEditing?: boolean;
  onCancel?: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  formData, onChange, onSubmit, tags, toggleTag, isEditing = false, onCancel 
}) => {
  return (
    <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-5 items-start">
      {/* Hàng 1: Ngày, Loại, Tiền, Số dư */}
      <div className="lg:col-span-3 w-full">
        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block uppercase">Ngày GD</label>
        <input type="date" name="transactionDate" value={formData.transactionDate} onChange={onChange} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition" required />
      </div>

      <div className="lg:col-span-3 w-full">
        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block uppercase">Loại GD</label>
        <div className="relative">
          <select name="type" value={formData.type} onChange={onChange} className={`appearance-none w-full px-4 py-3 border rounded-xl text-sm font-bold outline-none cursor-pointer transition ${formData.type === 'IN' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-500' : 'bg-rose-50 text-rose-700 border-rose-200 focus:ring-rose-500'}`}>
            <option value="IN">Tiền VÀO (+)</option>
            <option value="OUT">Tiền RA (-)</option>
          </select>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"><Filter size={14}/></div>
        </div>
      </div>

      <div className="lg:col-span-3 w-full">
        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block uppercase">Số Tiền</label>
        <div className="relative">
            <input type="number" name="amount" value={formData.amount} onChange={onChange} placeholder="0" className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition shadow-sm" required />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-black">VND</div>
        </div>
      </div>

      <div className="lg:col-span-3 w-full">
        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block uppercase flex items-center gap-1">Số dư (Ghi nhận) <Lock size={10}/></label>
        <div className="relative">
          <input type="number" name="balance" value={formData.balance} onChange={onChange} className="w-full px-4 py-3 bg-slate-100 border border-slate-200 text-slate-500 font-mono font-bold rounded-xl text-sm outline-none"/>
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><Calculator size={14} /></div>
        </div>
      </div>

      {/* Hàng 2: Đối tác, Nội dung */}
      <div className="lg:col-span-4 w-full">
        <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block uppercase">Đối Tác</label>
        <input type="text" name="partnerName" value={formData.partnerName} onChange={onChange} placeholder="Ví dụ: Nguyễn Văn A..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition" required />
      </div>
      
      <div className="lg:col-span-8 w-full">
          <label className="text-xs font-bold text-slate-500 mb-1.5 ml-1 block uppercase">Nội dung</label>
          <input type="text" name="description" value={formData.description} onChange={onChange} placeholder="Nhập nội dung..." className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 transition" />
      </div>

      {/* Hàng 3: Tags & Nút bấm */}
      <div className="lg:col-span-8 w-full">
        <label className="text-xs font-bold text-slate-500 mb-2 ml-1 block uppercase">Phân loại (Tags)</label>
        <div className="flex flex-wrap gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100 min-h-[52px]">
          {tags.length === 0 && <span className="text-slate-400 text-sm italic pl-1 self-center">Chưa có tag nào.</span>}
          {tags.map(tag => {
            const isSelected = formData.selectedTags.includes(tag._id);
            const colorObj = TAG_COLORS.find(c => c.val === tag.color);
            return (
              <button
                key={tag._id}
                type="button"
                onClick={() => toggleTag(tag._id)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-bold transition-all shadow-sm flex items-center gap-1.5
                  ${isSelected 
                    ? `${colorObj?.bg} ${colorObj?.text} border-transparent ring-2 ring-offset-1 ${colorObj?.ring}` 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-white hover:border-slate-300'}`}
              >
                {tag.name} {isSelected && <Check size={12} strokeWidth={4} />}
              </button>
            )
          })}
        </div>
      </div>

      <div className="lg:col-span-4 flex items-end h-full w-full">
          <div className="w-full flex gap-3">
            {isEditing && onCancel && (
              <button type="button" onClick={onCancel} className="flex-1 h-[50px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold flex items-center justify-center gap-2 transition">
                Hủy
              </button>
            )}
            <button type="submit" className={`flex-1 h-[50px] text-white rounded-xl shadow-lg font-bold flex items-center justify-center gap-2 transition active:scale-95 ${isEditing ? 'bg-orange-500 hover:bg-orange-600 shadow-orange-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}>
              {isEditing ? <Save size={18} /> : <Plus size={18} />}
              {isEditing ? 'Lưu Sửa' : 'Thêm Mới'}
            </button>
          </div>
      </div>
    </form>
  );
};

// --- 2. TAG MANAGER COMPONENT ---
const TagManager = ({ tags, onTagsChange }: { tags: Tag[], onTagsChange: () => void }) => {
  const [tagName, setTagName] = useState('');
  const [selectedColor, setSelectedColor] = useState(TAG_COLORS[1].val);
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleSave = async () => {
    if (!tagName.trim()) return;
    try {
      if (editingId) {
        await tagService.updateTag(editingId, { name: tagName, color: selectedColor });
        setEditingId(null);
      } else {
        await tagService.createTag({ name: tagName, color: selectedColor });
      }
      setTagName('');
      setSelectedColor(TAG_COLORS[1].val);
      onTagsChange();
    } catch (err) { alert('Lỗi khi lưu tag'); }
  };

  const handleEdit = (tag: Tag) => {
    setTagName(tag.name);
    setSelectedColor(tag.color);
    setEditingId(tag._id);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Xóa tag này?')) {
      await tagService.deleteTag(id);
      onTagsChange();
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2 border-b pb-4">
        <Settings className="w-5 h-5 text-slate-500" /> Quản Lý Danh Mục (Tags)
      </h3>
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          <div className="md:col-span-5">
            <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase">Tên Tag</label>
            <input value={tagName} onChange={(e) => setTagName(e.target.value)} className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-white" placeholder="Ví dụ: Ăn uống, Lương..." />
          </div>
          <div className="md:col-span-5">
            <label className="text-xs font-bold text-slate-500 block mb-1.5 uppercase">Màu hiển thị</label>
            <div className="flex flex-wrap gap-2">
              {TAG_COLORS.map((c) => (
                <button key={c.val} onClick={() => setSelectedColor(c.val)} className={`w-8 h-8 rounded-full ${c.bg} border-2 transition-all ${selectedColor === c.val ? `border-slate-600 scale-110 shadow-md` : 'border-transparent hover:scale-105'}`} />
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
             <button onClick={handleSave} className="w-full h-[42px] bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition flex items-center justify-center gap-2">
               {editingId ? <Save size={16}/> : <Plus size={16}/>} {editingId ? 'Lưu' : 'Thêm'}
             </button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {tags.map(tag => {
          const colorObj = TAG_COLORS.find(c => c.val === tag.color) || TAG_COLORS[5];
          return (
            <div key={tag._id} className={`group flex justify-between items-center p-3 rounded-xl border ${colorObj.bg} border-slate-200/50 hover:shadow-sm transition`}>
              <span className={`font-bold text-sm ${colorObj.text}`}>{tag.name}</span>
              <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition">
                <button onClick={() => handleEdit(tag)} className="p-1.5 hover:bg-white/60 rounded-lg"><Edit2 size={14} className={colorObj.text}/></button>
                <button onClick={() => handleDelete(tag._id)} className="p-1.5 hover:bg-white/60 rounded-lg"><Trash2 size={14} className={colorObj.text}/></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

// --- 3. STATS VIEW (DASHBOARD) ---
const StatsView = ({ statements, tags }: { statements: Statement[], tags: Tag[] }) => {
  // --- UPDATED: Allow Multiple Tag Selection for Stats too ---
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  const filteredStatements = filterTagIds.length > 0
    ? statements.filter(s => s.tags.some(t => filterTagIds.includes(t._id)))
    : statements;

  const totalIn = filteredStatements.filter(s => s.type === 'IN').reduce((sum, s) => sum + s.amount, 0);
  const totalOut = filteredStatements.filter(s => s.type === 'OUT').reduce((sum, s) => sum + s.amount, 0);
  const netBalance = totalIn - totalOut;

  // Breakdown logic remains the same (showing all relevant tags for filtered scope)
  const tagBreakdown = tags.map(tag => {
    const relevantStms = statements.filter(s => s.tags.some(t => t._id === tag._id));
    const inAmount = relevantStms.filter(s => s.type === 'IN').reduce((sum, s) => sum + s.amount, 0);
    const outAmount = relevantStms.filter(s => s.type === 'OUT').reduce((sum, s) => sum + s.amount, 0);
    const totalVolume = inAmount + outAmount;
    return { tag, inAmount, outAmount, totalVolume };
  }).sort((a, b) => b.totalVolume - a.totalVolume);

  const maxVolume = Math.max(...tagBreakdown.map(t => Math.max(t.inAmount, t.outAmount)), 0) || 1;

  const toggleFilter = (id: string) => {
    setFilterTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
      
      {/* FILTER BAR */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 text-slate-500 text-sm font-bold uppercase tracking-wider">
          <Filter size={14} /> Lọc thống kê (Chọn nhiều)
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterTagIds([])}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all
              ${filterTagIds.length === 0 
                ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
          >
            Tất cả
          </button>
          {tags.map(tag => {
            const colorObj = TAG_COLORS.find(c => c.val === tag.color);
            const isActive = filterTagIds.includes(tag._id);
            return (
              <button
                key={tag._id}
                onClick={() => toggleFilter(tag._id)}
                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-1.5
                  ${isActive 
                    ? `${colorObj?.bg} ${colorObj?.text} border-current ring-1 ring-offset-1` 
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
              >
                {tag.name} {isActive && <Check size={12} strokeWidth={4}/>}
              </button>
            );
          })}
        </div>
      </div>

      {/* OVERVIEW CARDS (Calculated based on Filter) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 p-5 rounded-2xl border border-emerald-100 relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white rounded-lg text-emerald-600 shadow-sm"><TrendingUp size={20}/></div>
            <span className="text-xs font-bold text-emerald-600 uppercase bg-emerald-100 px-2 py-1 rounded-md">Thu Nhập</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{formatVND(totalIn)}</div>
          <p className="text-xs text-emerald-600 font-medium mt-1 opacity-80">Tổng tiền vào (Đã lọc)</p>
        </div>

        <div className="bg-rose-50 p-5 rounded-2xl border border-rose-100 relative overflow-hidden">
           <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white rounded-lg text-rose-600 shadow-sm"><TrendingDown size={20}/></div>
            <span className="text-xs font-bold text-rose-600 uppercase bg-rose-100 px-2 py-1 rounded-md">Chi Tiêu</span>
          </div>
          <div className="text-2xl font-black text-slate-800">{formatVND(totalOut)}</div>
          <p className="text-xs text-rose-600 font-medium mt-1 opacity-80">Tổng tiền ra (Đã lọc)</p>
        </div>

        <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 relative overflow-hidden">
           <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-white rounded-lg text-blue-600 shadow-sm"><Wallet size={20}/></div>
            <span className="text-xs font-bold text-blue-600 uppercase bg-blue-100 px-2 py-1 rounded-md">Ròng</span>
          </div>
          <div className={`text-2xl font-black ${netBalance >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{formatVND(netBalance)}</div>
          <p className="text-xs text-blue-600 font-medium mt-1 opacity-80">Thu - Chi (Đã lọc)</p>
        </div>
      </div>

      {/* TAG BREAKDOWN */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="font-bold text-slate-700 flex items-center gap-2">
            <BarChart3 size={18} className="text-slate-400"/> Chi tiết toàn bộ Danh Mục
          </h3>
          <span className="text-xs text-slate-400 font-medium">Tổng quát</span>
        </div>
        
        <div className="divide-y divide-slate-100">
          {tagBreakdown.map(({ tag, inAmount, outAmount }) => {
            const colorObj = TAG_COLORS.find(c => c.val === tag.color);
            const inPercent = (inAmount / maxVolume) * 100;
            const outPercent = (outAmount / maxVolume) * 100;

            if (inAmount === 0 && outAmount === 0) return null;

            return (
              <div key={tag._id} className="p-5 hover:bg-slate-50 transition group">
                <div className="flex items-center gap-3 mb-3">
                   <div className={`w-3 h-3 rounded-full ${colorObj?.bg.replace('bg-', 'bg-slate-400 ')} border border-slate-200 shadow-sm`}></div>
                   <span className="font-bold text-slate-700 text-sm">{tag.name}</span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="w-16 text-xs font-bold text-slate-400 uppercase text-right">Vào</div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex justify-start">
                       <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${inPercent}%` }}></div>
                    </div>
                    <div className="w-24 text-right text-sm font-bold text-emerald-600">{inAmount > 0 ? formatVND(inAmount) : '-'}</div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-16 text-xs font-bold text-slate-400 uppercase text-right">Ra</div>
                     <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden flex justify-start">
                       <div className="h-full bg-rose-500 rounded-full" style={{ width: `${outPercent}%` }}></div>
                    </div>
                    <div className="w-24 text-right text-sm font-bold text-rose-600">{outAmount > 0 ? formatVND(outAmount) : '-'}</div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {tagBreakdown.every(t => t.totalVolume === 0) && (
            <div className="p-8 text-center text-slate-400 italic text-sm">Chưa có dữ liệu thống kê.</div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- MAIN PAGE ---
const StatementPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'TRANSACTIONS' | 'STATS' | 'TAGS'>('TRANSACTIONS');
  const [statements, setStatements] = useState<Statement[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentRealBalance, setCurrentRealBalance] = useState<number>(0);
  
  // --- UPDATED: STATE CHO MULTI-FILTER ---
  const [filterTagIds, setFilterTagIds] = useState<string[]>([]);

  // State for Edit Modal
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const initialFormState = {
    transactionDate: new Date().toISOString().split('T')[0],
    type: 'IN' as 'IN' | 'OUT',
    amount: '',
    partnerName: '',
    description: '',
    balance: '',
    selectedTags: [] as string[]
  };

  const [createFormData, setCreateFormData] = useState(initialFormState);
  const [editFormData, setEditFormData] = useState(initialFormState);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [stmData, tagData] = await Promise.all([
        statementService.getAllStatements(),
        tagService.getAllTags()
      ]);
      setStatements(stmData);
      setTags(tagData);
      const totalBalance = stmData.reduce((acc, curr) => curr.type === 'IN' ? acc + curr.amount : acc - curr.amount, 0);
      setCurrentRealBalance(totalBalance);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchAllData(); }, []);

  useEffect(() => {
    const inputAmount = parseFloat(createFormData.amount) || 0;
    let predictedBalance = currentRealBalance;
    if (createFormData.type === 'IN') predictedBalance += inputAmount;
    else predictedBalance -= inputAmount;
    setCreateFormData(prev => ({ ...prev, balance: predictedBalance.toString() }));
  }, [createFormData.amount, createFormData.type, currentRealBalance]); 

  // --- UPDATED: LOGIC LỌC ĐA TAG (OR Logic) ---
  const filteredStatements = filterTagIds.length > 0
    ? statements.filter(s => s.tags.some(t => filterTagIds.includes(t._id)))
    : statements;

  // --- HANDLER: Toggle Filter Tag ---
  const toggleTransactionFilter = (tagId: string) => {
    setFilterTagIds(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId) 
        : [...prev, tagId]
    );
  };

  const handleCreateChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setCreateFormData({ ...createFormData, [e.target.name]: e.target.value });
  };

  const handleEditChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const toggleCreateTag = (tagId: string) => {
    setCreateFormData(prev => {
      const exists = prev.selectedTags.includes(tagId);
      return { ...prev, selectedTags: exists ? prev.selectedTags.filter(id => id !== tagId) : [...prev.selectedTags, tagId] };
    });
  };

  const toggleEditTag = (tagId: string) => {
    setEditFormData(prev => {
      const exists = prev.selectedTags.includes(tagId);
      return { ...prev, selectedTags: exists ? prev.selectedTags.filter(id => id !== tagId) : [...prev.selectedTags, tagId] };
    });
  };

  const openEditModal = (item: Statement) => {
    setEditingId(item._id);
    const dateStr = new Date(item.transactionDate).toISOString().split('T')[0];
    setEditFormData({
      transactionDate: dateStr,
      type: item.type,
      amount: item.amount.toString(),
      partnerName: item.partnerName,
      description: item.description || '',
      balance: item.balance.toString(),
      selectedTags: item.tags.map(t => t._id) 
    });
    setIsModalOpen(true);
  };

  const closeEditModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setEditFormData(initialFormState);
  };

  const onCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...createFormData,
        amount: parseFloat(createFormData.amount),
        balance: parseFloat(createFormData.balance),
        tags: createFormData.selectedTags
      };
      await statementService.createStatement(payload);
      setCreateFormData({ ...initialFormState, transactionDate: createFormData.transactionDate }); 
      fetchAllData(); 
    } catch (err) { alert('Lỗi khi tạo mới.'); }
  };

  const onEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      const payload = {
        ...editFormData,
        amount: parseFloat(editFormData.amount),
        balance: parseFloat(editFormData.balance),
        tags: editFormData.selectedTags
      };
      await statementService.updateStatement(editingId, payload);
      closeEditModal();
      fetchAllData(); 
    } catch (err) { alert('Lỗi khi cập nhật.'); }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa?')) return;
    try { await statementService.deleteStatement(id); fetchAllData(); } catch (err) { console.error(err); }
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto min-h-screen bg-slate-50/50 font-sans text-slate-800">
      
      {/* HEADER */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200"><Landmark size={24} /></div>
            Sổ Quỹ Thông Minh
          </h1>
          <p className="text-slate-500 font-medium ml-1 mt-1">Quản lý dòng tiền cá nhân & doanh nghiệp</p>
        </div>
        <div className="w-full md:w-auto bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-end min-w-[200px]">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Tổng quỹ hiện tại</span>
            <span className={`text-3xl font-black tracking-tight ${currentRealBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatVND(currentRealBalance)}
            </span>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 mb-8 bg-white p-1 rounded-xl border border-slate-200 shadow-sm w-fit">
        {[
          { id: 'TRANSACTIONS', label: 'Giao Dịch', icon: <Landmark size={18}/> },
          { id: 'STATS', label: 'Thống Kê', icon: <PieChart size={18}/> },
          { id: 'TAGS', label: 'Danh Mục', icon: <TagIcon size={18}/> },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2.5 text-sm font-bold flex items-center gap-2 rounded-lg transition-all
              ${activeTab === tab.id ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'}`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* --- CONTENT AREA --- */}
      <div className="min-h-[500px]">
        {activeTab === 'TRANSACTIONS' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* CREATE FORM */}
            <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 mb-8">
              <h2 className="text-sm font-bold uppercase tracking-widest mb-6 flex items-center gap-2 text-slate-400">
                <Plus className="w-4 h-4" /> Tạo Giao Dịch Mới
              </h2>
              <TransactionForm 
                formData={createFormData} 
                onChange={handleCreateChange} 
                onSubmit={onCreateSubmit}
                tags={tags}
                toggleTag={toggleCreateTag}
              />
            </div>

            {/* FILTER TOOLBAR (UPDATED FOR MULTI-SELECT) */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-4 mb-4">
              <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                <Landmark size={20} className="text-slate-400"/> Lịch Sử Giao Dịch
                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                  {filteredStatements.length} bản ghi
                </span>
              </h3>
              
              <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-2 md:pb-0 scrollbar-hide">
                 <div className="text-xs font-bold text-slate-400 uppercase mr-1 whitespace-nowrap flex items-center gap-1">
                    <Filter size={12}/> Lọc (Nhiều):
                 </div>
                 <button
                    onClick={() => setFilterTagIds([])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap
                    ${filterTagIds.length === 0 
                        ? 'bg-slate-800 text-white border-slate-800 shadow-md' 
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                 >
                    Tất cả
                 </button>
                 {tags.map(tag => {
                    const colorObj = TAG_COLORS.find(c => c.val === tag.color);
                    const isActive = filterTagIds.includes(tag._id);
                    return (
                    <button
                        key={tag._id}
                        onClick={() => toggleTransactionFilter(tag._id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap flex items-center gap-1.5
                        ${isActive 
                            ? `${colorObj?.bg} ${colorObj?.text} border-current ring-1 ring-offset-1` 
                            : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                    >
                        {tag.name} {isActive && <Check size={12} strokeWidth={4}/>}
                    </button>
                    );
                 })}
              </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-xs tracking-wider">
                    <tr>
                      <th className="p-5">Ngày</th>
                      <th className="p-5">Thông Tin Giao Dịch</th>
                      <th className="p-5 text-right">Số Tiền</th>
                      <th className="p-5 text-right">Số Dư</th>
                      <th className="p-5 text-center">Tác vụ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr><td colSpan={5} className="p-10 text-center text-slate-400">Đang tải dữ liệu...</td></tr>
                    ) : filteredStatements.length === 0 ? (
                       <tr>
                         <td colSpan={5} className="p-16 text-center text-slate-400 italic">
                            <div className="flex flex-col items-center justify-center gap-2">
                                <Search size={32} className="opacity-20"/>
                                {filterTagIds.length > 0 ? 'Không tìm thấy giao dịch nào chứa các tag đã chọn.' : 'Chưa có giao dịch nào.'}
                                {filterTagIds.length > 0 && (
                                    <button onClick={() => setFilterTagIds([])} className="text-blue-500 font-bold hover:underline flex items-center gap-1 text-xs mt-1">
                                        <RotateCcw size={12}/> Xóa bộ lọc
                                    </button>
                                )}
                            </div>
                         </td>
                       </tr>
                    ) : (
                      filteredStatements.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-50/80 transition group">
                          <td className="p-5 whitespace-nowrap align-top">
                             <div className="flex flex-col">
                                <span className="font-bold text-slate-700 text-base">{new Date(item.transactionDate).getDate()}</span>
                                <span className="text-xs text-slate-400 font-medium">Tháng {new Date(item.transactionDate).getMonth() + 1}, {new Date(item.transactionDate).getFullYear()}</span>
                             </div>
                          </td>
                          <td className="p-5 align-top max-w-[300px]">
                            <div className="font-bold text-slate-800 text-base">{item.partnerName}</div>
                            <div className="text-slate-500 text-xs mt-1 line-clamp-2">{item.description}</div>
                            <div className="flex flex-wrap gap-1 mt-2">
                              {item.tags.map(t => {
                                  const c = TAG_COLORS.find(x => x.val === t.color);
                                  return <span key={t._id} className={`text-[10px] px-2 py-0.5 rounded-full ${c?.bg} ${c?.text} font-bold border ${c?.bg.replace('bg-', 'border-')}`}>{t.name}</span>
                              })}
                            </div>
                          </td>
                          <td className="p-5 text-right align-top">
                            <div className={`inline-flex items-center gap-1 font-bold px-3 py-1.5 rounded-lg border ${item.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                              {item.type === 'IN' ? '+' : '-'} {formatVND(item.amount)}
                            </div>
                          </td>
                          <td className="p-5 text-right font-bold text-slate-700 font-mono align-top text-base">{formatVND(item.balance)}</td>
                          <td className="p-5 text-center align-top">
                            <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition">
                               <button onClick={() => openEditModal(item)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Sửa">
                                  <Edit2 size={18} />
                               </button>
                               <button onClick={() => onDelete(item._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Xóa">
                                  <Trash2 size={18} />
                               </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'STATS' && <StatsView statements={statements} tags={tags} />}
        {activeTab === 'TAGS' && <TagManager tags={tags} onTagsChange={fetchAllData} />}
      </div>

      {/* --- MODAL POPUP (Overlay) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={closeEditModal}></div>
          
          {/* Modal Content */}
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="bg-orange-50 px-6 py-4 border-b border-orange-100 flex justify-between items-center">
              <h2 className="text-orange-700 font-bold flex items-center gap-2">
                <Edit2 size={18} /> Chỉnh Sửa Giao Dịch
              </h2>
              <button onClick={closeEditModal} className="text-orange-400 hover:text-orange-700 transition">
                <X size={24} />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 md:p-8 max-h-[80vh] overflow-y-auto">
              <TransactionForm 
                formData={editFormData} 
                onChange={handleEditChange} 
                onSubmit={onEditSubmit}
                tags={tags}
                toggleTag={toggleEditTag}
                isEditing={true}
                onCancel={closeEditModal}
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StatementPage;