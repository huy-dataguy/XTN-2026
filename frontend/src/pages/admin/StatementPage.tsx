import React, { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { 
  Plus, 
  Trash2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Calendar, 
  Landmark,
  Search,
  Lock,
  Calculator // Icon máy tính
} from 'lucide-react';
import statementService, { Statement } from '../../services/statementService';

interface StatementFormData {
  transactionDate: string;
  type: 'IN' | 'OUT';
  amount: string; 
  partnerName: string;
  description: string;
  balance: string;
}

const StatementPage: React.FC = () => {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // State tính tổng thực tế hiện tại
  const [currentRealBalance, setCurrentRealBalance] = useState<number>(0);

  const [formData, setFormData] = useState<StatementFormData>({
    transactionDate: new Date().toISOString().split('T')[0],
    type: 'IN',
    amount: '',
    partnerName: '',
    description: '',
    balance: ''
  });

  // --- API Functions ---
  const fetchStatements = async () => {
    try {
      setLoading(true);
      const data = await statementService.getAllStatements();
      setStatements(data);
      
      // Tính toán lại Tổng số dư thực tế từ DB (Tổng IN - Tổng OUT)
      const totalBalance = data.reduce((acc, curr) => {
        return curr.type === 'IN' ? acc + curr.amount : acc - curr.amount;
      }, 0);
      setCurrentRealBalance(totalBalance);

    } catch (err) {
      console.error('Error fetching statements:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatements();
  }, []);

  // --- LOGIC TỰ ĐỘNG TÍNH SỐ DƯ (Updated) ---
  // Công thức: Số dư dự kiến = (Tổng IN cũ - Tổng OUT cũ) +/- Số tiền đang nhập
  useEffect(() => {
    const inputAmount = parseFloat(formData.amount) || 0;
    
    // Lấy số dư thực tế hiện tại (đã tính ở fetchStatements)
    let predictedBalance = currentRealBalance;

    if (formData.type === 'IN') {
      predictedBalance += inputAmount;
    } else {
      predictedBalance -= inputAmount;
    }

    // Cập nhật vào ô Balance
    setFormData(prev => ({
      ...prev,
      balance: predictedBalance.toString()
    }));
  }, [formData.amount, formData.type, currentRealBalance]); 

  // --- Handlers ---
  const onChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        balance: parseFloat(formData.balance)
      };

      await statementService.createStatement(payload);
      
      setFormData(prev => ({
        ...prev,
        amount: '',
        partnerName: '',
        description: '',
        // Balance sẽ tự update nhờ useEffect
      }));
      
      fetchStatements(); 
    } catch (err) {
      console.error(err);
      alert('Lỗi khi thêm dữ liệu.');
    }
  };

  const onDelete = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa?')) return;
    try {
      await statementService.deleteStatement(id);
      // Gọi lại fetch để tính lại đúng tổng tiền IN - OUT sau khi xóa
      fetchStatements(); 
    } catch (err) {
      console.error(err);
      alert('Lỗi khi xóa.');
    }
  };

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
  };

  const formatDate = (isoString: string) => {
    return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto min-h-screen bg-slate-50/50">
      
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <Landmark className="w-8 h-8 text-blue-600" />
            Sổ Quỹ (Bank Statement)
          </h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý dòng tiền</p>
        </div>
        
        {/* Hiển thị nhanh số dư hiện tại */}
        <div className="text-right">
            <span className="text-xs text-slate-500 font-bold uppercase block mb-1">Tổng quỹ hiện tại</span>
            <span className={`text-2xl font-black ${currentRealBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatVND(currentRealBalance)}
            </span>
        </div>
      </div>

      {/* --- FORM SECTION --- */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 relative overflow-hidden">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-5 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nhập Giao Dịch Mới
        </h2>
        
        <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 items-end">
          
          {/* Date */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">Ngày Giao Dịch</label>
            <input 
              type="date" 
              name="transactionDate" 
              value={formData.transactionDate} 
              onChange={onChange}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium outline-none" 
              required
            />
          </div>

          {/* Type */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">Loại GD</label>
            <select 
              name="type" 
              value={formData.type} 
              onChange={onChange}
              className={`w-full px-3 py-2.5 border rounded-xl text-sm font-bold outline-none cursor-pointer
                ${formData.type === 'IN' 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
            >
              <option value="IN">Tiền VÀO (+)</option>
              <option value="OUT">Tiền RA (-)</option>
            </select>
          </div>

          {/* Amount */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">Số Tiền</label>
            <input 
              type="number" 
              name="amount" 
              value={formData.amount} 
              onChange={onChange}
              placeholder="0"
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none" 
              required
            />
          </div>

          {/* Partner */}
          <div className="lg:col-span-3">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1">Đối Tác</label>
            <input 
              type="text" 
              name="partnerName" 
              value={formData.partnerName} 
              onChange={onChange}
              placeholder="Tên người gửi/nhận"
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" 
              required
            />
          </div>

          {/* Balance (Auto Calculated) */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-bold text-slate-600 mb-1.5 ml-1 flex items-center gap-1">
              Số Dư Sau GD
              <Lock size={12} className="text-slate-400"/>
            </label>
            <div className="relative">
              <input 
                type="number" 
                name="balance" 
                value={formData.balance} 
                readOnly
                className="w-full px-3 py-2.5 bg-slate-100 border border-slate-200 text-slate-500 font-bold rounded-xl text-sm cursor-not-allowed outline-none"
              />
               <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Calculator size={14} />
               </div>
            </div>
          </div>

          {/* Submit */}
          <div className="lg:col-span-1">
             <button type="submit" className="w-full h-[42px] bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg flex items-center justify-center transition active:scale-95">
               <Plus className="w-5 h-5" />
             </button>
          </div>

          <div className="lg:col-span-12 mt-2">
             <input 
                type="text" 
                name="description" 
                value={formData.description} 
                onChange={onChange}
                placeholder="Nội dung chi tiết..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none" 
              />
          </div>

        </form>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 uppercase text-xs tracking-wider">
              <tr>
                <th className="p-4">Ngày GD</th>
                <th className="p-4">Đối Tác / Nội Dung</th>
                <th className="p-4 text-right">Số Tiền</th>
                <th className="p-4 text-right">Số Dư (Tại thời điểm đó)</th>
                <th className="p-4 text-center w-16">#</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">Đang tải...</td></tr>
              ) : statements.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-12 text-center text-slate-400">
                     <div className="flex flex-col items-center">
                        <Search className="w-10 h-10 mb-3 opacity-20" />
                        <p>Chưa có giao dịch nào.</p>
                     </div>
                  </td>
                </tr>
              ) : (
                statements.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/80 transition">
                    <td className="p-4 whitespace-nowrap">
                       <div className="flex items-center gap-2 text-slate-700 font-medium">
                          <Calendar size={14} className="text-slate-400"/>
                          {formatDate(item.transactionDate)}
                       </div>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{item.partnerName}</div>
                      <div className="text-slate-500 text-xs line-clamp-1">{item.description}</div>
                    </td>
                    <td className="p-4 text-right">
                      <div className={`inline-flex items-center gap-1 font-bold px-2 py-1 rounded-lg ${
                        item.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}>
                        {item.type === 'IN' ? '+' : '-'} {formatVND(item.amount)}
                      </div>
                    </td>
                    <td className="p-4 text-right font-bold text-slate-700 font-mono">
                      {formatVND(item.balance)}
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => onDelete(item._id)} className="text-slate-300 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default StatementPage;