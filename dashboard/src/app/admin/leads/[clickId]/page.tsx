'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { ArrowLeft, Mail, Phone, Tag, Calendar, ExternalLink } from 'lucide-react';

interface LeadEvent {
  id: string;
  event: string;
  amount: number | null;
  currency: string;
  metadata: any;
  createdAt: string;
}

interface TagHistory {
  id: string;
  tag: string;
  added: boolean;
  reason: string | null;
  createdAt: string;
}

interface Lead {
  id: string;
  clickId: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  source: string | null;
  campaignId: string | null;
  status: string;
  tags: string[];
  metadata: any;
  createdAt: string;
  updatedAt: string;
  events: LeadEvent[];
  tagsHistory: TagHistory[];
  _count: {
    events: number;
  };
}

export default function LeadDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const clickId = params.clickId as string;

  const [lead, setLead] = useState<Lead | null>(null);
  const [loadingLead, setLoadingLead] = useState(true);

  useEffect(() => {
    if (user && clickId) {
      fetchLead();
    }
  }, [user, clickId]);

  const fetchLead = async () => {
    try {
      setLoadingLead(true);
      const response = await fetch(`/api/leads/${clickId}`);
      const data = await response.json();

      if (data.success) {
        setLead(data.data);
      }
    } catch (error) {
      console.error('Error fetching lead:', error);
    } finally {
      setLoadingLead(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW':
        return 'bg-blue-100 text-blue-800';
      case 'ACTIVE':
        return 'bg-green-100 text-green-800';
      case 'INACTIVE':
        return 'bg-yellow-100 text-yellow-800';
      case 'CHURNED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTagColor = (tag: string) => {
    switch (tag) {
      case 'visitante':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'ftd':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'deposito':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'redeposito':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'recuperacao':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

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

  if (loading || loadingLead) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Loading lead...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">Lead not found</p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.back()}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">
            {lead.name || 'Lead Details'}
          </h1>
          <p className="text-muted-foreground">{lead.clickId}</p>
        </div>
        <Button>Edit Lead</Button>
      </div>

      {/* Lead Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Lead Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{lead.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">
                {lead.email ? (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {lead.email}
                  </span>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">
                {lead.phone ? (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {lead.phone}
                  </span>
                ) : (
                  '-'
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge className={getStatusColor(lead.status)}>
                {lead.status}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Source</p>
              <p className="font-medium capitalize">{lead.source || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Campaign ID</p>
              <p className="font-medium font-mono text-sm">{lead.campaignId || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created</p>
              <p className="font-medium">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(lead.createdAt).toLocaleString()}
                </span>
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Events</p>
              <p className="font-medium">{lead._count.events}</p>
            </div>
          </div>

          <Separator className="my-4" />

          <div>
            <p className="text-sm text-muted-foreground mb-2">
              <Tag className="inline h-3 w-3 mr-1" />
              Tags
            </p>
            <div className="flex gap-2 flex-wrap">
              {(lead.tags || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No tags</p>
              ) : (
                (lead.tags || []).map((tag) => (
                  <Badge
                    key={tag}
                    variant="outline"
                    className={getTagColor(tag)}
                  >
                    {tag}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="timeline" className="space-y-4">
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="tags">Tag History</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Event Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.events.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No events yet
                </p>
              ) : (
                <div className="space-y-4">
                  {lead.events.map((event) => (
                    <div key={event.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                          <span className="text-lg">
                            {getEventIcon(event.event)}
                          </span>
                        </div>
                        {event !== lead.events[lead.events.length - 1] && (
                          <div className="w-px h-full bg-border mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-8">
                        <div className="flex items-center gap-2">
                          <p className="font-medium capitalize">{event.event}</p>
                          <Badge variant="outline" className="text-xs">
                            {new Date(event.createdAt).toLocaleString()}
                          </Badge>
                        </div>
                        {event.amount && (
                          <p className="text-sm text-muted-foreground">
                            Amount: {event.amount} {event.currency}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tag History</CardTitle>
            </CardHeader>
            <CardContent>
              {lead.tagsHistory.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No tag history
                </p>
              ) : (
                <div className="space-y-2">
                  {lead.tagsHistory.map((history) => (
                    <div
                      key={history.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className={
                            history.added
                              ? 'bg-green-50 text-green-700 border-green-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }
                        >
                          {history.added ? '+' : '-'} {history.tag}
                        </Badge>
                        {history.reason && (
                          <span className="text-sm text-muted-foreground">
                            {history.reason}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(history.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="metadata" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(lead.metadata || {}).length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No metadata
                </p>
              ) : (
                <pre className="text-sm overflow-x-auto">
                  {JSON.stringify(lead.metadata, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
