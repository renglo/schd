import { useMemo } from "react";
import { Clock8, Download, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import DialogPost from "@/components/console/dialog-post";

interface BlueprintField {
  name: string;
  layer?: string;
  options?: Record<string, string>;
  widget?: string;
  required?: boolean;
  label?: string;
  hint?: string;
  [key: string]: unknown;
}

interface Blueprint {
  label: string;
  fields?: BlueprintField[];
  [key: string]: unknown;
}

interface TreeStructure {
  portfolios: {
    [key: string]: {
      name: string;
      portfolio_id: string;
      orgs: object;
      teams: object;
      tools: object;
    };
  };
  user_id: string;
}

interface SchdOnboardingProps {
  tree: TreeStructure;
}

const SCHD_ONBOARDING_BLUEPRINT: Blueprint = {
  label: "Scheduler Onboardings",
  fields: [
    {
      cardinality: "single",
      default: "",
      hint: "Portfolio this handle should belong to:",
      label: "Portfolio",
      layer: "2",
      multilingual: false,
      name: "portfolio",
      order: "2",
      required: false,
      semantic: "hs:portfolio",
      source: "",
      type: "string",
      widget: "text",
    },
    {
      cardinality: "single",
      default: "",
      hint: "Org the app should belong to",
      label: "Org",
      layer: "2",
      multilingual: false,
      name: "org",
      order: "3",
      required: false,
      semantic: "hs:org",
      source: "",
      type: "string",
      widget: "text",
    },
    {
      cardinality: "single",
      default: "Admin",
      hint: "Team the main user should belong to",
      label: "Team",
      layer: "2",
      multilingual: false,
      name: "team",
      order: "4",
      required: false,
      semantic: "hs:team",
      source: "",
      type: "string",
      widget: "text",
    },
    {
      cardinality: "single",
      default: "",
      hint: "Tool the user is getting onboarded to",
      label: "Tool",
      layer: "2",
      multilingual: false,
      name: "tool",
      order: "5",
      required: false,
      semantic: "hs:tool",
      source: "",
      type: "string",
      widget: "text",
    },
    {
      cardinality: "single",
      default: "16",
      hint: "How often should the agent run an operational cycle?",
      label: "Refresh Rate (minutes)",
      layer: "0",
      multilingual: false,
      name: "refresh_rate",
      order: "6",
      required: false,
      semantic: "hs:refresh",
      type: "string",
      widget: "text",
    },
  ],
};

export default function SchdOnboarding({ tree }: SchdOnboardingProps) {
  const onboardingBlueprint = useMemo(() => {
    if (!tree?.portfolios) {
      return SCHD_ONBOARDING_BLUEPRINT;
    }

    const portfolioDict: Record<string, string> = {};
    Object.entries(tree.portfolios).forEach(([portfolioId, portfolio]) => {
      portfolioDict[portfolioId] = portfolio.name;
    });

    return {
      ...SCHD_ONBOARDING_BLUEPRINT,
      fields: SCHD_ONBOARDING_BLUEPRINT.fields!.map((field) => {
        if (field.name === "portfolio") {
          return {
            ...field,
            layer: "0",
            options: portfolioDict,
            widget: "select",
            required: true,
          };
        }
        return field;
      }),
    };
  }, [tree]);

  const refreshAction = () => {};
  const portfolioField = onboardingBlueprint.fields?.find(
    (field: BlueprintField) => field.name === "portfolio"
  );
  const hasPortfolioOptions =
    !!portfolioField?.options && Object.keys(portfolioField.options).length > 0;

  return (
    <Card className="group relative overflow-hidden border-border bg-card transition-all hover:border-accent/50 hover:shadow-lg hover:shadow-accent/5">
      <div className="absolute right-3 top-3">
        <Badge className="bg-accent text-accent-foreground">Verified</Badge>
      </div>
      <CardContent className="p-5">
        <div className="mb-4 flex items-start gap-4">
          <Clock8 size={68} />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-foreground">Scheduler App</h3>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              Configure recurring cycles and automated operations for your agent.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-1.5">
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            scheduling
          </span>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            automation
          </span>
          <span className="rounded-md bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
            operations
          </span>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <div className="flex items-center gap-4">
            <div className="text-xs text-muted-foreground">by Renglo</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Download className="h-3.5 w-3.5" />
              Included
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              Core
            </div>
          </div>
          {hasPortfolioOptions ? (
            <DialogPost
              refreshUp={refreshAction}
              blueprint={onboardingBlueprint}
              title="Activate your portfolio"
              instructions="Please fill the following fields:"
              path={`${import.meta.env.VITE_API_URL}/_schd/run/schd/schd_onboardings`}
              method="POST"
              buttontext="Install"
            />
          ) : (
            <div className="text-xs font-medium text-red-500">Create a portfolio first</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
