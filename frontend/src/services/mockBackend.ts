import { Product, Order, WeeklyReport, User, UserRole, DistributorGroup, OrderStatus, ReportStatus } from '../types';

// --- Initial Data Seeding ---
const INITIAL_PRODUCTS: Product[] = [
  { id: 'p1', name: 'Premium Coffee Beans (1kg)', price: 150000, stock: 500, category: 'Beverage', image: 'https://picsum.photos/200/200?random=1' },
  { id: 'p2', name: 'Organic Green Tea', price: 80000, stock: 200, category: 'Beverage', image: 'https://picsum.photos/200/200?random=2' },
  { id: 'p3', name: 'Almond Milk (1L)', price: 45000, stock: 100, category: 'Dairy', image: 'https://picsum.photos/200/200?random=3' },
  { id: 'p4', name: 'Hazelnut Syrup', price: 120000, stock: 50, category: 'Additives', image: 'https://picsum.photos/200/200?random=4' },
];

const INITIAL_USERS: User[] = [
  { id: 'admin1', username: 'admin', name: 'Boss Owner', role: UserRole.ADMIN },
  { id: 'd1', username: 'user1', name: 'Distributor A (Gold)', role: UserRole.DISTRIBUTOR, group: DistributorGroup.GOLD },
  { id: 'd2', username: 'user2', name: 'Distributor B (Silver)', role: UserRole.DISTRIBUTOR, group: DistributorGroup.SILVER },
  { id: 'd3', username: 'user3', name: 'Distributor C (New)', role: UserRole.DISTRIBUTOR, group: DistributorGroup.NEW },
];

// --- LocalStorage Keys ---
const KEYS = {
  PRODUCTS: 'distriflow_products',
  ORDERS: 'distriflow_orders',
  REPORTS: 'distriflow_reports',
  USERS: 'distriflow_users',
};

// --- Helpers ---
const getStore = <T,>(key: string, initial: T[]): T[] => {
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(stored);
};

const setStore = <T,>(key: string, data: T[]) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// --- API Simulation ---

export const AuthService = {
  login: (username: string): User | undefined => {
    const users = getStore<User>(KEYS.USERS, INITIAL_USERS);
    return users.find(u => u.username === username);
  },
  getAllDistributors: (): User[] => {
    const users = getStore<User>(KEYS.USERS, INITIAL_USERS);
    return users.filter(u => u.role === UserRole.DISTRIBUTOR);
  },
  getUserById: (id: string): User | undefined => {
    const users = getStore<User>(KEYS.USERS, INITIAL_USERS);
    return users.find(u => u.id === id);
  }
};

export const ProductService = {
  getAll: (): Product[] => getStore(KEYS.PRODUCTS, INITIAL_PRODUCTS),
  
  create: (product: Omit<Product, 'id'>): Product => {
    const products = ProductService.getAll();
    const newProduct = { ...product, id: Math.random().toString(36).substr(2, 9) };
    setStore(KEYS.PRODUCTS, [...products, newProduct]);
    return newProduct;
  },

  update: (id: string, updates: Partial<Product>) => {
    const products = ProductService.getAll();
    const updated = products.map(p => p.id === id ? { ...p, ...updates } : p);
    setStore(KEYS.PRODUCTS, updated);
  },

  delete: (id: string) => {
    const products = ProductService.getAll();
    setStore(KEYS.PRODUCTS, products.filter(p => p.id !== id));
  },
  
  getById: (id: string): Product | undefined => {
     return ProductService.getAll().find(p => p.id === id);
  }
};

export const OrderService = {
  getAll: (): Order[] => getStore(KEYS.ORDERS, []),
  
  getByDistributor: (distributorId: string): Order[] => {
    return OrderService.getAll().filter(o => o.distributorId === distributorId);
  },

  create: (distributorId: string, distributorName: string, items: {productId: string, quantity: number}[]) => {
    const products = ProductService.getAll();
    let total = 0;
    items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (p) total += p.price * item.quantity;
    });

    const newOrder: Order = {
      id: Math.random().toString(36).substr(2, 9),
      distributorId,
      distributorName,
      items,
      totalAmount: total,
      status: OrderStatus.PENDING,
      createdAt: new Date().toISOString(),
    };

    setStore(KEYS.ORDERS, [newOrder, ...OrderService.getAll()]);
    return newOrder;
  },

  approve: (orderId: string) => {
    const orders = OrderService.getAll();
    const orderIndex = orders.findIndex(o => o.id === orderId);
    if (orderIndex === -1) return;

    const order = orders[orderIndex];
    
    // Check stock first
    const products = ProductService.getAll();
    let canFulfill = true;
    
    // Verify stock
    order.items.forEach(item => {
      const p = products.find(prod => prod.id === item.productId);
      if (!p || p.stock < item.quantity) canFulfill = false;
    });

    if (!canFulfill) {
      alert("Insufficient stock to approve this order!");
      return;
    }

    // Update Stock
    const updatedProducts = products.map(p => {
      const item = order.items.find(i => i.productId === p.id);
      if (item) {
        return { ...p, stock: p.stock - item.quantity };
      }
      return p;
    });
    setStore(KEYS.PRODUCTS, updatedProducts);

    // Update Order Status
    orders[orderIndex].status = OrderStatus.APPROVED;
    setStore(KEYS.ORDERS, orders);
  },

  reject: (orderId: string) => {
    const orders = OrderService.getAll();
    const updated = orders.map(o => o.id === orderId ? { ...o, status: OrderStatus.REJECTED } : o);
    setStore(KEYS.ORDERS, updated);
  }
};

export const ReportService = {
  getAll: (): WeeklyReport[] => getStore(KEYS.REPORTS, []),
  
  getByDistributor: (distributorId: string): WeeklyReport[] => {
    return ReportService.getAll().filter(r => r.distributorId === distributorId);
  },

  create: (report: Omit<WeeklyReport, 'id' | 'status'>) => {
    const reports = ReportService.getAll();
    const newReport: WeeklyReport = { 
      ...report, 
      id: Math.random().toString(36).substr(2, 9),
      status: ReportStatus.PENDING 
    };
    setStore(KEYS.REPORTS, [newReport, ...reports]);
  },

  update: (id: string, updates: Partial<WeeklyReport>) => {
    const reports = ReportService.getAll();
    const updated = reports.map(r => r.id === id ? { ...r, ...updates } : r);
    setStore(KEYS.REPORTS, updated);
  },

  approve: (id: string) => {
    const reports = ReportService.getAll();
    const updated = reports.map(r => r.id === id ? { ...r, status: ReportStatus.APPROVED } : r);
    setStore(KEYS.REPORTS, updated);
  },

  reject: (id: string) => {
    const reports = ReportService.getAll();
    const updated = reports.map(r => r.id === id ? { ...r, status: ReportStatus.REJECTED } : r);
    setStore(KEYS.REPORTS, updated);
  }
};