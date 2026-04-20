import React, { useState, useEffect } from 'react';
import { 
  auth, db 
} from './lib/firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc,
  deleteDoc,
  Timestamp
} from 'firebase/firestore';
import { 
  Bot, 
  Package, 
  Send, 
  Settings, 
  Plus, 
  Trash2, 
  ExternalLink, 
  LogOut,
  MessageSquare,
  Copy,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  User as UserIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'config' | 'products' | 'broadcast';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('config');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="min-h-screen bg-[#151619] flex items-center justify-center text-white font-mono">Loading BotMaster...</div>;

  if (!user) return <LoginView />;

  return (
    <div className="min-h-screen bg-[#E6E6E6] flex overflow-hidden">
      {/* Sidebar */}
      <aside className={`${sidebarOpen ? 'w-64' : 'w-0'} bg-[#151619] text-[#8E9299] flex-shrink-0 flex flex-col font-mono h-screen sticky top-0 transition-all duration-300 overflow-hidden`}>
        <div className="p-6 border-b border-[#2A2B2F] flex justify-between items-center">
          <h1 className="text-white text-xl font-bold flex items-center gap-2">
            <Bot className="text-orange-500" />
            BotMaster
          </h1>
          <button onClick={() => setSidebarOpen(false)} className="text-white hover:text-orange-500">×</button>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          <SidebarLink 
            icon={<Settings size={18} />} 
            label="Configuration" 
            active={activeTab === 'config'} 
            onClick={() => setActiveTab('config')}
          />
          <SidebarLink 
            icon={<Package size={18} />} 
            label="Produits" 
            active={activeTab === 'products'} 
            onClick={() => setActiveTab('products')}
          />
          <SidebarLink 
            icon={<Send size={18} />} 
            label="Broadcast" 
            active={activeTab === 'broadcast'} 
            onClick={() => setActiveTab('broadcast')}
          />
        </nav>

        <div className="p-4 border-t border-[#2A2B2F]">
          <button 
            onClick={() => signOut(auth)}
            className="w-full flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-red-900/20 hover:text-red-400 transition-colors text-xs"
          >
            <LogOut size={16} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-8 relative">
        {!sidebarOpen && (
          <button onClick={() => setSidebarOpen(true)} className="absolute top-8 left-4 text-gray-900">
            <Bot size={24} />
          </button>
        )}
        <AnimatePresence mode="wait">
          {activeTab === 'config' && <ConfigView user={user} />}
          {activeTab === 'products' && <ProductsView user={user} />}
          {activeTab === 'broadcast' && <BroadcastView user={user} />}
        </AnimatePresence>
      </main>
    </div>
  );
}

function SidebarLink({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
        active 
          ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20' 
          : 'hover:bg-[#2A2B2F] hover:text-white'
      }`}
    >
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

function LoginView() {
  const login = () => signInWithPopup(auth, new GoogleAuthProvider());
  return (
    <div className="min-h-screen bg-[#151619] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-[#1A1C20] p-8 rounded-2xl border border-[#2A2B2F] text-center"
      >
        <div className="w-16 h-16 bg-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-orange-500/20">
          <Bot size={40} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2 font-mono">Connectez-vous</h1>
        <p className="text-[#8E9299] text-sm mb-8">Accédez à votre plateforme de gestion de chatbot Messenger multi-utilisateurs.</p>
        <button 
          onClick={login}
          className="w-full bg-white text-black font-bold py-3 px-6 rounded-xl hover:bg-orange-500 hover:text-white transition-all flex items-center justify-center gap-3"
        >
          <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="" />
          Se connecter avec Google
        </button>
      </motion.div>
    </div>
  );
}

function ConfigView({ user }: { user: User }) {
  const [config, setConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'configs', user.uid), (doc) => {
      if (doc.exists()) {
        setConfig(doc.data());
      } else {
        const initialToken = Math.random().toString(36).substring(2, 15);
        setConfig({
          verificationToken: initialToken,
          webhookUrl: `${window.location.origin}/webhook/${user.uid}`,
          accessToken: '',
          aiPrompt: 'Vous êtes une IA assistante amicale. Aidez les clients avec leurs questions.',
          defaultResponse: 'Comment puis-je vous aider aujourd\'hui?'
        });
      }
    });
    return unsub;
  }, [user.uid]);

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await setDoc(doc(db, 'configs', user.uid), config);
    setSaving(false);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div 
      key="config"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <header className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-black/5">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuration Messenger</h2>
          <p className="text-sm text-gray-500">Gérez vos identifiants Facebook et comportements IA</p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase bg-green-50 text-green-600 px-3 py-1 rounded-full border border-green-100">
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          Connecté
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <form onSubmit={saveConfig} className="bg-white p-8 rounded-2xl shadow-sm border border-black/5 space-y-6">
          <div className="space-y-4">
            <label className="block text-xs font-mono uppercase tracking-wider text-gray-400">Messenger Access Token</label>
            <input 
              type="password"
              className="w-full bg-gray-50 border border-gray-100 p-3 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none transition-all"
              placeholder="Vôtre Page Access Token..."
              value={config?.accessToken || ''}
              onChange={e => setConfig({...config, accessToken: e.target.value})}
            />
          </div>

          <div className="space-y-4 pt-4 border-t border-gray-100">
            <label className="block text-xs font-mono uppercase tracking-wider text-gray-500">Comportement de l'IA (IA Assistante)</label>
            <textarea 
              className="w-full bg-gray-50 border border-gray-100 p-3 rounded-lg text-sm h-32 focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder="Prompt personnalisé pour l'IA..."
              value={config?.aiPrompt || ''}
              onChange={e => setConfig({...config, aiPrompt: e.target.value})}
            />
            <p className="text-[10px] text-gray-400">Décrivez comment l'IA doit parler et réagir avec vos clients.</p>
          </div>

          <button 
            disabled={saving}
            className="w-full bg-[#151619] text-white p-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-orange-500 transition-all disabled:opacity-50"
          >
            {saving ? 'Sauvegarde...' : 'Enregistrer les paramètres'}
          </button>
        </form>

        <div className="space-y-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-black/5 space-y-6">
            <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-4">Webhook Automatique</h3>
            
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg flex gap-3 items-start">
                <AlertCircle className="text-blue-500 shrink-0" size={18} />
                <p className="text-xs text-blue-700 leading-relaxed font-medium">Copiez ces valeurs dans votre Facebook Developer App (Webhooks).</p>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-mono uppercase text-gray-400">Callback URL</label>
                <div className="flex gap-2">
                  <input readOnly value={config?.webhookUrl || ''} className="flex-1 bg-gray-50 p-2 rounded border border-gray-100 text-[10px] font-mono truncate" />
                  <button onClick={() => copyToClipboard(config.webhookUrl, 'url')} className="p-2 hover:bg-gray-100 rounded transition-colors relative">
                    {copied === 'url' ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-[10px] font-mono uppercase text-gray-400">Verify Token</label>
                <div className="flex gap-2">
                  <input readOnly value={config?.verificationToken || ''} className="flex-1 bg-gray-50 p-2 rounded border border-gray-100 text-[10px] font-mono truncate" />
                  <button onClick={() => copyToClipboard(config.verificationToken, 'token')} className="p-2 hover:bg-gray-100 rounded transition-colors">
                    {copied === 'token' ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-orange-500 p-8 rounded-2xl shadow-lg shadow-orange-500/20 text-white relative overflow-hidden">
            <Bot className="absolute -right-8 -bottom-8 w-40 h-40 opacity-10" />
            <h3 className="text-lg font-bold mb-2">Lovable IA Active</h3>
            <p className="text-xs opacity-90 leading-relaxed">Votre chatbot répond automatiquement aux messages sur Messenger en utilisant l'IA Gemini.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProductsView({ user }: { user: User }) {
  const [products, setProducts] = useState<any[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newProduct, setNewProduct] = useState({ title: '', description: '', fileUrl: '', fileType: 'image' });

  useEffect(() => {
    const q = query(collection(db, 'products'), where('userId', '==', user.uid));
    return onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [user.uid]);

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, 'products'), {
      ...newProduct,
      userId: user.uid,
      createdAt: new Date().toISOString()
    });
    setNewProduct({ title: '', description: '', fileUrl: '', fileType: 'image' });
    setIsAdding(false);
  };

  const deleteProduct = async (id: string) => {
    if (confirm('Supprimer ce produit?')) {
      await deleteDoc(doc(db, 'products', id));
    }
  };

  return (
    <motion.div 
      key="products"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-6xl mx-auto space-y-8"
    >
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Catalogue Produits</h2>
          <p className="text-gray-500">Ces produits seront présentés automatiquement par l'IA</p>
        </div>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-orange-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-600 shadow-lg shadow-orange-500/20 transition-all"
        >
          <Plus size={20} />
          Ajouter Produit
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-xl transition-all">
            <div className="aspect-video bg-gray-100 relative group">
              {p.fileUrl ? (
                p.fileType === 'video' ? (
                  <video src={p.fileUrl} className="w-full h-full object-cover" />
                ) : (
                  <img src={p.fileUrl} alt="" className="w-full h-full object-cover" />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-300">
                  <Package size={48} />
                </div>
              )}
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => deleteProduct(p.id)}
                  className="bg-white p-2 rounded-full text-red-500 hover:bg-red-50 transition-colors shadow-lg"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono uppercase bg-gray-100 px-2 py-0.5 rounded text-gray-500">{p.fileType}</span>
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">{p.title}</h3>
              <p className="text-sm text-gray-600 line-clamp-2">{p.description}</p>
            </div>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-xl p-8 overflow-hidden relative"
            >
              <div className="absolute -right-16 -top-16 w-48 h-48 bg-orange-100 rounded-full blur-3xl opacity-50" />
              <h3 className="text-2xl font-bold mb-6 relative">Nouveau Produit</h3>
              <form onSubmit={addProduct} className="space-y-4 relative">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-gray-400">Titre du produit</label>
                  <input required value={newProduct.title} onChange={e => setNewProduct({...newProduct, title: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl border border-gray-100" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-gray-400">Description</label>
                  <textarea required value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl border border-gray-100 h-24" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-gray-400">Type de média</label>
                    <select value={newProduct.fileType} onChange={e => setNewProduct({...newProduct, fileType: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl border border-gray-100">
                      <option value="image">Image</option>
                      <option value="video">Vidéo</option>
                      <option value="audio">Audio</option>
                      <option value="pdf">PDF (Document)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-gray-400">URL du fichier</label>
                    <input value={newProduct.fileUrl} onChange={e => setNewProduct({...newProduct, fileUrl: e.target.value})} className="w-full bg-gray-50 p-3 rounded-xl border border-gray-100" placeholder="https://..." />
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsAdding(false)} className="flex-1 font-bold p-4 hover:bg-gray-100 rounded-xl transition-colors">Annuler</button>
                  <button type="submit" className="flex-1 bg-orange-500 text-white font-bold p-4 rounded-xl shadow-lg shadow-orange-500/20 hover:bg-orange-600 transition-all">Ajouter au catalogue</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BroadcastView({ user }: { user: User }) {
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [type, setType] = useState<'text' | 'image' | 'audio'>('text');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'messenger_users'), where('userId', '==', user.uid));
    return onSnapshot(q, (snap) => setActiveUsers(snap.size));
  }, [user.uid]);

  useEffect(() => {
    const q = query(collection(db, 'broadcasts'), where('userId', '==', user.uid));
    return onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
        data.sort((a,b) => (b.sentAt || '').localeCompare(a.sentAt || ''));
        setHistory(data);
    });
  }, [user.uid]);

  const sendBroadcast = async () => {
    if (!message && type === 'text') return;
    setSending(true);
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, type, content: message, mediaUrl })
      });
      
      if (res.ok) {
        await addDoc(collection(db, 'broadcasts'), {
          userId: user.uid,
          type,
          content: message,
          mediaUrl,
          sentAt: new Date().toISOString()
        });
        setMessage('');
        setMediaUrl('');
        alert('Broadcast envoyé avec succès!');
      }
    } catch (err) {
      alert('Erreur lors de l\'envoie');
    }
    setSending(false);
  };

  return (
    <motion.div 
      key="broadcast"
      initial={{ opacity: 0, scale: 1.05 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto space-y-8 pb-12"
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-black/5 space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Send className="text-orange-500" />
              Nouveau Broadcast
            </h2>
            
            <div className="flex gap-2 p-1 bg-gray-50 rounded-xl border border-gray-100">
              <button onClick={() => setType('text')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${type === 'text' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                <FileText size={14} /> Texte
              </button>
              <button onClick={() => setType('image')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${type === 'image' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                <ImageIcon size={14} /> Image
              </button>
              <button onClick={() => setType('audio')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${type === 'audio' ? 'bg-white text-orange-500 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>
                <Music size={14} /> Audio
              </button>
            </div>

            <div className="space-y-4">
              {type === 'text' ? (
                <textarea 
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-sm min-h-[150px] focus:ring-2 focus:ring-orange-500 outline-none" 
                  placeholder="Écrivez votre message de promotion ou d'information ici..." 
                />
              ) : (
                <div className="space-y-4">
                  <input 
                    type="text" 
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none" 
                    placeholder={`URL de l'${type === 'image' ? 'image' : 'audio'}...`}
                  />
                  <input 
                    type="text" 
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-100 p-4 rounded-xl text-sm focus:ring-2 focus:ring-orange-500 outline-none" 
                    placeholder="Légende (Optionnel)..." 
                  />
                </div>
              )}
            </div>

            <button 
              onClick={sendBroadcast}
              disabled={sending || activeUsers === 0}
              className="w-full bg-orange-500 text-white p-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-orange-600 shadow-lg shadow-orange-500/20 disabled:opacity-50 transition-all"
            >
              <Send size={18} />
              {sending ? 'Envoi en cours...' : `Envoyer à ${activeUsers} utilisateurs`}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-[#151619] p-6 rounded-2xl text-white">
            <p className="text-[10px] font-mono uppercase text-gray-400 mb-1">Audience Connectée</p>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold">{activeUsers}</span>
              <span className="text-gray-400 text-xs mb-1">utilisateurs</span>
            </div>
            <div className="mt-4 pt-4 border-t border-[#2A2B2F] flex items-center gap-2 text-xs text-orange-400 font-medium">
              <UserIcon size={14} />
              Base de clients active
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-black/5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MessageSquare size={16} className="text-gray-400" />
              Historique
            </h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
              {history.map(h => (
                <div key={h.id} className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex justify-between text-[8px] uppercase font-mono text-gray-400 mb-1">
                    <span>{h.type}</span>
                    <span>{new Date(h.sentAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-[10px] text-gray-600 line-clamp-2">{h.content || 'Fichier média'}</p>
                </div>
              ))}
              {history.length === 0 && <p className="text-center text-xs text-gray-400 py-4">Aucun envoi</p>}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
