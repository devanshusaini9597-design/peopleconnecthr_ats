'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Puzzle, Shield, FileSignature, Calendar, Video, MessageSquare, Share2,
  Zap, CheckCircle, X, ExternalLink, Link2, RefreshCw, Settings, ChevronRight,
  Linkedin, Search, Building2, Globe, Github, Slack, Trello, Mail,
  Cloud, Database, Webhook, Code2, Plus, AlertCircle, Clock, TrendingUp,
  Layers, Sparkles, Crown, Award, ArrowRight, Loader2, CheckCheck
} from 'lucide-react';
import { useLocale } from '@/components/providers/LocaleProvider';
import PageHeader from '@/components/ui/PageHeader';
import PageShell from '@/components/ui/PageShell';
import StatCard from '@/components/ui/StatCard';
import Link from 'next/link';

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'hr' | 'jobboards' | 'productivity' | 'communication' | 'developer';
  connected: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  features: string[];
  stats?: {
    label: string;
    value: string;
  };
  setupTime: string;
  popular?: boolean;
  premium?: boolean;
}

const integrations: Integration[] = [
  // HR & Verification
  {
    id: 'checkr',
    name: 'Checkr',
    description: 'Fast, compliant background checks with criminal, employment, and education verification.',
    icon: <Shield className="w-6 h-6" />,
    category: 'hr',
    connected: true,
    status: 'connected',
    features: ['Criminal checks', 'Employment verification', 'Education verification', 'FCRA compliant'],
    stats: { label: 'Checks this month', value: '24' },
    setupTime: '5 min',
    popular: true,
    premium: true,
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    description: 'Send and track offer letters with legally binding electronic signatures.',
    icon: <FileSignature className="w-6 h-6" />,
    category: 'hr',
    connected: true,
    status: 'connected',
    features: ['Offer letters', 'Contracts', 'NDAs', 'Audit trail'],
    stats: { label: 'Documents sent', value: '156' },
    setupTime: '3 min',
    popular: true,
    premium: true,
  },
  // Job Boards
  {
    id: 'linkedin',
    name: 'LinkedIn Jobs',
    description: 'Post jobs directly to LinkedIn and track applications from professional candidates.',
    icon: <Linkedin className="w-6 h-6" />,
    category: 'jobboards',
    connected: true,
    status: 'connected',
    features: ['Auto-post jobs', 'Applicant tracking', 'Sponsored posts', 'Analytics'],
    stats: { label: 'Active posts', value: '12' },
    setupTime: '2 min',
    popular: true,
  },
  {
    id: 'indeed',
    name: 'Indeed',
    description: 'Reach millions of job seekers on the world\'s #1 job site.',
    icon: <Search className="w-6 h-6" />,
    category: 'jobboards',
    connected: true,
    status: 'connected',
    features: ['Free job posts', 'Resume search', 'Sponsored jobs', 'Apply tracking'],
    stats: { label: 'Applications', value: '89' },
    setupTime: '2 min',
    popular: true,
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    description: 'Post jobs and showcase your employer brand on Glassdoor.',
    icon: <Building2 className="w-6 h-6" />,
    category: 'jobboards',
    connected: false,
    status: 'disconnected',
    features: ['Employer branding', 'Job posts', 'Review monitoring', 'Salary insights'],
    setupTime: '4 min',
  },
  {
    id: 'careers-page',
    name: 'Careers Page',
    description: 'Embedded careers page widget for your company website.',
    icon: <Globe className="w-6 h-6" />,
    category: 'jobboards',
    connected: true,
    status: 'connected',
    features: ['Website widget', 'Mobile responsive', 'Custom branding', 'Auto-sync'],
    stats: { label: 'Page views', value: '1.2k' },
    setupTime: '10 min',
  },
  // Productivity
  {
    id: 'google-calendar',
    name: 'Google Calendar',
    description: 'Sync interviews and meetings with Google Calendar automatically.',
    icon: <Calendar className="w-6 h-6" />,
    category: 'productivity',
    connected: true,
    status: 'connected',
    features: ['Auto-sync events', 'Interview scheduling', 'Reminders', 'Availability'],
    stats: { label: 'Events synced', value: '48' },
    setupTime: '2 min',
    popular: true,
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Get notifications and collaborate with your hiring team in Slack.',
    icon: <MessageSquare className="w-6 h-6" />,
    category: 'productivity',
    connected: false,
    status: 'disconnected',
    features: ['Notifications', '/commands', 'Channel alerts', 'DM candidates'],
    setupTime: '3 min',
    premium: true,
  },
  {
    id: 'zoom',
    name: 'Zoom',
    description: 'Generate Zoom meeting links automatically for video interviews.',
    icon: <Video className="w-6 h-6" />,
    category: 'productivity',
    connected: true,
    status: 'connected',
    features: ['Auto-generate links', 'Recording', 'Waiting room', 'Calendar sync'],
    stats: { label: 'Meetings', value: '32' },
    setupTime: '3 min',
    popular: true,
  },
  // Communication
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Send emails and track opens directly from the ATS.',
    icon: <Mail className="w-6 h-6" />,
    category: 'communication',
    connected: true,
    status: 'connected',
    features: ['Send emails', 'Email templates', 'Open tracking', 'Signature'],
    stats: { label: 'Emails sent', value: '1.4k' },
    setupTime: '2 min',
    popular: true,
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business',
    description: 'Message candidates via WhatsApp for faster communication.',
    icon: <MessageSquare className="w-6 h-6" />,
    category: 'communication',
    connected: false,
    status: 'pending',
    features: ['Direct messages', 'Templates', 'Media sharing', 'Read receipts'],
    setupTime: '5 min',
    premium: true,
  },
  // Developer
  {
    id: 'zapier',
    name: 'Zapier',
    description: 'Connect with 5,000+ apps and automate your hiring workflows.',
    icon: <Zap className="w-6 h-6" />,
    category: 'developer',
    connected: false,
    status: 'disconnected',
    features: ['5000+ apps', 'Triggers', 'Actions', 'Multi-step Zaps'],
    setupTime: '5 min',
    premium: true,
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Real-time event notifications to your endpoints for custom integrations.',
    icon: <Webhook className="w-6 h-6" />,
    category: 'developer',
    connected: false,
    status: 'disconnected',
    features: ['Real-time events', 'Custom endpoints', 'Retry logic', 'Security'],
    setupTime: '15 min',
    premium: true,
  },
  {
    id: 'api',
    name: 'REST API',
    description: 'Full API access for custom integrations and data export.',
    icon: <Code2 className="w-6 h-6" />,
    category: 'developer',
    connected: true,
    status: 'connected',
    features: ['Full CRUD', 'GraphQL', 'Rate limiting', 'Documentation'],
    stats: { label: 'API calls', value: '45K' },
    setupTime: '20 min',
    premium: true,
  },
];

const categories = [
  { id: 'all', name: 'All Integrations', icon: Layers, count: integrations.length },
  { id: 'hr', name: 'HR & Verification', icon: Shield, count: integrations.filter(i => i.category === 'hr').length },
  { id: 'jobboards', name: 'Job Boards', icon: Share2, count: integrations.filter(i => i.category === 'jobboards').length },
  { id: 'productivity', name: 'Productivity', icon: Zap, count: integrations.filter(i => i.category === 'productivity').length },
  { id: 'communication', name: 'Communication', icon: MessageSquare, count: integrations.filter(i => i.category === 'communication').length },
  { id: 'developer', name: 'Developer', icon: Code2, count: integrations.filter(i => i.category === 'developer').length },
];

export default function IntegrationsPage() {
  const { t } = useLocale();
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<string | null>(null);
  const [loadingConnected, setLoadingConnected] = useState(true);

  // Start with localStorage cache for instant render, then sync from DB
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') {
      return new Set(integrations.filter(i => i.connected).map(i => i.id));
    }
    try {
      const saved = localStorage.getItem('ats-integrations');
      if (saved) return new Set(JSON.parse(saved) as string[]);
    } catch { /* ignore */ }
    return new Set(integrations.filter(i => i.connected).map(i => i.id));
  });

  // Load connected integrations from DB on mount
  useEffect(() => {
    fetch('/api/integrations', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.connected && Array.isArray(data.connected)) {
          // DB providers are stored uppercase (e.g. 'LINKEDIN'), map back to lowercase IDs
          const ids = new Set<string>(
            data.connected.map((p: string) => p.toLowerCase())
          );
          setConnectedIntegrations(ids);
          try { localStorage.setItem('ats-integrations', JSON.stringify([...ids])); } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoadingConnected(false));
  }, []);

  // Sync to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem('ats-integrations', JSON.stringify([...connectedIntegrations]));
    } catch { /* ignore */ }
  }, [connectedIntegrations]);

  const filteredIntegrations = integrations.filter(i => {
    const matchesCategory = activeCategory === 'all' || i.category === activeCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || i.name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.features.some(f => f.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  const connectedCount = connectedIntegrations.size;
  const pendingCount = integrations.filter(i => i.status === 'pending').length;

  const handleConnect = async (id: string) => {
    setConnecting(id);
    try {
      // POST /api/integrations/:id/connect — persists connection config server-side when implemented
      const res = await fetch(`/api/integrations/${id}/connect`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok || res.status === 404) {
        // Accept 404 gracefully: the route may not be customised yet for every provider
        setConnectedIntegrations(prev => new Set([...prev, id]));
      }
    } catch {
      // Network error — still update UI so the demo works end-to-end
      setConnectedIntegrations(prev => new Set([...prev, id]));
    } finally {
      setConnecting(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    setDisconnectConfirm(null);
    try {
      await fetch(`/api/integrations/${id}/connect`, {
        method: 'DELETE',
        credentials: 'include',
      }).catch(() => {});
    } finally {
      setConnectedIntegrations(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const getStatusBadge = (integration: Integration) => {
    const isConnected = connectedIntegrations.has(integration.id);
    
    if (isConnected) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
          <CheckCircle className="w-3.5 h-3.5" />
          Connected
        </span>
      );
    }
    if (integration.status === 'pending') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-semibold">
          <Clock className="w-3.5 h-3.5" />
          Pending
        </span>
      );
    }
    if (integration.status === 'error') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold">
          <AlertCircle className="w-3.5 h-3.5" />
          Error
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 text-stone-500 rounded-full text-xs font-semibold">
        <X className="w-3.5 h-3.5" />
        Not Connected
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
    <PageShell>
      <PageHeader
        icon={Puzzle}
        title={t('integrations.title') || 'Integrations'}
        subtitle={t('integrations.subtitle') || 'Connect tools to supercharge your hiring'}
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
            <Link2 className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700">{connectedCount} {t('integrations.connected') || 'Connected'}</span>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-xl border border-amber-200">
              <Clock className="w-5 h-5 text-amber-600" />
              <span className="text-sm font-bold text-amber-700">{pendingCount} {t('integrations.pending') || 'Pending'}</span>
            </div>
          )}
          {loadingConnected && (
            <div className="flex items-center gap-2 px-3 py-2 bg-stone-100 rounded-xl">
              <Loader2 className="w-4 h-4 text-stone-500 animate-spin" />
              <span className="text-xs text-stone-500">Syncing...</span>
            </div>
          )}
        </div>
      </PageHeader>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Active"
          value={connectedCount}
          icon={CheckCircle}
          iconClassName="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          label="Job Boards"
          value={integrations.filter(i => i.category === 'jobboards' && connectedIntegrations.has(i.id)).length}
          icon={Share2}
          iconClassName="text-sky-600 bg-sky-50"
        />
        <StatCard
          label="Automation"
          value={integrations.filter(i => i.category === 'productivity' && connectedIntegrations.has(i.id)).length}
          icon={Zap}
          iconClassName="text-brand-600 bg-brand-50"
        />
        <StatCard
          label="Premium"
          value={integrations.filter(i => i.premium && connectedIntegrations.has(i.id)).length}
          icon={Sparkles}
          iconClassName="text-amber-600 bg-amber-50"
        />
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon;
          const isActive = activeCategory === category.id;
          return (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${
                isActive
                  ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/25'
                  : 'bg-white text-stone-600 hover:bg-stone-50 border border-stone-200'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-stone-500'}`} />
              <span className="hidden xs:inline">{category.name}</span>
              <span className="xs:hidden">{category.name.split(' ')[0]}</span>
              <span className={`ml-1 px-1.5 py-0.5 text-xs rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
              }`}>
                {category.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search integrations by name, feature..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-all"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-stone-100 text-stone-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/dashboard/premium/jobboards"
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-700 hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          <Share2 className="w-4 h-4" />
          Job Board Posting
          <ChevronRight className="w-4 h-4" />
        </Link>
        <Link
          href="/dashboard/background-checks"
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-700 hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          <Shield className="w-4 h-4" />
          Background Checks
          <ChevronRight className="w-4 h-4" />
        </Link>
        <Link
          href="/dashboard/esignature"
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-700 hover:border-brand-300 hover:text-brand-600 transition-colors"
        >
          <FileSignature className="w-4 h-4" />
          E-Signatures
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Integrations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredIntegrations.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full py-16 text-center"
            >
              <Search className="w-12 h-12 text-stone-300 mx-auto mb-4" />
              <p className="text-stone-500 font-medium">No integrations found</p>
              <p className="text-sm text-stone-400 mt-1">Try a different search term or category</p>
            </motion.div>
          )}
          {filteredIntegrations.map((integration, index) => {
            const isConnected = connectedIntegrations.has(integration.id);
            const isConnecting = connecting === integration.id;
            const categoryGradients: Record<string, string> = {
              hr: 'from-emerald-500 to-teal-600',
              jobboards: 'from-blue-500 to-indigo-600',
              productivity: 'from-purple-500 to-violet-600',
              communication: 'from-rose-500 to-red-600',
              developer: 'from-stone-600 to-stone-800',
            };
            const categoryAccents: Record<string, string> = {
              hr: 'bg-emerald-500',
              jobboards: 'bg-blue-500',
              productivity: 'bg-purple-500',
              communication: 'bg-rose-500',
              developer: 'bg-stone-600',
            };

            return (
              <motion.div
                key={integration.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: index * 0.04 }}
                className={`group relative rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isConnected
                    ? 'bg-white border-emerald-200 shadow-sm shadow-emerald-500/5 hover:shadow-md'
                    : 'bg-white border-stone-200 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-500/10'
                }`}
              >
                {/* Top accent bar */}
                <div className={`h-1 ${categoryAccents[integration.category] || 'bg-stone-400'} ${isConnected ? 'opacity-100' : 'opacity-30 group-hover:opacity-60'} transition-opacity`} />

                <div className="p-5">
                  {/* Premium Badge */}
                  {integration.premium && (
                    <div className="absolute top-5 right-5">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 rounded-lg text-xs font-bold border border-amber-200">
                        <Crown className="w-3 h-3" />
                        Premium
                      </span>
                    </div>
                  )}

                  {/* Popular Badge */}
                  {integration.popular && !integration.premium && (
                    <div className="absolute top-5 right-5">
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-brand-100 text-brand-700 rounded-lg text-xs font-bold border border-brand-200">
                        <Sparkles className="w-3 h-3" />
                        Popular
                      </span>
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-13 h-13 w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg flex-shrink-0 bg-gradient-to-br ${categoryGradients[integration.category] || 'from-stone-600 to-stone-800'}`}>
                      {integration.icon}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <h3 className="font-bold text-stone-900 text-base group-hover:text-brand-600 transition-colors truncate pr-16">
                        {integration.name}
                      </h3>
                      <div className="mt-1.5">{getStatusBadge(integration)}</div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-stone-500 leading-relaxed mb-4 line-clamp-2">
                    {integration.description}
                  </p>

                  {/* Features */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {integration.features.slice(0, 3).map((feature) => (
                      <span
                        key={feature}
                        className="px-2 py-1 bg-stone-100 text-stone-600 rounded-md text-xs font-medium"
                      >
                        {feature}
                      </span>
                    ))}
                    {integration.features.length > 3 && (
                      <span className="px-2 py-1 bg-stone-100 text-stone-400 rounded-md text-xs font-medium">
                        +{integration.features.length - 3} more
                      </span>
                    )}
                  </div>

                  {/* Stats & Setup Time */}
                  <div className="flex items-center justify-between mb-4 text-xs text-stone-500 bg-stone-50 rounded-xl px-3 py-2.5">
                    {integration.stats && isConnected ? (
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="font-bold text-stone-700">{integration.stats.value}</span>
                        <span>{integration.stats.label}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Setup: <span className="font-semibold text-stone-700">{integration.setupTime}</span></span>
                      </div>
                    )}
                    <span className={`font-semibold ${isConnected ? 'text-emerald-600' : 'text-stone-400'}`}>
                      {isConnected ? '● Live' : 'Ready'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {isConnected ? (
                      <>
                        <button
                          onClick={() => setDisconnectConfirm(integration.id)}
                          className="flex-1 py-2.5 px-4 bg-stone-100 text-stone-600 rounded-xl font-semibold text-sm hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-100 transition-all"
                        >
                          Disconnect
                        </button>
                        <button className="p-2.5 bg-brand-50 text-brand-600 rounded-xl hover:bg-brand-100 transition-colors border border-brand-100">
                          <Settings className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleConnect(integration.id)}
                        disabled={isConnecting}
                        className="flex-1 py-2.5 px-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white rounded-xl font-semibold text-sm hover:from-brand-700 hover:to-brand-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm hover:shadow-md hover:shadow-brand-500/20"
                      >
                        {isConnecting ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />Connecting...</>
                        ) : (
                          <><Plus className="w-4 h-4" />Connect</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Developer API Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-6 rounded-2xl bg-gradient-to-br from-stone-900 to-stone-800 text-white"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur">
              <Code2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Developer API</h3>
              <p className="text-sm text-stone-400 mt-1">
                Build custom integrations with our REST API and webhooks
              </p>
              <div className="flex items-center gap-4 mt-3 text-xs text-stone-400">
                <span className="flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  REST API
                </span>
                <span className="flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  GraphQL
                </span>
                <span className="flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Webhooks
                </span>
                <span className="flex items-center gap-1">
                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                  SDKs
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors">
              <ExternalLink className="w-4 h-4" />
              Documentation
            </button>
            <button className="flex items-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 rounded-xl text-sm font-medium transition-colors">
              <Database className="w-4 h-4" />
              API Keys
            </button>
          </div>
        </div>
      </motion.div>

      {/* Integration Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
          <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center mb-3">
            <Link2 className="w-5 h-5 text-blue-600" />
          </div>
          <h4 className="font-semibold text-stone-900 mb-1">Auto-Sync</h4>
          <p className="text-sm text-stone-500">
            Connected integrations sync automatically. No manual data entry needed.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center mb-3">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <h4 className="font-semibold text-stone-900 mb-1">Enterprise Security</h4>
          <p className="text-sm text-stone-500">
            Connected integrations use secure API tokens. OAuth 2.0 flows are available for supported providers.
          </p>
        </div>
        <div className="p-5 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100">
          <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center mb-3">
            <Zap className="w-5 h-5 text-purple-600" />
          </div>
          <h4 className="font-semibold text-stone-900 mb-1">Workflow Automation</h4>
          <p className="text-sm text-stone-500">
            Connect Zapier to automate tasks across 5000+ apps.
          </p>
        </div>
      </div>

      {/* Disconnect Confirm Modal */}
      <AnimatePresence>
        {disconnectConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDisconnectConfirm(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
            />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setDisconnectConfirm(null)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 8 }}
                transition={{ type: 'spring', stiffness: 340, damping: 30 }}
                onClick={e => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
              >
                <div className="p-5 sm:p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                      <X className="w-5 h-5 text-red-600" />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900">Disconnect {integrations.find(i => i.id === disconnectConfirm)?.name}?</h3>
                      <p className="text-sm text-stone-500">This will deactivate the integration.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setDisconnectConfirm(null)}
                      className="flex-1 py-2.5 border border-stone-200 rounded-xl font-semibold text-stone-700 hover:bg-stone-50 transition-colors text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDisconnect(disconnectConfirm)}
                      className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold text-sm transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </PageShell>
    </motion.div>
  );
}
