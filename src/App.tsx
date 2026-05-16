import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, MapPin, DollarSign, Calendar, Compass, Star, Plus, Trash2, 
  ChevronRight, X, Filter, Sun, Sunrise, Sunset, Moon, Heart, 
  Thermometer, Clock, Globe, MessageCircle, ShieldAlert, Info, TrendingUp, BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PLACES } from './data';
import { Place, ItineraryItem, DayItinerary, UserProfile, Category, SlotKey } from './types';

// --- Constants & Helpers ---
const SLOTS: { id: SlotKey; label: string; icon: any }[] = [
  { id: 'morning', label: 'Morning', icon: Sunrise },
  { id: 'afternoon', label: 'Afternoon', icon: Sun },
  { id: 'evening', label: 'Evening', icon: Sunset },
  { id: 'night', label: 'Night', icon: Moon },
];

const CATEGORIES: Category[] = ['Stays', 'Restaurants', 'Transport', 'Activities', 'Shopping', 'Attractions', 'Events'];

const DEFAULT_PROFILE: UserProfile = {
  name: 'Explorer',
  dailyBudget: 200,
  homeCity: 'Mumbai',
  homeCurrency: 'USD',
  budgetSplit: {
    'Stays': 0.4,
    'Restaurants': 0.25,
    'Transport': 0.15,
    'Activities': 0.15,
    'Shopping': 0.05
  }
};

const getRelativeTime = (city: string) => {
  const offsets: Record<string, number> = {
    'Mumbai': 5.5, 'Delhi': 5.5, 'Agra': 5.5, 'Bangalore': 5.5,
    'Paris': 2, 'Tokyo': 9, 'London': 1, 'New York': -4, 'Bali': 8
  };
  const offset = offsets[city] || 0;
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * offset));
};

const getWeather = (city: string) => {
  const weatherMap: Record<string, { temp: number; emoji: string }> = {
    'Mumbai': { temp: 32, emoji: '☀️' },
    'Paris': { temp: 18, emoji: '☁️' },
    'Tokyo': { temp: 22, emoji: '🌦️' },
    'New York': { temp: 20, emoji: '🌤️' },
    'London': { temp: 15, emoji: '🌧️' },
    'Bali': { temp: 30, emoji: '🌋' },
    'Delhi': { temp: 35, emoji: '🔥' },
  };
  return weatherMap[city] || { temp: 25, emoji: '✨' };
};

// --- Components ---

const ProgressRing = ({ spent, budget }: { spent: number; budget: number }) => {
  const radius = 60;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const ratio = Math.min(spent / budget, 1.2);
  const strokeDashoffset = circumference - ratio * circumference;
  
  const getColor = () => {
    const p = (spent / budget) * 100;
    if (p < 80) return '#10b981'; // green
    if (p < 100) return '#f59e0b'; // orange
    return '#ef4444'; // red
  };

  return (
    <div className="relative flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
        <circle
          stroke="#f1f5f9"
          fill="transparent"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <motion.circle
          stroke={getColor()}
          fill="transparent"
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1, ease: "easeOut" }}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-2xl font-bold text-slate-800">${Math.round(spent)}</span>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">/ ${budget}</span>
      </div>
    </div>
  );
};

const CategoryBar: React.FC<{ label: string; spent: number; target: number }> = ({ label, spent, target }) => {
  const p = Math.min((spent / target) * 100, 100);
  return (
    <div className="flex-1 space-y-1">
      <div className="flex justify-between text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
        <span>{label}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${p}%` }}
          className={`h-full rounded-full ${p >= 100 ? 'bg-red-500' : 'bg-blue-500'}`} 
        />
      </div>
      <div className="text-[9px] font-medium text-slate-400">${Math.round(spent)}/${Math.round(target)}</div>
    </div>
  );
};

export default function App() {
  // --- State ---
  const [activeTab, setActiveTab] = useState('explore');
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [userProfile, setUserProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [itineraryHistory, setItineraryHistory] = useState<Record<string, DayItinerary>>({});
  const [favorites, setFavorites] = useState<string[]>([]);
  const [customPlaces, setCustomPlaces] = useState<Place[]>([]);
  const [recentPlaces, setRecentPlaces] = useState<Place[]>([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState<Category | 'All'>('All');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<SlotKey>('morning');
  const [itemDetail, setItemDetail] = useState<Place | null>(null);
  const [editCost, setEditCost] = useState<string>('');
  const [showWeekly, setShowWeekly] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customItem, setCustomItem] = useState({ name: '', city: '', category: 'Activities' as Category, cost: '' });

  // --- Handlers ---
  const handleAddCustom = () => {
    if (!customItem.name || !customItem.city || !customItem.cost) return;
    const newPlace: Place = {
      id: `custom-${Date.now()}`,
      name: customItem.name,
      city: customItem.city,
      country: 'Custom',
      category: customItem.category,
      estimatedCostUSD: parseFloat(customItem.cost) || 0,
      description: 'Self-added local spot',
      durationHours: 2,
      rating: 5,
      tags: ['Custom'],
      openingHours: 'Flexible'
    };
    setCustomPlaces(prev => [newPlace, ...prev]);
    handleAddItem(newPlace, activeSlot);
    setShowCustomForm(false);
    setCustomItem({ name: '', city: '', category: 'Activities', cost: '' });
  };
  useEffect(() => {
    const savedItinerary = localStorage.getItem('wanderwise_itinerary');
    const savedFavs = localStorage.getItem('wanderwise_favorites');
    const savedCustom = localStorage.getItem('wanderwise_custom');
    
    if (savedItinerary) setItineraryHistory(JSON.parse(savedItinerary));
    if (savedFavs) setFavorites(JSON.parse(savedFavs));
    if (savedCustom) setCustomPlaces(JSON.parse(savedCustom));
  }, []);

  useEffect(() => {
    localStorage.setItem('wanderwise_itinerary', JSON.stringify(itineraryHistory));
  }, [itineraryHistory]);

  useEffect(() => {
    localStorage.setItem('wanderwise_favorites', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('wanderwise_custom', JSON.stringify(customPlaces));
  }, [customPlaces]);

  // --- Derived Data ---
  const currentDay = useMemo(() => {
    return itineraryHistory[currentDate] || { morning: [], afternoon: [], evening: [], night: [] };
  }, [itineraryHistory, currentDate]);

  const totalSpentToday = useMemo(() => {
    const allItems = [...currentDay.morning, ...currentDay.afternoon, ...currentDay.evening, ...currentDay.night];
    return allItems.reduce((acc, item) => acc + item.actualCost, 0);
  }, [currentDay]);

  const categorySpending = useMemo(() => {
    const stats: Record<string, number> = { 'Stay': 0, 'Food': 0, 'Transport': 0, 'Activities': 0, 'Shopping': 0 };
    const allItems = [...currentDay.morning, ...currentDay.afternoon, ...currentDay.evening, ...currentDay.night];
    
    allItems.forEach(item => {
      let bucket = 'Activities';
      if (item.category === 'Stays') bucket = 'Stay';
      else if (item.category === 'Restaurants') bucket = 'Food';
      else if (item.category === 'Transport') bucket = 'Transport';
      else if (item.category === 'Shopping') bucket = 'Shopping';
      else if (item.category === 'Attractions' || item.category === 'Events' || item.category === 'Activities') bucket = 'Activities';
      
      stats[bucket] = (stats[bucket] || 0) + item.actualCost;
    });
    return stats;
  }, [currentDay]);

  const availablePlaces = useMemo(() => [...PLACES, ...customPlaces], [customPlaces]);
  
  const filteredPlaces = useMemo(() => {
    return availablePlaces.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.city.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCity = selectedCity === 'All' || p.city === selectedCity;
      const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
      return matchesSearch && matchesCity && matchesCategory;
    });
  }, [availablePlaces, searchQuery, selectedCity, selectedCategory]);

  const cities = useMemo(() => {
    return ['All', ...Array.from(new Set(availablePlaces.map(p => p.city))).sort()];
  }, [availablePlaces]);

  // --- Handlers ---
  const handleAddItem = (place: Place, slot: SlotKey) => {
    const newItem: ItineraryItem = {
      ...place,
      slotId: slot,
      actualCost: parseFloat(editCost) || place.estimatedCostUSD
    };
    
    setItineraryHistory(prev => ({
      ...prev,
      [currentDate]: {
        ...currentDay,
        [slot]: [...currentDay[slot], newItem]
      }
    }));
    
    setRecentPlaces(prev => [place, ...prev.filter(p => p.id !== place.id).slice(0, 9)]);
    setIsAddModalOpen(false);
    setItemDetail(null);
  };

  const removeItem = (id: string, slot: SlotKey) => {
    setItineraryHistory(prev => ({
      ...prev,
      [currentDate]: {
        ...currentDay,
        [slot]: currentDay[slot].filter(item => item.id !== id)
      }
    }));
  };

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const getDayTotal = (dateStr: string) => {
    const day = itineraryHistory[dateStr];
    if (!day) return 0;
    return [...day.morning, ...day.afternoon, ...day.evening, ...day.night]
      .reduce((acc, item) => acc + item.actualCost, 0);
  };

  const last7Days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const ds = d.toISOString().split('T')[0];
      return { date: ds, total: getDayTotal(ds) };
    });
  }, [itineraryHistory]);

  // --- Quick Facts Panel helper ---
  const activeCity = currentDay.morning[0]?.city || currentDay.afternoon[0]?.city || userProfile.homeCity;
  const weather = getWeather(activeCity);
  const localTime = getRelativeTime(activeCity);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 pb-32">
      {/* Search & Header */}
      <header className="p-6 pb-2 space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-black italic tracking-tighter text-blue-600">WanderWise</h1>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{new Date(currentDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          </div>
          <button 
            onClick={() => setShowWeekly(!showWeekly)}
            className={`p-3 rounded-2xl transition-colors ${showWeekly ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}
          >
            <BarChart3 className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="px-6 space-y-8">
        {/* Wallet Ring & Budget Summary */}
        <section className="bg-slate-50 rounded-[2.5rem] p-8 space-y-8">
          {showWeekly ? (
            <div className="space-y-4 h-[240px] flex flex-col justify-end">
              <div className="flex items-end justify-between gap-2 h-40">
                {last7Days.map(day => (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-2 group relative">
                    <motion.div 
                      className="w-full bg-blue-500 rounded-t-lg min-h-[4px]" 
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.min((day.total / userProfile.dailyBudget) * 100, 150)}%` }}
                    />
                    <div className="text-[10px] font-bold text-slate-400">{new Date(day.date).getDate()}</div>
                    {day.date === currentDate && <div className="absolute -top-6 bg-slate-800 text-white text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">${day.total}</div>}
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-200 pt-4 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500">Weekly Tracker</span>
                <span className="text-xs font-medium text-slate-400">Target line: {userProfile.dailyBudget}</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-8">
              <ProgressRing spent={totalSpentToday} budget={userProfile.dailyBudget} />
              <div className="flex-1 space-y-4">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Remaining</p>
                  <p className="text-2xl font-black text-slate-800 transition-all">
                    ${Math.max(userProfile.dailyBudget - totalSpentToday, 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  {[
                    { k: 'Stay', l: 'S', bk: 'Stays' },
                    { k: 'Food', l: 'F', bk: 'Restaurants' },
                    { k: 'Transport', l: 'T', bk: 'Transport' },
                    { k: 'Activities', l: 'A', bk: 'Activities' },
                    { k: 'Shopping', l: 'S', bk: 'Shopping' }
                  ].map(b => (
                    <CategoryBar 
                      key={b.k} 
                      label={b.l} 
                      spent={categorySpending[b.k] || 0} 
                      target={userProfile.dailyBudget * (userProfile.budgetSplit[b.bk] || 0.1)} 
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Day Slots */}
        <section className="space-y-6">
          {SLOTS.map(slot => (
            <div key={slot.id} className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-2">
                  <slot.icon className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-slate-600">{slot.label}</h3>
                </div>
                <span className="text-xs font-bold text-slate-400">${Math.round(currentDay[slot.id].reduce((sum, i) => sum + i.actualCost, 0))}</span>
              </div>
              
              <div className="space-y-3">
                {currentDay[slot.id].length > 0 ? (
                  currentDay[slot.id].map(item => (
                    <motion.div 
                      layout
                      key={`${item.id}-${slot.id}`}
                      className="bg-white border border-slate-100 p-4 rounded-3xl shadow-sm flex items-center justify-between group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center">
                          <span className="text-blue-600 text-xs font-black">{item.category[0]}</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-800">{item.name}</p>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase">
                            <span>{item.category}</span>
                            <span>•</span>
                            <span className="text-slate-600">${item.actualCost}</span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => removeItem(item.id, slot.id)}
                        className="p-2 text-slate-200 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-xs text-slate-300 font-medium italic py-2">Nothing planned yet. Tap + to add something.</p>
                )}
                <button 
                  onClick={() => { setActiveSlot(slot.id); setIsAddModalOpen(true); }}
                  className="w-full py-4 border-2 border-dashed border-slate-100 rounded-3xl text-teal-600 font-bold text-xs flex items-center justify-center gap-2 hover:bg-teal-50 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Add Place / Event
                </button>
              </div>
            </div>
          ))}
        </section>

        {/* Recent & Favorites */}
        <section className="space-y-4">
          <h3 className="font-bold text-slate-800 px-1">Quick Re-add</h3>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-1">
            {recentPlaces.map(p => (
              <button 
                key={p.id}
                onClick={() => handleAddItem(p, activeSlot)}
                className="flex-shrink-0 w-32 space-y-2 text-left bg-slate-50 p-3 rounded-2xl border border-slate-100 group"
              >
                <div className="bg-white p-2 rounded-xl inline-block group-hover:text-blue-600 transition-colors">
                  {favorites.includes(p.id) ? <Heart className="w-4 h-4 fill-red-500 text-red-500" /> : <Plus className="w-4 h-4" />}
                </div>
                <p className="text-[10px] font-bold text-slate-800 truncate">{p.name}</p>
                <p className="text-[9px] font-medium text-slate-400 truncate">{p.city}</p>
              </button>
            ))}
            {recentPlaces.length === 0 && <p className="text-xs text-slate-300 italic">Recently added items will appear here.</p>}
          </div>
        </section>

        {/* Quick Facts Panel */}
        <section className="bg-slate-900 rounded-[2.5rem] p-8 text-white space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400" />
              Quick Facts
            </h3>
            <span className="text-xs font-bold text-slate-500 uppercase">{activeCity}</span>
          </div>

          <QuickFactsPanel city={activeCity} />
        </section>
      </main>

      {/* Add Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: 200, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 200, opacity: 0 }}
              className="bg-white w-full max-w-xl rounded-[3rem] p-8 shadow-2xl relative max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="space-y-6 mb-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-black italic tracking-tight underline decoration-blue-500 underline-offset-8">Explore</h2>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
                </div>
                
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input 
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                    placeholder="Search Mumbai, Tokyo..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {cities.map(city => (
                    <button 
                      key={city}
                      onClick={() => setSelectedCity(city)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCity === city ? 'bg-slate-900 text-white scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {city}
                    </button>
                  ))}
                </div>
                
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {['All', ...CATEGORIES].map(cat => (
                    <button 
                      key={cat}
                      onClick={() => setSelectedCategory(cat as Category | 'All')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${selectedCategory === cat ? 'bg-blue-600 text-white scale-105' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                {filteredPlaces.map(place => (
                  <button 
                    key={place.id}
                    onClick={() => { setItemDetail(place); setEditCost(place.estimatedCostUSD.toString()); }}
                    className="w-full text-left bg-slate-50 p-6 rounded-3xl border border-slate-100 hover:shadow-md hover:scale-[1.01] transition-all flex justify-between items-center group"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">{place.category}</span>
                        <div className="flex items-center text-amber-500 gap-0.5 px-2 py-0.5 bg-amber-50 rounded-lg">
                          <Star className="w-3 h-3 fill-amber-500" />
                          <span className="text-[10px] font-bold">{place.rating}</span>
                        </div>
                      </div>
                      <h4 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">{place.name}</h4>
                      <p className="text-xs font-medium text-slate-400">{place.city} • {place.durationHours}h • ${place.estimatedCostUSD}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                  </button>
                ))}
                
                <div className="py-8 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-400 mb-2">Can't find your place?</p>
                  <button 
                    onClick={() => setShowCustomForm(true)}
                    className="text-blue-600 font-black text-sm hover:underline"
                  >
                    Create Custom Place +
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCustomForm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCustomForm(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Custom Place</h3>
                <button onClick={() => setShowCustomForm(false)} className="p-2 bg-slate-100 rounded-full"><X className="w-4 h-4" /></button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Place Name</label>
                  <input 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl"
                    placeholder="Grandma's Kitchen"
                    value={customItem.name}
                    onChange={(e) => setCustomItem(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">City</label>
                  <input 
                    className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl"
                    placeholder="Paris"
                    value={customItem.city}
                    onChange={(e) => setCustomItem(prev => ({ ...prev, city: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Category</label>
                    <select 
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl text-xs font-bold"
                      value={customItem.category}
                      onChange={(e) => setCustomItem(prev => ({ ...prev, category: e.target.value as Category }))}
                    >
                      {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Cost ($)</label>
                    <input 
                      type="number"
                      className="w-full px-4 py-3 bg-slate-50 border-none rounded-xl"
                      placeholder="20"
                      value={customItem.cost}
                      onChange={(e) => setCustomItem(prev => ({ ...prev, cost: e.target.value }))}
                    />
                  </div>
                </div>
                <button 
                  onClick={handleAddCustom}
                  className="w-full py-4 bg-teal-600 text-white rounded-2xl font-bold mt-4 shadow-lg shadow-teal-100"
                >
                  Add Custom Place
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {itemDetail && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setItemDetail(null)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[3rem] p-8 shadow-2xl relative space-y-6"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black text-slate-800">{itemDetail.name}</h3>
                    <p className="text-sm font-bold text-slate-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {itemDetail.city}, {itemDetail.country}</p>
                  </div>
                  <button onClick={() => toggleFavorite(itemDetail.id)} className="p-3 bg-slate-50 rounded-2xl text-red-500">
                    <Heart className={`w-5 h-5 ${favorites.includes(itemDetail.id) ? 'fill-red-500' : ''}`} />
                  </button>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {itemDetail.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">{tag}</span>
                  ))}
                </div>

                <p className="text-sm text-slate-500 leading-relaxed font-medium">
                  {itemDetail.description}
                </p>

                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Hours</p>
                    <p className="text-xs font-bold text-slate-700">{itemDetail.openingHours}</p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Duration</p>
                    <p className="text-xs font-bold text-slate-700">{itemDetail.durationHours} Hours</p>
                  </div>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-bold text-slate-800">Actual Cost ($)</label>
                    <input 
                      type="number" 
                      className="w-24 px-3 py-2 bg-slate-50 border-none rounded-xl text-right font-black text-blue-600 focus:ring-2 focus:ring-blue-500"
                      value={editCost}
                      onChange={(e) => setEditCost(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={() => handleAddItem(itemDetail, activeSlot)}
                    className="w-full py-5 bg-blue-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-blue-100 ring-4 ring-white transition-all active:scale-95"
                  >
                    Add to {activeSlot}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const QuickFactsPanel = ({ city }: { city: string }) => {
  const [activeSubTab, setActiveSubTab] = useState('weather');
  const details = {
    'Mumbai': {
      currency: '1 USD ≈ 83 INR',
      language: 'Hindi / Marathi',
      phrases: ['Namaste (Hello)', 'Dhanyawad (Thanks)', 'Kuthe (Where)', 'Kiti? (How much?)', 'Madat kara (Help)'],
      emergency: { police: '100', ambo: '102', tourist: '1363' },
      culture: ['Remove shoes inside homes', 'Avoid public displays of affection', 'Eat with your right hand'],
      timeZone: 'GMT +5.5'
    },
    'Tokyo': {
      currency: '1 USD ≈ 150 JPY',
      language: 'Japanese',
      phrases: ['Konnichiwa', 'Arigatou', 'Doko', 'Ikura', 'Tasukete'],
      emergency: { police: '110', ambo: '119', tourist: '03-3501-0110' },
      culture: ['Don’t tip at restaurants', 'Stay quiet on public transport', 'Bow when greeting'],
      timeZone: 'GMT +9'
    },
    'New York': {
      currency: 'Local: USD',
      language: 'English',
      phrases: ['Hi', 'Thanks', 'Where', 'How much', 'Help'],
      emergency: { police: '911', ambo: '911', tourist: '311' },
      culture: ['18-25% tipping is standard', 'Walk fast on sidewalks', 'Wait for green man to cross'],
      timeZone: 'GMT -4'
    }
  };

  const data = details[city as keyof typeof details] || details['Mumbai'];
  const weather = getWeather(city);
  const time = getRelativeTime(city);

  const tabs = [
    { id: 'weather', icon: Thermometer },
    { id: 'time', icon: Clock },
    { id: 'currency', icon: Globe },
    { id: 'lang', icon: MessageCircle },
    { id: 'safety', icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between p-1 bg-white/10 rounded-2xl">
        {tabs.map(tab => (
          <button 
            key={tab.id} 
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex-1 p-3 flex justify-center rounded-xl transition-all ${activeSubTab === tab.id ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400 hover:text-white'}`}
          >
            <tab.icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div 
          key={activeSubTab} 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }} 
          exit={{ opacity: 0, y: -10 }}
          className="min-h-[120px]"
        >
          {activeSubTab === 'weather' && (
            <div className="flex items-center gap-6">
              <span className="text-6xl">{weather.emoji}</span>
              <div>
                <p className="text-4xl font-black">{weather.temp}°C</p>
                <p className="text-xs font-bold text-slate-500 uppercase">Current Weather</p>
              </div>
            </div>
          )}
          {activeSubTab === 'time' && (
            <div className="space-y-1">
              <p className="text-4xl font-black">{time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              <p className="text-xs font-bold text-slate-500 uppercase">Local Time ({data.timeZone})</p>
            </div>
          )}
          {activeSubTab === 'currency' && (
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center font-black text-xl">$</div>
              <div>
                <p className="text-2xl font-bold">{data.currency}</p>
                <p className="text-xs font-bold text-slate-500 uppercase">Rough Conversion</p>
              </div>
            </div>
          )}
          {activeSubTab === 'lang' && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-blue-400 uppercase tracking-widest">{data.language}</p>
              <div className="flex flex-wrap gap-2">
                {data.phrases.map(p => <span key={p} className="px-3 py-1 bg-white/10 rounded-lg text-[10px] font-bold">{p}</span>)}
              </div>
            </div>
          )}
          {activeSubTab === 'safety' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-500/20 p-3 rounded-2xl border border-red-500/30">
                <p className="text-[10px] font-bold text-red-300 uppercase">Emergency</p>
                <p className="text-lg font-black text-red-500">{data.emergency.police}</p>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Tourist Helpline</p>
                <p className="text-lg font-black text-slate-300 truncate">{data.emergency.tourist}</p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="border-t border-white/10 pt-4 space-y-2">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cultural Notes</p>
        <ul className="space-y-1">
          {data.culture.map((note, idx) => (
            <li key={idx} className="text-xs font-medium text-slate-300 flex items-start gap-2">
              <span className="text-blue-400">•</span> {note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
