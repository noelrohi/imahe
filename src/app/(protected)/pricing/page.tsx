"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { CheckIcon, CrownIcon, MailIcon, ZapIcon } from "lucide-react";
import { useTransition } from "react";

export default function BillingPage() {
  const [isPending, startTransition] = useTransition();

  const handleCheckout = (slug: string) => {
    startTransition(async () => {
      try {
        await authClient.customer.portal();
      } catch (error) {
        console.error("Error during checkout:", error);
      }
    });
  };

  const handleContactSales = () => {
    window.location.href =
      "mailto:noelrohi@gmail.com?subject=Enterprise Plan Inquiry";
  };

  const pricingPlans = [
    {
      name: "FREE",
      price: "$0",
      period: "forever",
      description: "Perfect for getting started",
      icon: <ZapIcon className="w-6 h-6 text-slate-600" />,
      badge: "Current Plan",
      badgeVariant: "secondary" as const,
      features: [
        "75 AI image gen per month",
        "All image models access",
        "Standard support",
        "Community access",
      ],
      slug: "free",
      buttonText: "Current Plan",
      buttonVariant: "outline" as const,
      disabled: true,
    },
    {
      name: "PRO",
      price: "$5",
      period: "per month",
      description: "For professionals and creators",
      icon: <CrownIcon className="w-6 h-6 text-yellow-600" />,
      badge: "Most Popular",
      badgeVariant: "default" as const,
      features: [
        "75 AI image gen per month",
        "All image models access",
        "Roll over unused credits",
        "Priority support",
        "Community access",
      ],
      slug: "pro",
      buttonText: "Upgrade to Pro",
      buttonVariant: "default" as const,
      disabled: false,
    },
    {
      name: "Usage-Based",
      price: "$20",
      period: "per month",
      description: "Usage based pricing, starts at $20 per month",
      icon: <ZapIcon className="w-6 h-6 text-green-600" />,
      badge: "Flexible",
      badgeVariant: "outline" as const,
      features: [
        "300 AI image gen per month",
        "Roll over unused credits",
        "All image models access",
        "Priority support",
        "Community access",
      ],
      slug: "usage-based",
      buttonText: "Upgrade now",
      buttonVariant: "default" as const,
      disabled: false,
      isUsageBased: true,
    },
  ];

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Choose Your Plan</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Select the perfect plan for your needs. Upgrade or downgrade at any
          time.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-3 max-w-6xl mx-auto">
        {pricingPlans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative ${
              plan.name === "PRO"
                ? "border-primary shadow-lg scale-105"
                : "border-border"
            }`}
          >
            {plan.name === "PRO" && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <Badge className="px-3 py-1">Most Popular</Badge>
              </div>
            )}

            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">{plan.icon}</div>
              <div className="space-y-2">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <div className="space-y-1">
                  <div className="text-3xl font-bold">
                    {plan.price}
                    {plan.price !== "Custom" && (
                      <span className="text-lg font-normal text-muted-foreground">
                        /{plan.period}
                      </span>
                    )}
                  </div>
                  {plan.price === "Custom" && (
                    <span className="text-lg text-muted-foreground">
                      {plan.period}
                    </span>
                  )}
                </div>
                <CardDescription className="text-base">
                  {plan.description}
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              <ul className="space-y-3">
                {plan.features.map((feature, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                  <li key={index} className="flex items-center gap-3">
                    <CheckIcon className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                variant={plan.buttonVariant}
                size="lg"
                className="w-full"
                disabled={plan.disabled || isPending}
                onClick={() => {
                  if (!plan.disabled) {
                    handleCheckout(plan.slug);
                  }
                }}
              >
                {isPending ? "Loading..." : plan.buttonText}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="text-center space-y-4 pt-8">
        <h3 className="text-xl font-semibold">Need help choosing?</h3>
        <p className="text-muted-foreground">
          Contact our team for personalized recommendations
        </p>
        <Button variant="outline" onClick={handleContactSales}>
          <MailIcon className="w-4 h-4 mr-2" />
          Contact Support
        </Button>
      </div>
    </div>
  );
}
