import ToolDataCRUD from "../../../tools/data/ui/pages/tool_data_crud"
import SchdActionProbe from "../../../tools/schd/ui/pages/schd_action_probe"
import SchdToolProbe from "../../../tools/schd/ui/pages/schd_tool_probe"
import SchdLoop from "../../../tools/schd/ui/pages/schd_loop"
import { useNavigate } from "react-router-dom"
import { useEffect } from "react"


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

export default function Schd({ portfolio, org, tool, section, tree, query }: {
  portfolio: string;
  org: string;
  tool: string;
  section?: string;  // optional prop since it might be undefined
  tree?: { portfolios: Record<string, Portfolio> };
  query?: Record<string, string>; // query args in the url (if any)
}) {
 
    const navigate = useNavigate();

    console.log('Schd > Section:',section)

    // If undefined. It should be redirected to /agent
    useEffect(() => {
        if (!section) {
            navigate(`/${portfolio}/${org}/schd/agent`);
        }
    }, [section, navigate, portfolio, org, tool]);

    // Don't render anything if section is undefined (will redirect)
    if (!section) {
        return null;
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
        
          <div className="flex flex-col sm:gap-2 sm:pl-2">

            {section === 'schd_jobs' && <ToolDataCRUD readonly={false} portfolio={portfolio} org={org} tool={tool} ring={section} />}
            {section === 'schd_runs' && <ToolDataCRUD readonly={true} portfolio={portfolio} org={org} tool={tool} ring={section} />}
            {section === 'schd_rules' && <ToolDataCRUD readonly={false} portfolio={portfolio} org={org} tool={tool} ring={section} />}
            {section === 'schd_actions' && <ToolDataCRUD readonly={false} portfolio={portfolio} org={org} tool={tool} ring={section} />}
            {section === 'schd_tools' && <ToolDataCRUD readonly={false} portfolio={portfolio} org={org} tool={tool} ring={section} />}

            {section === 'agent' && <SchdLoop portfolio={portfolio} org={org} tool={tool} tree={tree} query={query} />}
            {section === 'action' && <SchdActionProbe portfolio={portfolio} org={org} tool={tool} />}
            {section === 'tool' && <SchdToolProbe portfolio={portfolio} org={org} tool={tool} />}

          </div>
        </div>
    )
}