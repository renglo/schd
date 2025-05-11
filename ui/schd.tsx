import ToolDataCRUD from "../../../tools/data/ui/pages/tool_data_crud"
import SchdActionProbe from "../../../tools/schd/ui/pages/schd_action_probe"
import SchdToolProbe from "../../../tools/schd/ui/pages/schd_tool_probe"


interface Portfolio {
  name: string;
  portfolio_id: string;
  orgs: Record<string, Org>;
  tools: Record<string, Tool>;
}

interface Org {
  name: string;
  org_id: string;
  tools: string[];
}

interface Tool {
  name: string;
  handle: string;
}

export default function Schd({ portfolio, org, tool, ring, tree }: {
  portfolio: string;
  org: string;
  tool: string;
  ring?: string;  // optional prop since it might be undefined
  tree?: { portfolios: Record<string, Portfolio> };
}) {
 

    console.log('Schd > Ring:',ring)

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
        
          <div className="flex flex-col sm:gap-2 sm:pl-2">

            {ring === 'schd_jobs' && <ToolDataCRUD readonly={false} portfolio={portfolio} org={org} tool={tool} ring={ring} />}
            {ring === 'schd_runs' && <ToolDataCRUD readonly={true} portfolio={portfolio} org={org} tool={tool} ring={ring} />}
            {ring === 'schd_rules' && <ToolDataCRUD readonly={false} portfolio={portfolio} org={org} tool={tool} ring={ring} />}
            {ring === 'schd_actions' && <ToolDataCRUD readonly={false} portfolio={portfolio} org={org} tool={tool} ring={ring} />}
            {ring === 'schd_tools' && <ToolDataCRUD readonly={false} portfolio={portfolio} org={org} tool={tool} ring={ring} />}

            {ring === 'action' && <SchdActionProbe portfolio={portfolio} org={org} tool={tool} />}
            {ring === 'tool' && <SchdToolProbe portfolio={portfolio} org={org} tool={tool} />}

          </div>
        </div>
    )
}