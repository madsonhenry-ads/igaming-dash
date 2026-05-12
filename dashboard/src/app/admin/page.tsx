'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Users,
  UserCheck,
  Clock,
  BarChart3,
  ArrowRight,
  ArrowUpRight,
  Wallet,
  Activity,
  Eye,
  Target,
  TrendingUp,
  Tag,
} from 'lucide-react';

interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  activeLeads: number;
  inactiveLeads: number;
  churnedLeads: number;
  conversionRate: number;
  leadsBySource: Array<{ source: string; count: number }>;
  tagDistribution: Record<string, number>;
  recentEvents: Array<{
    id: string;
    event: string;
    lead: {
      clickId: string;
      email: string | null;
      name: string | null;
    };
    createdAt: string;
  }>;
}

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      fetchDashboardData();
    }
  }, [user]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/dashboard');

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <DashboardSkeleton />;
  }

  const statCards = [
    {
      title: 'Total Leads',
      value: stats?.totalLeads || 0,
      icon: Users,
      description: 'All leads in database',
      trend: '+15%',
      trendUp: true,
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Active Leads',
      value: stats?.activeLeads || 0,
      icon: UserCheck,
      description: 'Currently active',
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'New Leads',
      value: stats?.newLeads || 0,
      icon: Clock,
      description: 'Recently added',
      color: 'text-violet-600',
      bg: 'bg-violet-500/10',
    },
    {
      title: 'Conversion Rate',
      value: `${stats?.conversionRate.toFixed(1) || 0}%`,
      icon: Target,
      description: 'Lead to active rate',
      trend: '+5%',
      trendUp: true,
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
    },
  ];

  const quickActions = [
    {
      title: 'Leads',
      description: 'View all leads',
      icon: Users,
      href: '/admin/leads',
      color: 'text-blue-600',
      bg: 'bg-blue-500/10',
    },
    {
      title: 'Traffic Sources',
      description: 'Analyze channels',
      icon: BarChart3,
      href: '/admin/traffic-sources',
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      title: 'Segments',
      description: 'Lead segmentation',
      icon: Tag,
      href: '/admin/segments',
      color: 'text-violet-600',
      bg: 'bg-violet-500/10',
    },
    {
      title: 'Reports',
      description: 'Analytics & insights',
      icon: Activity,
      href: '/admin/reports',
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
    },
  ];

  const getEventIcon = (event: string) => {
    switch (event) {
      case 'click':
        return '👆';
      case 'registration':
        return '📝';
      case 'ftd':
        return '💎';
      case 'deposit':
        return '💰';
      case 'redeposit':
        return '💵';
      case 'recovery':
        return '🔄';
      case 'withdrawal':
        return '🏦';
      case 'bet':
        return '🎲';
      default:
        return '📌';
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your lead management performance
          </p>
        </div>

        {/* Primary Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.title} className="relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-2xl font-bold tracking-tight">{stat.value}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{stat.description}</span>
                  {stat.trend && (
                    <Badge variant="secondary" className="h-5 gap-0.5 px-1.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border-0">
                      <ArrowUpRight className="h-3 w-3" />
                      {stat.trend}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Lead Status Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/10">
                  <Clock className="h-5 w-5 text-violet-600" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{stats?.newLeads || 0}</p>
                  <p className="text-sm text-muted-foreground">New Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{stats?.activeLeads || 0}</p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-500/10">
                  <Activity className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{stats?.inactiveLeads || 0}</p>
                  <p className="text-sm text-muted-foreground">Inactive</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
                  <Target className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{stats?.churnedLeads || 0}</p>
                  <p className="text-sm text-muted-foreground">Churned</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/20"
              onClick={() => router.push(action.href)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${action.bg}`}>
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Data Tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Traffic Sources */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Traffic Sources</CardTitle>
                <CardDescription>Leads by source channel</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => router.push('/admin/traffic-sources')}>
                View all
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              {stats?.leadsBySource && stats.leadsBySource.length > 0 ? (
                <div className="space-y-3">
                  {stats.leadsBySource.map((item, index) => {
                    const total = stats.leadsBySource?.reduce((sum, s) => sum + s.count, 0) || 1;
                    const percentage = (item.count / total) * 100;
                    const sourceColors: Record<string, string> = {
                      facebook: 'bg-blue-500',
                      google: 'bg-red-500',
                      instagram: 'bg-pink-500',
                      tiktok: 'bg-black',
                      direct: 'bg-gray-500',
                    };
                    const color = sourceColors[item.source] || 'bg-gray-400';

                    return (
                      <div key={index} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium capitalize">{item.source}</span>
                          <span className="text-muted-foreground">{item.count} leads</span>
                        </div>
                        <Progress value={percentage} className="h-2">
                          <div className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }} />
                        </Progress>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <EmptyState
                  icon={BarChart3}
                  title="No traffic data"
                  description="Traffic sources will appear here"
                />
              )}
            </CardContent>
          </Card>

          {/* Recent Events */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">Recent Events</CardTitle>
                <CardDescription>Latest lead activities</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => router.push('/admin/leads')}>
                View all
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              {stats?.recentEvents && stats.recentEvents.length > 0 ? (
                <div className="space-y-1">
                  {stats.recentEvents.slice(0, 5).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/admin/leads/${event.lead.clickId}`)}
                    >
                      <span className="text-xl">{getEventIcon(event.event)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium capitalize">{event.event}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.lead.email || event.lead.clickId}
                        </p>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {new Date(event.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Activity}
                  title="No recent events"
                  description="Lead events will appear here"
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tag Distribution */}
        {stats?.tagDistribution && Object.keys(stats.tagDistribution).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tag Distribution</CardTitle>
              <CardDescription>Leads by tag</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {Object.entries(stats.tagDistribution).map(([tag, count]) => (
                  <div key={tag} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Tag className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium capitalize">{tag}</p>
                      <p className="text-xs text-muted-foreground">{count} leads</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}

function EmptyState({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground/70">{description}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-7 w-36 mb-1" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-32 mt-2" />
              <Skeleton className="h-3 w-20 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="flex items-center gap-4 p-5">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div>
                <Skeleton className="h-7 w-16 mb-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
