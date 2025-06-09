"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CrownIcon, ZapIcon, SettingsIcon } from "lucide-react";

interface SubscriptionStatusProps {
  className?: string;
}

export function SubscriptionStatus({ className }: SubscriptionStatusProps) {
  const [customerState, setCustomerState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCustomerState = async () => {
      try {
        const { data } = await authClient.customer.state();
        setCustomerState(data);
      } catch (error) {
        console.error("Error fetching customer state:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomerState();
  }, []);

  const handleManageSubscription = async () => {
    try {
      await authClient.customer.portal();
    } catch (error) {
      console.error("Error opening customer portal:", error);
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasActiveSubscription = customerState?.activeSubscriptions?.length > 0;
  const subscription = customerState?.activeSubscriptions?.[0];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {hasActiveSubscription ? (
              <CrownIcon className="w-5 h-5 text-yellow-600" />
            ) : (
              <ZapIcon className="w-5 h-5 text-slate-600" />
            )}
            <CardTitle className="text-lg">
              {hasActiveSubscription ? "Pro Plan" : "Free Plan"}
            </CardTitle>
          </div>
          <Badge variant={hasActiveSubscription ? "default" : "secondary"}>
            {hasActiveSubscription ? "Active" : "Free"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {hasActiveSubscription && subscription ? (
          <div className="space-y-2">
            <CardDescription>
              Your Pro subscription is active and includes unlimited AI
              generations.
            </CardDescription>
            {subscription.currentPeriodEnd && (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Next billing:{" "}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <CardDescription>
            You're on the free plan with limited AI generations. Upgrade to Pro
            for unlimited access.
          </CardDescription>
        )}

        <div className="flex gap-2">
          {hasActiveSubscription ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              className="flex items-center gap-2"
            >
              <SettingsIcon className="w-4 h-4" />
              Manage Subscription
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => (window.location.href = "/onboarding")}
              className="flex items-center gap-2"
            >
              <CrownIcon className="w-4 h-4" />
              Upgrade to Pro
            </Button>
          )}
        </div>

        {customerState?.usage && (
          <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
            <h4 className="text-sm font-medium mb-2">Usage This Month</h4>
            <div className="space-y-1">
              {customerState.usage.map((meter: any, index: number) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    {meter.meter?.name || "Generations"}
                  </span>
                  <span className="font-medium">
                    {meter.consumed || 0} / {meter.limit || "∞"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
