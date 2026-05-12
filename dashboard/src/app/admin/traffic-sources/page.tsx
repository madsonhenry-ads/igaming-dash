'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus, Settings } from 'lucide-react';

export default function TrafficSourcesPage() {
  const { user, loading } = useAuth();
  const [syncing, setSyncing] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">Loading traffic sources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Traffic Sources</h1>
          <p className="text-muted-foreground">
            Manage your advertising campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Facebook
          </Button>
          <Button variant="outline">
            <Settings className="mr-2 h-4 w-4" />
            Configure
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facebook Campaigns</CardTitle>
          <CardDescription>
            Your Facebook Ads campaigns and performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Plus className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No campaigns synced yet</h3>
            <p className="text-muted-foreground mb-4">
              Sync your Facebook campaigns to see their performance
            </p>
            <Button>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Campaigns
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
